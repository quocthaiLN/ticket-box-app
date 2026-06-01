import { CheckinResult, Prisma, TicketStatus } from "@prisma/client";
import type { PrismaClient, Ticket } from "@prisma/client";

import { prisma } from "./client.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

type TicketAccessRow = {
  id: string;
  concertId: string;
  seatZoneId: string;
  qrTokenHash: string;
  status: string;
};

export type GateZoneValidationErrorCode =
  | "GATE_ZONE_NOT_MAPPED"
  | "GATE_INACTIVE"
  | "GATE_CONCERT_MISMATCH"
  | "TICKET_NOT_FOUND"
  | "WRONG_CONCERT"
  | "TICKET_ALREADY_CHECKED_IN"
  | "TICKET_NOT_CHECKIN_READY";

export class GateZoneValidationError extends Error {
  constructor(
    public readonly code: GateZoneValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GateZoneValidationError";
  }
}

export type GateZoneValidationInput = {
  gateId: string;
  seatZoneId: string;
  concertId?: string;
};

export type GateZoneValidationResult = {
  gateId: string;
  seatZoneId: string;
  concertId: string;
};

export async function assertGateAllowsZone(
  input: GateZoneValidationInput,
  db: DbClient = prisma,
): Promise<GateZoneValidationResult> {
  const mapping = await db.checkinGateZone.findUnique({
    where: {
      gateId_seatZoneId: {
        gateId: input.gateId,
        seatZoneId: input.seatZoneId,
      },
    },
    select: {
      gateId: true,
      seatZoneId: true,
      concertId: true,
      gate: {
        select: {
          concertId: true,
          isActive: true,
        },
      },
      seatZone: {
        select: {
          concertId: true,
        },
      },
    },
  });

  if (!mapping) {
    throw new GateZoneValidationError(
      "GATE_ZONE_NOT_MAPPED",
      "Gate is not allowed to check in tickets for this seat zone.",
    );
  }

  if (!mapping.gate.isActive) {
    throw new GateZoneValidationError("GATE_INACTIVE", "Gate is inactive.");
  }

  if (
    mapping.gate.concertId !== mapping.concertId ||
    mapping.seatZone.concertId !== mapping.concertId ||
    (input.concertId && mapping.concertId !== input.concertId)
  ) {
    throw new GateZoneValidationError(
      "GATE_CONCERT_MISMATCH",
      "Gate, seat zone, and concert must match.",
    );
  }

  return {
    gateId: mapping.gateId,
    seatZoneId: mapping.seatZoneId,
    concertId: mapping.concertId,
  };
}

export type CheckInTicketAtGateInput = {
  gateId: string;
  ticketId?: string;
  qrTokenHash?: string;
  concertId?: string;
  deviceId?: string;
  staffId?: string;
  scannedAt?: Date;
  metadata?: Prisma.InputJsonValue;
};

type RejectedCheckinLogDetails = {
  input: CheckInTicketAtGateInput;
  result: CheckinResult;
  reason: string;
  ticket?: TicketAccessRow;
  fallbackConcertId?: string;
};

class CheckinRejectedAuditError extends Error {
  constructor(
    public readonly originalError: GateZoneValidationError,
    public readonly logDetails: RejectedCheckinLogDetails,
  ) {
    super(originalError.message);
    this.name = "CheckinRejectedAuditError";
  }
}

function rejectWithAudit(
  originalError: GateZoneValidationError,
  logDetails: RejectedCheckinLogDetails,
): never {
  throw new CheckinRejectedAuditError(originalError, logDetails);
}

async function findLoggableGateId(
  db: DbClient,
  gateId: string,
  concertId: string,
): Promise<string | undefined> {
  const gate = await db.checkinGate.findUnique({
    where: {
      id_concertId: {
        id: gateId,
        concertId,
      },
    },
    select: { id: true },
  });

  return gate?.id;
}

async function createRejectedCheckinLog(
  db: DbClient,
  input: CheckInTicketAtGateInput,
  result: CheckinResult,
  reason: string,
  ticket?: TicketAccessRow,
  fallbackConcertId?: string,
): Promise<void> {
  const concertId = ticket?.concertId ?? fallbackConcertId;

  if (!concertId) {
    return;
  }

  if (!ticket) {
    const concert = await db.concert.findUnique({
      where: { id: concertId },
      select: { id: true },
    });

    if (!concert) {
      return;
    }
  }

  const gateId = await findLoggableGateId(db, input.gateId, concertId);

  await db.checkinLog.create({
    data: {
      ticketId: ticket?.id,
      concertId,
      seatZoneId: ticket?.seatZoneId,
      gateId,
      deviceId: input.deviceId,
      staffId: input.staffId,
      scanTokenHash: ticket?.qrTokenHash ?? input.qrTokenHash,
      result,
      reason,
      scannedAt: input.scannedAt ?? new Date(),
      metadata: input.metadata,
    },
  });
}

