import type {
  AuthUser,
  LoginInput,
  RegisterInput,
  TokenPair,
} from "./auth.type.js";

export const authService = {
  /**
   * Đăng ký tài khoản khán giả mới.
   * Sprint 2: hash password, tạo user, ghi audit log.
   */
  async register(_input: RegisterInput): Promise<AuthUser> {
    throw new Error("authService.register: not implemented — Sprint 2");
  },

  /**
   * Đăng nhập, trả về cặp access/refresh token.
   * Sprint 2: verify password, ký JWT, lưu refresh token.
   */
  async login(
    _input: LoginInput,
  ): Promise<{ user: AuthUser; tokens: TokenPair }> {
    throw new Error("authService.login: not implemented — Sprint 2");
  },

  /**
   * Thu hồi token hiện tại qua Redis denylist.
   * Sprint 2: giải mã JWT lấy jti, SET jti vào Redis với TTL còn lại.
   */
  async logout(_accessToken: string): Promise<void> {
    throw new Error("authService.logout: not implemented — Sprint 2");
  },

  /**
   * Lấy thông tin user hiện tại từ token đã xác thực.
   * Sprint 2: đọc user từ DB theo user_id trong payload.
   */
  async me(_userId: string): Promise<AuthUser> {
    throw new Error("authService.me: not implemented — Sprint 2");
  },
};
