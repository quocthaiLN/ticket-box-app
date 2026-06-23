import { useId } from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard, Users, FileText,
  TrendingUp, Ticket, ArrowRight, Eye, ChevronRight, Clock, XCircle, CheckCircle2, Calendar
} from "lucide-react";
import { CONCERTS, ADMIN_STATS, ORGANIZER_REQUESTS, DELETION_REQUESTS, USERS, formatCurrency } from "../../data/mockData";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";

const COLORS = { PENDING: "#F5C842", APPROVED: "#2DBE6C", REJECTED: "#E8315B" };

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pendingRequests = ORGANIZER_REQUESTS.filter((r) => r.status === "PENDING").length;
  const pendingDeletions = DELETION_REQUESTS.filter((r) => r.status === "PENDING").length;

  const navItems = [
    { to: "/admin", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: "/admin/organizer-requests", label: "Hồ sơ BTC", icon: <FileText className="w-4 h-4" />, badge: pendingRequests },
    { to: "/admin/deletion-requests", label: "Yêu cầu xóa", icon: <XCircle className="w-4 h-4" />, badge: pendingDeletions },
    { to: "/admin/guest-list", label: "Khách mời", icon: <Users className="w-4 h-4" /> },
    { to: "/admin/users", label: "Người dùng", icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: "#08080E", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingTop: "4rem" }}>
      <aside
        className="hidden md:flex flex-col w-56 fixed left-0 top-16 bottom-0 py-6 px-3"
        style={{ background: "#0D0D15", borderRight: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="px-2 mb-4">
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#8585A0" }}>Admin</span>
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/admin" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all"
                style={{
                  background: active ? "rgba(245,200,66,0.1)" : "transparent",
                  color: active ? "#F5C842" : "#8585A0",
                  borderLeft: active ? "3px solid #F5C842" : "3px solid transparent",
                }}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(232,49,91,0.2)", color: "#E8315B" }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/5" style={{ color: "#8585A0" }}>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />Về trang khách
          </Link>
        </div>
      </aside>
      <main className="flex-1 md:ml-56 p-6">{children}</main>
    </div>
  );
}

