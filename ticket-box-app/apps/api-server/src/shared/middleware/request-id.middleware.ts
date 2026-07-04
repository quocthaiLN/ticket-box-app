import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerRequestId = req.header("X-Request-Id");
  req.requestId = headerRequestId && headerRequestId.trim().length > 0 ? headerRequestId : `req_${randomUUID()}`;
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
