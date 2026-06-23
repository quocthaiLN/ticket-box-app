import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  ShieldCheck,
  Ticket,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import { getAdminCatalogData, type ConcertSummary } from "../../services/admin-catalog.service";
import { listAdminOrganizerRequests } from "../../services/admin-organizer.service";
import { AdminShell } from "./AdminShell";

type LoadState = "loading" | "ready" | "error";

export function AdminHomePage() {
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [venueCount, setVenueCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    if (!canUseAdmin) return;

    let ignore = false;
    setLoadState("loading");
    Promise.all([getAdminCatalogData(), listAdminOrganizerRequests("PENDING")])
      .then(([catalog, requests]) => {
        if (ignore) return;
        setConcerts(catalog.concerts);
        setVenueCount(catalog.venues.length);
        setPendingRequests(requests.length);
        setLoadState("ready");
      })
      .catch(() => {
        if (!ignore) setLoadState("error");
      });

    return () => {
      ignore = true;
    };
  }, [canUseAdmin]);

  const stats = useMemo(() => {
    const published = concerts.filter((concert) => concert.status === "PUBLISHED").length;
    const drafts = concerts.filter((concert) => concert.status === "DRAFT").length;
    const cancelled = concerts.filter((concert) => concert.status === "CANCELLED").length;

    return [
      {
        label: "Hồ sơ chờ duyệt",
        value: pendingRequests,
        icon: FileText,
        tone: "#F5C842",
        to: "/admin/organizer-requests",
      },
      {
        label: "Concert đã đăng",
        value: published,
        icon: CheckCircle2,
        tone: "#2DBE6C",
        to: "/admin/catalog",
      },
      {
        label: "Bản nháp từ duyệt",
        value: drafts,
        icon: Activity,
        tone: "#7B61FF",
        to: "/admin/catalog",
      },
      {
        label: "Đã hủy",
        value: cancelled,
        icon: XCircle,
        tone: "#E8315B",
        to: "/admin/catalog",
      },
    ];
  }, [concerts, pendingRequests]);

  const recentConcerts = useMemo(
    () =>
      concerts
        .slice()
        .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
        .slice(0, 5),
    [concerts],
  );

  const statusSeries = useMemo(
    () => [
      { label: "Đã đăng", value: concerts.filter((concert) => concert.status === "PUBLISHED").length, tone: "#2DBE6C" },
      { label: "Nháp", value: concerts.filter((concert) => concert.status === "DRAFT").length, tone: "#F5C842" },
      { label: "Đã hủy", value: concerts.filter((concert) => concert.status === "CANCELLED").length, tone: "#E8315B" },
      { label: "Hoàn tất", value: concerts.filter((concert) => concert.status === "COMPLETED").length, tone: "#8585A0" },
    ],
    [concerts],
  );

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} />;
  }

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
              <ShieldCheck className="h-4 w-4" />
              Vận hành hệ thống
            </div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Bảng điều hành admin
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#8585A0]">
              Theo dõi catalog, duyệt hồ sơ ban tổ chức, publish hoặc hủy concert theo đúng ranh giới Sprint 6.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/organizer-requests"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F5C842] px-4 py-2.5 text-sm font-semibold text-[#0D0D14] transition-transform hover:scale-[1.02]"
            >
              <FileText className="h-4 w-4" />
              Duyệt hồ sơ BTC
            </Link>
            <Link
              to="/admin/catalog"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-[#F0EDEB]"
            >
              Điều phối catalog
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {loadState === "error" && (
          <div className="mb-5 rounded-2xl border border-[#E8315B]/25 bg-[#E8315B]/10 px-4 py-3 text-sm text-[#E8315B]">
            Không thể tải dữ liệu quản trị.
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <DashboardCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={loadState === "loading" ? "--" : item.value.toLocaleString("vi-VN")}
              tone={item.tone}
              to={item.to}
            />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Catalog gần đây</h2>
                <p className="mt-1 text-xs text-[#8585A0]">
                  {concerts.length} concert, {venueCount} địa điểm
                </p>
              </div>
              <Link to="/admin/catalog" className="inline-flex items-center gap-1 text-xs text-[#F5C842]">
                Xem tất cả
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {loadState === "loading" && <EmptyRow text="Đang tải catalog..." />}
              {loadState === "ready" && recentConcerts.length === 0 && <EmptyRow text="Chưa có concert trong catalog." />}
              {recentConcerts.map((concert) => (
                <Link
                  key={concert.id}
                  to="/admin/catalog"
                  className="grid gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_140px_120px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{concert.title}</p>
                    <p className="mt-1 truncate text-xs text-[#8585A0]">
                      {concert.artist_name} - {concert.venue.name}, {concert.venue.city}
                    </p>
                  </div>
                  <p className="text-xs text-[#8585A0]">{formatDate(concert.starts_at)}</p>
                  <StatusBadge status={concert.status} />
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Phân bổ trạng thái</h2>
                <CalendarDays className="h-4 w-4 text-[#8585A0]" />
              </div>
              <div className="space-y-3">
                {statusSeries.map((item) => (
                  <StatusBar key={item.label} item={item} total={Math.max(concerts.length, 1)} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#F5C842]/20 bg-[#F5C842]/[0.06] p-5">
              <p className="mb-2 text-xs font-semibold uppercase text-[#F5C842]">Sprint 6</p>
              <p className="text-sm leading-6 text-[#B0B0C0]">
                Admin không tạo concert trực tiếp trên Catalog. Concert nháp, khu ghế, loại vé và checker được tạo khi duyệt hồ sơ BTC.
              </p>
              <Link
                to="/admin/organizer-requests"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#F5C842]/25 px-3 py-2 text-xs font-semibold text-[#F5C842]"
              >
                Mở hồ sơ BTC
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

function DashboardCard({
  icon: Icon,
  label,
  value,
  tone,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-white/[0.07] bg-[#111118] p-4 transition-transform hover:scale-[1.01]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-[#8585A0]">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${tone}18`, color: tone }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </Link>
  );
}

function StatusBar({ item, total }: { item: { label: string; value: number; tone: string }; total: number }) {
  const percent = Math.round((item.value / total) * 100);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[#8585A0]">{item.label}</span>
        <span className="font-semibold text-[#F0EDEB]">{item.value.toLocaleString("vi-VN")}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: item.tone }} />
      </div>
    </div>
  );
}

function AdminAccessState({ role }: { role?: string }) {
  return (
    <main className="min-h-screen bg-[#08080E] px-4 pt-28 text-[#F0EDEB]">
      <section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#111118] p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8315B]/15 text-[#E8315B]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="mb-2 text-xl font-semibold">Chỉ dành cho admin</h1>
        <p className="mb-5 text-sm leading-6 text-[#8585A0]">
          Vai trò hiện tại: {role ?? "khách"}. Khu vực này chỉ dành cho tài khoản vận hành hệ thống.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white">
          Về trang khách
          <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-[#8585A0]">{text}</p>;
}

function StatusBadge({ status }: { status: ConcertSummary["status"] }) {
  const styles: Record<ConcertSummary["status"], { label: string; bg: string; color: string }> = {
    PUBLISHED: { label: "Đã đăng", bg: "rgba(45,190,108,0.12)", color: "#2DBE6C" },
    DRAFT: { label: "Nháp", bg: "rgba(245,200,66,0.12)", color: "#F5C842" },
    CANCELLED: { label: "Đã hủy", bg: "rgba(232,49,91,0.12)", color: "#E8315B" },
    COMPLETED: { label: "Hoàn tất", bg: "rgba(255,255,255,0.08)", color: "#8585A0" },
  };
  const style = styles[status];

  return (
    <span className="inline-flex w-fit items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
