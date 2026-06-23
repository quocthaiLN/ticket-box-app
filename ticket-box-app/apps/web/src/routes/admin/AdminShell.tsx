import {
  ChevronRight,
  FileText,
  LayoutDashboard,
  Ticket,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

type AdminShellProps = {
  children: React.ReactNode;
};

const navItems: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/admin/organizer-requests", label: "Hồ sơ BTC", icon: FileText },
  { to: "/admin/deletion-requests", label: "Yêu cầu hủy", icon: Trash2 },
  { to: "/admin/catalog", label: "Danh mục", icon: Ticket },
];

export function AdminShell({ children }: AdminShellProps) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-[#08080E] pt-16 text-[#F0EDEB]">
      <aside className="fixed bottom-0 left-0 top-16 hidden w-56 flex-col border-r border-white/[0.07] bg-[#0D0D15] px-3 py-6 md:flex">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-widest text-[#8585A0]">
          Quản trị
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active =
              location.pathname === item.to ||
              (item.to !== "/admin" && location.pathname.startsWith(item.to));
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2.5 rounded-lg border-l-[3px] px-3 py-2.5 text-sm transition-all"
                style={{
                  background: active ? "rgba(245,200,66,0.1)" : "transparent",
                  borderLeftColor: active ? "#F5C842" : "transparent",
                  color: active ? "#F5C842" : "#8585A0",
                }}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <Link
          to="/events"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#8585A0] transition-colors hover:bg-white/5"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Trang khách
        </Link>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 md:ml-56">
        {children}
      </main>
    </div>
  );
}
