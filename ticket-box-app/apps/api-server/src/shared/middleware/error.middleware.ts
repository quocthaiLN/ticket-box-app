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
