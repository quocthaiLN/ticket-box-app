import type { NextFunction, Request, Response } from "express";
import { ok } from "../../shared/http/response.js";
import { Errors } from "../../shared/http/problem-details.js";
import { authService } from "./auth.service.js";
import {
  loginSchema,
  registerSchema,
  requestOtpSchema,
  updateMeSchema,
  updateRoleByEmailSchema,
  updateRoleSchema,
} from "./auth.schema.js";
import { redirectPathForRole } from "./auth.utils.js";
import { z } from "zod";

const REFRESH_COOKIE = "refresh_token";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Production: frontend (Vercel) và API (Render) khác domain nên cookie phải
// `sameSite: "none"` + `secure` thì browser mới gửi kèm request cross-site.
// Dev (localhost) dùng `lax` + non-secure để chạy qua http. clearCookie phải
// dùng đúng options này, nếu không browser sẽ không xóa được cookie.
const isProd = process.env.NODE_ENV === "production";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ("none" as const) : ("lax" as const),
  path: "/v1/auth",
};

export async function handleRequestOtp(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = requestOtpSchema.parse(req.body);
    const result = await authService.requestOtp(body.email);
    res.status(200).json(ok(result, req.requestId));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(
        Errors.validationError(
          "Request body failed validation.",
          err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ),
      );
      return;
    }
    next(err);
  }
}

export async function handleRegister(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = registerSchema.parse(req.body);
    const user = await authService.register({
      email: body.email,
      password: body.password,
      full_name: body.full_name ?? "",
      otp: body.otp,
    });
    res.status(201).json(ok(user, req.requestId));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(
        Errors.validationError(
          "Request body failed validation.",
          err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ),
      );
      return;
    }
    next(err);
  }
}

export async function handleLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = loginSchema.parse(req.body);
    const { user, tokens } = await authService.login(body);

    res.cookie(REFRESH_COOKIE, tokens.refresh_token, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: COOKIE_MAX_AGE_MS,
    });

    res.status(200).json(
      ok(
        {
          access_token: tokens.access_token,
          expires_in: tokens.expires_in,
          user,
          redirect_to: redirectPathForRole(user.role),
        },
        req.requestId,
      ),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(
        Errors.validationError(
          "Request body failed validation.",
          err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ),
      );
      return;
    }
    next(err);
  }
}

export async function handleLogout(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    await authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
    res.status(204).send();
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
    next(err);
  }
}

export async function handleMe(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId: string = res.locals.auth?.user_id;
    const user = await authService.me(userId);
    res.status(200).json(ok(user, req.requestId));
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateMe(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId: string = res.locals.auth?.user_id;
    const body = updateMeSchema.parse(req.body);
    const updated = await authService.updateProfile(userId, {
      full_name: body.full_name,
      phone: body.phone,
    });
    res.status(200).json(
      ok(
        {
          id: updated.id,
          full_name: updated.full_name,
          phone: updated.phone,
          updated_at: updated.updated_at,
        },
        req.requestId,
      ),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(
        Errors.validationError(
          "Request body failed validation.",
          err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ),
      );
      return;
    }
    next(err);
  }
}

export async function handleRefresh(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const refreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw Errors.unauthorized("Refresh token cookie is missing.");
    }
    const result = await authService.refresh(refreshToken);
    res.status(200).json(ok(result, req.requestId));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin handlers
// ---------------------------------------------------------------------------

export async function handleAdminListUsers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = req.query.cursor as string | undefined;
    const users = await import("./auth.repository.js").then((m) =>
      m.authRepository.listUsers({ limit, cursor }),
    );

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    res.status(200).json({
      data: items.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.fullName,
        role: u.role,
        status: u.status,
        created_at: u.createdAt,
      })),
      pagination: { next_cursor: nextCursor, has_more: hasMore, limit },
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function handleAdminUpdateRole(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user_id } = req.params;
    const body = updateRoleSchema.parse(req.body);
    const actorId: string = res.locals.auth?.user_id;
    const updated = await authService.updateUserRole(
      actorId,
      user_id,
      body.role,
    );
    res
      .status(200)
      .json(
        ok(
          { user_id: updated.id, role: updated.role, updated_at: new Date() },
          req.requestId,
        ),
      );
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(Errors.invalidRole());
      return;
    }
    next(err);
  }
}

export async function handleAdminUpdateRoleByEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = updateRoleByEmailSchema.parse(req.body);
    const actorId: string = res.locals.auth?.user_id;
    const updated = await authService.updateUserRoleByEmail(
      actorId,
      body.email,
      body.role,
    );
    res.status(200).json(
      ok(
        {
          user_id: updated.id,
          email: updated.email,
          role: updated.role,
          updated_at: new Date(),
        },
        req.requestId,
      ),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(Errors.invalidRole());
      return;
    }
    next(err);
  }
}

export async function handleAdminUpdateStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user_id } = req.params;
    const schema = z.object({
      status: z.enum(["ACTIVE", "LOCKED", "DISABLED"]),
    });
    const body = schema.parse(req.body);
    const actorId: string = res.locals.auth?.user_id;
    const updated = await authService.updateUserStatus(
      actorId,
      user_id,
      body.status,
    );
    res.status(200).json(
      ok(
        {
          user_id: updated.id,
          status: updated.status,
          updated_at: new Date(),
        },
        req.requestId,
      ),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(
        Errors.validationError("Status must be ACTIVE, LOCKED, or DISABLED."),
      );
      return;
    }
    next(err);
  }
}

export async function handleAdminDeleteUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user_id } = req.params;
    const actorId: string = res.locals.auth?.user_id;
    const deleted = await authService.deleteUser(actorId, user_id);

    res.status(200).json(
      ok(
        {
          user_id: deleted.id,
          status: deleted.status,
          deleted_at: new Date(),
        },
        req.requestId,
      ),
    );
  } catch (err) {
    next(err);
  }
}
