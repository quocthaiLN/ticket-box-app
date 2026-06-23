import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Ticket,
  User,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, register, requestOtp } from "../../services/auth.service";
import type { AuthUser } from "../../lib/auth-session";

type AuthMode = "login" | "register";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage({ mode }: { mode: AuthMode }) {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    otp: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  async function handleSendCode() {
    if (!EMAIL_PATTERN.test(form.email)) {
      setError("Vui lòng nhập email hợp lệ trước khi lấy mã xác thực.");
      return;
    }
    setOtpLoading(true);
    setError("");
    try {
      await requestOtp(form.email);
      setOtpCooldown(60);
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi mã xác thực.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const auth =
        mode === "login"
          ? await login({
              email: form.email,
              password: form.password,
            })
          : await register({
              email: form.email,
              password: form.password,
              confirmPassword: form.confirmPassword,
              full_name: form.fullName,
              otp: form.otp,
            });

      navigate(auth.redirect_to ?? nextPathForUser(auth.user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác thực thất bại.");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080E] px-4 py-24"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(232,49,91,0.12) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(123,97,255,0.1) 0%, transparent 50%)",
        }}
      />
      <section
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl"
        style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)" }}
        aria-labelledby="auth-title"
      >
        <div className="h-1" style={{ background: "linear-gradient(90deg, #F5C842, #E8315B, #7B61FF)" }} />
        <div className="p-8">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, #F5C842, #E8315B)" }}
            >
              <Ticket className="h-5 w-5 text-white" />
            </span>
            <span
              style={{
                color: "#F0EDEB",
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: "1.3rem",
                letterSpacing: "0.04em",
              }}
            >
              <span className="text-[#F5C842]">Ticket</span>Box
            </span>
          </Link>

          <div className="mb-6 text-center">
            <h1
              id="auth-title"
              className="mb-1 text-center"
              style={{
                color: "#F0EDEB",
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: "1.8rem",
                fontWeight: 700,
              }}
            >
              {isLogin ? "Chào mừng trở lại" : "Tạo tài khoản"}
            </h1>
            <p className="text-sm" style={{ color: "#8585A0" }}>
              {isLogin ? "Đăng nhập để mua vé và quản lý trải nghiệm sự kiện." : "Tham gia TicketBox để mua vé nhanh và nhận e-ticket thuận tiện."}
            </p>
          </div>

          {error && (
            <div
              className="mb-4 rounded-lg p-3 text-sm"
              style={{
                background: "rgba(232,49,91,0.1)",
                border: "1px solid rgba(232,49,91,0.2)",
                color: "#E8315B",
              }}
            >
              {error}
            </div>
          )}

          <form className="space-y-3" onSubmit={handleSubmit}>
            {!isLogin && (
              <AuthField
                icon={<User className="h-4 w-4" />}
                placeholder="Họ và tên *"
                type="text"
                value={form.fullName}
                onChange={(value) => setForm({ ...form, fullName: value })}
                autoComplete="name"
              />
            )}

            <AuthField
              icon={<Mail className="h-4 w-4" />}
              placeholder="Email *"
              type="email"
              value={form.email}
              onChange={(value) => {
                setForm({ ...form, email: value });
                setOtpSent(false);
              }}
              autoComplete="email"
            />

            <PasswordField
              placeholder="Mật khẩu *"
              value={form.password}
              visible={showPassword}
              onVisibleChange={() => setShowPassword((value) => !value)}
              onChange={(value) => setForm({ ...form, password: value })}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />

            {!isLogin && (
              <PasswordField
                placeholder="Xác nhận mật khẩu *"
                value={form.confirmPassword}
                visible={showPassword}
                onVisibleChange={() => setShowPassword((value) => !value)}
                onChange={(value) => setForm({ ...form, confirmPassword: value })}
                autoComplete="new-password"
              />
            )}

            {!isLogin &&
              form.confirmPassword.length > 0 &&
              form.confirmPassword !== form.password && (
                <p className="text-xs" style={{ color: "#E8315B", marginTop: "-0.25rem" }}>
                  Mật khẩu xác nhận không khớp.
                </p>
              )}

            {!isLogin && (
              <div className="flex gap-2">
                <div
                  className="auth-input-shell flex flex-1 items-center gap-2 rounded-xl px-3 py-3"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    minHeight: "46px",
                  }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center"
                    style={{ color: "#8585A0", width: "18px", height: "18px" }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Mã xác thực *"
                    value={form.otp}
                    onChange={(e) =>
                      setForm({ ...form, otp: e.target.value.replace(/\D/g, "") })
                    }
                    required
                    className="auth-input min-w-0 flex-1 border-0 bg-transparent p-0 text-[#F0EDEB] outline-none placeholder:text-[#8585A0]"
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#F0EDEB",
                      fontSize: "0.95rem",
                      lineHeight: "1.25rem",
                      padding: 0,
                      letterSpacing: "0.1em",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={otpCooldown > 0 || otpLoading}
                  className="shrink-0 rounded-xl px-4 text-xs font-semibold transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background:
                      otpCooldown > 0
                        ? "rgba(255,255,255,0.06)"
                        : "linear-gradient(135deg, #F5C842, #E8A020)",
                    color: otpCooldown > 0 ? "#8585A0" : "#0D0D14",
                    border: otpCooldown > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
                    minWidth: "88px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {otpLoading ? "Đang gửi..." : otpCooldown > 0 ? `Gửi lại (${otpCooldown}s)` : "Gửi mã"}
                </button>
              </div>
            )}

            {!isLogin && otpSent && (
              <p className="text-xs" style={{ color: "#8585A0", marginTop: "-0.25rem" }}>
                Mã 6 chữ số đã được gửi đến{" "}
                <span style={{ color: "#F0EDEB" }}>{form.email}</span>. Vui lòng kiểm tra hộp thư và spam.
              </p>
            )}

            {isLogin && (
              <div className="text-right">
                <Link
                  to="#"
                  className="text-xs transition-colors hover:text-amber-400"
                  style={{ color: "#8585A0" }}
                >
                  Quên mật khẩu?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #E8315B, #C41E42)",
                boxShadow: "0 8px 24px rgba(232,49,91,0.3)",
                color: "#fff",
                marginTop: "0.5rem",
              }}
            >
              {loading ? "Đang xử lý..." : isLogin ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3" style={{ background: "#111118", color: "#8585A0" }}>
                {isLogin ? "hoặc đăng nhập với" : "hoặc đăng ký với"}
              </span>
            </div>
          </div>

          <div
            className="mb-6 grid gap-2"
            style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}
          >
            <SocialButton icon="G" label="Google" />
            <SocialButton icon="F" label="Facebook" />
          </div>

          <p className="text-center text-xs" style={{ color: "#8585A0" }}>
            {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <Link
              to={isLogin ? "/register" : "/login"}
              className="font-medium transition-colors hover:text-amber-400"
              style={{ color: "#F5C842" }}
            >
              {isLogin ? "Đăng ký" : "Đăng nhập"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function AuthField({
  icon,
  placeholder,
  type,
  value,
  onChange,
  autoComplete,
}: {
  icon: React.ReactNode;
  placeholder: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div
      className="auth-input-shell flex items-center gap-2 rounded-xl px-3 py-3"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        minHeight: "46px",
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ color: "#8585A0", width: "18px", height: "18px" }}
      >
        {icon}
      </span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          className="auth-input min-w-0 flex-1 border-0 bg-transparent p-0 text-[#F0EDEB] outline-none placeholder:text-[#8585A0]"
          style={{
            width: "100%",
            border: 0,
            background: "transparent",
            color: "#F0EDEB",
            fontSize: "0.95rem",
            lineHeight: "1.25rem",
            padding: 0,
          }}
        />
    </div>
  );
}

function PasswordField({
  placeholder,
  value,
  visible,
  onVisibleChange,
  onChange,
  autoComplete,
}: {
  placeholder: string;
  value: string;
  visible: boolean;
  onVisibleChange: () => void;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div
      className="auth-input-shell flex items-center gap-2 rounded-xl px-3 py-3"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        minHeight: "46px",
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ color: "#8585A0", width: "18px", height: "18px" }}
      >
        <Lock className="h-4 w-4" />
      </span>
        <input
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          className="auth-input min-w-0 flex-1 border-0 bg-transparent p-0 text-[#F0EDEB] outline-none placeholder:text-[#8585A0]"
          style={{
            width: "100%",
            border: 0,
            background: "transparent",
            color: "#F0EDEB",
            fontSize: "0.95rem",
            lineHeight: "1.25rem",
            padding: 0,
          }}
        />
        <button
          type="button"
          onClick={onVisibleChange}
          className="shrink-0 rounded-md p-1 text-[#8585A0] transition-colors hover:text-[#F0EDEB]"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
    </div>
  );
}

function SocialButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      className="auth-social-button flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm transition-colors"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "#F0EDEB",
        minWidth: 0,
        whiteSpace: "nowrap",
      }}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: "rgba(255,255,255,0.15)" }}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

function nextPathForUser(user: AuthUser) {
  if (user.role === "ADMIN") return "/admin";
  if (user.role === "ORGANIZER") return "/organizer";
  if (user.role === "CHECKER") return "/checker";
  return "/";
}
