import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Ticket, Search, Menu, X, User, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";

interface NavbarProps {
  user?: { fullName: string; role: string } | null;
  onLogout?: () => void;
}

export function Navbar({ user, onLogout }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const dashboardLink =
    user?.role === "ADMIN" ? "/admin"
    : user?.role === "ORGANIZER" ? "/organizer"
    : user?.role === "CHECKER" ? "/checker"
    : null;
  const dashboardLabel =
    user?.role === "ADMIN" ? "Admin"
    : user?.role === "ORGANIZER" ? "Organizer"
    : user?.role === "CHECKER" ? "Checker"
    : null;

  return (
    <nav
      style={{
        background: "rgba(8,8,14,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #F5C842, #E8315B)" }}
            >
              <Ticket className="w-4 h-4 text-white" />
            </div>
            <span
              style={{ fontFamily: "'Cormorant Garamond', serif", color: "#F0EDEB", letterSpacing: "0.05em" }}
              className="hidden sm:block"
            >
              <span style={{ color: "#F5C842" }}>Ticket</span>Box
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <NavLink to="/" active={location.pathname === "/"}>Sự kiện</NavLink>
            <NavLink to="/events" active={location.pathname === "/events"}>Khám phá</NavLink>
          </div>

          {/* Search bar */}
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-sm mx-6">
            <div
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Search className="w-4 h-4" style={{ color: "#8585A0" }} />
              <input
                type="text"
                placeholder="Tìm kiếm sự kiện..."
                className="bg-transparent outline-none w-full text-sm"
                style={{ color: "#F0EDEB" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value;
                    if (val) navigate(`/events?search=${encodeURIComponent(val)}`);
                  }
                }}
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((p) => !p)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ background: "linear-gradient(135deg, #F5C842, #E8315B)", color: "#fff" }}
                  >
                    {user.fullName[0]}
                  </div>
                  <span className="hidden sm:block text-sm" style={{ color: "#F0EDEB" }}>
                    {user.fullName.split(" ").slice(-1)[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" style={{ color: "#8585A0" }} />
                </button>

                {profileOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-52 rounded-xl py-2 z-50"
                    style={{ background: "#1A1A24", border: "1px solid rgba(255,255,255,0.1)" }}
                    onMouseLeave={() => setProfileOpen(false)}
                  >
                    <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                      <p className="text-sm font-medium" style={{ color: "#F0EDEB" }}>{user.fullName}</p>
                      <p className="text-xs" style={{ color: "#8585A0" }}>{user.role}</p>
                    </div>
                    {user?.role === "AUDIENCE" && (
                      <DropdownItem icon={<Ticket className="w-4 h-4" />} label="Vé của tôi" to="/my-tickets" onClick={() => setProfileOpen(false)} />
                    )}
                    {dashboardLink && (
                      <DropdownItem icon={<LayoutDashboard className="w-4 h-4" />} label={dashboardLabel!} to={dashboardLink} onClick={() => setProfileOpen(false)} />
                    )}
                    <button
                      onClick={() => { onLogout?.(); setProfileOpen(false); navigate("/login"); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors hover:bg-white/5"
                      style={{ color: "#E8315B" }}
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:block text-sm px-4 py-2 rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: "#F0EDEB" }}
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="text-sm px-4 py-2 rounded-lg font-medium transition-all"
                  style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff" }}
                >
                  Đăng ký
                </Link>
              </>
            )}

            <button
              className="md:hidden p-2 rounded-lg"
              style={{ color: "#F0EDEB" }}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden border-t px-4 py-4 space-y-2"
          style={{ background: "rgba(8,8,14,0.97)", borderColor: "rgba(255,255,255,0.07)" }}
        >
          <MobileNavLink to="/" label="Trang chủ" onClick={() => setMenuOpen(false)} />
          <MobileNavLink to="/events" label="Khám phá" onClick={() => setMenuOpen(false)} />
          {user ? (
            <>
              {user?.role === "AUDIENCE" && <MobileNavLink to="/my-tickets" label="Vé của tôi" onClick={() => setMenuOpen(false)} />}
              {dashboardLink && <MobileNavLink to={dashboardLink} label={dashboardLabel!} onClick={() => setMenuOpen(false)} />}
              <button
                onClick={() => { onLogout?.(); setMenuOpen(false); navigate("/login"); }}
                className="w-full text-left text-sm px-3 py-2 rounded-lg"
                style={{ color: "#E8315B" }}
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

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-sm transition-colors"
      style={{ color: active ? "#F5C842" : "#8585A0" }}
    >
      {children}
    </Link>
  );
}

function DropdownItem({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-white/5"
      style={{ color: "#F0EDEB" }}
    >
      {icon}
      {label}
    </Link>
  );
}

function MobileNavLink({ to, label, onClick }: { to: string; label: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block text-sm px-3 py-2 rounded-lg"
      style={{ color: "#F0EDEB" }}
    >
      {label}
    </Link>
  );
}
