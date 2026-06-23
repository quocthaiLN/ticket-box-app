import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  KeyRound,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import {
  approveAdminOrganizerRequest,
  getAdminOrganizerRequest,
  listAdminOrganizerRequests,
  rejectAdminOrganizerRequest,
  type ApproveOrganizerRequestResult,
  type AdminOrganizerRequestSummary,
} from "../../services/admin-organizer.service";
import {
  normalizeTicketTypes,
  type ApprovalStatus,
  type OrganizerRequestDetail,
} from "../../services/organizer.service";
import {
  approveResultTitle,
  toAdminOrganizerRequestDetailView,
  toAdminOrganizerRequestView,
} from "./admin-organizer.view-model";

type LoadState = "loading" | "ready" | "error";
const statuses = ["all", "PENDING", "APPROVED", "REJECTED"] as const;

export function AdminOrganizerRequestsPage() {
  const session = getStoredAuthSession();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [filter, setFilter] = useState<(typeof statuses)[number]>("all");
  const [requests, setRequests] = useState<AdminOrganizerRequestSummary[]>([]);
  const [details, setDetails] = useState<Record<string, OrganizerRequestDetail>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("");
  const [approveResult, setApproveResult] = useState<ApproveOrganizerRequestResult | null>(null);

  const canUseAdmin = session?.user.role === "ADMIN";

  useEffect(() => {
    if (canUseAdmin) void reload(filter);
  }, [canUseAdmin, filter]);

  async function reload(status = filter) {
    setLoadState("loading");
    setMessage("");
    try {
      const data = await listAdminOrganizerRequests(status);
      setRequests(data);
      setLoadState("ready");
    } catch (err) {
      setLoadState("error");
      setMessage(err instanceof Error ? err.message : "Không thể tải hồ sơ ban tổ chức.");
    }
  }

  async function toggleRequest(requestId: string) {
    setExpandedId((current) => (current === requestId ? null : requestId));
    if (details[requestId]) return;
    try {
      const detail = await getAdminOrganizerRequest(requestId);
      setDetails((current) => ({ ...current, [requestId]: detail }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể tải chi tiết hồ sơ.");
    }
  }

  async function approve(requestId: string) {
    setMessage("");
    setApproveResult(null);
    try {
      const result = await approveAdminOrganizerRequest(requestId);
      setApproveResult(result);
      setReviewingId(null);
      setReviewNote("");
      setMessage("Đã duyệt hồ sơ. Mật khẩu tài khoản soát vé chỉ hiển thị một lần bên dưới.");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể duyệt hồ sơ.");
    }
  }

  async function reject(requestId: string) {
    setMessage("");
    try {
      await rejectAdminOrganizerRequest(requestId, reviewNote);
      setReviewingId(null);
      setReviewNote("");
      setMessage("Đã từ chối hồ sơ.");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể từ chối hồ sơ.");
    }
  }

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} />;
  }

  const pendingCount = requests.filter((request) => request.status === "PENDING").length;

  return (
    <div className="flex min-h-screen bg-[#08080E] pt-16 text-[#F0EDEB]">
      <aside className="fixed bottom-0 left-0 top-16 hidden w-56 flex-col border-r border-white/[0.07] bg-[#0D0D15] px-3 py-6 md:flex">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-widest text-[#8585A0]">Quản trị</div>
        <nav className="flex-1 space-y-1">
          <AdminSideLink to="/admin" active={false} icon={<LayoutDashboard className="h-4 w-4" />} label="Tổng quan" />
          <AdminSideLink to="/admin/organizer-requests" active icon={<FileText className="h-4 w-4" />} label="Hồ sơ BTC" badge={pendingCount} />
          <AdminSideLink to="/admin/deletion-requests" active={false} icon={<Trash2 className="h-4 w-4" />} label="Yêu cầu hủy" />
          <AdminSideLink to="/admin/catalog" active={false} icon={<Ticket className="h-4 w-4" />} label="Danh mục" />
        </nav>
        <Link to="/events" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#8585A0] transition-colors hover:bg-white/5">
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Trang khách
        </Link>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 md:ml-56">
        <section className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
                <ShieldCheck className="h-4 w-4" />
                Duyệt hồ sơ
              </div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                Hồ sơ ban tổ chức
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#8585A0]">
                Xem xét hồ sơ, tạo concert sau khi duyệt và bàn giao thông tin soát vé một lần.
              </p>
            </div>
            {pendingCount > 0 && (
              <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#F5C842]/25 bg-[#F5C842]/10 px-3 py-1.5 text-sm font-semibold text-[#F5C842]">
                <Clock className="h-4 w-4" />
                {pendingCount} chờ duyệt
              </div>
            )}
          </div>

          {message && <Message text={message} error={loadState === "error" || message.toLowerCase().includes("không thể")} />}
          {approveResult && <CheckerPasswords result={approveResult} />}

          <section className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Chờ duyệt" value={pendingCount} tone="#F5C842" icon={<Clock className="h-4 w-4" />} />
              <Stat label="Đã duyệt" value={requests.filter((request) => request.status === "APPROVED").length} tone="#2DBE6C" icon={<CheckCircle2 className="h-4 w-4" />} />
              <Stat label="Từ chối" value={requests.filter((request) => request.status === "REJECTED").length} tone="#E8315B" icon={<XCircle className="h-4 w-4" />} />
              <Stat label="Đã tải" value={requests.length} tone="#7B61FF" icon={<FileText className="h-4 w-4" />} />
            </div>
          </section>

          <FilterTabs value={filter} onChange={setFilter} />

          <section className="mt-5 grid gap-3">
            {loadState === "loading" && <LoadingState />}
            {loadState === "ready" && requests.length === 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-10 text-center text-sm text-[#8585A0]">
                Không có hồ sơ phù hợp bộ lọc.
              </div>
            )}
            {requests.map((request) => (
              <RequestReviewCard
                key={request.id}
                request={request}
                detail={details[request.id]}
                expanded={expandedId === request.id}
                reviewing={reviewingId === request.id}
                reviewNote={reviewNote}
                onToggle={() => toggleRequest(request.id)}
                onStartReview={() => {
                  setReviewingId(request.id);
                  setReviewNote("");
                }}
                onCancelReview={() => setReviewingId(null)}
                onReviewNote={setReviewNote}
                onApprove={() => approve(request.id)}
                onReject={() => reject(request.id)}
              />
            ))}
          </section>
        </section>
      </main>
    </div>
  );
}

function AdminSideLink({ to, active, icon, label, badge }: { to: string; active: boolean; icon: ReactNode; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-lg border-l-[3px] px-3 py-2.5 text-sm transition-all"
      style={{
        background: active ? "rgba(245,200,66,0.1)" : "transparent",
        borderLeftColor: active ? "#F5C842" : "transparent",
        color: active ? "#F5C842" : "#8585A0",
      }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-[#E8315B]/20 px-1.5 py-0.5 text-xs font-semibold text-[#E8315B]">{badge}</span> : null}
    </Link>
  );
}

function RequestReviewCard({
  request,
  detail,
  expanded,
  reviewing,
  reviewNote,
  onToggle,
  onStartReview,
  onCancelReview,
  onReviewNote,
  onApprove,
  onReject,
}: {
  request: AdminOrganizerRequestSummary;
  detail?: OrganizerRequestDetail;
  expanded: boolean;
  reviewing: boolean;
  reviewNote: string;
  onToggle: () => void;
  onStartReview: () => void;
  onCancelReview: () => void;
  onReviewNote: (value: string) => void;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const requestView = toAdminOrganizerRequestView(request);
  const detailView = detail ? toAdminOrganizerRequestDetailView(detail) : undefined;

  async function run(action: "approve" | "reject") {
    setBusy(action);
    try {
      await (action === "approve" ? onApprove() : onReject());
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
      <div className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-center">
        <button type="button" onClick={onToggle} className="min-w-0 text-left">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ApprovalBadge status={requestView.status} />
            <span className="text-xs text-[#8585A0]">#{requestView.id}</span>
          </div>
          <h2 className="truncate text-sm font-semibold">{requestView.title}</h2>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#8585A0]">
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{requestView.organizerLabel}</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(requestView.startsAt)}</span>
          </div>
        </button>
        <p className="inline-flex items-center gap-1 text-xs text-[#8585A0]"><Building2 className="h-3 w-3" />{requestView.artistName}</p>
        <p className="text-xs text-[#8585A0]">{requestView.gateCount} cổng / {requestView.checkerCount} nhân sự soát vé</p>
        <div className="flex gap-2 lg:justify-end">
          {request.status === "PENDING" && (
            <button type="button" onClick={onStartReview} className="rounded-lg bg-[#F5C842] px-3 py-2 text-xs font-semibold text-[#0D0D14] shadow-[0_6px_18px_rgba(245,200,66,0.22)]">
              Xem xét
            </button>
          )}
          <button type="button" onClick={onToggle} className="rounded-lg p-2 text-[#8585A0] hover:bg-white/10" aria-label={expanded ? "Ẩn chi tiết" : "Mở chi tiết"}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.07] px-5 py-4">
          {!detailView ? (
            <p className="text-sm text-[#8585A0]">Đang tải chi tiết...</p>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm leading-6 text-[#B0B0C0]">{detailView.description}</p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <Detail label="ID địa điểm" value={detailView.venueId} />
                <Detail label="Dự kiến publish" value={detailView.plannedPublishAt ? formatDate(detailView.plannedPublishAt) : "Chưa đặt"} />
                <Detail label="Bộ tư liệu" value={detailView.pressKitLabel} />
                <Detail label="Ghi chú duyệt" value={detailView.reviewNote} />
              </div>
              <div className="grid gap-2">
                {normalizeTicketTypes(detailView.ticketTypes).map((ticket) => (
                  <div key={`${ticket.zone_code}-${ticket.name}`} className="grid gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 md:grid-cols-[minmax(0,1fr)_180px_160px]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{ticket.zone_name} - {ticket.name}</p>
                      <p className="mt-1 text-xs text-[#8585A0]">Khu {ticket.zone_code}, sức chứa {ticket.zone_capacity.toLocaleString("vi-VN")}</p>
                    </div>
                    <p className="text-xs text-[#F5C842]">{formatMoney(ticket.price.amount)}</p>
                    <p className="text-xs text-[#8585A0]">{ticket.total_quantity.toLocaleString("vi-VN")} vé, tối đa {ticket.max_per_user}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {reviewing && (
        <div className="border-t border-[#F5C842]/20 bg-[#F5C842]/[0.04] p-5">
          <div className="mb-3 flex gap-3 rounded-xl border border-[#F5C842]/20 bg-[#F5C842]/[0.06] p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F5C842]" />
            <p className="text-xs text-[#B0B0C0]">Duyệt hồ sơ sẽ tạo concert bản nháp, zone, loại vé, cổng và tài khoản soát vé trong một transaction.</p>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
            Ghi chú khi từ chối
            <textarea value={reviewNote} onChange={(event) => onReviewNote(event.target.value)} className={inputClass} style={inputStyle} />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" disabled={busy !== null} onClick={() => run("approve")} className="inline-flex items-center gap-2 rounded-lg border border-[#2DBE6C]/30 bg-[#2DBE6C]/15 px-4 py-2.5 text-sm font-semibold text-[#2DBE6C]">
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Duyệt
            </button>
            <button type="button" disabled={busy !== null} onClick={() => run("reject")} className="inline-flex items-center gap-2 rounded-lg border border-[#E8315B]/30 bg-[#E8315B]/15 px-4 py-2.5 text-sm font-semibold text-[#E8315B]">
              {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Từ chối
            </button>
            <button type="button" onClick={onCancelReview} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-[#8585A0]">
              Hủy
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function CheckerPasswords({ result }: { result: ApproveOrganizerRequestResult }) {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-[#F5C842]/30 bg-[#F5C842]/[0.06]">
      <div className="border-b border-[#F5C842]/20 px-5 py-4">
        <div className="flex items-center gap-2 text-[#F5C842]">
          <KeyRound className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Thông tin soát vé chỉ hiển thị một lần</h2>
        </div>
        <p className="mt-1 text-xs text-[#8585A0]">
          {approveResultTitle(result)}
        </p>
      </div>
      <div className="grid gap-2 p-5">
        {result.checker_accounts.map((account) => (
          <div key={account.user_id} className="grid gap-2 rounded-xl border border-white/[0.08] bg-[#111118] p-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{account.email}</p>
              <p className="mt-1 text-xs text-[#8585A0]">Mã người dùng: {account.user_id}</p>
            </div>
            <code className="rounded-lg bg-black/30 px-3 py-2 text-sm text-[#F5C842]">{account.password}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminAccessState({ role }: { role?: string }) {
  return (
    <main className="min-h-screen bg-[#08080E] px-4 pt-28 text-[#F0EDEB]">
      <section className="mx-auto max-w-xl rounded-lg border border-white/10 bg-[#111118] p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8315B]/15 text-[#E8315B]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="mb-2 text-xl font-semibold">Chỉ dành cho admin</h1>
        <p className="mb-5 text-sm leading-6 text-[#8585A0]">Vai trò hiện tại: {role ?? "khách"}. Công cụ duyệt hồ sơ chỉ dành cho quản trị viên.</p>
        <Link to="/" className="inline-flex items-center gap-2 rounded-lg bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white">
          Về trang chủ
          <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function FilterTabs({ value, onChange }: { value: (typeof statuses)[number]; onChange: (value: (typeof statuses)[number]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onChange(status)}
          className="rounded-lg px-3 py-2 text-sm"
          style={value === status ? { background: "#F5C842", color: "#0D0D14", fontWeight: 700 } : { background: "rgba(255,255,255,0.05)", color: "#8585A0", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {status === "all" ? "Tất cả" : statusLabel(status)}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-[#8585A0]">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${tone}18`, color: tone }}>{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <p className="text-xs text-[#8585A0]">{label}</p>
      <p className="mt-1 break-words text-sm">{value}</p>
    </div>
  );
}

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const styles: Record<ApprovalStatus, { label: string; bg: string; color: string; icon: ReactNode }> = {
    PENDING: { label: "Chờ duyệt", bg: "rgba(245,200,66,0.12)", color: "#F5C842", icon: <Clock className="h-3.5 w-3.5" /> },
    APPROVED: { label: "Đã duyệt", bg: "rgba(45,190,108,0.12)", color: "#2DBE6C", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    REJECTED: { label: "Từ chối", bg: "rgba(232,49,91,0.12)", color: "#E8315B", icon: <XCircle className="h-3.5 w-3.5" /> },
  };
  const style = styles[status];
  return <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>{style.icon}{style.label}</span>;
}

function Message({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className="mb-5 rounded-2xl border px-4 py-3 text-sm" style={error ? { borderColor: "rgba(232,49,91,0.25)", background: "rgba(232,49,91,0.1)", color: "#E8315B" } : { borderColor: "rgba(45,190,108,0.25)", background: "rgba(45,190,108,0.1)", color: "#2DBE6C" }}>
      {text}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-10 text-center text-[#8585A0]">
      <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
      Đang tải hồ sơ ban tổ chức...
    </div>
  );
}

function statusLabel(status: Exclude<(typeof statuses)[number], "all">) {
  const labels: Record<Exclude<(typeof statuses)[number], "all">, string> = {
    PENDING: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
  };
  return labels[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

const inputClass = "min-h-20 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]";

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  borderColor: "rgba(255,255,255,0.1)",
  color: "#F0EDEB",
};
