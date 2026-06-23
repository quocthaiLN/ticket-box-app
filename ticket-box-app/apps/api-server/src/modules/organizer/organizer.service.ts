import { ConcertStatus } from "@ticketbox/database";
import { ApiError, Errors } from "../../shared/http/problem-details.js";
import {
  OrganizerRepository,
  toConcertUpdateData,
} from "./organizer.repository.js";
import type {
  ApprovalStatusValue,
  ConcertStatusValue,
  CreateDeletionRequestInput,
  CreateOrganizerRequestInput,
  GuestStatusValue,
  ListQuery,
  OrderStatusValue,
  UpdateOrganizerConcertInput,
} from "./organizer.schema.js";

export class OrganizerService {
  constructor(private readonly repository = new OrganizerRepository()) {}

  listVenues(query: ListQuery) {
    return this.repository.listVenues(query);
  }

  listRequests(organizerId: string, query: ListQuery) {
    this.assertApprovalStatus(query.status);
    return this.repository.listRequests(organizerId, query);
  }

  async createRequest(organizerId: string, input: CreateOrganizerRequestInput) {
    this.assertTimeRange(input.starts_at, input.ends_at);
    if (input.planned_publish_at) {
      this.assertPlannedPublishAt(input.planned_publish_at, input.starts_at);
    }

    if (!(await this.repository.venueExists(input.venue_id))) {
      throw venueNotFound(input.venue_id);
    }

    return this.repository.createRequest(organizerId, input);
  }

  async getRequest(organizerId: string, requestId: string) {
    const request = await this.repository.getRequest(organizerId, requestId);
    if (!request) {
      throw Errors.organizerRequestNotFound(requestId);
    }

    return request;
  }

  listConcerts(organizerId: string, query: ListQuery) {
    this.assertConcertStatus(query.status);
    return this.repository.listConcerts(organizerId, query);
  }

  async updateDraftConcert(
    organizerId: string,
    concertId: string,
    input: UpdateOrganizerConcertInput,
  ) {
    const concert = await this.repository.getOwnedConcertForUpdate(organizerId, concertId);
    if (!concert) {
      throw Errors.concertNotFound(concertId);
    }

    if (concert.status !== ConcertStatus.DRAFT) {
      throw Errors.concertNotEditable(concertId);
    }

    const startsAt = input.starts_at ?? concert.startsAt.toISOString();
    const endsAt = input.ends_at ?? concert.endsAt.toISOString();
    this.assertTimeRange(startsAt, endsAt);

    if (input.planned_publish_at) {
      this.assertPlannedPublishAt(input.planned_publish_at, startsAt);
    }

    if (input.venue_id && !(await this.repository.venueExists(input.venue_id))) {
      throw venueNotFound(input.venue_id);
    }

    return this.repository.updateDraftConcert(concertId, toConcertUpdateData(input));
  }

  async createDeletionRequest(
    organizerId: string,
    concertId: string,
    input: CreateDeletionRequestInput,
  ) {
    const concert = await this.repository.getOwnedConcertForUpdate(organizerId, concertId);
    if (!concert) {
      throw Errors.concertNotFound(concertId);
    }

    return this.repository.createDeletionRequest(organizerId, concertId, input.reason);
  }

  async getAnalytics(organizerId: string, concertId: string) {
    const analytics = await this.repository.getAnalytics(organizerId, concertId);
    if (!analytics) {
      throw Errors.concertNotFound(concertId);
    }

    return analytics;
  }

  listOrders(organizerId: string, query: ListQuery) {
    this.assertOrderStatus(query.status);
    return this.repository.listOrders(organizerId, query);
  }

  async getTicketTypeInventory(organizerId: string, ticketTypeId: string) {
    const inventory = await this.repository.getTicketTypeInventory(organizerId, ticketTypeId);
    if (!inventory) {
      throw Errors.ticketTypeNotFound(ticketTypeId);
    }

    return inventory;
  }

  listCheckerAccounts(organizerId: string, query: ListQuery) {
    return this.repository.listCheckerAccounts(organizerId, query);
  }

  async listGuests(organizerId: string, concertId: string, query: ListQuery) {
    this.assertGuestStatus(query.status);
    const guests = await this.repository.listGuests(organizerId, concertId, query);
    if (!guests) {
      throw Errors.concertNotFound(concertId);
    }

    return guests;
  }

  private assertTimeRange(startsAt: string, endsAt: string) {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw Errors.invalidConcertTimeRange();
    }
  }

  private assertPlannedPublishAt(plannedPublishAt: string, startsAt: string) {
    if (new Date(plannedPublishAt) > new Date(startsAt)) {
      throw Errors.fieldValidationError(
        "planned_publish_at",
        "planned_publish_at must be earlier than or equal to starts_at.",
      );
    }
  }

  private assertApprovalStatus(status?: string) {
    if (!status) return;
    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      throw invalidQueryStatus("status must be one of PENDING, APPROVED, REJECTED.");
    }
  }

  private assertConcertStatus(status?: string) {
    if (!status) return;
    const allowed: ConcertStatusValue[] = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"];
    if (!allowed.includes(status as ConcertStatusValue)) {
      throw invalidQueryStatus("status must be one of DRAFT, PUBLISHED, CANCELLED, COMPLETED.");
    }
  }

  private assertOrderStatus(status?: string) {
    if (!status) return;
    const allowed: OrderStatusValue[] = ["HELD", "CONFIRMED", "CANCELLED", "EXPIRED"];
    if (!allowed.includes(status as OrderStatusValue)) {
      throw invalidQueryStatus("status must be one of HELD, CONFIRMED, CANCELLED, EXPIRED.");
    }
  }

  private assertGuestStatus(status?: string) {
    if (!status) return;
    const allowed: GuestStatusValue[] = ["INVITED", "CHECKED_IN", "CANCELLED"];
    if (!allowed.includes(status as GuestStatusValue)) {
      throw invalidQueryStatus("status must be one of INVITED, CHECKED_IN, CANCELLED.");
    }
  }
}

function venueNotFound(id: string) {
  return new ApiError({
    title: "Venue not found",
    status: 404,
    code: "VENUE_NOT_FOUND",
    detail: `Venue ${id} was not found.`,
  });
}

function invalidQueryStatus(detail: string) {
  return new ApiError({
    title: "Invalid status",
    status: 400,
    code: "BAD_REQUEST",
    detail,
  });
}