export async function checkInTicketAtGate(
  input: CheckInTicketAtGateInput,
  db: PrismaClient = prisma,
): Promise<Ticket> {
  if (!input.ticketId && !input.qrTokenHash) {
    throw new GateZoneValidationError(
      "TICKET_NOT_FOUND",
      "Either ticketId or qrTokenHash is required.",
    );
  }

  try {
    return await db.$transaction(
      async (tx) => {
        const rows = input.ticketId
          ? await tx.$queryRaw<TicketAccessRow[]>(Prisma.sql`
              SELECT
                id AS "id",
                concert_id AS "concertId",
                seat_zone_id AS "seatZoneId",
                qr_token_hash AS "qrTokenHash",
                status::text AS "status"
              FROM tickets
              WHERE id = ${input.ticketId}::uuid
              FOR UPDATE
            `)
          : await tx.$queryRaw<TicketAccessRow[]>(Prisma.sql`
              SELECT
                id AS "id",
                concert_id AS "concertId",
                seat_zone_id AS "seatZoneId",
                qr_token_hash AS "qrTokenHash",
                status::text AS "status"
              FROM tickets
              WHERE qr_token_hash = ${input.qrTokenHash}
              FOR UPDATE
            `);

        const ticket = rows[0];

        if (!ticket) {
          rejectWithAudit(
            new GateZoneValidationError(
              "TICKET_NOT_FOUND",
              "Ticket was not found.",
            ),
            {
              input,
              result: CheckinResult.INVALID_TICKET,
              reason: "TICKET_NOT_FOUND",
              fallbackConcertId: input.concertId,
            },
          );
        }

        if (input.concertId && ticket.concertId !== input.concertId) {
          rejectWithAudit(
            new GateZoneValidationError(
              "WRONG_CONCERT",
              "Ticket does not belong to the requested concert.",
            ),
            {
              input,
              result: CheckinResult.WRONG_CONCERT,
              reason: "WRONG_CONCERT",
              ticket,
            },
          );
        }

        try {
          await assertGateAllowsZone(
            {
              gateId: input.gateId,
              seatZoneId: ticket.seatZoneId,
              concertId: ticket.concertId,
            },
            tx,
          );
        } catch (error) {
          if (error instanceof GateZoneValidationError) {
            rejectWithAudit(error, {
              input,
              result: CheckinResult.WRONG_GATE,
              reason: error.code,
              ticket,
            });
          }

          throw error;
        }

        if (ticket.status === TicketStatus.CHECKED_IN) {
          rejectWithAudit(
            new GateZoneValidationError(
              "TICKET_ALREADY_CHECKED_IN",
              "Ticket has already been checked in.",
            ),
            {
              input,
              result: CheckinResult.ALREADY_CHECKED_IN,
              reason: "TICKET_ALREADY_CHECKED_IN",
              ticket,
            },
          );
        }

        if (ticket.status !== TicketStatus.ISSUED) {
          rejectWithAudit(
            new GateZoneValidationError(
              "TICKET_NOT_CHECKIN_READY",
              "Ticket is not in an issued state.",
            ),
            {
              input,
              result: CheckinResult.INVALID_TICKET,
              reason: `TICKET_NOT_CHECKIN_READY:${ticket.status}`,
              ticket,
            },
          );
        }

        const scannedAt = input.scannedAt ?? new Date();

        const updatedTicket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.CHECKED_IN,
            checkedInAt: scannedAt,
            checkedInById: input.staffId,
          },
        });

        await tx.checkinLog.create({
          data: {
            ticketId: ticket.id,
            concertId: ticket.concertId,
            seatZoneId: ticket.seatZoneId,
            gateId: input.gateId,
            deviceId: input.deviceId,
            staffId: input.staffId,
            scanTokenHash: ticket.qrTokenHash,
            result: CheckinResult.SUCCESS,
            scannedAt,
            metadata: input.metadata,
          },
        });

        return updatedTicket;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof CheckinRejectedAuditError) {
      try {
        await createRejectedCheckinLog(
          db,
          error.logDetails.input,
          error.logDetails.result,
          error.logDetails.reason,
          error.logDetails.ticket,
          error.logDetails.fallbackConcertId,
        );
      } catch {
        // Keep the check-in validation result stable even if audit logging fails.
      }

      throw error.originalError;
    }

    throw error;
  }
}
