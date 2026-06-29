import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit2,
  Eye,
  FileText,
  LayoutDashboard,
  Loader2,
  PenLine,
  Plus,
  Search,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import type { Venue } from "../../lib/api-client";
import {
  createOrganizerDeletionRequest,
  createOrganizerRequest,
  getOrganizerAnalytics,
  getOrganizerRequest,
  listOrganizerCheckerAccounts,
  listOrganizerConcerts,
  listOrganizerOrders,
  listOrganizerRequests,
  listOrganizerVenues,
  normalizeTicketTypes,
  updateOrganizerConcert,
  type ApprovalStatus,
  type CreateOrganizerRequestInput,
  type OrganizerAnalytics,
  type OrganizerCheckerAccount,
  type OrganizerConcert,
  type OrganizerOrder,
  type OrganizerRequestDetail,
  type OrganizerRequestSummary,
} from "../../services/organizer.service";
import {
  approvalStatusLabel,
  concertStatusLabel as vmConcertStatusLabel,
  normalizeOrganizerRequestDetail,
  toOrganizerConcertPerformanceView,
  toOrganizerRequestView,
  toOrganizerStatsView,
} from "./organizer.view-model";

type OrganizerView = "dashboard" | "requests" | "concerts";
type LoadState = "loading" | "ready" | "error";

const approvalStatuses = ["all", "PENDING", "APPROVED", "REJECTED"] as const;
const concertStatuses = ["all", "DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"] as const;

