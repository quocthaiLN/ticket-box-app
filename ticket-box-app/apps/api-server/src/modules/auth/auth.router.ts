import { Router } from "express";
import {
  handleLogin,
  handleLogout,
  handleMe,
  handleRefresh,
  handleRegister,
  handleAdminListUsers,
  handleAdminUpdateRole,
  handleAdminUpdateStatus,
} from "./auth.controller.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { requireRole } from "../../shared/guards/role.guard.js";

export const authRouter = Router();

// Public
authRouter.post("/register", handleRegister);
authRouter.post("/login", handleLogin);
authRouter.post("/refresh", handleRefresh);

// Protected (yêu cầu Bearer token)
authRouter.post("/logout", requireAuth, handleLogout);
authRouter.get("/me", requireAuth, handleMe);

// Admin-only
authRouter.get("/admin/users", requireAuth, requireRole("ADMIN"), handleAdminListUsers);
authRouter.patch(
  "/admin/users/:user_id/role",
  requireAuth,
  requireRole("ADMIN"),
  handleAdminUpdateRole
);
authRouter.patch(
  "/admin/users/:user_id/status",
  requireAuth,
  requireRole("ADMIN"),
  handleAdminUpdateStatus
);
