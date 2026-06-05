import type { NextFunction, Request, Response } from "express";

export type Role = "AUDIENCE" | "ORGANIZER" | "CHECKER" | "ADMIN";

export function requireRole(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const currentRole = res.locals.auth?.role as Role | undefined;

    if (!currentRole || !roles.includes(currentRole)) {
      res.status(403).type("application/problem+json").json({
        type: "https://api.ticketbox.vn/errors/forbidden",
        title: "Forbidden",
        status: 403,
        code: "FORBIDDEN",
        detail: "Role is not allowed to access this resource.",
        request_id: _req.requestId
      });
      return;
    }

    next();
  };
}
