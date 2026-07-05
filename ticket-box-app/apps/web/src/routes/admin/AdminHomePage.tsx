import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  ShieldCheck,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import { listAdminConcerts, type ConcertSummary } from "../../lib/api-client";
import { listAdminUsers } from "../../services/admin-account.service";
import {
  listAdminConcertDeletionRequests,
  listAdminOrganizerRequests,
  type AdminOrganizerRequestSummary,
} from "../../services/admin-organizer.service";
import { AdminAccessState, AdminShell } from "./AdminShell";

type LoadState = "loading" | "ready" | "error";

export function AdminHomePage() {
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AdminOrganizerRequestSummary[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!canUseAdmin) return;

    let ignore = false;
    setLoadState("loading");
    setMessage("");

    Promise.allSettled([
      listAdminConcerts(),
      listAdminOrganizerRequests("PENDING"),
      listAdminConcertDeletionRequests("PENDING"),
      listAdminUsers(),
    ])
      .then(([concertResult, requestResult, deletionResult, userResult]) => {
        if (ignore) return;

        const failed: string[] = [];

        if (concertResult.status === "fulfilled") {
          setConcerts(concertResult.value);
        } else {
          setConcerts([]);
          failed.push("sự kiện");
        }

        if (requestResult.status === "fulfilled") {
          setPendingRequests(requestResult.value);
        } else {
          setPendingRequests([]);
          failed.push("hồ sơ BTC");
        }

        if (deletionResult.status === "fulfilled") {
          setPendingDeletions(deletionResult.value.length);
        } else {
          setPendingDeletions(0);
          failed.push("yêu cầu hủy");
        }

        if (userResult.status === "fulfilled") {
          setUserCount(userResult.value.length);
        } else {
          setUserCount(0);
          failed.push("account");
        }

        setMessage(failed.length > 0 ? `Không thể tải dữ liệu: ${failed.join(", ")}.` : "");
        setLoadState(failed.length === 4 ? "error" : "ready");
      });

    return () => {
      ignore = true;
    };
  }, [canUseAdmin]);

  const activeConcerts = useMemo(
    () => concerts.filter((concert) => concert.status === "PUBLISHED"),
    [concerts],
  );

  const recentConcerts = useMemo(
    () =>
      concerts
        .slice()
        .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
        .slice(0, 4),
    [concerts],
  );

  const statCards = [
    {
      label: "Hồ sơ chờ duyệt",
      value: pendingRequests.length,
      icon: FileText,
      tone: "#F5C842",
      bg: "rgba(245,200,66,0.1)",
      to: "/admin/organizer-requests",
    },
    {
      label: "Sự kiện đang chạy",
      value: activeConcerts.length,
      icon: Calendar,
      tone: "#7B61FF",
      bg: "rgba(123,97,255,0.1)",
    },
    {
      label: "Yêu cầu hủy",
      value: pendingDeletions,
      icon: AlertTriangle,
      tone: "#E8315B",
      bg: "rgba(232,49,91,0.1)",
      to: "/admin/deletion-requests",
    },
    {
      label: "Tổng account",
      value: userCount,
      icon: Users,
      tone: "#2DBE6C",
      bg: "rgba(45,190,108,0.1)",
      to: "/admin/accounts",
    },
  ];

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} />;
  }

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
              <ShieldCheck className="h-4 w-4" />
              Admin dashboard
            </div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Tổng quan vận hành
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#8585A0]">
              Theo dõi hồ sơ BTC, yêu cầu hủy, sự kiện đang chạy và account trong một màn hình điều phối.
            </p>
          </div>
        </div>

        {message && (
          <div className="mb-5 rounded-2xl border border-[#E8315B]/25 bg-[#E8315B]/10 px-4 py-3 text-sm text-[#E8315B]">
            {message}
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => (
            <StatCard
              key={item.label}
              {...item}
              value={loadState === "loading" ? "--" : item.value.toLocaleString("vi-VN")}
            />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Hồ sơ BTC chờ duyệt</h2>
              <Link to="/admin/organizer-requests" className="inline-flex items-center gap-1 text-xs text-[#F5C842]">
                Tất cả
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {loadState === "loading" && <EmptyBlock text="Đang tải hồ sơ..." />}
            {loadState !== "loading" && pendingRequests.length === 0 && (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[#2DBE6C]" />
                <p className="text-sm text-[#8585A0]">Không có hồ sơ nào đang chờ.</p>
              </div>
            )}
            <div className="space-y-3">
              {pendingRequests.slice(0, 4).map((request) => (
                <Link
                  key={request.id}
                  to="/admin/organizer-requests"
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5C842]/10 text-[#F5C842]">
                    <Clock className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{request.title}</span>
                    <span className="mt-1 block truncate text-xs text-[#8585A0]">
                      {request.artist_name} - {formatDate(request.starts_at)}
                    </span>
                  </span>
                  <span className="rounded-lg border border-[#F5C842]/25 px-2.5 py-1 text-xs font-semibold text-[#F5C842]">
                    Xem
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Sự kiện gần đây</h2>
            </div>
            {loadState === "loading" && <EmptyBlock text="Đang tải sự kiện..." />}
            {loadState !== "loading" && recentConcerts.length === 0 && <EmptyBlock text="Chưa có sự kiện." />}
            <div className="space-y-3">
              {recentConcerts.map((concert) => (
                <div key={concert.id} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.04]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1A1A24]">
                    {concert.cover_image_url ? (
                      <img src={concert.cover_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Calendar className="h-5 w-5 text-[#8585A0]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{concert.title}</p>
                    <p className="mt-1 truncate text-xs text-[#8585A0]">
                      {concert.venue.city} - {formatDate(concert.starts_at)}
                    </p>
                  </div>
                  <StatusChip status={concert.status} />
                  <Link
                    to={`/admin/concerts/${concert.id}/preview`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8585A0] hover:bg-white/10 hover:text-[#F0EDEB]"
                    title="Xem trước"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  bg,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
  bg: string;
  to?: string;
}) {
  const content = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: bg, color: tone }}>
          <Icon className="h-5 w-5" />
        </span>
        {to && <ChevronRight className="h-4 w-4 text-[#8585A0] opacity-70 transition-opacity group-hover:opacity-100" />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-[#8585A0]">{label}</p>
    </>
  );

  if (!to) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-4">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="group rounded-2xl border border-white/[0.07] bg-[#111118] p-4 transition-all hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-[#15151F]"
    >
      {content}
    </Link>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-[#8585A0]">{text}</p>;
}

function StatusChip({ status }: { status: ConcertSummary["status"] }) {
  const map: Record<ConcertSummary["status"], { bg: string; color: string; label: string; icon: LucideIcon }> = {
    PUBLISHED: { bg: "rgba(45,190,108,0.1)", color: "#2DBE6C", label: "Đã đăng", icon: CheckCircle2 },
    DRAFT: { bg: "rgba(245,200,66,0.1)", color: "#F5C842", label: "Nháp", icon: Clock },
    CANCELLED: { bg: "rgba(232,49,91,0.1)", color: "#E8315B", label: "Đã hủy", icon: XCircle },
    COMPLETED: { bg: "rgba(255,255,255,0.08)", color: "#8585A0", label: "Xong", icon: CheckCircle2 },
  };
  const item = map[status];
  const Icon = item.icon;
  return (
    <span className="hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex" style={{ background: item.bg, color: item.color }}>
      <Icon className="h-3.5 w-3.5" />
      {item.label}
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
