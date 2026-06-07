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
  ) =>
    new ApiError({
      title: "Validation error",
      status: 400,
      code: "VALIDATION_ERROR",
      detail,
      errors,
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
