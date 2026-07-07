import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ConcertStatus,
  Prisma,
  TicketTypeStatus,
  prisma,
} from "@ticketbox/database";
import { invalidateConcertCache } from "@ticketbox/redis";

export type AutoPublishSchedulerOptions = {
  interval_ms?: number;
  batch_size?: number;
};

type AutoPublishCandidate = {
  id: string;
  title: string;
  slug: string;
  startsAt: Date;
  endsAt: Date;
  plannedPublishAt: Date | null;
};

type AutoPublishResult =
  | {
      status: "published";
      concert: AutoPublishCandidate;
      ticketTypesOpened: number;
    }
  | {
      status: "skipped";
      concertId: string;
      reason: string;
    };

export function startAutoPublishScheduler(
  options: AutoPublishSchedulerOptions = {},
): NodeJS.Timeout {
  const intervalMs = options.interval_ms ?? 60_000;
  const batchSize = options.batch_size ?? 25;

  console.log(
    `[auto-publish] Started, checking every ${intervalMs / 1000}s, batch=${batchSize}`,
  );

  const tick = async () => {
    try {
      await runAutoPublishTick(batchSize);
    } catch (err) {
      console.error("[auto-publish] Tick error:", err);
    }
  };

  const timer = setInterval(() => void tick(), Math.max(intervalMs, 5_000));
  void tick();
  return timer;
}

export async function runAutoPublishTick(batchSize = 25): Promise<void> {
  const now = new Date();
  const candidates = await prisma.concert.findMany({
    where: {
      status: ConcertStatus.DRAFT,
      plannedPublishAt: { not: null, lte: now },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      plannedPublishAt: true,
    },
    orderBy: { plannedPublishAt: "asc" },
    take: batchSize,
  });

  if (candidates.length === 0) return;

  console.log(`[auto-publish] Found ${candidates.length} due concert(s)`);

  for (const candidate of candidates) {
    const result = await publishCandidate(candidate.id, now).catch((err) => {
      console.error(
        `[auto-publish] Failed for concert=${candidate.id}:`,
        err,
      );
      return null;
    });

    if (!result) continue;

    if (result.status === "skipped") {
      console.warn(
        `[auto-publish] Skipped concert=${result.concertId}: ${result.reason}`,
      );
      continue;
    }

    await Promise.allSettled([
      invalidateConcertCache(result.concert.id),
      recordAutoPublishAudit(result),
    ]);

    console.log(
      `[auto-publish] Published "${result.concert.title}" (${result.concert.id}), opened_ticket_types=${result.ticketTypesOpened}`,
    );
  }
}

async function publishCandidate(
  concertId: string,
  now: Date,
): Promise<AutoPublishResult> {
  return prisma.$transaction(async (tx) => {
    const concert = await tx.concert.findFirst({
      where: {
        id: concertId,
        status: ConcertStatus.DRAFT,
        plannedPublishAt: { not: null, lte: now },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        startsAt: true,
        endsAt: true,
        plannedPublishAt: true,
        _count: {
          select: {
            seatZones: true,
            ticketTypes: true,
          },
        },
      },
    });

    if (!concert) {
      return {
        status: "skipped",
        concertId,
        reason: "not_draft_or_not_due",
      };
    }

    if (concert.endsAt <= concert.startsAt) {
      return { status: "skipped", concertId, reason: "invalid_time_range" };
    }

    if (concert._count.seatZones === 0) {
      return { status: "skipped", concertId, reason: "missing_seat_zone" };
    }

    if (concert._count.ticketTypes === 0) {
      return { status: "skipped", concertId, reason: "missing_ticket_type" };
    }

    const updated = await tx.concert.updateMany({
      where: {
        id: concert.id,
        status: ConcertStatus.DRAFT,
        plannedPublishAt: { not: null, lte: now },
      },
      data: { status: ConcertStatus.PUBLISHED },
    });

    if (updated.count === 0) {
      return { status: "skipped", concertId, reason: "already_changed" };
    }

    const ticketTypes = await tx.ticketType.updateMany({
      where: {
        concertId: concert.id,
        status: TicketTypeStatus.DRAFT,
      },
      data: { status: TicketTypeStatus.ON_SALE },
    });

    return {
      status: "published",
      concert: {
        id: concert.id,
        title: concert.title,
        slug: concert.slug,
        startsAt: concert.startsAt,
        endsAt: concert.endsAt,
        plannedPublishAt: concert.plannedPublishAt,
      },
      ticketTypesOpened: ticketTypes.count,
    };
  });
}

async function recordAutoPublishAudit(
  result: Extract<AutoPublishResult, { status: "published" }>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: null,
        action: AUDIT_ACTIONS.CONCERT_AUTO_PUBLISHED,
        entityType: AUDIT_ENTITY_TYPES.CONCERT,
        entityId: result.concert.id,
        metadata: {
          source: "worker_auto_publish_scheduler",
          slug: result.concert.slug,
          planned_publish_at: result.concert.plannedPublishAt?.toISOString(),
          starts_at: result.concert.startsAt.toISOString(),
          ends_at: result.concert.endsAt.toISOString(),
          ticket_types_opened: result.ticketTypesOpened,
        } as Prisma.InputJsonObject,
      },
    });
  } catch (err) {
    console.error(
      `[auto-publish] Failed to write audit for concert=${result.concert.id}:`,
      err,
    );
  }
}
