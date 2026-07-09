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

  const unknownError = err as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    meta?: unknown;
    stack?: unknown;
  };

  // Không đưa chi tiết nội bộ vào HTTP response, nhưng phải ghi đủ dữ liệu để
  // phân biệt lỗi Prisma, PostgreSQL, timeout và lỗi lập trình khi điều tra.
  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_request_error",
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      error: {
        name:
          typeof unknownError.name === "string"
            ? unknownError.name
            : undefined,
        message:
          typeof unknownError.message === "string"
            ? unknownError.message
            : String(err),
        code:
          typeof unknownError.code === "string"
            ? unknownError.code
            : undefined,
        meta: unknownError.meta,
        stack:
          typeof unknownError.stack === "string"
            ? unknownError.stack
            : undefined,
      },
    }),
  );

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
