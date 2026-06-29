import { useId } from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard, FileText, Calendar, Cpu, ArrowRight,
  TrendingUp, Ticket, Clock, ChevronRight, Eye
} from "lucide-react";
import { CONCERTS, ORGANIZER_REQUESTS, ORGANIZER_STATS, formatCurrency } from "../../data/mockData";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";

export function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pendingCount = ORGANIZER_REQUESTS.filter((r) => r.status === "PENDING").length;

  const navItems = [
    { to: "/organizer", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: "/organizer/requests", label: "Hồ sơ của tôi", icon: <FileText className="w-4 h-4" />, badge: pendingCount },
    { to: "/organizer/concerts", label: "Sự kiện", icon: <Calendar className="w-4 h-4" /> },
    { to: "/organizer/artist-bio", label: "AI Artist Bio", icon: <Cpu className="w-4 h-4" /> },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: "#08080E", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingTop: "4rem" }}>
      <aside
        className="hidden md:flex flex-col w-56 fixed left-0 top-16 bottom-0 py-6 px-3"
        style={{ background: "#0D0D15", borderRight: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="px-2 mb-4">
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#8585A0" }}>Organizer</span>
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/organizer" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all"
                style={{
                  background: active ? "rgba(123,97,255,0.12)" : "transparent",
                  color: active ? "#7B61FF" : "#8585A0",
                  borderLeft: active ? "3px solid #7B61FF" : "3px solid transparent",
                }}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(245,200,66,0.2)", color: "#F5C842" }}>
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

export function OrganizerDashboard() {
  const uid = useId();
  const gradId = `orgRevGrad-${uid.replace(/:/g, "")}`;
  const stats = ORGANIZER_STATS;
  const myConcerts = CONCERTS.filter((c) => c.organizerId === "user-organizer-1");
  const pendingRequests = ORGANIZER_REQUESTS.filter((r) => r.status === "PENDING");

  const statCards = [
    { label: "Tổng doanh thu", value: formatCurrency(stats.totalRevenue), icon: <TrendingUp className="w-5 h-5" />, color: "#F5C842", bg: "rgba(245,200,66,0.1)" },
    { label: "Vé đã bán", value: stats.ticketsSold.toLocaleString("vi-VN"), icon: <Ticket className="w-5 h-5" />, color: "#7B61FF", bg: "rgba(123,97,255,0.1)" },
    { label: "Sự kiện published", value: stats.publishedConcerts.toString(), icon: <Calendar className="w-5 h-5" />, color: "#2DBE6C", bg: "rgba(45,190,108,0.1)" },
    { label: "Hồ sơ đang chờ", value: stats.pendingRequests.toString(), icon: <Clock className="w-5 h-5" />, color: "#E8315B", bg: "rgba(232,49,91,0.1)" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>Organizer Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>Quản lý sự kiện và hồ sơ BTC của bạn</p>
        </div>
        <Link
          to="/organizer/requests/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #7B61FF, #5B41CF)", color: "#fff", boxShadow: "0 6px 20px rgba(123,97,255,0.3)" }}
        >
          <FileText className="w-4 h-4" />
          Tạo hồ sơ mới
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="p-4 rounded-xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            </div>
            <p className="text-xl font-bold" style={{ color: "#F0EDEB" }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Revenue chart */}
        <div className="xl:col-span-2 p-5 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#F0EDEB" }}>Doanh thu theo tháng (concert của tôi)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.monthlyRevenue} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7B61FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#8585A0", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8585A0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
              <Tooltip contentStyle={{ background: "#1A1A24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#F0EDEB", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), "Doanh thu"]} />
              <Area type="monotone" dataKey="revenue" stroke="#7B61FF" strokeWidth={2} fill={`url(#${gradId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top concerts */}
        <div className="p-5 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#F0EDEB" }}>Top concert doanh thu</h3>
          <div className="space-y-3">
            {stats.topConcerts.map((c, i) => {
              const pct = Math.round((c.sold / c.total) * 100);
              return (
                <div key={c.title}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs truncate" style={{ color: "#F0EDEB" }}>{c.title}</span>
                    <span className="text-xs flex-shrink-0 ml-2" style={{ color: "#F5C842" }}>{formatCurrency(c.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ["#7B61FF", "#E8315B", "#F5C842"][i] }} />
                    </div>
                    <span className="text-xs" style={{ color: "#8585A0" }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div className="p-5 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Hồ sơ đang chờ admin duyệt</h3>
              <Link to="/organizer/requests" className="text-xs flex items-center gap-1" style={{ color: "#8585A0" }}>
                Tất cả <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#F5C842" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#F0EDEB" }}>{req.title}</p>
                    <p className="text-xs" style={{ color: "#8585A0" }}>Nộp {new Date(req.createdAt).toLocaleDateString("vi-VN")}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842" }}>Chờ duyệt</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My concerts */}
        <div className="p-5 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Sự kiện của tôi</h3>
            <Link to="/organizer/concerts" className="text-xs flex items-center gap-1" style={{ color: "#8585A0" }}>
              Tất cả <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {myConcerts.slice(0, 4).map((c) => {
              const sold = c.ticketTypes.reduce((s, t) => s + t.soldQuantity, 0);
              const total = c.ticketTypes.reduce((s, t) => s + t.totalQuantity, 0);
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-white/5">
                  <ImageWithFallback src={c.coverImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#F0EDEB" }}>{c.title}</p>
                    <p className="text-xs" style={{ color: "#8585A0" }}>
                      {sold.toLocaleString("vi-VN")}/{total.toLocaleString("vi-VN")} vé bán
                    </p>
                  </div>
                  <StatusChip status={c.status} />
                  <Link to={`/concerts/${c.slug}`} className="p-1.5 rounded-lg transition-colors hover:bg-white/10 flex-shrink-0" style={{ color: "#8585A0" }} title="Xem trang public">
                    <Eye className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PUBLISHED: { bg: "rgba(45,190,108,0.1)", color: "#2DBE6C", label: "Đã đăng" },
    DRAFT:     { bg: "rgba(245,200,66,0.1)", color: "#F5C842", label: "Nháp" },
    CANCELLED: { bg: "rgba(232,49,91,0.1)",  color: "#E8315B", label: "Đã hủy" },
    COMPLETED: { bg: "rgba(255,255,255,0.08)", color: "#8585A0", label: "Xong" },
  };
  const s = map[status] || map.DRAFT;
  return <span className="px-2 py-0.5 rounded text-xs flex-shrink-0" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}
