/**
 * auth.router.ts — Route definitions cho Auth module.
 * Tất cả routes được mount tại /v1/auth (xem app.ts).
 *
 * Public routes:
 *   POST /auth/register  — Đăng ký tài khoản khán giả
 *   POST /auth/login     — Đăng nhập
 *   POST /auth/refresh   — Làm mới access token
 *
 * Protected routes (yêu cầu Bearer token):
 *   POST /auth/logout    — Thu hồi token qua Redis denylist
 *   GET  /auth/me        — Lấy thông tin user hiện tại
 */

import { Router } from "express";
import {
  handleLogin,
  handleLogout,
  handleMe,
  handleRefresh,
  handleRegister,
} from "./auth.controller.js";

export const authRouter = Router();

// Public
authRouter.post("/register", handleRegister);
authRouter.post("/login", handleLogin);
authRouter.post("/refresh", handleRefresh);

// Protected (requireAuth middleware trước handler)
authRouter.post("/logout", handleLogout);
authRouter.get("/me", handleMe);
