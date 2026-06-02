import type { NextFunction, Request, Response } from "express";

export function requireAuth(_req: Request, res: Response, next: NextFunction) {
  res.locals.auth = {
    user_id: "stub_user",
    role: "ADMIN"
  };
  next();
}
