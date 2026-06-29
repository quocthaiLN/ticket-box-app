import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Ticket, Mail, Lock, User, Phone, ShieldCheck, RefreshCw } from "lucide-react";

interface AuthPageProps {
  mode: "login" | "register" | "verify-otp";
  onAuth?: (user: { fullName: string; role: string }) => void;
}

// ── Demo accounts ────────────────────────────────────────────────────────────
const DEMO_ACCOUNTS: Record<string, { password: string; role: string; fullName: string }> = {
  "admin@gmail.com":     { password: "Admin123@",     role: "ADMIN",     fullName: "Admin" },
  "organizer@gmail.com": { password: "Organizer123@", role: "ORGANIZER", fullName: "Demo Organizer" },
  "checker@gmail.com":   { password: "Checker123@",   role: "CHECKER",   fullName: "Demo Checker" },
  "audience@gmail.com":  { password: "Audience123@",  role: "AUDIENCE",  fullName: "Demo Audience" },
};

const REDIRECT_FOR_ROLE: Record<string, string> = {
  ADMIN: "/admin", ORGANIZER: "/organizer", CHECKER: "/checker", AUDIENCE: "/",
};

// ── OTP verify page ──────────────────────────────────────────────────────────
export function OTPVerifyPage({ onAuth }: { onAuth?: (user: { fullName: string; role: string }) => void }) {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const pendingStr = sessionStorage.getItem("pendingRegister");
  const pending = pendingStr ? JSON.parse(pendingStr) : null;

  useEffect(() => {
    if (!pending) { navigate("/register"); return; }
  }, []);

  // Countdown
  useEffect(() => {
    if (secondsLeft <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const handleInput = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    setError("");
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleVerify = () => {
    const code = otp.join("");
    if (code.length < 6) { setError("Vui lòng nhập đầy đủ 6 chữ số"); return; }
    setVerifying(true);
    setTimeout(() => {
      // Mock: any 6-digit code accepted
      if (pending) {
        onAuth?.({ fullName: pending.fullName, role: "AUDIENCE" });
        sessionStorage.removeItem("pendingRegister");
        navigate("/");
      }
      setVerifying(false);
    }, 1000);
  };

  const handleResend = () => {
    setResending(true);
    setTimeout(() => {
      setSecondsLeft(60);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
      setResending(false);
      inputRefs.current[0]?.focus();
    }, 800);
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen flex items-center justify-center pt-16 px-4" style={{ background: "#08080E", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 40%, rgba(123,97,255,0.12) 0%, transparent 60%)" }} />
      <div className="relative z-10 w-full max-w-md rounded-3xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)" }}>
        <div className="h-1" style={{ background: "linear-gradient(90deg, #7B61FF, #E8315B, #F5C842)" }} />
        <div className="p-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #F5C842, #E8315B)" }}>
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", color: "#F0EDEB", fontSize: "1.3rem", letterSpacing: "0.04em" }}>
              <span style={{ color: "#F5C842" }}>Ticket</span>Box
            </span>
          </div>

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(123,97,255,0.12)", border: "1px solid rgba(123,97,255,0.25)" }}>
              <ShieldCheck className="w-8 h-8" style={{ color: "#7B61FF" }} />
            </div>
          </div>

          <h1 className="text-center mb-1" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.8rem", color: "#F0EDEB", fontWeight: 700 }}>
            Xác minh email
          </h1>
          <p className="text-center mb-2 text-sm" style={{ color: "#8585A0" }}>
            Nhập mã OTP gồm 6 chữ số đã được gửi đến
          </p>
          <p className="text-center mb-6 text-sm font-semibold" style={{ color: "#F0EDEB" }}>
            {pending?.email ?? "email của bạn"}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(232,49,91,0.1)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.2)" }}>
              {error}
            </div>
          )}

          {/* OTP inputs */}
          <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInput(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-all"
                style={{
                  background: digit ? "rgba(123,97,255,0.12)" : "rgba(255,255,255,0.05)",
                  border: digit ? "1.5px solid rgba(123,97,255,0.5)" : "1px solid rgba(255,255,255,0.12)",
                  color: "#F0EDEB",
                }}
              />
            ))}
          </div>

          {/* Timer */}
          <div className="text-center mb-6">
            {!canResend ? (
              <p className="text-sm" style={{ color: "#8585A0" }}>
                Mã hết hạn sau{" "}
                <span className="font-mono font-semibold" style={{ color: secondsLeft <= 10 ? "#E8315B" : "#F5C842" }}>
                  {formatTime(secondsLeft)}
                </span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="flex items-center gap-1.5 mx-auto text-sm font-medium transition-colors hover:text-amber-400"
                style={{ color: "#F5C842" }}
              >
                <RefreshCw className={`w-4 h-4 ${resending ? "animate-spin" : ""}`} />
                {resending ? "Đang gửi lại..." : "Gửi lại mã OTP"}
              </button>
            )}
          </div>

          <button
            onClick={handleVerify}
            disabled={verifying || otp.join("").length < 6}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #7B61FF, #5B41CF)", color: "#fff", boxShadow: "0 8px 24px rgba(123,97,255,0.3)" }}
          >
            {verifying ? "Đang xác minh..." : "Xác minh & Hoàn tất đăng ký"}
          </button>

          <p className="mt-4 text-xs text-center" style={{ color: "#8585A0" }}>
            Không nhận được mã?{" "}
            <Link to="/register" className="font-medium transition-colors hover:text-amber-400" style={{ color: "#F5C842" }}>
              Quay lại đăng ký
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main AuthPage ─────────────────────────────────────────────────────────────
export function AuthPage({ mode, onAuth }: AuthPageProps) {
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    setTimeout(() => {
      if (mode === "login") {
        const account = DEMO_ACCOUNTS[form.email.toLowerCase().trim()];
        if (!form.email || !form.password) {
          setError("Vui lòng nhập đầy đủ thông tin");
          setLoading(false);
          return;
        }
        if (!account || account.password !== form.password) {
          setError("Email hoặc mật khẩu không đúng");
          setLoading(false);
          return;
        }
        onAuth?.({ fullName: account.fullName, role: account.role });
        navigate(REDIRECT_FOR_ROLE[account.role] ?? "/");
      } else {
        // Register — all new accounts are AUDIENCE
        if (!form.email || !form.password || !form.fullName) {
          setError("Vui lòng điền đầy đủ thông tin bắt buộc");
          setLoading(false);
          return;
        }
        if (form.password.length < 8) {
          setError("Mật khẩu phải có ít nhất 8 ký tự");
          setLoading(false);
          return;
        }
        // Store pending registration and go to OTP
        sessionStorage.setItem("pendingRegister", JSON.stringify({ email: form.email, fullName: form.fullName, phone: form.phone }));
        navigate("/verify-otp");
      }
      setLoading(false);
    }, 700);
  };

  return (
    <div className="min-h-screen flex items-center justify-center pt-16 px-4" style={{ background: "#08080E", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Glow BG */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 40%, rgba(232,49,91,0.12) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(123,97,255,0.1) 0%, transparent 50%)" }} />

      <div className="relative z-10 w-full max-w-md rounded-3xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)" }}>
        <div className="h-1" style={{ background: "linear-gradient(90deg, #F5C842, #E8315B, #7B61FF)" }} />

        <div className="p-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #F5C842, #E8315B)" }}>
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", color: "#F0EDEB", fontSize: "1.3rem", letterSpacing: "0.04em" }}>
              <span style={{ color: "#F5C842" }}>Ticket</span>Box
            </span>
          </div>

          <h1 className="text-center mb-1" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.8rem", color: "#F0EDEB", fontWeight: 700 }}>
            {mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
          </h1>
          <p className="text-center mb-6 text-sm" style={{ color: "#8585A0" }}>
            {mode === "login" ? "Đăng nhập để mua vé và quản lý sự kiện" : "Tham gia TicketBox để trải nghiệm mua vé tiện lợi"}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(232,49,91,0.1)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.2)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <InputField icon={<User className="w-4 h-4" />} placeholder="Họ và tên *" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} type="text" />
            )}

            <InputField icon={<Mail className="w-4 h-4" />} placeholder="Email *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />

            {mode === "register" && (
              <InputField icon={<Phone className="w-4 h-4" />} placeholder="Số điện thoại" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" />
            )}

            {/* Password */}
            <div className="flex items-center gap-2 px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Lock className="w-4 h-4 flex-shrink-0" style={{ color: "#8585A0" }} />
              <input
                type={showPass ? "text" : "password"}
                placeholder="Mật khẩu *"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "#F0EDEB" }}
                required
              />
              <button type="button" onClick={() => setShowPass((s) => !s)} style={{ color: "#8585A0" }}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {mode === "login" && (
              <div className="text-right">
                <Link to="#" className="text-xs transition-colors hover:text-amber-400" style={{ color: "#8585A0" }}>Quên mật khẩu?</Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff", boxShadow: "0 8px 24px rgba(232,49,91,0.3)", marginTop: "0.5rem" }}
            >
              {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3" style={{ background: "#111118", color: "#8585A0" }}>hoặc đăng nhập bằng</span>
            </div>
          </div>

          {/* Social login */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <SocialBtn icon="G" label="Google" />
            <SocialBtn icon="f" label="Facebook" />
          </div>

          <p className="text-xs text-center" style={{ color: "#8585A0" }}>
            {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <Link to={mode === "login" ? "/register" : "/login"} className="font-medium transition-colors hover:text-amber-400" style={{ color: "#F5C842" }}>
              {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
            </Link>
          </p>

          {/* Demo accounts hint */}
          {mode === "login" && (
            <div className="mt-4 p-3 rounded-xl space-y-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "#8585A0" }}>Tài khoản demo:</p>
              {Object.entries(DEMO_ACCOUNTS).map(([email, acc]) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => setForm({ ...form, email, password: acc.password })}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span style={{ color: "#F0EDEB" }}>{email}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs" style={{
                    background: acc.role === "ADMIN" ? "rgba(232,49,91,0.1)" : acc.role === "ORGANIZER" ? "rgba(245,200,66,0.1)" : acc.role === "CHECKER" ? "rgba(123,97,255,0.1)" : "rgba(255,255,255,0.07)",
                    color: acc.role === "ADMIN" ? "#E8315B" : acc.role === "ORGANIZER" ? "#F5C842" : acc.role === "CHECKER" ? "#7B61FF" : "#8585A0",
                  }}>
                    {acc.role}
                  </span>
                </button>
              ))}
              <p className="text-xs pt-1" style={{ color: "#8585A0" }}>Nhấn vào để tự điền thông tin đăng nhập</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({ icon, placeholder, value, onChange, type }: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span className="flex-shrink-0" style={{ color: "#8585A0" }}>{icon}</span>
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" style={{ color: "#F0EDEB" }} />
    </div>
  );
}

function SocialBtn({ icon, label }: { icon: string; label: string }) {
  return (
    <button type="button" className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm transition-colors hover:bg-white/10" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}>
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(255,255,255,0.15)" }}>{icon}</span>
      {label}
    </button>
  );
}
