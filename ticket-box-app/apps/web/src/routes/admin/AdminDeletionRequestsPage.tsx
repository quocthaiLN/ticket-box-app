import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Loader2,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import {
  approveAdminConcertDeletionRequest,
  listAdminConcertDeletionRequests,
  rejectAdminConcertDeletionRequest,
  type AdminConcertDeletionRequest,
} from "../../services/admin-organizer.service";
import type { ApprovalStatus } from "../../services/organizer.service";
import { AdminShell } from "./AdminShell";

type LoadState = "loading" | "ready" | "error";
const statuses = ["all", "PENDING", "APPROVED", "REJECTED"] as const;

export function AdminDeletionRequestsPage() {
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [filter, setFilter] = useState<(typeof statuses)[number]>("all");
  const [requests, setRequests] = useState<AdminConcertDeletionRequest[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (canUseAdmin) void reload(filter);
  }, [canUseAdmin, filter]);

  async function reload(status = filter) {
    setLoadState("loading");
    setMessage("");
    try {
      const data = await listAdminConcertDeletionRequests(status);
      setRequests(data);
      setLoadState("ready");
    } catch (err) {
      setLoadState("error");
      setMessage(err instanceof Error ? err.message : "Không thể tải yêu cầu hủy concert.");
    }
  }

  async function approve(requestId: string) {
    setMessage("");
    try {
      const result = await approveAdminConcertDeletionRequest(requestId);
      setReviewingId(null);
      setReviewNote("");
      setMessage(`Đã duyệt yêu cầu hủy. Concert ${result.concert_id} đã chuyển sang ${result.concert_status}.`);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể duyệt yêu cầu hủy.");
    }
  }

  async function reject(requestId: string) {
    setMessage("");
    try {
      await rejectAdminConcertDeletionRequest(requestId, reviewNote);
      setReviewingId(null);
      setReviewNote("");
      setMessage("Đã từ chối yêu cầu hủy concert.");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể từ chối yêu cầu hủy.");
    }
  }

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} />;
  }

  const pendingCount = requests.filter((request) => request.status === "PENDING").length;

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[1.75rem] font-bold text-[#F0EDEB]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Yêu cầu Hủy Concert
            </h1>
            <p className="mt-0.5 text-sm text-[#8585A0]">
              Duyệt hoặc từ chối yêu cầu hủy concert từ BTC
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#E8315B]/25 bg-[#E8315B]/10 px-3 py-1.5 text-sm font-semibold text-[#E8315B]">
              <Clock className="h-4 w-4" />
              {pendingCount} chờ duyệt
            </div>
          )}
        </div>

        {message && <Message text={message} error={loadState === "error" || message.toLowerCase().includes("không thể")} />}

        <FilterTabs value={filter} pendingCount={pendingCount} onChange={setFilter} />

        <section className="mt-5 space-y-3">
          {loadState === "loading" && <LoadingState />}
          {loadState === "ready" && requests.length === 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-10 text-center text-sm text-[#8585A0]">
              Không có yêu cầu hủy phù hợp bộ lọc.
            </div>
          )}
          {requests.map((request) => (
            <DeletionRequestCard
              key={request.id}
              request={request}
              expanded={expandedId === request.id}
              reviewing={reviewingId === request.id}
              reviewNote={reviewNote}
              onToggle={() => setExpandedId((current) => (current === request.id ? null : request.id))}
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
    </AdminShell>
  );
}

function DeletionRequestCard({
  request,
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
  request: AdminConcertDeletionRequest;
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
  const concertTitle = request.concert?.title ?? `Concert ${request.concert_id}`;
  const organizerLabel = request.organizer?.full_name || request.organizer?.email || request.organizer_id;

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
      <div className="flex items-center gap-4 px-5 py-4">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ApprovalBadge status={request.status} />
            <span className="text-xs text-[#8585A0]">#{request.id}</span>
          </div>
          <h2 className="truncate text-sm font-semibold">{concertTitle}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#8585A0]">
            <span className="inline-flex items-center gap-1"><Trash2 className="h-3 w-3" />{organizerLabel}</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(request.created_at)}</span>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {request.status === "PENDING" && (
            <button
              type="button"
              onClick={onStartReview}
              className="rounded-lg bg-[#E8315B] px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-105"
            >
              Xem xét
            </button>
          )}
          <button type="button" onClick={onToggle} className="rounded-lg p-2 text-[#8585A0] hover:bg-white/10" aria-label={expanded ? "Ẩn chi tiết" : "Mở chi tiết"}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-5 border-t border-white/[0.07] px-5 pb-4 pt-4">
          <section>
            <p className="mb-1 text-xs text-[#8585A0]">Lý do xin hủy</p>
            <p className="max-w-3xl text-sm leading-6 text-[#B0B0C0]">{request.reason || "Không có lý do."}</p>
          </section>

          <section className="grid max-w-3xl gap-3 sm:grid-cols-2">
            <DetailItem label="Concert" value={concertTitle} />
            <DetailItem label="BTC" value={organizerLabel} />
            <DetailItem label="Ngày gửi" value={formatDate(request.created_at)} />
            <DetailItem label="Trạng thái" value={statusLabel(request.status)} />
          </section>

          {request.review_note && (
            <section className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3">
              <p className="mb-1 text-xs font-semibold text-[#8585A0]">Ghi chú review</p>
              <p className="text-xs text-[#B0B0C0]">{request.review_note}</p>
            </section>
          )}
        </div>
      )}

      {reviewing && (
        <div className="border-t border-[#E8315B]/20 bg-[#E8315B]/[0.04] p-5">
          <div className="mb-3 flex gap-3 rounded-xl border border-[#E8315B]/20 bg-[#E8315B]/[0.06] p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#E8315B]" />
            <p className="text-xs text-[#B0B0C0]">
              Duyệt yêu cầu này sẽ chuyển concert sang `CANCELLED`. Backend sẽ vô hiệu hóa checker account gắn với concert trong cùng luồng trạng thái.
            </p>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
            Ghi chú khi từ chối
            <textarea value={reviewNote} onChange={(event) => onReviewNote(event.target.value)} className={inputClass} style={inputStyle} />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" disabled={busy !== null} onClick={() => run("approve")} className="inline-flex items-center gap-2 rounded-lg border border-[#2DBE6C]/30 bg-[#2DBE6C]/15 px-4 py-2.5 text-sm font-semibold text-[#2DBE6C]">
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Duyệt hủy
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

function AdminAccessState({ role }: { role?: string }) {
  return (
    <main className="min-h-screen bg-[#08080E] px-4 pt-28 text-[#F0EDEB]">
      <section className="mx-auto max-w-xl rounded-2xl border border-white/[0.07] bg-[#111118] p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8315B]/15 text-[#E8315B]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="mb-2 text-xl font-semibold">Chỉ dành cho admin</h1>
        <p className="mb-5 text-sm leading-6 text-[#8585A0]">
          Vai trò hiện tại: {role ?? "khách"}. Công cụ duyệt yêu cầu hủy concert chỉ dành cho quản trị viên.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 rounded-lg bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white">
          Về trang chủ
          <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function FilterTabs({
  value,
  pendingCount,
  onChange,
}: {
  value: (typeof statuses)[number];
  pendingCount: number;
  onChange: (value: (typeof statuses)[number]) => void;
}) {
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
          {status === "PENDING" && pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-[#E8315B]/20 px-1.5 py-0.5 text-xs text-[#E8315B]">
              {pendingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const styles: Record<ApprovalStatus, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    PENDING: { label: "Chờ duyệt", bg: "rgba(245,200,66,0.12)", color: "#F5C842", icon: <Clock className="h-3.5 w-3.5" /> },
    APPROVED: { label: "Đã duyệt", bg: "rgba(45,190,108,0.12)", color: "#2DBE6C", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    REJECTED: { label: "Từ chối", bg: "rgba(232,49,91,0.12)", color: "#E8315B", icon: <XCircle className="h-3.5 w-3.5" /> },
  };
  const style = styles[status];
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {style.icon}
      {style.label}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-[#8585A0]">{label}</span>
      <span className="min-w-0 break-words text-right text-xs font-medium text-[#F0EDEB]">{value}</span>
    </div>
  );
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
      Đang tải yêu cầu hủy concert...
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

const inputClass = "min-h-20 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]";

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  borderColor: "rgba(255,255,255,0.1)",
  color: "#F0EDEB",
};
