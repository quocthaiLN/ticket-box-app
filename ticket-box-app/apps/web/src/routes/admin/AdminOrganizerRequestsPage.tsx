import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  KeyRound,
  Loader2,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import {
  approveAdminOrganizerRequest,
  getAdminOrganizerRequest,
  listAdminOrganizerRequests,
  rejectAdminOrganizerRequest,
  type AdminOrganizerRequestDetail,
  type ApproveOrganizerRequestResult,
  type AdminOrganizerRequestSummary,
} from "../../services/admin-organizer.service";
import {
  normalizeTicketTypes,
  type ApprovalStatus,
} from "../../services/organizer.service";
import {
  approveResultTitle,
  toAdminOrganizerRequestDetailView,
  toAdminOrganizerRequestView,
} from "./admin-organizer.view-model";
import { AdminShell } from "./AdminShell";

type LoadState = "loading" | "ready" | "error";
const statuses = ["all", "PENDING", "APPROVED", "REJECTED"] as const;

export function AdminOrganizerRequestsPage() {
  const session = getStoredAuthSession();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [filter, setFilter] = useState<(typeof statuses)[number]>("all");
  const [requests, setRequests] = useState<AdminOrganizerRequestSummary[]>([]);
  const [message, setMessage] = useState("");

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
                Hồ sơ Ban Tổ Chức
              </h1>
              <p className="mt-0.5 text-sm text-[#8585A0]">
                Duyệt hồ sơ xin tổ chức concert
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

          <FilterTabs value={filter} pendingCount={pendingCount} onChange={setFilter} />

          <section className="mt-5 space-y-3">
            {loadState === "loading" && <LoadingState />}
            {loadState === "ready" && requests.length === 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-10 text-center text-sm text-[#8585A0]">
                Không có hồ sơ phù hợp bộ lọc.
              </div>
            )}
            {requests.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </section>
      </section>
    </AdminShell>
  );
}

