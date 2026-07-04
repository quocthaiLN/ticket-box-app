import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Ticket,
  User,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, register, requestOtp } from "../../services/auth.service";
import type { AuthUser } from "../../lib/auth-session";

type AuthMode = "login" | "register";
type RegisterStep = "form" | "otp";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage({ mode }: { mode: AuthMode }) {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [registerStep, setRegisterStep] = useState<RegisterStep>("form");
  const navigate = useNavigate();

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  useEffect(() => {
    setRegisterStep("form");
    setError("");
    setOtpCooldown(0);
  }, [mode]);

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
      if (mode === "login") {
        const auth = await login({
          email: form.email,
          password: form.password,
        });
        redirectAuthenticatedUser(auth);
        return;
      }

      if (form.password !== form.confirmPassword) {
        setError("Mật khẩu xác nhận không khớp.");
        return;
      }

      if (!EMAIL_PATTERN.test(form.email)) {
        setError("Vui lòng nhập email hợp lệ.");
        return;
      }

      await requestOtp(form.email);
      setOtpCooldown(60);
      setRegisterStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác thực thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyRegister(otp: string) {
    setLoading(true);
    setError("");

    try {
      const auth = await register({
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        full_name: form.fullName,
        otp,
      });
      redirectAuthenticatedUser(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể hoàn tất đăng ký.");
    } finally {
      setLoading(false);
    }
  }

  function redirectAuthenticatedUser(auth: Awaited<ReturnType<typeof login>>) {
    const redirectAfterLogin = sessionStorage.getItem("ticketbox.redirectAfterLogin");
    if (redirectAfterLogin && auth.user.role === "AUDIENCE") {
      sessionStorage.removeItem("ticketbox.redirectAfterLogin");
      navigate(redirectAfterLogin, { replace: true });
    } else {
      navigate(auth.redirect_to ?? nextPathForUser(auth.user), { replace: true });
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

          {(isLogin || registerStep === "form") && (
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
          )}

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

          {!isLogin && registerStep === "otp" ? (
            <OtpVerificationPanel
              email={form.email}
              loading={loading}
              otpCooldown={otpCooldown}
              otpLoading={otpLoading}
              onBack={() => {
                setRegisterStep("form");
                setError("");
              }}
              onResend={handleSendCode}
              onVerify={handleVerifyRegister}
            />
          ) : (
            <>
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
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function OtpVerificationPanel({
  email,
  loading,
  otpCooldown,
  otpLoading,
  onBack,
  onResend,
  onVerify,
}: {
  email: string;
  loading: boolean;
  otpCooldown: number;
  otpLoading: boolean;
  onBack: () => void;
  onResend: () => void;
  onVerify: (otp: string) => void;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const otp = digits.join("");

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;
    event.preventDefault();
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((digit, index) => {
      next[index] = digit;
    });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 6) - 1]?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (otp.length === 6) onVerify(otp);
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/5"
        style={{ color: "#8585A0" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Quay lại
      </button>

      <div className="mb-6 text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(123,97,255,0.12)", border: "1px solid rgba(123,97,255,0.25)" }}
        >
          <ShieldCheck className="h-7 w-7 text-[#7B61FF]" />
        </div>
        <h2
          id="auth-title"
          className="mb-1"
          style={{
            color: "#F0EDEB",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "1.55rem",
            fontWeight: 700,
          }}
        >
          Xác minh email
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "#8585A0" }}>
          Nhập mã OTP gồm 6 chữ số đã được gửi đến{" "}
          <span className="font-semibold" style={{ color: "#F0EDEB" }}>
            {email}
          </span>
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => handleDigitChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              aria-label={`Mã OTP số ${index + 1}`}
              className="rounded-xl text-center text-xl font-bold outline-none transition-all focus:scale-105"
              style={{
                width: "clamp(2.5rem, 12vw, 3rem)",
                height: "3.5rem",
                background: digit ? "rgba(123,97,255,0.13)" : "rgba(255,255,255,0.05)",
                border: digit ? "1.5px solid rgba(123,97,255,0.55)" : "1px solid rgba(255,255,255,0.12)",
                boxShadow: digit ? "0 10px 30px rgba(123,97,255,0.12)" : "none",
                color: "#F0EDEB",
                padding: 0,
                textAlign: "center",
              }}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || otp.length < 6}
          className="w-full rounded-xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #7B61FF, #5B41CF)",
            boxShadow: "0 8px 24px rgba(123,97,255,0.3)",
            color: "#fff",
          }}
        >
          {loading ? "Đang xác minh..." : "Xác minh & hoàn tất đăng ký"}
        </button>
      </form>

      <div className="mt-5 text-center">
        {otpCooldown > 0 ? (
          <p className="text-xs" style={{ color: "#8585A0" }}>
            Có thể gửi lại mã sau{" "}
            <span className="font-mono font-semibold" style={{ color: "#F5C842" }}>
              {otpCooldown}s
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={otpLoading}
            className="mx-auto inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-amber-300 disabled:opacity-60"
            style={{ color: "#F5C842" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${otpLoading ? "animate-spin" : ""}`} />
            {otpLoading ? "Đang gửi lại..." : "Gửi lại mã OTP"}
          </button>
        )}
      </div>
    </div>
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
