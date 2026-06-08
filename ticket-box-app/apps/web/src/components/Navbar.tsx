import { Menu, Search, Ticket, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  function submitSearch(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const value = event.currentTarget.value.trim();
    if (value) navigate(`/events?search=${encodeURIComponent(value)}`);
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
              Home
            </NavItem>
            <NavItem to="/events" active={location.pathname === "/events"}>
              Explore
            </NavItem>
            <NavItem to="/admin" active={location.pathname.startsWith("/admin")}>
              Admin
            </NavItem>
          </div>

          <div className="mx-6 hidden max-w-sm flex-1 items-center gap-2 md:flex">
            <div className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
              <Search className="h-4 w-4 text-[#8585A0]" />
              <input
                type="text"
                placeholder="Search events..."
                className="w-full bg-transparent text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]"
                onKeyDown={submitSearch}
              />
            </div>
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
          <MobileNavLink to="/" label="Home" onClick={() => setMenuOpen(false)} />
          <MobileNavLink to="/events" label="Explore" onClick={() => setMenuOpen(false)} />
          <MobileNavLink to="/admin" label="Admin" onClick={() => setMenuOpen(false)} />
        </div>
      )}
    </nav>
  );
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
