import type { ErrorRequestHandler } from "express";
import { ApiError, problem } from "../http/problem-details.js";

export const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res
      .status(err.problem.status)
      .type("application/problem+json")
      .json(
        problem({
          ...err.problem,
          request_id: req.requestId,
          instance: err.problem.instance ?? req.originalUrl,
        }),
      );
    return;
  }

  // Domain errors mang sẵn statusCode + code (vd TicketError, InventoryError, ...).
  // Yêu cầu cả hai để không bắt nhầm lỗi Prisma/Node (có `code` nhưng không có statusCode).
  if (typeof err?.statusCode === "number" && typeof err?.code === "string") {
    res
      .status(err.statusCode)
      .type("application/problem+json")
      .json(
        problem({
          title: typeof err.title === "string" ? err.title : err.code,
          status: err.statusCode,
          code: err.code,
          detail:
            typeof err.message === "string" ? err.message : "Request failed.",
          errors: Array.isArray(err.errors) ? err.errors : undefined,
          instance: req.originalUrl,
          request_id: req.requestId,
        }),
      );
    return;
  }

  res
    .status(500)
    .type("application/problem+json")
    .json(
      problem({
        title: "Internal server error",
        status: 500,
        code: "INTERNAL_ERROR",
        detail: "Unexpected server error.",
        instance: req.originalUrl,
        request_id: req.requestId,
      }),
    );
};
