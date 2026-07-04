import type { NextFunction, Request, Response } from "express";
import { Errors } from "../http/problem-details.js";

export type Role = "AUDIENCE" | "ORGANIZER" | "CHECKER" | "ADMIN";

export function requireRole(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const currentRole = res.locals.auth?.role as Role | undefined;

    if (!currentRole || !roles.includes(currentRole)) {
      next(Errors.forbidden("Role is not allowed to access this resource."));
      return;
    }

    next();
  };
}
