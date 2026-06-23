import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  Plus,
  ShieldCheck,
  Ticket,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import { getAdminCatalogData, type ConcertSummary } from "../../services/admin-catalog.service";

type LoadState = "loading" | "ready" | "error";

export function AdminHomePage() {
  const session = getStoredAuthSession();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [venueCount, setVenueCount] = useState(0);

  useEffect(() => {
    if (session?.user.role !== "ADMIN") return;

    let ignore = false;
    setLoadState("loading");
    getAdminCatalogData()
      .then((data) => {
        if (ignore) return;
        setConcerts(data.concerts);
        setVenueCount(data.venues.length);
        setLoadState("ready");
      })
      .catch(() => {
        if (!ignore) setLoadState("error");
      });

    return () => {
      ignore = true;
    };
  }, [session?.user.role]);

  if (session?.user.role !== "ADMIN") {
    return <AdminAccessState role={session?.user.role} />;
  }

  const stats = useMemo(() => {
    const published = concerts.filter((concert) => concert.status === "PUBLISHED").length;
    const drafts = concerts.filter((concert) => concert.status === "DRAFT").length;
    const upcoming = concerts.filter((concert) => new Date(concert.starts_at) > new Date()).length;

    return [
      {
        label: "Sự kiện đã đăng",
        value: published,
        icon: <CheckCircle2 className="h-4 w-4" />,
        tone: "#2DBE6C",
      },
      {
        label: "Bản nháp",
        value: drafts,
        icon: <Activity className="h-4 w-4" />,
        tone: "#F5C842",
      },
      {
        label: "Sắp diễn ra",
        value: upcoming,
        icon: <CalendarDays className="h-4 w-4" />,
        tone: "#7B61FF",
      },
      {
        label: "Địa điểm",
        value: venueCount,
        icon: <Building2 className="h-4 w-4" />,
        tone: "#E8315B",
      },
    ];
  }, [concerts, venueCount]);

  const recentConcerts = useMemo(
    () =>
      concerts
        .slice()
        .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
        .slice(0, 5),
    [concerts],
  );

  return (
    <main className="min-h-screen bg-[#08080E] px-4 pb-12 pt-24 text-[#F0EDEB] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
              <ShieldCheck className="h-4 w-4" />
              Vận hành hệ thống
            </div>
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Bảng điều hành admin
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#8585A0]">
              Theo dõi danh mục, duyệt hồ sơ ban tổ chức, đăng công khai concert và vận hành nền tảng TicketBox.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/catalog"
              className="inline-flex items-center gap-2 rounded-lg bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              Danh mục
            </Link>
            <Link
              to="/events"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-[#F0EDEB]"
            >
              Trang khách
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {loadState === "error" && (
          <div className="mb-5 rounded-lg border border-[#E8315B]/25 bg-[#E8315B]/10 px-4 py-3 text-sm text-[#E8315B]">
            Không thể tải dữ liệu quản trị.
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-white/10 bg-[#111118] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-[#8585A0]">{item.label}</span>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: `${item.tone}18`, color: item.tone }}
                >
                  {item.icon}
                </span>
              </div>
              <p className="text-2xl font-bold">{loadState === "loading" ? "--" : item.value}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#111118]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Sự kiện gần đây</h2>
                <p className="mt-1 text-xs text-[#8585A0]">{concerts.length} bản ghi catalog</p>
              </div>
              <Link
                to="/admin/catalog"
                className="inline-flex items-center gap-1 text-xs text-[#F5C842]"
              >
                Xem tất cả
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {loadState === "loading" && <EmptyRow text="Đang tải catalog..." />}
              {loadState === "ready" && recentConcerts.length === 0 && <EmptyRow text="Chưa có sự kiện." />}
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
            <OperatorLink
              to="/admin/catalog"
              icon={<LayoutDashboard className="h-4 w-4" />}
              title="Điều phối catalog"
              detail="Sự kiện, địa điểm, khu ghế và loại vé"
            />
            <OperatorLink
              to="/admin/organizer-requests"
              icon={<UserCheck className="h-4 w-4" />}
              title="Duyệt hồ sơ BTC"
              detail="Xem xét hồ sơ và cấp tài khoản soát vé"
            />
            <OperatorLink
              to="/admin/catalog"
              icon={<Ticket className="h-4 w-4" />}
              title="Cấu hình vé"
              detail="Tồn kho, giới hạn và khung giờ mở bán"
            />
            <div className="rounded-lg border border-white/10 bg-[#111118] p-5">
              <p className="mb-2 text-xs font-semibold uppercase text-[#F5C842]">Ranh giới vai trò</p>
              <p className="text-sm leading-6 text-[#8585A0]">
                Admin vận hành website. Organizer thuộc ban tổ chức sự kiện. Checker chỉ dùng cho soát vé tại cổng.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminAccessState({ role }: { role?: string }) {
  const label = role ?? "guest";

  return (
    <main className="min-h-screen bg-[#08080E] px-4 pt-28 text-[#F0EDEB]">
      <section className="mx-auto max-w-xl rounded-lg border border-white/10 bg-[#111118] p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8315B]/15 text-[#E8315B]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="mb-2 text-xl font-semibold">Chỉ dành cho admin</h1>
        <p className="mb-5 text-sm leading-6 text-[#8585A0]">
          Vai trò hiện tại: {label}. Khu vực này chỉ dành cho tài khoản vận hành hệ thống.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Về trang khách
          <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function OperatorLink({
  to,
  icon,
  title,
  detail,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-lg border border-white/10 bg-[#111118] p-4 transition-colors hover:border-[#F5C842]/35"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5C842]/15 text-[#F5C842]">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs text-[#8585A0]">{detail}</span>
        </span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#8585A0]" />
    </Link>
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
    <span
      className="inline-flex w-fit items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
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