export function AdminDashboard() {
  const uid = useId();
  const gradId = `revenueGrad-${uid.replace(/:/g, "")}`;
  const stats = ADMIN_STATS;

  const pendingRequests = ORGANIZER_REQUESTS.filter((r) => r.status === "PENDING");
  const pendingDeletions = DELETION_REQUESTS.filter((r) => r.status === "PENDING");

  const statCards = [
    { label: "Hồ sơ chờ duyệt", value: pendingRequests.length.toString(), icon: <FileText className="w-5 h-5" />, color: "#F5C842", bg: "rgba(245,200,66,0.1)", link: "/admin/organizer-requests" },
    { label: "Sự kiện đang chạy", value: CONCERTS.filter((c) => c.status === "PUBLISHED").length.toString(), icon: <Calendar className="w-5 h-5" />, color: "#7B61FF", bg: "rgba(123,97,255,0.1)", link: "/admin/concerts" },
    { label: "Vé đã bán", value: stats.ticketsSold.toLocaleString("vi-VN"), icon: <Ticket className="w-5 h-5" />, color: "#E8315B", bg: "rgba(232,49,91,0.1)", link: "/admin/reports" },
    { label: "Tổng người dùng", value: stats.totalUsers.toLocaleString("vi-VN"), icon: <Users className="w-5 h-5" />, color: "#2DBE6C", bg: "rgba(45,190,108,0.1)", link: "/admin/users" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>Admin Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>Tổng quan quản trị nền tảng TicketBox</p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: "#8585A0" }}>Tổng doanh thu nền tảng</p>
          <p className="text-xl font-bold" style={{ color: "#F5C842", fontFamily: "'Cormorant Garamond', serif" }}>{formatCurrency(stats.totalRevenue)}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <Link key={s.label} to={s.link} className="p-4 rounded-xl transition-all hover:scale-[1.02]" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: "#2DBE6C" }} />
            </div>
            <p className="text-xl font-bold" style={{ color: "#F0EDEB" }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Revenue chart */}
        <div className="xl:col-span-2 p-5 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Doanh thu theo tháng</h3>
            <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(45,190,108,0.1)", color: "#2DBE6C" }}>↑ 15.2% so với năm trước</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.monthlyRevenue} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5C842" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F5C842" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#8585A0", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8585A0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
              <Tooltip contentStyle={{ background: "#1A1A24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#F0EDEB", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), "Doanh thu"]} />
              <Area type="monotone" dataKey="revenue" stroke="#F5C842" strokeWidth={2} fill={`url(#${gradId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ticket distribution */}
        <div className="p-5 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#F0EDEB" }}>Phân bổ loại vé</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={stats.ticketsByType} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                {stats.ticketsByType.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1A1A24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#F0EDEB", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5">
            {stats.ticketsByType.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ background: t.color }} />
                  <span style={{ color: "#8585A0" }}>{t.name}</span>
                </div>
                <span style={{ color: "#F0EDEB" }}>{t.value.toLocaleString("vi-VN")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pending organizer requests */}
        <div className="p-5 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Hồ sơ BTC chờ duyệt</h3>
            <Link to="/admin/organizer-requests" className="text-xs flex items-center gap-1 transition-colors hover:text-amber-400" style={{ color: "#8585A0" }}>
              Tất cả <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "#2DBE6C" }} />
              <p className="text-xs" style={{ color: "#8585A0" }}>Không có hồ sơ nào đang chờ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,200,66,0.12)", color: "#F5C842" }}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#F0EDEB" }}>{req.title}</p>
                    <p className="text-xs" style={{ color: "#8585A0" }}>{req.organizerName} · {req.title}</p>
                  </div>
                  <Link to="/admin/organizer-requests" className="text-xs px-2.5 py-1 rounded-lg transition-colors hover:bg-white/10" style={{ color: "#F5C842", border: "1px solid rgba(245,200,66,0.25)" }}>
                    Xem
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent concerts */}
        <div className="p-5 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Sự kiện gần đây</h3>
            <Link to="/admin/concerts" className="text-xs flex items-center gap-1 transition-colors hover:text-amber-400" style={{ color: "#8585A0" }}>
              Tất cả <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {CONCERTS.slice(0, 4).map((concert) => {
              const totalSold = concert.ticketTypes.reduce((s, t) => s + t.soldQuantity, 0);
              const totalQ = concert.ticketTypes.reduce((s, t) => s + t.totalQuantity, 0);
              const pct = totalQ > 0 ? Math.round((totalSold / totalQ) * 100) : 0;
              return (
                <div key={concert.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-white/5">
                  <ImageWithFallback src={concert.coverImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#F0EDEB" }}>{concert.title}</p>
                    <p className="text-xs" style={{ color: "#8585A0" }}>{concert.venue.city} · {pct}% vé bán</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={concert.status} />
                    <Link to={`/admin/concerts/${concert.id}`} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: "#8585A0" }}>
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const roleColors: Record<string, { bg: string; color: string }> = {
    ADMIN: { bg: "rgba(232,49,91,0.1)", color: "#E8315B" },
    ORGANIZER: { bg: "rgba(245,200,66,0.1)", color: "#F5C842" },
    CHECKER: { bg: "rgba(123,97,255,0.1)", color: "#7B61FF" },
    AUDIENCE: { bg: "rgba(255,255,255,0.07)", color: "#8585A0" },
  };

  return (
    <div>
      <div className="mb-6">
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>Người dùng</h1>
        <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>Quản lý tài khoản và phân quyền</p>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Họ tên", "Email", "Role", "Trạng thái", "Ngày tạo", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#8585A0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {USERS.map((u) => {
              const rc = roleColors[u.role] ?? roleColors.AUDIENCE;
              return (
                <tr key={u.id} className="transition-colors hover:bg-white/[0.03]" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: "#F0EDEB" }}>{u.fullName}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#8585A0" }}>{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: rc.bg, color: rc.color }}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: u.status === "ACTIVE" ? "rgba(45,190,108,0.1)" : "rgba(232,49,91,0.1)", color: u.status === "ACTIVE" ? "#2DBE6C" : "#E8315B" }}>
                      {u.status === "ACTIVE" ? "Hoạt động" : "Tạm khóa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#8585A0" }}>{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
                  <td className="px-4 py-3">
                    <button className="text-xs px-2.5 py-1 rounded-lg transition-colors hover:bg-white/10" style={{ color: "#8585A0", border: "1px solid rgba(255,255,255,0.08)" }}>
                      Sửa
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PUBLISHED: { bg: "rgba(45,190,108,0.1)", color: "#2DBE6C", label: "Đã đăng" },
    DRAFT: { bg: "rgba(245,200,66,0.1)", color: "#F5C842", label: "Nháp" },
    CANCELLED: { bg: "rgba(232,49,91,0.1)", color: "#E8315B", label: "Đã hủy" },
    COMPLETED: { bg: "rgba(255,255,255,0.08)", color: "#8585A0", label: "Xong" },
  };
  const s = map[status] || map.DRAFT;
  return <span className="px-2 py-0.5 rounded text-xs" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}
