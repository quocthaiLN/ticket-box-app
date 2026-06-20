import {
  apiGet,
  apiPost,
  type ApiResponse,
} from "../lib/api-client";
import {
  clearAuthSession,
  storeAuthSession,
  type AuthUser,
} from "../lib/auth-session";

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  full_name: string;
  confirmPassword: string;
  otp: string;
};

export async function requestOtp(email: string) {
  await apiPost<ApiResponse<unknown>>("/auth/otp/request", { email });
}

type LoginResponse = {
  access_token: string;
  expires_in: number;
  user: AuthUser;
};

export async function login(input: LoginInput) {
  const response = await apiPost<ApiResponse<LoginResponse>>("/auth/login", input, {
    credentials: "include",
  });

  storeAuthSession({
    accessToken: response.data.access_token,
    expiresIn: response.data.expires_in,
    user: response.data.user,
  });

  return response.data.user;
}

export async function register(input: RegisterInput) {
  await apiPost<ApiResponse<AuthUser>>("/auth/register", input);
  return login({ email: input.email, password: input.password });
}

export async function loadCurrentUser() {
  const response = await apiGet<ApiResponse<AuthUser>>("/auth/me");
  return response.data;
}

export async function logout() {
  try {
    await apiPost<void>("/auth/logout", undefined, {
      credentials: "include",
    });
  } finally {
    clearAuthSession();
  }
}
