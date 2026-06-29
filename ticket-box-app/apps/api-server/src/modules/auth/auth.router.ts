import { Router } from "express";
import {
  handleLogin,
  handleLogout,
  handleMe,
  handleUpdateMe,
  handleRefresh,
  handleRegister,
  handleRequestOtp,
  handleAdminListUsers,
  handleAdminUpdateRole,
  handleAdminUpdateRoleByEmail,
  handleAdminUpdateStatus,
} from "./auth.controller.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { requireRole } from "../../shared/guards/role.guard.js";

export const authRouter = Router();

// Public
authRouter.post("/otp/request", handleRequestOtp);
authRouter.post("/register", handleRegister);
authRouter.post("/login", handleLogin);
authRouter.post("/refresh", handleRefresh);

// Protected (yêu cầu Bearer token)
authRouter.post("/logout", requireAuth, handleLogout);
authRouter.get("/me", requireAuth, handleMe);
authRouter.patch("/me", requireAuth, handleUpdateMe);

// Admin-only
authRouter.get(
  "/admin/users",
  requireAuth,
  requireRole("ADMIN"),
  handleAdminListUsers,
);
// Đặt route role-by-email TRƯỚC /:user_id/role để Express không bắt nhầm
// "role-by-email" thành tham số :user_id.
authRouter.patch(
  "/admin/users/role-by-email",
  requireAuth,
  requireRole("ADMIN"),
  handleAdminUpdateRoleByEmail,
);
authRouter.patch(
  "/admin/users/:user_id/role",
  requireAuth,
  requireRole("ADMIN"),
  handleAdminUpdateRole,
);
authRouter.patch(
  "/admin/users/:user_id/status",
  requireAuth,
  requireRole("ADMIN"),
  handleAdminUpdateStatus,
);