export function OrganizerWorkspacePage({ view }: { view: OrganizerView }) {
  const session = getStoredAuthSession();
  const location = useLocation();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [requests, setRequests] = useState<OrganizerRequestSummary[]>([]);
  const [requestDetails, setRequestDetails] = useState<Record<string, OrganizerRequestDetail>>({});
  const [concerts, setConcerts] = useState<OrganizerConcert[]>([]);
  const [orders, setOrders] = useState<OrganizerOrder[]>([]);
  const [checkers, setCheckers] = useState<OrganizerCheckerAccount[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, OrganizerAnalytics>>({});
  const [requestFilter, setRequestFilter] = useState<(typeof approvalStatuses)[number]>("all");
  const [concertFilter, setConcertFilter] = useState<(typeof concertStatuses)[number]>("all");
  const [concertSearch, setConcertSearch] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(location.pathname.endsWith("/new"));
  const [editingConcertId, setEditingConcertId] = useState<string | null>(null);
  const [deletingConcertId, setDeletingConcertId] = useState<string | null>(null);

  const canUseOrganizer = session?.user.role === "ORGANIZER";

  useEffect(() => {
    if (!canUseOrganizer) return;
    void reload();
  }, [canUseOrganizer]);

  async function reload() {
    setLoadState("loading");
    setMessage("");
    try {
      const [venueData, requestData, concertData, orderData, checkerData] = await Promise.all([
        listOrganizerVenues(),
        listOrganizerRequests(),
        listOrganizerConcerts(),
        listOrganizerOrders(),
        listOrganizerCheckerAccounts(),
      ]);
      setVenues(venueData);
      setRequests(requestData);
      setConcerts(concertData);
      setOrders(orderData);
      setCheckers(checkerData);
      setLoadState("ready");

      const topConcerts = concertData.slice(0, 4);
      const analyticsEntries = await Promise.allSettled(
        topConcerts.map(async (concert) => [concert.id, await getOrganizerAnalytics(concert.id)] as const),
      );
      setAnalytics(
        Object.fromEntries(
          analyticsEntries
            .filter((entry): entry is PromiseFulfilledResult<readonly [string, OrganizerAnalytics]> => entry.status === "fulfilled")
            .map((entry) => entry.value),
        ),
      );
    } catch (err) {
      setLoadState("error");
      setMessage(err instanceof Error ? err.message : "Không thể tải không gian ban tổ chức.");
    }
  }

  async function openRequest(requestId: string) {
    setExpandedRequestId((current) => (current === requestId ? null : requestId));
    if (requestDetails[requestId]) return;
    try {
      const detail = await getOrganizerRequest(requestId);
      setRequestDetails((current) => ({ ...current, [requestId]: detail }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể tải chi tiết hồ sơ.");
    }
  }

  async function submitRequest(input: CreateOrganizerRequestInput) {
    setMessage("");
    await createOrganizerRequest(input);
    setShowRequestForm(false);
    setMessage("Đã nộp hồ sơ tổ chức.");
    await reload();
  }

  async function submitConcertUpdate(concertId: string, input: Record<string, string>) {
    setMessage("");
    await updateOrganizerConcert(concertId, emptyToUndefined(input));
    setEditingConcertId(null);
    setMessage("Đã cập nhật bản nháp concert.");
    await reload();
  }

  async function submitDeletionRequest(concertId: string, reason: string) {
    setMessage("");
    await createOrganizerDeletionRequest(concertId, reason);
    setDeletingConcertId(null);
    setMessage("Đã gửi yêu cầu hủy concert cho admin.");
  }

  const stats = useMemo(() => {
    return toOrganizerStatsView({ orders, analytics, concerts, requests });
  }, [analytics, concerts, orders, requests]);

  const visibleRequests = useMemo(
    () => requests.filter((request) => requestFilter === "all" || request.status === requestFilter),
    [requests, requestFilter],
  );

  const visibleConcerts = useMemo(() => {
    const needle = concertSearch.trim().toLowerCase();
    return concerts.filter((concert) => {
      const matchesStatus = concertFilter === "all" || concert.status === concertFilter;
      const matchesSearch =
        !needle ||
        concert.title.toLowerCase().includes(needle) ||
        concert.artist_name.toLowerCase().includes(needle) ||
        concert.venue.name.toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [concertFilter, concertSearch, concerts]);

  if (!canUseOrganizer) {
    return <OrganizerAccessState role={session?.user.role} />;
  }

  return (
    <div className="flex min-h-screen bg-[#08080E] pt-16 text-[#F0EDEB]">
      <aside className="fixed bottom-0 left-0 top-16 hidden w-56 flex-col border-r border-white/[0.07] bg-[#0D0D15] px-3 py-6 md:flex">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-widest text-[#8585A0]">Ban tổ chức</div>
        <nav className="flex-1 space-y-1">
          <SideLink to="/organizer" active={view === "dashboard"} icon={<LayoutDashboard className="h-4 w-4" />} label="Tổng quan" />
          <SideLink to="/organizer/requests" active={view === "requests"} icon={<FileText className="h-4 w-4" />} label="Hồ sơ" badge={stats.pending} />
          <SideLink to="/organizer/concerts" active={view === "concerts"} icon={<CalendarDays className="h-4 w-4" />} label="Sự kiện" />
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
        <section className="mx-auto max-w-7xl">
          <Header view={view} onNewRequest={() => setShowRequestForm(true)} />

          {message && <Message text={message} error={loadState === "error" || message.toLowerCase().includes("không thể")} />}

          {loadState === "loading" ? (
            <LoadingState />
          ) : (
            <>
              {view === "dashboard" && (
                <DashboardView
                  stats={stats}
                  requests={requests}
                  concerts={concerts}
                  analytics={analytics}
                  checkers={checkers}
                />
              )}
              {view === "requests" && (
                <RequestsView
                  venues={venues}
                  requests={visibleRequests}
                  details={requestDetails}
                  filter={requestFilter}
                  expandedId={expandedRequestId}
                  showForm={showRequestForm}
                  onFilter={setRequestFilter}
                  onToggle={openRequest}
                  onSubmit={submitRequest}
                  onCloseForm={() => setShowRequestForm(false)}
                />
              )}
              {view === "concerts" && (
                <ConcertsView
                  concerts={visibleConcerts}
                  analytics={analytics}
                  filter={concertFilter}
                  search={concertSearch}
                  editingId={editingConcertId}
                  deletingId={deletingConcertId}
                  onFilter={setConcertFilter}
                  onSearch={setConcertSearch}
                  onEdit={setEditingConcertId}
                  onDelete={setDeletingConcertId}
                  onUpdate={submitConcertUpdate}
                  onDeletionRequest={submitDeletionRequest}
                />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function DashboardView({
  stats,
  requests,
  concerts,
  analytics,
  checkers,
}: {
  stats: { revenue: number; sold: number; drafts: number; pending: number };
  requests: OrganizerRequestSummary[];
  concerts: OrganizerConcert[];
  analytics: Record<string, OrganizerAnalytics>;
  checkers: OrganizerCheckerAccount[];
}) {
  const performance = concerts.map((concert) => toOrganizerConcertPerformanceView(concert, analytics[concert.id]));
  const topConcerts = [...performance].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const chartConcerts = performance.slice(0, 6);
  const maxRevenue = Math.max(...chartConcerts.map((concert) => concert.revenue), 1);
  const pendingRequests = requests.filter((request) => request.status === "PENDING").slice(0, 4);
  const statCards = [
    { label: "Doanh thu xác nhận", value: formatMoney(stats.revenue), icon: <BarChart3 className="h-4 w-4" />, tone: "#F5C842" },
    { label: "Vé đã bán", value: stats.sold.toLocaleString("vi-VN"), icon: <Ticket className="h-4 w-4" />, tone: "#7B61FF" },
    { label: "Concert nháp", value: String(stats.drafts), icon: <PenLine className="h-4 w-4" />, tone: "#2DBE6C" },
    { label: "Hồ sơ chờ duyệt", value: String(stats.pending), icon: <Clock className="h-4 w-4" />, tone: "#E8315B" },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Panel title="Doanh thu theo concert" action={<Link to="/organizer/concerts" className="text-xs text-[#8585A0] hover:text-[#7B61FF]">Xem tất cả</Link>}>
          {chartConcerts.length > 0 ? (
            <div className="flex h-56 items-end gap-3 border-b border-white/[0.07] pb-4">
              {chartConcerts.map((concert, index) => {
                const height = Math.max(12, Math.round((concert.revenue / maxRevenue) * 100));
                return (
                  <div key={concert.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-40 w-full items-end rounded-xl bg-white/[0.025] px-2">
                      <div
                        className="w-full rounded-t-xl"
                        style={{
                          height: `${height}%`,
                          background: index % 3 === 0 ? "#7B61FF" : index % 3 === 1 ? "#E8315B" : "#F5C842",
                          boxShadow: "0 12px 28px rgba(123,97,255,0.22)",
                        }}
                        title={`${concert.title}: ${formatMoney(concert.revenue)}`}
                      />
                    </div>
                    <p className="w-full truncate text-center text-[11px] text-[#8585A0]">{concert.title}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="Chưa có dữ liệu doanh thu." />
          )}
        </Panel>

        <Panel title="Concert doanh thu cao" action={<span className="text-xs text-[#F5C842]">{formatMoney(stats.revenue)}</span>}>
          <div className="grid gap-3">
            {topConcerts.map((concert, index) => (
              <div key={concert.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{concert.title}</p>
                    <p className="mt-1 text-xs text-[#8585A0]">{concert.venueName} - {formatDate(concert.startsAt)}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#F5C842]">{formatMoney(concert.revenue)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${concert.soldPercent}%`,
                        background: index % 3 === 0 ? "#7B61FF" : index % 3 === 1 ? "#E8315B" : "#F5C842",
                      }}
                    />
                  </div>
                  <span className="text-xs text-[#8585A0]">{concert.soldPercent}%</span>
                </div>
              </div>
            ))}
            {topConcerts.length === 0 && <EmptyState text="Chưa có concert nào." />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Hồ sơ đang chờ admin" action={<Link to="/organizer/requests" className="text-xs text-[#8585A0] hover:text-[#7B61FF]">Tất cả</Link>}>
          <div className="grid gap-3">
            {pendingRequests.map((request) => {
              const view = toOrganizerRequestView(request);
              return (
                <Link key={view.id} to="/organizer/requests" className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
                  <Clock className="h-4 w-4 shrink-0 text-[#F5C842]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{view.title}</p>
                    <p className="mt-1 text-xs text-[#8585A0]">{view.artistName} - nộp {formatDate(view.submittedAt)}</p>
                  </div>
                  <ApprovalBadge status={view.status} />
                </Link>
              );
            })}
            {pendingRequests.length === 0 && <EmptyState text="Không có hồ sơ đang chờ." />}
          </div>
        </Panel>
        <Panel title="Tài khoản soát vé">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold">{checkers.length}</p>
              <p className="mt-1 text-sm text-[#8585A0]">Được tạo sau khi admin duyệt. Mật khẩu không hiển thị lại tại đây.</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7B61FF]/15 text-[#7B61FF]">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RequestsView({
  venues,
  requests,
  details,
  filter,
  expandedId,
  showForm,
  onFilter,
  onToggle,
  onSubmit,
  onCloseForm,
}: {
  venues: Venue[];
  requests: OrganizerRequestSummary[];
  details: Record<string, OrganizerRequestDetail>;
  filter: (typeof approvalStatuses)[number];
  expandedId: string | null;
  showForm: boolean;
  onFilter: (value: (typeof approvalStatuses)[number]) => void;
  onToggle: (id: string) => void;
  onSubmit: (input: CreateOrganizerRequestInput) => Promise<void>;
  onCloseForm: () => void;
}) {
  return (
    <div className="grid gap-5">
      {showForm && <NewRequestForm venues={venues} onSubmit={onSubmit} onClose={onCloseForm} />}

      <FilterTabs values={approvalStatuses} value={filter} onChange={onFilter} label={approvalStatusLabel} />

      <div className="grid gap-3">
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            detail={details[request.id]}
            expanded={expandedId === request.id}
            onToggle={() => onToggle(request.id)}
          />
        ))}
        {requests.length === 0 && <EmptyPanel icon={<FileText className="h-8 w-8" />} text="Không có hồ sơ phù hợp bộ lọc." />}
      </div>
    </div>
  );
}

function NewRequestForm({
  venues,
  onSubmit,
  onClose,
}: {
  venues: Venue[];
  onSubmit: (input: CreateOrganizerRequestInput) => Promise<void>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        venue_id: text(data, "venue_id"),
        title: text(data, "title"),
        artist_name: text(data, "artist_name"),
        description: optionalText(data, "description"),
        starts_at: dateTimeToIso(text(data, "starts_at")),
        ends_at: dateTimeToIso(text(data, "ends_at")),
        planned_publish_at: optionalDateTimeToIso(text(data, "planned_publish_at")),
        gate_count: numberValue(data, "gate_count"),
        checker_count: numberValue(data, "checker_count"),
        press_kit_url: optionalText(data, "press_kit_url"),
        ticket_types: [
          {
            zone_code: text(data, "zone_code").toUpperCase(),
            zone_name: text(data, "zone_name"),
            zone_capacity: numberValue(data, "zone_capacity"),
            name: text(data, "ticket_name"),
            price: { amount: numberValue(data, "price"), currency: "VND" },
            total_quantity: numberValue(data, "total_quantity"),
            max_per_user: numberValue(data, "max_per_user"),
            sale_start_at: dateTimeToIso(text(data, "sale_start_at")),
            sale_end_at: dateTimeToIso(text(data, "sale_end_at")),
          },
        ],
      });
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể nộp hồ sơ.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="overflow-hidden rounded-2xl border border-[#7B61FF]/30 bg-[#111118]" onSubmit={handleSubmit}>
      <div className="border-b border-white/[0.07] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Nộp hồ sơ tổ chức mới</h2>
            <p className="mt-1 text-sm text-[#8585A0]">Sau khi duyệt, hệ thống sẽ tạo concert nháp, khu vực ghế, loại vé, cổng và tài khoản soát vé.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#8585A0] hover:bg-white/10" aria-label="Đóng biểu mẫu">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="p-5">
      {error && <Message text={error} error />}
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="title" label="Tên concert" required />
        <Field name="artist_name" label="Nghệ sĩ / lineup" required />
        <SelectField name="venue_id" label="Địa điểm" required options={venues.map((venue) => ({ value: venue.id, label: `${venue.name} - ${venue.city}` }))} />
        <Field name="press_kit_url" label="URL bộ tư liệu" />
        <Field name="starts_at" label="Thời gian bắt đầu" type="datetime-local" required />
        <Field name="ends_at" label="Thời gian kết thúc" type="datetime-local" required />
        <Field name="planned_publish_at" label="Dự kiến publish" type="datetime-local" />
        <Field name="gate_count" label="Số cổng check-in" type="number" min="1" defaultValue="2" required />
        <Field name="checker_count" label="Số tài khoản soát vé" type="number" min="1" defaultValue="2" required />
        <TextArea name="description" label="Mô tả" />
      </div>

      <div className="my-5 border-t border-white/10 pt-5">
        <h3 className="mb-3 text-sm font-semibold">Loại vé đầu tiên</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field name="zone_code" label="Mã khu vực" placeholder="GA" required />
          <Field name="zone_name" label="Tên khu vực" placeholder="General Admission" required />
          <Field name="zone_capacity" label="Sức chứa khu vực" type="number" min="1" required />
          <Field name="ticket_name" label="Tên vé" placeholder="Standard" required />
          <Field name="price" label="Giá vé VND" type="number" min="0" required />
          <Field name="total_quantity" label="Số lượng" type="number" min="1" required />
          <Field name="max_per_user" label="Tối đa mỗi người" type="number" min="1" defaultValue="4" required />
          <Field name="sale_start_at" label="Mở bán" type="datetime-local" required />
          <Field name="sale_end_at" label="Kết thúc bán" type="datetime-local" required />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-[#7B61FF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(123,97,255,0.3)] disabled:opacity-60">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nộp hồ sơ
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[#8585A0]">
          Hủy
        </button>
      </div>
      </div>
    </form>
  );
}

function RequestCard({
  request,
  detail,
  expanded,
  onToggle,
}: {
  request: OrganizerRequestSummary;
  detail?: OrganizerRequestDetail;
  expanded: boolean;
  onToggle: () => void;
}) {
  const view = toOrganizerRequestView(request);
  const detailView = normalizeOrganizerRequestDetail(detail);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
      <button type="button" onClick={onToggle} className="grid w-full gap-3 px-5 py-4 text-left md:grid-cols-[minmax(0,1fr)_180px_32px] md:items-center">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ApprovalBadge status={view.status} />
            <span className="text-xs text-[#8585A0]">Nộp {formatDate(view.submittedAt)}</span>
          </div>
          <h2 className="truncate text-sm font-semibold">{view.title}</h2>
          <p className="mt-1 truncate text-xs text-[#8585A0]">{view.artistName} - {formatDate(view.startsAt)}</p>
        </div>
        <p className="text-xs text-[#8585A0]">{view.gateCount} cổng / {view.checkerCount} nhân sự soát vé</p>
        <span className="text-[#8585A0]">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.07] px-5 py-4">
          {!detailView ? (
            <p className="text-sm text-[#8585A0]">Đang tải chi tiết...</p>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm leading-6 text-[#B0B0C0]">{detailView.description}</p>
              <div className="grid gap-2 md:grid-cols-2">
                <Detail label="ID địa điểm" value={detailView.venueId} />
                <Detail label="Dự kiến publish" value={detailView.plannedPublishAt ? formatDate(detailView.plannedPublishAt) : "Chưa đặt"} />
                <Detail label="Ghi chú duyệt" value={detailView.reviewNote || "Chưa có ghi chú từ admin"} />
                <Detail label="ID concert" value={detailView.concertId || "Chưa được tạo"} />
              </div>
              <div className="grid gap-2">
                {normalizeTicketTypes(detailView.ticketTypes).map((ticket) => (
                  <div key={`${ticket.zone_code}-${ticket.name}`} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <p className="text-sm font-semibold">{ticket.zone_name} - {ticket.name}</p>
                    <p className="mt-1 text-xs text-[#8585A0]">
                      {ticket.total_quantity.toLocaleString("vi-VN")} vé / {formatMoney(ticket.price.amount)} / tối đa {ticket.max_per_user}
                    </p>
                  </div>
                ))}
              </div>
              {detailView.status === "APPROVED" && detailView.concertId && (
                <div className="flex gap-3 rounded-xl border border-[#2DBE6C]/20 bg-[#2DBE6C]/[0.08] p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2DBE6C]" />
                  <div>
                    <p className="text-xs font-semibold text-[#2DBE6C]">Hồ sơ đã được duyệt - concert đã tạo</p>
                    <p className="mt-1 text-xs text-[#8585A0]">Bạn có thể chỉnh sửa bản nháp trong mục Sự kiện của tôi.</p>
                  </div>
                </div>
              )}
              {detailView.status === "REJECTED" && (
                <div className="flex gap-3 rounded-xl border border-[#E8315B]/20 bg-[#E8315B]/[0.08] p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E8315B]" />
                  <div>
                    <p className="text-xs font-semibold text-[#E8315B]">Phản hồi từ admin</p>
                    <p className="mt-1 text-xs text-[#B0B0C0]">{detailView.reviewNote || "Hồ sơ cần được điều chỉnh trước khi nộp lại."}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ConcertsView({
  concerts,
  analytics,
  filter,
  search,
  editingId,
  deletingId,
  onFilter,
  onSearch,
  onEdit,
  onDelete,
  onUpdate,
  onDeletionRequest,
}: {
  concerts: OrganizerConcert[];
  analytics: Record<string, OrganizerAnalytics>;
  filter: (typeof concertStatuses)[number];
  search: string;
  editingId: string | null;
  deletingId: string | null;
  onFilter: (value: (typeof concertStatuses)[number]) => void;
  onSearch: (value: string) => void;
  onEdit: (value: string | null) => void;
  onDelete: (value: string | null) => void;
  onUpdate: (concertId: string, input: Record<string, string>) => Promise<void>;
  onDeletionRequest: (concertId: string, reason: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111118] px-3">
          <Search className="h-4 w-4 text-[#8585A0]" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm concert..."
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#F0EDEB] outline-none"
            style={{ border: 0, background: "transparent" }}
          />
        </div>
        <FilterTabs values={concertStatuses} value={filter} onChange={onFilter} label={vmConcertStatusLabel} />
      </div>

      <div className="grid gap-4">
        {concerts.map((concert) => (
          <ConcertCard
            key={concert.id}
            concert={concert}
            analytics={analytics[concert.id]}
            editing={editingId === concert.id}
            deleting={deletingId === concert.id}
            onEdit={() => onEdit(editingId === concert.id ? null : concert.id)}
            onDelete={() => onDelete(deletingId === concert.id ? null : concert.id)}
            onUpdate={(input) => onUpdate(concert.id, input)}
            onDeletionRequest={(reason) => onDeletionRequest(concert.id, reason)}
          />
        ))}
        {concerts.length === 0 && <EmptyPanel icon={<CalendarDays className="h-8 w-8" />} text="Không có concert phù hợp bộ lọc." />}
      </div>
    </div>
  );
}

function ConcertCard({
  concert,
  analytics,
  editing,
  deleting,
  onEdit,
  onDelete,
  onUpdate,
  onDeletionRequest,
}: {
  concert: OrganizerConcert;
  analytics?: OrganizerAnalytics;
  editing: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (input: Record<string, string>) => Promise<void>;
  onDeletionRequest: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const view = toOrganizerConcertPerformanceView(concert, analytics);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await onUpdate({
        title: text(data, "title"),
        artist_name: text(data, "artist_name"),
        starts_at: optionalDateTimeToIso(text(data, "starts_at")) ?? "",
        ends_at: optionalDateTimeToIso(text(data, "ends_at")) ?? "",
        planned_publish_at: optionalDateTimeToIso(text(data, "planned_publish_at")) ?? "",
        cover_image_url: text(data, "cover_image_url"),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletionRequest() {
    setSubmitting(true);
    try {
      await onDeletionRequest(reason);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
        <div className="h-20 w-full shrink-0 overflow-hidden rounded-xl bg-[#1A1A24] md:h-16 md:w-16">
          {view.coverImageUrl ? (
            <img src={view.coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#8585A0]">
              <CalendarDays className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={view.status} />
            <span className="text-xs text-[#8585A0]">{formatDate(view.startsAt)} - {view.venueName}</span>
          </div>
          <h2 className="truncate text-base font-semibold">{view.title}</h2>
          <p className="mt-1 text-sm text-[#8585A0]">{view.artistName}</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <InlineMetric icon={<BarChart3 className="h-3.5 w-3.5" />} label={formatMoney(view.revenue)} tone="#2DBE6C" />
            <InlineMetric icon={<Ticket className="h-3.5 w-3.5" />} label={`${view.ticketsSold.toLocaleString("vi-VN")}/${view.ticketsTotal.toLocaleString("vi-VN")} vé (${view.soldPercent}%)`} tone="#7B61FF" />
            <InlineMetric icon={<UserCheck className="h-3.5 w-3.5" />} label={`${Math.round(view.checkInRate * 100)}% check-in`} tone="#F5C842" />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${view.soldPercent}%`,
                background: view.soldPercent > 85 ? "#E8315B" : view.soldPercent > 60 ? "#F5C842" : "#2DBE6C",
              }}
            />
          </div>
        </div>
        <div className="flex items-start justify-end gap-2">
          <Link to={`/concerts/${concert.id}`} className="rounded-lg p-2 text-[#8585A0] hover:bg-white/10 hover:text-[#F0EDEB]" title="Mở trang công khai">
            <Eye className="h-4 w-4" />
          </Link>
          {concert.status === "DRAFT" && (
            <button type="button" onClick={onEdit} className="rounded-lg p-2 text-[#7B61FF] hover:bg-white/10" title="Sửa bản nháp">
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          {concert.status !== "CANCELLED" && (
            <button type="button" onClick={onDelete} className="rounded-lg p-2 text-[#E8315B] hover:bg-white/10" title="Yêu cầu hủy">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <form className="grid gap-3 border-t border-white/10 bg-white/[0.02] p-5 md:grid-cols-2" onSubmit={handleUpdate}>
          <Field name="title" label="Tên concert" defaultValue={concert.title} required />
          <Field name="artist_name" label="Nghệ sĩ" defaultValue={concert.artist_name} required />
          <Field name="starts_at" label="Thời gian bắt đầu" type="datetime-local" />
          <Field name="ends_at" label="Thời gian kết thúc" type="datetime-local" />
          <Field name="planned_publish_at" label="Dự kiến publish" type="datetime-local" />
          <Field name="cover_image_url" label="URL ảnh bìa" defaultValue={concert.cover_image_url} />
          <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#F5C842] px-4 py-2.5 text-sm font-semibold text-[#0D0D14] md:col-span-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Lưu bản nháp
          </button>
        </form>
      )}

      {deleting && (
        <div className="border-t border-[#E8315B]/20 bg-[#E8315B]/[0.04] p-5">
          <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
            Lý do hủy concert
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} style={inputStyle} />
          </label>
          <button type="button" disabled={submitting} onClick={handleDeletionRequest} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#E8315B]/30 bg-[#E8315B]/15 px-4 py-2.5 text-sm font-semibold text-[#E8315B]">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Gửi yêu cầu
          </button>
        </div>
      )}
    </article>
  );
}

function Header({ view, onNewRequest }: { view: OrganizerView; onNewRequest: () => void }) {
  const content = {
    dashboard: ["Tổng quan ban tổ chức", "Theo dõi hồ sơ, concert nháp, phân tích và tài khoản soát vé."],
    requests: ["Hồ sơ của tôi", "Nộp hồ sơ tổ chức concert và theo dõi trạng thái duyệt."],
    concerts: ["Sự kiện của tôi", "Chỉnh sửa concert nháp, xem phân tích và gửi yêu cầu hủy."],
  }[view];

  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
          <ShieldCheck className="h-4 w-4" />
          Không gian đối tác sự kiện
        </div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{content[0]}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8585A0]">{content[1]}</p>
      </div>
      <button type="button" onClick={onNewRequest} className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white">
        <Plus className="h-4 w-4" />
        Hồ sơ mới
      </button>
    </div>
  );
}

function OrganizerAccessState({ role }: { role?: string }) {
  return (
    <main className="min-h-screen bg-[#08080E] px-4 pt-28 text-[#F0EDEB]">
      <section className="mx-auto max-w-xl rounded-lg border border-white/10 bg-[#111118] p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#7B61FF]/15 text-[#7B61FF]">
          <UserCheck className="h-5 w-5" />
        </div>
        <h1 className="mb-2 text-xl font-semibold">Chỉ dành cho ban tổ chức</h1>
        <p className="mb-5 text-sm leading-6 text-[#8585A0]">Vai trò hiện tại: {role ?? "khách"}. Tài khoản ban tổ chức dùng khu vực này để quản lý hồ sơ và concert.</p>
        <Link to="/" className="inline-flex items-center gap-2 rounded-lg bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white">
          Về trang chủ
          <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function SideLink({ to, active, icon, label, badge }: { to: string; active: boolean; icon: ReactNode; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-lg border-l-[3px] px-3 py-2.5 text-sm transition-all"
      style={{
        background: active ? "rgba(123,97,255,0.12)" : "transparent",
        borderLeftColor: active ? "#7B61FF" : "transparent",
        color: active ? "#7B61FF" : "#8585A0",
      }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-[#E8315B]/20 px-1.5 py-0.5 text-xs text-[#E8315B]">{badge}</span> : null}
    </Link>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone: string }) {
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

function FilterTabs<T extends string>({ values, value, onChange, label }: { values: readonly T[]; value: T; onChange: (value: T) => void; label: (value: T) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className="rounded-lg px-3 py-2 text-sm"
          style={value === item ? { background: "#F5C842", color: "#0D0D14", fontWeight: 700 } : { background: "rgba(255,255,255,0.05)", color: "#8585A0", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {label(item)}
        </button>
      ))}
    </div>
  );
}

function Field({ label, name, type = "text", required, min, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; min?: string; placeholder?: string; defaultValue?: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
      {label}
      <input name={name} type={type} required={required} min={min} placeholder={placeholder} defaultValue={defaultValue} className={inputClass} style={inputStyle} />
    </label>
  );
}

function SelectField({ label, name, required, options }: { label: string; name: string; required?: boolean; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
      {label}
      <select name={name} required={required} className={inputClass} style={inputStyle} defaultValue="">
        <option value="" disabled>Chọn địa điểm</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, name }: { label: string; name: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0] md:col-span-2">
      {label}
      <textarea name={name} className={inputClass} style={inputStyle} />
    </label>
  );
}

function StatusBadge({ status }: { status: OrganizerConcert["status"] }) {
  const styles: Record<OrganizerConcert["status"], { label: string; bg: string; color: string }> = {
    DRAFT: { label: "Nháp", bg: "rgba(245,200,66,0.12)", color: "#F5C842" },
    PUBLISHED: { label: "Đã đăng", bg: "rgba(45,190,108,0.12)", color: "#2DBE6C" },
    CANCELLED: { label: "Đã hủy", bg: "rgba(232,49,91,0.12)", color: "#E8315B" },
    COMPLETED: { label: "Hoàn tất", bg: "rgba(255,255,255,0.08)", color: "#8585A0" },
  };
  const style = styles[status];
  return <span className="inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>{style.label}</span>;
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3">
      <p className="text-xs text-[#8585A0]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
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

function InlineMetric({ icon, label, tone }: { icon: ReactNode; label: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#8585A0]">
      <span style={{ color: tone }}>{icon}</span>
      {label}
    </span>
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
      Đang tải không gian ban tổ chức...
    </div>
  );
}

function EmptyPanel({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-10 text-center text-[#8585A0]">{icon}<p className="mt-3 text-sm">{text}</p></div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-[#8585A0]">{text}</p>;
}

function approvalLabel(value: (typeof approvalStatuses)[number]) {
  const labels: Record<(typeof approvalStatuses)[number], string> = {
    all: "Tất cả",
    PENDING: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
  };
  return labels[value];
}

function concertStatusLabel(value: (typeof concertStatuses)[number]) {
  const labels: Record<(typeof concertStatuses)[number], string> = {
    all: "Tất cả",
    DRAFT: "Nháp",
    PUBLISHED: "Đã đăng",
    CANCELLED: "Đã hủy",
    COMPLETED: "Hoàn tất",
  };
  return labels[value];
}

function emptyToUndefined(input: Record<string, string>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value.trim().length > 0));
}

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function optionalText(data: FormData, key: string) {
  const value = text(data, key);
  return value || undefined;
}

function numberValue(data: FormData, key: string) {
  return Number(text(data, key));
}

function dateTimeToIso(value: string) {
  return new Date(value).toISOString();
}

function optionalDateTimeToIso(value: string) {
  return value ? dateTimeToIso(value) : undefined;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

const inputClass = "min-h-11 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]";

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  borderColor: "rgba(255,255,255,0.1)",
  color: "#F0EDEB",
};
