import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Ticket, Mail, Lock, User, Phone } from "lucide-react";

interface AuthPageProps {
  mode: "login" | "register";
  onAuth?: (user: { fullName: string; role: string }) => void;
}

export function AuthPage({ mode, onAuth }: AuthPageProps) {
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", phone: "", role: "AUDIENCE" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    setTimeout(() => {
      if (mode === "login") {
        if (form.email && form.password) {
          const isAdmin = form.email.includes("admin") || form.email.includes("organizer");
          onAuth?.({ fullName: form.email.split("@")[0].replace(/\./g, " "), role: isAdmin ? "ADMIN" : "AUDIENCE" });
          navigate("/");
        } else {
          setError("Vui lòng nhập đầy đủ thông tin");
        }
      } else {
        if (form.email && form.password && form.fullName) {
          onAuth?.({ fullName: form.fullName, role: form.role });
          navigate("/");
        } else {
          setError("Vui lòng điền đầy đủ thông tin bắt buộc");
        }
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center pt-16 px-4"
      style={{ background: "#08080E", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Glow BG */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 40%, rgba(232,49,91,0.12) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(123,97,255,0.1) 0%, transparent 50%)",
        }}
      />

      <div
        className="relative z-10 w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        {/* Top bar */}
        <div className="h-1" style={{ background: "linear-gradient(90deg, #F5C842, #E8315B, #7B61FF)" }} />

        <div className="p-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #F5C842, #E8315B)" }}
            >
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", color: "#F0EDEB", fontSize: "1.3rem", letterSpacing: "0.04em" }}>
              <span style={{ color: "#F5C842" }}>Ticket</span>Box
            </span>
          </div>

          <h1
            className="text-center mb-1"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.8rem", color: "#F0EDEB", fontWeight: 700 }}
          >
            {mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
          </h1>
          <p className="text-center mb-6 text-sm" style={{ color: "#8585A0" }}>
            {mode === "login"
              ? "Đăng nhập để mua vé và quản lý sự kiện"
              : "Tham gia TicketBox để trải nghiệm mua vé tiện lợi"}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: "rgba(232,49,91,0.1)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.2)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <InputField
                icon={<User className="w-4 h-4" />}
                placeholder="Họ và tên *"
                value={form.fullName}
                onChange={(v) => setForm({ ...form, fullName: v })}
                type="text"
              />
            )}

            <InputField
              icon={<Mail className="w-4 h-4" />}
              placeholder="Email *"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              type="email"
            />

            {mode === "register" && (
              <InputField
                icon={<Phone className="w-4 h-4" />}
                placeholder="Số điện thoại"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                type="tel"
              />
            )}

            <div
              className="flex items-center gap-2 px-3 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Lock className="w-4 h-4 flex-shrink-0" style={{ color: "#8585A0" }} />
              <input
                type={showPass ? "text" : "password"}
                placeholder="Mật khẩu *"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "#F0EDEB" }}
              />
              <button type="button" onClick={() => setShowPass((s) => !s)} style={{ color: "#8585A0" }}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {mode === "register" && (
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: "#8585A0" }}>Đăng ký với tư cách</label>
                <div className="grid grid-cols-2 gap-2">
                  <RoleOption value="AUDIENCE" label="Khán giả" emoji="🎵" selected={form.role === "AUDIENCE"} onClick={() => setForm({ ...form, role: "AUDIENCE" })} />
                  <RoleOption value="ORGANIZER" label="Ban tổ chức" emoji="🎤" selected={form.role === "ORGANIZER"} onClick={() => setForm({ ...form, role: "ORGANIZER" })} />
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="text-right">
                <Link to="#" className="text-xs transition-colors hover:text-amber-400" style={{ color: "#8585A0" }}>
                  Quên mật khẩu?
                </Link>
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

          {/* Social login (demo) */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <SocialBtn icon="G" label="Google" />
            <SocialBtn icon="F" label="Facebook" />
          </div>

          <p className="text-xs text-center" style={{ color: "#8585A0" }}>
            {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <Link
              to={mode === "login" ? "/register" : "/login"}
              className="font-medium transition-colors hover:text-amber-400"
              style={{ color: "#F5C842" }}
            >
              {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
            </Link>
          </p>

          {/* Demo hint */}
          <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.15)", color: "#8585A0" }}>
            <strong style={{ color: "#F5C842" }}>Demo:</strong> Dùng email chứa "admin" để đăng nhập với quyền Admin Dashboard
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({ icon, placeholder, value, onChange, type }: {
  icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span className="flex-shrink-0" style={{ color: "#8585A0" }}>{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent outline-none text-sm"
        style={{ color: "#F0EDEB" }}
      />
    </div>
  );
}

function RoleOption({ value, label, emoji, selected, onClick }: {
  value: string; label: string; emoji: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all"
      style={{
        background: selected ? "rgba(245,200,66,0.1)" : "rgba(255,255,255,0.04)",
        border: selected ? "1.5px solid rgba(245,200,66,0.4)" : "1px solid rgba(255,255,255,0.07)",
        color: selected ? "#F5C842" : "#8585A0",
      }}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

function SocialBtn({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm transition-colors hover:bg-white/10"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: "rgba(255,255,255,0.15)" }}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}