// Dòng hồ sơ: không còn dropdown — hồ sơ đã có concert mở trang concert,
// còn lại mở trang xem xét hồ sơ riêng (tránh field bị giãn khi nội dung dài).
function RequestRow({ request }: { request: AdminOrganizerRequestSummary }) {
  const navigate = useNavigate();
  const requestView = toAdminOrganizerRequestView(request);
  const target = request.concert_id
    ? `/admin/concerts/${request.concert_id}`
    : `/admin/organizer-requests/${request.id}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118] transition-colors hover:border-white/[0.14]">
      <div className="flex items-center gap-4 px-5 py-4">
        <button type="button" onClick={() => navigate(target)} className="min-w-0 flex-1 text-left">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ApprovalBadge status={requestView.status} />
            <span className="text-xs text-[#8585A0]">#{requestView.id}</span>
          </div>
          <h2 className="truncate text-sm font-semibold">{requestView.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#8585A0]">
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{requestView.organizerLabel}</span>
            <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{requestView.venueLabel}</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(requestView.startsAt)}</span>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {request.status === "PENDING" && (
            <Link
              to={`/admin/organizer-requests/${request.id}`}
              className="rounded-lg bg-[#F5C842] px-3 py-1.5 text-xs font-semibold text-[#0D0D14] transition-transform hover:scale-105"
            >
              Xem xét
            </Link>
          )}
          <Link
            to={target}
            className="rounded-lg p-2 text-[#8585A0] hover:bg-white/10"
            aria-label={request.concert_id ? "Mở trang concert" : "Xem chi tiết hồ sơ"}
            title={request.concert_id ? "Mở trang concert (Thông tin · Khách mời · Bio)" : "Xem chi tiết hồ sơ"}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

// Trang xem xét hồ sơ riêng: /admin/organizer-requests/:requestId
export function AdminOrganizerRequestReviewPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";

  const [detail, setDetail] = useState<AdminOrganizerRequestDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");
  const [approveResult, setApproveResult] = useState<ApproveOrganizerRequestResult | null>(null);

  useEffect(() => {
    if (!canUseAdmin || !requestId) return;
    let mounted = true;
    setLoadState("loading");
    getAdminOrganizerRequest(requestId)
      .then((data) => {
        if (!mounted) return;
        setDetail(data);
        setLoadState("ready");
      })
      .catch(() => {
        if (mounted) setLoadState("error");
      });
    return () => {
      mounted = false;
    };
  }, [canUseAdmin, requestId]);

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} />;
  }

  async function run(action: "approve" | "reject") {
    if (!requestId) return;
    setBusy(action);
    setMessage("");
    try {
      if (action === "approve") {
        const result = await approveAdminOrganizerRequest(requestId);
        setApproveResult(result);
        setMessage("Đã duyệt hồ sơ. Mật khẩu tài khoản soát vé chỉ hiển thị một lần bên dưới.");
      } else {
        await rejectAdminOrganizerRequest(requestId, reviewNote);
        setMessage("Đã từ chối hồ sơ.");
      }
      const refreshed = await getAdminOrganizerRequest(requestId);
      setDetail(refreshed);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Thao tác thất bại.");
    } finally {
      setBusy(null);
    }
  }

  const detailView = detail ? toAdminOrganizerRequestDetailView(detail) : undefined;

  return (
    <AdminShell>
      <section className="mx-auto max-w-6xl">
        <Link to="/admin/organizer-requests" className="mb-4 inline-flex items-center gap-1 text-sm text-[#8585A0] hover:text-[#F0EDEB]">
          ← Về danh sách hồ sơ
        </Link>

        {loadState === "loading" && <LoadingState />}
        {loadState === "error" && <Message text="Không tải được chi tiết hồ sơ." error />}

        {detailView && (
          <>
            <div className="mb-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <ApprovalBadge status={detailView.status} />
                <span className="text-xs text-[#8585A0]">#{detailView.id}</span>
              </div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                {detailView.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#8585A0]">
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{detailView.organizerLabel}</span>
                <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{detailView.venueLabel}</span>
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(detailView.startsAt)}</span>
              </div>
            </div>

            {message && <Message text={message} error={message.includes("thất bại") || message.includes("Không")} />}
            {approveResult && <CheckerPasswords result={approveResult} />}
            {detailView.concertId && (
              <Link
                to={`/admin/concerts/${detailView.concertId}`}
                className="mb-5 inline-flex w-fit items-center gap-2 rounded-lg border border-[#F5C842]/25 bg-[#F5C842]/10 px-3 py-2 text-xs font-semibold text-[#F5C842] hover:bg-[#F5C842]/15"
              >
                Mở trang concert (Thông tin · Khách mời · Bio) →
              </Link>
            )}

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              {/* Cột trái: thông tin hồ sơ + loại vé */}
              <div className="space-y-5">
                <section className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
                  <p className="mb-2 text-sm font-semibold text-[#F5C842]">Giới thiệu concert (mô tả / AI sinh từ press kit)</p>
                  <p className="whitespace-pre-line text-sm leading-6 text-[#B0B0C0]">{detailView.description}</p>
                  <div className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
                    <DetailItem label="Nghệ sĩ" value={detailView.artistName} />
                    <DetailItem label="Số cổng check-in" value={`${detailView.gateCount} cổng`} />
                    <DetailItem label="Số checker" value={`${detailView.checkerCount} người`} />
                    <DetailItem label="Dự kiến publish" value={detailView.plannedPublishAt ? formatDate(detailView.plannedPublishAt) : "Chưa đặt"} />
                  </div>
                  <div className="mt-3">
                    <DetailItem label="Press Kit" value={detailView.pressKitLabel} />
                  </div>
                </section>

                <section className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
                  <p className="mb-3 text-sm font-semibold text-[#F0EDEB]">Loại vé đề xuất</p>
                  <div className="space-y-2">
                    {normalizeTicketTypes(detailView.ticketTypes).map((ticket) => (
                      <div
                        key={`${ticket.zone_code}-${ticket.name}`}
                        className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#F0EDEB]">{ticket.zone_name} - {ticket.name}</p>
                          <p className="mt-0.5 text-xs text-[#8585A0]">Capacity: {ticket.zone_capacity.toLocaleString("vi-VN")}</p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <p className="text-xs font-semibold text-[#F5C842]">{formatMoney(ticket.price.amount)}</p>
                          <p className="text-xs text-[#8585A0]">{ticket.total_quantity.toLocaleString("vi-VN")} vé - max {ticket.max_per_user}/người</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {detailView.reviewNote !== "Chưa có ghi chú" && (
                  <section className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
                    <p className="mb-1 text-xs font-semibold text-[#8585A0]">Ghi chú review</p>
                    <p className="text-sm text-[#B0B0C0]">{detailView.reviewNote}</p>
                  </section>
                )}
              </div>

              {/* Cột phải: bio nghệ sĩ + hành động duyệt */}
              <div className="space-y-5">
                <section className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
                  <p className="mb-3 text-sm font-semibold text-[#F0EDEB]">
                    Giới thiệu nghệ sĩ (AI){detailView.artists.length > 1 ? ` — ${detailView.artists.length} nghệ sĩ` : ""}
                  </p>
                  <BioStatusBadge status={detailView.bioStatus} />
                  <div className="mt-3 space-y-4">
                    {detailView.artists.map((artist, index) => (
                      <div key={`${artist.name}-${index}`} className="border-t border-white/[0.06] pt-4 first:border-t-0 first:pt-0">
                        {artist.imageUrl ? (
                          <img src={artist.imageUrl} alt={artist.name} className="mb-2 h-28 w-28 rounded-lg object-cover" />
                        ) : (
                          <div className="mb-2 flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-[#8585A0]">
                            Chưa có ảnh
                          </div>
                        )}
                        <p className="text-xs font-semibold text-[#F0EDEB]">{artist.name}</p>
                        <p className="mt-1 whitespace-pre-line text-xs leading-5 text-[#B0B0C0]">
                          {artist.bio || bioStatusHint(detailView.bioStatus)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {detailView.status === "PENDING" && !approveResult && (
                  <section className="rounded-2xl border border-[#F5C842]/20 bg-[#F5C842]/[0.04] p-5">
                    <div className="mb-3 flex gap-3 rounded-xl border border-[#F5C842]/20 bg-[#F5C842]/[0.06] p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F5C842]" />
                      <p className="text-xs text-[#B0B0C0]">Duyệt hồ sơ sẽ tạo concert bản nháp, zone, loại vé, cổng và tài khoản soát vé trong một transaction.</p>
                    </div>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
                      Ghi chú khi từ chối
                      <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className={inputClass} style={inputStyle} />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button type="button" disabled={busy !== null} onClick={() => void run("approve")} className="inline-flex items-center gap-2 rounded-lg border border-[#2DBE6C]/30 bg-[#2DBE6C]/15 px-4 py-2.5 text-sm font-semibold text-[#2DBE6C]">
                        {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Duyệt
                      </button>
                      <button type="button" disabled={busy !== null} onClick={() => void run("reject")} className="inline-flex items-center gap-2 rounded-lg border border-[#E8315B]/30 bg-[#E8315B]/15 px-4 py-2.5 text-sm font-semibold text-[#E8315B]">
                        {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        Từ chối
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </AdminShell>
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-[#8585A0]">{label}</span>
      <span className="min-w-0 break-words text-right text-xs font-medium text-[#F0EDEB]">{value}</span>
    </div>
  );
}

function BioStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: "Đang chờ AI", color: "#F5C842", bg: "rgba(245,200,66,0.12)" },
    PROCESSING: { label: "AI đang xử lý", color: "#26A7DE", bg: "rgba(38,167,222,0.12)" },
    DONE: { label: "Đã sinh bio", color: "#2DBE6C", bg: "rgba(45,190,108,0.12)" },
    FAILED: { label: "Lỗi sinh bio", color: "#E8315B", bg: "rgba(232,49,91,0.12)" },
  };
  const style = status ? map[status] : undefined;
  if (!style) {
    return <span className="text-xs text-[#8585A0]">Không có press kit / chưa tạo bio</span>;
  }
  return (
    <span className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}

function bioStatusHint(status: string | null) {
  if (status === "FAILED") return "AI không sinh được bio (PDF lỗi hoặc API lỗi). Có thể nhập bio tay sau khi duyệt.";
  if (status === "PENDING" || status === "PROCESSING") return "Đang chờ AI sinh giới thiệu từ press kit...";
  return "Chưa có nội dung giới thiệu.";
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
