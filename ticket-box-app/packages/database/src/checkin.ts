import { CheckinResult, Prisma, TicketStatus } from "@prisma/client";
import type { PrismaClient, Ticket } from "@prisma/client";

import { prisma } from "./client.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

type TicketAccessRow = {
  id: string;
  concertId: string;
  zoneId: string;
  qrTokenHash: string;
  status: string;
};

export type GateZoneValidationErrorCode =
  | "GATE_ZONE_NOT_MAPPED"
  | "GATE_INACTIVE"
  | "GATE_ZONE_VENUE_MISMATCH"
  | "CONCERT_NOT_FOUND"
  | "CONCERT_VENUE_MISMATCH"
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
  zoneId: string;
  concertId?: string;
};

export type GateZoneValidationResult = {
  gateId: string;
  zoneId: string;
  venueId: string;
  concertId?: string;
};

export async function assertGateAllowsZone(
  input: GateZoneValidationInput,
  db: DbClient = prisma,
): Promise<GateZoneValidationResult> {
  const mapping = await db.gateZone.findUnique({
    where: {
      gateId_zoneId: {
        gateId: input.gateId,
        zoneId: input.zoneId,
      },
    },
    select: {
      gateId: true,
      zoneId: true,
      gate: {
        select: {
          venueId: true,
          isActive: true,
        },
      },
      zone: {
        select: {
          venueId: true,
        },
      },
    },
  });

  if (!mapping) {
    throw new GateZoneValidationError(
      "GATE_ZONE_NOT_MAPPED",
      "Gate is not allowed to check in tickets for this zone.",
    );
  }

  if (!mapping.gate.isActive) {
    throw new GateZoneValidationError(
      "GATE_INACTIVE",
      "Gate is inactive.",
    );
  }

  if (mapping.gate.venueId !== mapping.zone.venueId) {
    throw new GateZoneValidationError(
      "GATE_ZONE_VENUE_MISMATCH",
      "Gate and zone must belong to the same venue.",
    );
  }

  if (input.concertId) {
    const concert = await db.concert.findUnique({
      where: { id: input.concertId },
      select: { venueId: true },
    });

    if (!concert) {
      throw new GateZoneValidationError(
        "CONCERT_NOT_FOUND",
        "Concert was not found.",
      );
    }

    if (concert.venueId !== mapping.gate.venueId) {
      throw new GateZoneValidationError(
        "CONCERT_VENUE_MISMATCH",
        "Gate venue does not match the concert venue.",
      );
    }
  }

  return {
    gateId: mapping.gateId,
    zoneId: mapping.zoneId,
    venueId: mapping.gate.venueId,
    concertId: input.concertId,
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

  return db.$transaction(
    async (tx) => {
      const rows = input.ticketId
        ? await tx.$queryRaw<TicketAccessRow[]>(Prisma.sql`
            SELECT
              id AS "id",
              concert_id AS "concertId",
              zone_id AS "zoneId",
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
              zone_id AS "zoneId",
              qr_token_hash AS "qrTokenHash",
              status::text AS "status"
            FROM tickets
            WHERE qr_token_hash = ${input.qrTokenHash}
            FOR UPDATE
          `);

      const ticket = rows[0];

      if (!ticket) {
        throw new GateZoneValidationError(
          "TICKET_NOT_FOUND",
          "Ticket was not found.",
        );
      }

      if (input.concertId && ticket.concertId !== input.concertId) {
        throw new GateZoneValidationError(
          "WRONG_CONCERT",
          "Ticket does not belong to the requested concert.",
        );
      }

      await assertGateAllowsZone(
        {
          gateId: input.gateId,
          zoneId: ticket.zoneId,
          concertId: ticket.concertId,
        },
        tx,
      );

      const status = String(ticket.status).toLowerCase();

      if (status === "checked_in" || ticket.status === TicketStatus.CHECKED_IN) {
        throw new GateZoneValidationError(
          "TICKET_ALREADY_CHECKED_IN",
          "Ticket has already been checked in.",
        );
      }

      if (status !== "issued" && ticket.status !== TicketStatus.ISSUED) {
        throw new GateZoneValidationError(
          "TICKET_NOT_CHECKIN_READY",
          "Ticket is not in an issued state.",
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
          zoneId: ticket.zoneId,
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
}
