import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ApiError } from "../http/problem-details.js";

function formatPath(path: (string | number)[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === "number") return `${acc}[${key}]`;
    return acc ? `${acc}.${key}` : key;
  }, "");
}

/**
 * Validate `req.body` against a Zod schema. On failure throws an `ApiError`
 * (handled by the global error middleware) → 400 with field-level errors.
 * `code` lets each module keep its own error code.
 */
export function validateBody(schema: ZodTypeAny, code = "VALIDATION_ERROR") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(
        new ApiError({
          title: "Validation error",
          status: 400,
          code,
          detail: "Request body failed validation.",
          errors: parsed.error.issues.map((issue) => ({
            field: formatPath(issue.path),
            message: issue.message,
          })),
        }),
      );
    }
    req.body = parsed.data;
    next();
  };
}
