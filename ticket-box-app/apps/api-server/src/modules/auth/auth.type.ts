export type Role = "AUDIENCE" | "ORGANIZER" | "CHECKER" | "ADMIN";

export type UserStatus = "ACTIVE" | "LOCKED" | "DISABLED";

/** Thông tin user trả về trong API response */
export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
};

/** Cặp token trả về sau login */
export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
};

/** Payload được giải mã từ JWT */
export type AuthPayload = {
  sub: string; // user_id
  role: Role;
  jti: string; // JWT ID — dùng cho Redis denylist
  iat: number;
  exp: number;
};

/** Input cho register */
export type RegisterInput = {
  email: string;
  password: string;
  full_name: string;
};

/** Input cho login */
export type LoginInput = {
  email: string;
  password: string;
};
