export type ProblemDetails = {
  title: string;
  status: number;
  code: string;
  detail: string;
  instance?: string;
  request_id?: string;
  errors?: Array<{ field: string; message: string }>;
};

export class ApiError extends Error {
  constructor(public problem: Omit<ProblemDetails, "request_id">) {
    super(problem.detail);
  }
}

export function problem(details: ProblemDetails): ProblemDetails {
  return details;
}

// ---------------------------------------------------------------------------
// Error catalog — factory functions cho từng domain error
// ---------------------------------------------------------------------------

export const Errors = {
  // Auth
  invalidCredentials: () =>
    new ApiError({
      title: "Invalid credentials",
      status: 401,
      code: "INVALID_CREDENTIALS",
      detail: "Email or password is incorrect.",
    }),

  tokenExpired: () =>
    new ApiError({
      title: "Token expired",
      status: 401,
      code: "TOKEN_EXPIRED",
      detail: "Access token has expired. Please refresh.",
    }),

  tokenRevoked: () =>
    new ApiError({
      title: "Token revoked",
      status: 401,
      code: "TOKEN_REVOKED",
      detail: "This token has been revoked. Please log in again.",
    }),

  unauthorized: (detail = "Authentication required.") =>
    new ApiError({
      title: "Unauthorized",
      status: 401,
      code: "UNAUTHORIZED",
      detail,
    }),

  forbidden: (detail = "You do not have permission to access this resource.") =>
    new ApiError({
      title: "Forbidden",
      status: 403,
      code: "FORBIDDEN",
      detail,
    }),

  emailAlreadyExists: () =>
    new ApiError({
      title: "Email already exists",
      status: 409,
      code: "EMAIL_ALREADY_EXISTS",
      detail: "An account with this email already exists.",
    }),

  invalidRole: () =>
    new ApiError({
      title: "Invalid role",
      status: 422,
      code: "INVALID_ROLE",
      detail: "Role must be one of AUDIENCE, ORGANIZER, CHECKER, ADMIN.",
    }),

  // Resource
  notFound: (resource = "Resource") =>
    new ApiError({
      title: "Not found",
      status: 404,
      code: "NOT_FOUND",
      detail: `${resource} not found.`,
    }),

  // Request
  validationError: (
    detail: string,
    errors?: Array<{ field: string; message: string }>,
    code = "VALIDATION_ERROR",
  ) =>
    new ApiError({
      title: "Validation error",
      status: 400,
      code,
      detail,
      errors,
    }),

  fieldValidationError: (field: string, message: string) =>
    new ApiError({
      title: "Validation error",
      status: 422,
      code: "VALIDATION_ERROR",
      detail: message,
      errors: [{ field, message }],
    }),

  badRequest: (detail: string) =>
    new ApiError({
      title: "Bad request",
      status: 400,
      code: "BAD_REQUEST",
      detail,
    }),

  // Rate limiting
  rateLimited: (retryAfter?: number) =>
    new ApiError({
      title: "Too many requests",
      status: 429,
      code: "RATE_LIMITED",
      detail: retryAfter
        ? `Rate limit exceeded. Retry after ${retryAfter} seconds.`
        : "Rate limit exceeded.",
    }),

  // Idempotency
  idempotencyInProgress: () =>
    new ApiError({
      title: "Request in progress",
      status: 409,
      code: "IDEMPOTENCY_IN_PROGRESS",
      detail:
        "A request with the same Idempotency-Key is currently being processed.",
    }),

  missingIdempotencyKey: () =>
    new ApiError({
      title: "Missing Idempotency-Key",
      status: 400,
      code: "MISSING_IDEMPOTENCY_KEY",
      detail: "This endpoint requires an Idempotency-Key header.",
    }),

  // Inventory / Orders
  oversold: () =>
    new ApiError({
      title: "Not enough tickets",
      status: 409,
      code: "OVERSOLD",
      detail: "The requested quantity exceeds available inventory.",
    }),

  maxPerUserExceeded: () =>
    new ApiError({
      title: "Purchase limit reached",
      status: 409,
      code: "MAX_PER_USER_EXCEEDED",
      detail:
        "You have reached the maximum ticket purchase limit for this event.",
    }),

  orderNotFound: (orderId: string) =>
    new ApiError({
      title: "Order not found",
      status: 404,
      code: "NOT_FOUND",
      detail: `Order ${orderId} not found or does not belong to you.`,
    }),

  // Payment
  paymentFailed: (detail = "Payment processing failed.") =>
    new ApiError({
      title: "Payment failed",
      status: 422,
      code: "PAYMENT_FAILED",
      detail,
    }),

  serviceUnavailable: (
    detail = "A downstream service is temporarily unavailable.",
  ) =>
    new ApiError({
      title: "Service unavailable",
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      detail,
    }),

  // Check-in
  alreadyCheckedIn: () =>
    new ApiError({
      title: "Already checked in",
      status: 409,
      code: "ALREADY_CHECKED_IN",
      detail: "This ticket has already been scanned.",
    }),

  wrongGate: (detail = "This ticket is not valid for this gate.") =>
    new ApiError({
      title: "Wrong gate",
      status: 409,
      code: "WRONG_GATE",
      detail,
    }),

  invalidTicket: () =>
    new ApiError({
      title: "Invalid ticket",
      status: 422,
      code: "INVALID_TICKET",
      detail: "The QR code does not correspond to a valid ticket.",
    }),

  // Auth - account state
  accountInactive: () =>
    new ApiError({
      title: "Account inactive",
      status: 403,
      code: "FORBIDDEN",
      detail: "Your account is not active. Please contact support.",
    }),

  // Catalog
  cannotPublishConcert: () =>
    new ApiError({
      title: "Cannot publish concert",
      status: 422,
      code: "CANNOT_PUBLISH_CONCERT",
      detail:
        "Concert must have a valid time range, at least one seat zone, and at least one ticket type.",
    }),

  organizerNotFound: () =>
    new ApiError({
      title: "Organizer not found",
      status: 422,
      code: "ORGANIZER_NOT_FOUND",
      detail: "A valid organizer user is required to create a concert.",
    }),

  invalidConcertTimeRange: () =>
    new ApiError({
      title: "Invalid concert time range",
      status: 422,
      code: "INVALID_CONCERT_TIME_RANGE",
      detail: "ends_at must be later than starts_at.",
    }),

  invalidSaleWindow: () =>
    new ApiError({
      title: "Invalid sale window",
      status: 422,
      code: "INVALID_SALE_WINDOW",
      detail: "sale_end_at must be later than sale_start_at.",
    }),

  concertNotFound: (id?: string) =>
    new ApiError({
      title: "Concert not found",
      status: 404,
      code: "CONCERT_NOT_FOUND",
      detail: id
        ? `concert ${id} does not exist or is not accessible.`
        : "Concert was not found.",
    }),

  seatZoneNotFound: (id?: string) =>
    new ApiError({
      title: "Seat zone not found",
      status: 404,
      code: "SEAT_ZONE_NOT_FOUND",
      detail: id
        ? `seat_zone ${id} does not exist or is not accessible.`
        : "Seat zone was not found.",
    }),

  seatZoneNotFoundForConcert: () =>
    new ApiError({
      title: "Seat zone not found",
      status: 422,
      code: "SEAT_ZONE_NOT_FOUND",
      detail: "Seat zone was not found for this concert.",
    }),

  zoneCapacityExceeded: () =>
    new ApiError({
      title: "Zone capacity exceeded",
      status: 422,
      code: "ZONE_CAPACITY_EXCEEDED",
      detail:
        "Configured ticket quantity would exceed the seat zone capacity.",
    }),

  invalidCatalogRequest: (field: string, message: string) =>
    new ApiError({
      title: "Invalid catalog request",
      status: 400,
      code: "INVALID_CATALOG_REQUEST",
      detail: message,
      errors: [{ field, message }],
    }),

  // Tickets
  ticketNotFound: () =>
    new ApiError({
      title: "Ticket not found",
      status: 404,
      code: "TICKET_NOT_FOUND",
      detail: "Ticket not found.",
    }),

  ticketAccessDenied: () =>
    new ApiError({
      title: "Ticket access denied",
      status: 403,
      code: "TICKET_ACCESS_DENIED",
      detail: "Access denied to this ticket.",
    }),

  ticketNotUsable: () =>
    new ApiError({
      title: "Ticket not usable",
      status: 422,
      code: "TICKET_NOT_USABLE",
      detail: "Ticket is cancelled or refunded.",
    }),

  ticketsAlreadyIssued: () =>
    new ApiError({
      title: "Tickets already issued",
      status: 409,
      code: "TICKETS_ALREADY_ISSUED",
      detail: "Partial ticket records exist.",
    }),

  orderNotConfirmed: (status: string) =>
    new ApiError({
      title: "Order not confirmed",
      status: 422,
      code: "ORDER_NOT_CONFIRMED",
      detail: `Order is in status ${status}.`,
    }),

  paymentNotSucceeded: () =>
    new ApiError({
      title: "Payment not succeeded",
      status: 422,
      code: "PAYMENT_NOT_SUCCEEDED",
      detail: "No succeeded payment found for this order.",
    }),

  // Orders
  orderNotFoundById: () =>
    new ApiError({
      title: "Order not found",
      status: 404,
      code: "ORDER_NOT_FOUND",
      detail: "Order not found.",
    }),

  orderAccessDenied: () =>
    new ApiError({
      title: "Order access denied",
      status: 403,
      code: "ORDER_ACCESS_DENIED",
      detail: "Access denied to this order.",
    }),

  orderNotHeld: (detail = "Order is not in HELD status.") =>
    new ApiError({
      title: "Order not held",
      status: 422,
      code: "ORDER_NOT_HELD",
      detail,
    }),

  orderNotHeldConflict: (status: string) =>
    new ApiError({
      title: "Order not held",
      status: 409,
      code: "ORDER_NOT_HELD",
      detail: `Order is in status ${status}.`,
    }),

  orderAlreadyFinalized: (status: string) =>
    new ApiError({
      title: "Order already finalized",
      status: 409,
      code: "ORDER_ALREADY_FINALIZED",
      detail: `Order is in status ${status} and cannot be cancelled.`,
    }),

  ticketTypeNotFound: (id?: string) =>
    new ApiError({
      title: "Ticket type not found",
      status: 404,
      code: "TICKET_TYPE_NOT_FOUND",
      detail: id
        ? `Ticket type ${id} not found.`
        : "One or more ticket types not found.",
    }),

  ticketTypeNotOnSale: (id: string, detail?: string) =>
    new ApiError({
      title: "Ticket type not on sale",
      status: 422,
      code: "TICKET_TYPE_NOT_ON_SALE",
      detail: detail ?? `Ticket type ${id} is not on sale.`,
    }),

  ticketSoldOut: (id?: string) =>
    new ApiError({
      title: "Ticket sold out",
      status: 409,
      code: "TICKET_SOLD_OUT",
      detail: id
        ? `Not enough available tickets for type ${id}.`
        : "Not enough available tickets.",
    }),

  inventoryError: (detail?: string) =>
    new ApiError({
      title: "Inventory error",
      status: 500,
      code: "INVENTORY_ERROR",
      detail: detail ?? "An inventory error occurred.",
    }),

  perUserLimitExceeded: (id?: string) =>
    new ApiError({
      title: "Per-user limit exceeded",
      status: 422,
      code: "PER_USER_LIMIT_EXCEEDED",
      detail: id
        ? `Purchase would exceed per-user limit for ticket type ${id}.`
        : "Purchase would exceed per-user limit.",
    }),

  invalidCursor: () =>
    new ApiError({
      title: "Invalid cursor",
      status: 400,
      code: "INVALID_CHECKOUT_REQUEST",
      detail: "Invalid cursor.",
    }),

  // Payments
  paymentAlreadyPending: () =>
    new ApiError({
      title: "Payment already pending",
      status: 409,
      code: "PAYMENT_ALREADY_PENDING",
      detail: "An active pending payment already exists for this order.",
    }),

  // Notifications
  notificationNotFound: (id: string) =>
    new ApiError({
      title: "Notification not found",
      status: 404,
      code: "NOTIFICATION_NOT_FOUND",
      detail: `Notification ${id} not found.`,
    }),

  notificationNotRetryable: (currentStatus: string) =>
    new ApiError({
      title: "Notification not retryable",
      status: 409,
      code: "NOTIFICATION_NOT_RETRYABLE",
      detail: `Only FAILED notifications can be retried. Current status: ${currentStatus}.`,
    }),

  // Check-in / Devices
  deviceNotFound: () =>
    new ApiError({
      title: "Device not found",
      status: 404,
      code: "DEVICE_NOT_FOUND",
      detail: "Device was not found.",
    }),

  gateNotFound: (detail = "Gate was not found.") =>
    new ApiError({
      title: "Gate not found",
      status: 404,
      code: "GATE_NOT_FOUND",
      detail,
    }),

  invalidMappingId: () =>
    new ApiError({
      title: "Invalid mapping id",
      status: 400,
      code: "INVALID_MAPPING_ID",
      detail: "Mapping id must be formatted as gate_id:seat_zone_id.",
    }),

  gateMappingNotFound: () =>
    new ApiError({
      title: "Mapping not found",
      status: 404,
      code: "MAPPING_NOT_FOUND",
      detail: "Gate-zone mapping was not found.",
    }),

  deviceNotAssigned: () =>
    new ApiError({
      title: "Device not assigned",
      status: 422,
      code: "DEVICE_NOT_ASSIGNED",
      detail: "Device is not active or is not assigned to this concert/gate.",
    }),

  invalidOfflineBatch: () =>
    new ApiError({
      title: "Invalid offline batch",
      status: 422,
      code: "INVALID_OFFLINE_BATCH",
      detail:
        "device_id, concert_id, and gate_id are required for a new offline batch.",
    }),

  // Guest List
  invalidCsv: (
    detail = "file_object_key or file_url is required to create a guest import job.",
  ) =>
    new ApiError({
      title: "Invalid CSV",
      status: 400,
      code: "INVALID_CSV",
      detail,
    }),

  // Internal
  internalError: () =>
    new ApiError({
      title: "Internal server error",
      status: 500,
      code: "INTERNAL_ERROR",
      detail: "An unexpected error occurred. Please try again later.",
    }),

  notImplemented: (feature: string) =>
    new ApiError({
      title: "Not implemented",
      status: 501,
      code: "NOT_IMPLEMENTED",
      detail: `${feature} is not yet implemented.`,
    }),
};
