import { LogOut, Menu, Search, Ticket, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  authSessionChangedEvent,
  getStoredAuthSession,
  type AuthSession,
} from "../lib/auth-session";
import { logout } from "../services/auth.service";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const syncSession = () => setSession(getStoredAuthSession());
    window.addEventListener(authSessionChangedEvent, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener(authSessionChangedEvent, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  function submitSearch(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const value = event.currentTarget.value.trim();
    if (value) navigate(`/events?search=${encodeURIComponent(value)}`);
  }

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#08080E]/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#F5C842] to-[#E8315B]">
              <Ticket className="h-4 w-4 text-white" />
            </div>
            <span
              className="hidden sm:block"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: "0.05em" }}
            >
              <span className="text-[#F5C842]">Ticket</span>Box
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <NavItem to="/" active={location.pathname === "/"}>
              Trang chủ
            </NavItem>
            <NavItem to="/events" active={location.pathname === "/events"}>
              Khám phá
            </NavItem>
          </div>

          <div className="mx-6 hidden max-w-sm flex-1 items-center gap-2 md:flex">
            <div
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Search className="h-4 w-4" style={{ color: "#8585A0" }} />
              <input
                type="text"
                placeholder="Tìm sự kiện..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#8585A0]"
                onKeyDown={submitSearch}
                style={{
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  color: "#F0EDEB",
                  padding: 0,
                }}
              />
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {session ? (
              <>
                <Link
                  to={profilePathForRole(session.user.role)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-[#F0EDEB]"
                >
                  <User className="h-4 w-4 text-[#F5C842]" />
                  <span className="max-w-28 truncate">{session.user.full_name || session.user.email}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-[#8585A0] transition-colors hover:text-[#F0EDEB]"
                  aria-label="Đăng xuất"
                  title="Đăng xuất"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-[#8585A0] transition-colors hover:text-[#F0EDEB]">
                  Đăng nhập
                </Link>
                <Link to="/register" className="rounded-lg bg-[#E8315B] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#C41E42]">
                  Đăng ký
                </Link>
              </>
            )}
          </div>

          <button
            className="rounded-lg p-2 text-[#F0EDEB] md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="space-y-2 border-t border-white/10 bg-[#08080E]/95 px-4 py-4 md:hidden">
          <MobileNavLink to="/" label="Trang chủ" onClick={() => setMenuOpen(false)} />
          <MobileNavLink to="/events" label="Khám phá" onClick={() => setMenuOpen(false)} />
          {session ? (
            <>
              {session.user.role === "ADMIN" && (
                <MobileNavLink to="/admin" label="Admin" onClick={() => setMenuOpen(false)} />
              )}
              {session.user.role === "ORGANIZER" && (
                <MobileNavLink to="/organizer" label="Organizer" onClick={() => setMenuOpen(false)} />
              )}
              {session.user.role === "CHECKER" && (
                <MobileNavLink to="/checker" label="Checker" onClick={() => setMenuOpen(false)} />
              )}
              {session.user.role === "AUDIENCE" && (
                <MobileNavLink to="/my-tickets" label="Vé của tôi" onClick={() => setMenuOpen(false)} />
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#F0EDEB]"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <MobileNavLink to="/login" label="Đăng nhập" onClick={() => setMenuOpen(false)} />
              <MobileNavLink to="/register" label="Đăng ký" onClick={() => setMenuOpen(false)} />
            </>
          )}
        </div>
      )}
    </nav>
  );
}

function profilePathForRole(role: AuthSession["user"]["role"]) {
  if (role === "ADMIN") return "/admin";
  if (role === "ORGANIZER") return "/organizer";
  if (role === "CHECKER") return "/checker";
  return "/my-tickets";
}

function NavItem({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className="text-sm transition-colors" style={{ color: active ? "#F5C842" : "#8585A0" }}>
      {children}
    </Link>
  );
}

function MobileNavLink({
  to,
  label,
  onClick,
}: {
  to: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link to={to} onClick={onClick} className="block rounded-lg px-3 py-2 text-sm text-[#F0EDEB]">
      {label}
    </Link>
  );
}
