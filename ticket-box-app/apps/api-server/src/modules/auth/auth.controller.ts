import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../shared/http/problem-details.js";

export function handleRegister(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  next(notImplemented("Auth register"));
}

export function handleLogin(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  next(notImplemented("Auth login"));
}

export function handleLogout(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  next(notImplemented("Auth logout"));
}

export function handleMe(_req: Request, _res: Response, next: NextFunction) {
  next(notImplemented("Auth me"));
}

export function handleRefresh(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  next(notImplemented("Auth refresh"));
}

function notImplemented(feature: string) {
  return new ApiError({
    type: "https://api.ticketbox.vn/errors/not-implemented",
    title: "Not implemented",
    status: 501,
    code: "NOT_IMPLEMENTED",
    detail: `${feature} is scaffolded for Sprint 1 and pending Sprint 2 implementation.`,
  });
}
