import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { Errors } from "../http/problem-details.js";

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
        Errors.validationError(
          "Request body failed validation.",
          parsed.error.issues.map((issue) => ({
            field: formatPath(issue.path),
            message: issue.message,
          })),
          code,
        ),
      );
    }
    req.body = parsed.data;
    next();
  };
}

/**
 * Validate `req.query` against a Zod schema (vd webhook/return chạy bằng GET).
 * Trùng hành vi với `validateBody`: hỏng → 400 với lỗi theo field; thành công thì
 * gán lại `req.query` bằng dữ liệu đã parse (đã ép kiểu, vd string -> number).
 */
export function validateQuery(schema: ZodTypeAny, code = "VALIDATION_ERROR") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return next(
        Errors.validationError(
          "Request query failed validation.",
          parsed.error.issues.map((issue) => ({
            field: formatPath(issue.path),
            message: issue.message,
          })),
          code,
        ),
      );
    }
    req.query = parsed.data;
    next();
  };
}
