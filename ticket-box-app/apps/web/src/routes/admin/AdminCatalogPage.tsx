import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Ticket,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import {
  cancelCatalogConcert,
  getAdminCatalogData,
  publishCatalogConcert,
  type ConcertSummary,
  type Venue,
} from "../../services/admin-catalog.service";
import { AdminShell } from "./AdminShell";

type LoadStatus = "loading" | "ready" | "error";
const statusOptions = ["all", "PUBLISHED", "DRAFT", "CANCELLED", "COMPLETED"] as const;

export function AdminCatalogPage() {
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";
  const [venues, setVenues] = useState<Venue[]>([]);
  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [selectedConcertId, setSelectedConcertId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("all");
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (canUseAdmin) void reload();
  }, [canUseAdmin]);

  async function reload() {
    setLoadStatus("loading");
    try {
      const data = await getAdminCatalogData();
      setVenues(data.venues);
      setConcerts(data.concerts);
      setSelectedConcertId((current) => current || data.concerts[0]?.id || "");
      setLoadStatus("ready");
    } catch {
      setLoadStatus("error");
    }
  }

  const filteredConcerts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return concerts.filter((concert) => {
      const matchesSearch =
        !needle ||
        concert.title.toLowerCase().includes(needle) ||
        concert.artist_name.toLowerCase().includes(needle) ||
        concert.venue.city.toLowerCase().includes(needle) ||
        concert.venue.name.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "all" || concert.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [concerts, search, statusFilter]);

  const selectedConcert = useMemo(
    () => concerts.find((concert) => concert.id === selectedConcertId) ?? filteredConcerts[0] ?? concerts[0],
    [concerts, filteredConcerts, selectedConcertId],
  );

  const stats = useMemo(
    () => ({
      total: concerts.length,
      published: concerts.filter((concert) => concert.status === "PUBLISHED").length,
      draft: concerts.filter((concert) => concert.status === "DRAFT").length,
      cancelled: concerts.filter((concert) => concert.status === "CANCELLED").length,
    }),
    [concerts],
  );

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} />;
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setMessage("");
    try {
      await action();
      await reload();
      setMessage(successMessage);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể thực hiện thao tác.");
    }
  }

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
              <ShieldCheck className="h-4 w-4" />
              Quản trị catalog
            </div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Điều phối danh mục sự kiện
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#8585A0]">
              Tập trung vào list, publish, cancel và trạng thái catalog. Concert mới đi qua luồng duyệt hồ sơ ban tổ chức.
            </p>
          </div>
          <Link
            to="/admin/organizer-requests"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#F5C842] px-4 py-2.5 text-sm font-semibold text-[#0D0D14] transition-transform hover:scale-[1.02]"
          >
            <FileText className="h-4 w-4" />
            Mở hồ sơ BTC
          </Link>
        </div>

        {message && <Message text={message} error={isErrorMessage(message)} />}
        {loadStatus === "error" && (
          <div className="mb-5 rounded-2xl border border-[#E8315B]/25 bg-[#E8315B]/10 px-4 py-3 text-sm text-[#E8315B]">
            Không thể tải API quản trị catalog.
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Ticket className="h-4 w-4" />} label="Tất cả concert" value={stats.total} tone="#F5C842" />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Đã đăng" value={stats.published} tone="#2DBE6C" />
          <StatCard icon={<Clock className="h-4 w-4" />} label="Nháp" value={stats.draft} tone="#7B61FF" />
          <StatCard icon={<XCircle className="h-4 w-4" />} label="Đã hủy" value={stats.cancelled} tone="#E8315B" />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#111118] px-3">
                <Search className="h-4 w-4 shrink-0 text-[#8585A0]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm sự kiện, nghệ sĩ, địa điểm..."
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]"
                  style={{ border: 0, background: "transparent" }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as (typeof statusOptions)[number])}
                className="min-h-11 rounded-xl border border-white/10 bg-[#111118] px-3 text-sm text-[#F0EDEB] outline-none sm:w-52"
                style={{ background: "#111118" }}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "Tất cả trạng thái" : statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
              <div className="grid grid-cols-[minmax(220px,1.4fr)_120px_140px_110px_96px] border-b border-white/[0.07] px-4 py-3 text-xs font-semibold text-[#8585A0] max-lg:hidden">
                <span>Sự kiện</span>
                <span>Ngày</span>
                <span>Địa điểm</span>
                <span>Trạng thái</span>
                <span></span>
              </div>

              {loadStatus === "loading" && <EmptyState text="Đang tải catalog..." />}
              {loadStatus === "ready" && filteredConcerts.length === 0 && <EmptyState text="Không có sự kiện phù hợp bộ lọc." />}

              <div className="divide-y divide-white/[0.06]">
                {filteredConcerts.map((concert) => (
                  <button
                    type="button"
                    key={concert.id}
                    onClick={() => setSelectedConcertId(concert.id)}
                    className={`grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] lg:grid-cols-[minmax(220px,1.4fr)_120px_140px_110px_96px] ${
                      selectedConcert?.id === concert.id ? "bg-white/[0.04]" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F0EDEB]">{concert.title}</p>
                      <p className="mt-1 truncate text-xs text-[#8585A0]">{concert.artist_name}</p>
                    </div>
                    <span className="text-xs text-[#8585A0]">{formatDate(concert.starts_at)}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-[#8585A0]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#F5C842]" />
                      <span className="truncate">{concert.venue.city}</span>
                    </span>
                    <StatusBadge status={concert.status} />
                    <span className="flex items-center gap-2 lg:justify-end">
                      <Link
                        to={`/concerts/${concert.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8585A0] hover:bg-white/10 hover:text-[#F0EDEB]"
                        title="Mở trang công khai"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <SelectedConcertPanel
              concert={selectedConcert}
              onPublish={() =>
                selectedConcert
                  ? runAction(() => publishCatalogConcert(selectedConcert.id), "Đã đăng công khai concert.")
                  : Promise.resolve()
              }
              onCancel={() =>
                selectedConcert
                  ? runAction(() => cancelCatalogConcert(selectedConcert.id), "Đã hủy concert.")
                  : Promise.resolve()
              }
            />

            <div className="rounded-2xl border border-[#F5C842]/20 bg-[#F5C842]/[0.06] p-5">
              <p className="mb-2 text-xs font-semibold uppercase text-[#F5C842]">Luồng tạo mới</p>
              <p className="text-sm leading-6 text-[#B0B0C0]">
                Admin không tạo concert, khu ghế hoặc loại vé trực tiếp tại đây. Hãy duyệt hồ sơ BTC để hệ thống materialize concert nháp và cấu hình bán vé trong transaction.
              </p>
              <Link
                to="/admin/organizer-requests"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#F5C842]/25 px-3 py-2 text-xs font-semibold text-[#F5C842]"
              >
                Đi tới hồ sơ BTC
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Địa điểm seed</h2>
                <Building2 className="h-4 w-4 text-[#8585A0]" />
              </div>
              <p className="mb-3 text-xs text-[#8585A0]">
                Organizer dùng danh sách venue read-only khi nộp hồ sơ.
              </p>
              <div className="max-h-48 space-y-2 overflow-auto pr-1">
                {venues.slice(0, 8).map((venue) => (
                  <div key={venue.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="truncate text-sm font-semibold">{venue.name}</p>
                    <p className="mt-1 text-xs text-[#8585A0]">{venue.city}</p>
                  </div>
                ))}
                {venues.length === 0 && <p className="text-sm text-[#8585A0]">Chưa có venue.</p>}
              </div>
            </div>
          </aside>
        </section>
      </section>
    </AdminShell>
  );
}

function SelectedConcertPanel({
  concert,
  onPublish,
  onCancel,
}: {
  concert?: ConcertSummary;
  onPublish: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"publish" | "cancel" | null>(null);

  async function run(kind: "publish" | "cancel", action: () => Promise<void>) {
    setBusy(kind);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
      <p className="mb-1 text-xs uppercase text-[#8585A0]">Concert đang chọn</p>
      {concert ? (
        <>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{concert.title}</h2>
              <p className="mt-1 text-xs text-[#8585A0]">
                {concert.artist_name} - {concert.venue.name}
              </p>
            </div>
            <StatusBadge status={concert.status} />
          </div>
          <div className="mb-4 grid gap-2 text-xs text-[#8585A0]">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-[#F5C842]" />
              {formatDate(concert.starts_at)}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-[#F5C842]" />
              {concert.venue.city}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy !== null || concert.status === "PUBLISHED" || concert.status === "CANCELLED"}
              onClick={() => run("publish", onPublish)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#2DBE6C]/30 bg-[#2DBE6C]/15 px-3 py-2 text-sm font-semibold text-[#2DBE6C] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy === "publish" ? "Đang đăng..." : "Đăng"}
            </button>
            <button
              type="button"
              disabled={busy !== null || concert.status === "CANCELLED" || concert.status === "COMPLETED"}
              onClick={() => run("cancel", onCancel)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E8315B]/30 bg-[#E8315B]/15 px-3 py-2 text-sm font-semibold text-[#E8315B] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <XCircle className="h-4 w-4" />
              {busy === "cancel" ? "Đang hủy..." : "Hủy"}
            </button>
          </div>
          <Link
            to={`/concerts/${concert.id}`}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-[#F0EDEB]"
          >
            <Eye className="h-4 w-4" />
            Mở trang công khai
          </Link>
        </>
      ) : (
        <p className="text-sm text-[#8585A0]">Chưa chọn concert.</p>
      )}
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
          Vai trò hiện tại: {role ?? "khách"}. Organizer và checker dùng khu vực riêng theo vai trò.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white">
          Về trang khách
          <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function Message({ text, error }: { text: string; error?: boolean }) {
  return (
    <div
      className="mb-5 rounded-2xl border px-4 py-3 text-sm"
      style={
        error
          ? { borderColor: "rgba(232,49,91,0.25)", background: "rgba(232,49,91,0.1)", color: "#E8315B" }
          : { borderColor: "rgba(45,190,108,0.25)", background: "rgba(45,190,108,0.1)", color: "#2DBE6C" }
      }
    >
      {text}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-[#8585A0]">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${tone}18`, color: tone }}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString("vi-VN")}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-[#8585A0]">{text}</p>;
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

function statusLabel(status: Exclude<(typeof statusOptions)[number], "all">) {
  const labels: Record<Exclude<(typeof statusOptions)[number], "all">, string> = {
    PUBLISHED: "Đã đăng",
    DRAFT: "Nháp",
    CANCELLED: "Đã hủy",
    COMPLETED: "Hoàn tất",
  };
  return labels[status];
}

function isErrorMessage(message: string) {
  const text = message.toLowerCase();
  return text.includes("không thể") || text.includes("failed") || text.includes("error");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
