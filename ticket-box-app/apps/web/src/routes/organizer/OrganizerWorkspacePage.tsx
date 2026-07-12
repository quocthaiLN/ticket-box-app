import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  ChevronLeft,
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
  TrendingUp,
  Trash2,
  Upload,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";
import { LongText } from "../../components/LongText";
import type { Venue } from "../../lib/api-client";
import {
  createOrganizerDeletionRequest,
  createOrganizerRequest,
  createOrganizerSeatZone,
  createOrganizerTicketType,
  getOrganizerAnalytics,
  getOrganizerRequest,
  listOrganizerCheckerAccounts,
  listOrganizerConcerts,
  listOrganizerConcertGuests,
  listOrganizerOrders,
  setOrganizerConcertDriveFolder,
  uploadOrganizerSeatMapImage,
  uploadOrganizerSeatMapSvg,
  listOrganizerRequests,
  listOrganizerVenues,
  normalizeTicketTypes,
  updateOrganizerConcert,
  uploadOrganizerPressKit,
  type ApprovalStatus,
  type CreateOrganizerRequestInput,
  type CreateOrganizerSeatZoneInput,
  type CreateOrganizerTicketTypeInput,
  type OrganizerAnalytics,
  type OrganizerCheckerAccount,
  type OrganizerConcert,
  type OrganizerGuest,
  type OrganizerOrder,
  type OrganizerRequestDetail,
  type OrganizerRequestSummary,
  type OrganizerSeatZone,
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

      const analyticsEntries = await Promise.allSettled(
        concertData.map(async (concert) => [concert.id, await getOrganizerAnalytics(concert.id)] as const),
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

  async function submitSeatZoneCreate(concertId: string, input: CreateOrganizerSeatZoneInput) {
    setMessage("");
    try {
      const zone = await createOrganizerSeatZone(concertId, input);
      setMessage("Đã lưu zone mới.");
      await reload();
      return zone;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể lưu zone mới.");
      throw err;
    }
  }

  async function submitTicketTypeCreate(concertId: string, input: CreateOrganizerTicketTypeInput) {
    setMessage("");
    try {
      const ticketType = await createOrganizerTicketType(concertId, input);
      setMessage("Đã lưu loại vé mới.");
      await reload();
      return ticketType;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể lưu loại vé mới.");
      throw err;
    }
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
                <OrganizerDashboardView
                  stats={stats}
                  requests={requests}
                  concerts={concerts}
                  orders={orders}
                  checkers={checkers}
                  analytics={analytics}
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
                  venues={venues}
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
                  onCreateSeatZone={submitSeatZoneCreate}
                  onCreateTicketType={submitTicketTypeCreate}
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

function OrganizerDashboardView({
  stats,
  requests,
  concerts,
  orders,
  checkers,
  analytics,
}: {
  stats: { revenue: number; sold: number; drafts: number; pending: number };
  requests: OrganizerRequestSummary[];
  concerts: OrganizerConcert[];
  orders: OrganizerOrder[];
  checkers: OrganizerCheckerAccount[];
  analytics: Record<string, OrganizerAnalytics>;
}) {
  const performance = concerts.map((concert) => toOrganizerConcertPerformanceView(concert, analytics[concert.id]));
  const topConcerts = [...performance].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const myConcerts = performance.slice(0, 4);
  const pendingRequests = requests.filter((request) => request.status === "PENDING").slice(0, 4);
  const monthlyRevenue = buildMonthlyRevenue(orders);
  const [checkerConcertId, setCheckerConcertId] = useState<string>("all");
  // Concert lấy từ chính danh sách checker để dropdown không hiện concert chưa có tài khoản.
  const checkerConcerts = useMemo(() => {
    const map = new Map<string, string>();
    for (const checker of checkers) map.set(checker.concert_id, checker.concert_title);
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [checkers]);
  const visibleCheckers =
    checkerConcertId === "all"
      ? checkers
      : checkers.filter((checker) => checker.concert_id === checkerConcertId);
  const checkerGroups = useMemo(() => groupCheckersByConcert(visibleCheckers), [visibleCheckers]);
  // null = trạng thái mặc định (chỉ mở nhóm đầu); reset khi đổi bộ lọc concert.
  const [openGroupIds, setOpenGroupIds] = useState<string[] | null>(null);

  function changeCheckerFilter(concertId: string) {
    setCheckerConcertId(concertId);
    setOpenGroupIds(null);
  }

  function toggleCheckerGroup(concertId: string) {
    setOpenGroupIds((current) => {
      const base = current ?? (checkerGroups[0] ? [checkerGroups[0].concertId] : []);
      return base.includes(concertId)
        ? base.filter((id) => id !== concertId)
        : [...base, concertId];
    });
  }
  const statCards = [
    { label: "Tổng doanh thu", value: formatMoney(stats.revenue), icon: <TrendingUp className="h-5 w-5" />, tone: "#F5C842" },
    { label: "Vé đã bán", value: stats.sold.toLocaleString("vi-VN"), icon: <Ticket className="h-5 w-5" />, tone: "#7B61FF" },
    { label: "Sự kiện published", value: String(concerts.filter((concert) => concert.status === "PUBLISHED").length), icon: <CalendarDays className="h-5 w-5" />, tone: "#2DBE6C" },
    { label: "Hồ sơ đang chờ", value: String(stats.pending), icon: <Clock className="h-5 w-5" />, tone: "#E8315B" },
  ];

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DashboardPanel className="xl:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-[#F0EDEB]">Doanh thu theo tháng (concert của tôi)</h3>
          <RevenueAreaChart data={monthlyRevenue} />
        </DashboardPanel>

        <DashboardPanel>
          <h3 className="mb-4 text-sm font-semibold text-[#F0EDEB]">Top concert doanh thu</h3>
          <div className="space-y-3">
            {topConcerts.map((concert, index) => (
              <div key={concert.id}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="min-w-0 break-words text-xs text-[#F0EDEB]">{concert.title}</span>
                  <span className="shrink-0 text-xs text-[#F5C842]">{formatMoney(concert.revenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${concert.soldPercent}%`,
                        background: ["#7B61FF", "#E8315B", "#F5C842", "#2DBE6C", "#26A7DE"][index] ?? "#7B61FF",
                      }}
                    />
                  </div>
                  <span className="text-xs text-[#8585A0]">{concert.soldPercent}%</span>
                </div>
              </div>
            ))}
            {topConcerts.length === 0 && <EmptyState text="Chưa có concert nào." />}
          </div>
        </DashboardPanel>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {pendingRequests.length > 0 && (
          <DashboardPanel>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#F0EDEB]">Hồ sơ đang chờ admin duyệt</h3>
              <Link to="/organizer/requests" className="flex items-center gap-1 text-xs text-[#8585A0] hover:text-[#7B61FF]">
                Tất cả
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {pendingRequests.map((request) => {
                const view = toOrganizerRequestView(request);
                return (
                  <Link key={view.id} to="/organizer/requests" className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]">
                    <Clock className="h-4 w-4 shrink-0 text-[#F5C842]" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-[#F0EDEB]">{view.title}</p>
                      <p className="mt-1 text-xs text-[#8585A0]">Nộp {formatDate(view.submittedAt)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#F5C842]/10 px-2 py-0.5 text-xs text-[#F5C842]">Chờ duyệt</span>
                  </Link>
                );
              })}
            </div>
          </DashboardPanel>
        )}

        <DashboardPanel>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F0EDEB]">Sự kiện của tôi</h3>
            <Link to="/organizer/concerts" className="flex items-center gap-1 text-xs text-[#8585A0] hover:text-[#7B61FF]">
              Tất cả
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {myConcerts.map((concert) => (
              <div key={concert.id} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.05]">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#1A1A24]">
                  {concert.coverImageUrl ? (
                    <img src={concert.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#8585A0]">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-[#F0EDEB]">{concert.title}</p>
                  <p className="mt-1 text-xs text-[#8585A0]">
                    {concert.ticketsSold.toLocaleString("vi-VN")}/{concert.ticketsTotal.toLocaleString("vi-VN")} vé bán
                  </p>
                </div>
                <StatusBadge status={concert.status} />
                <Link to={`/organizer/concerts/${concert.id}/preview`} className="shrink-0 rounded-lg p-1.5 text-[#8585A0] transition-colors hover:bg-white/10 hover:text-[#F0EDEB]" title="Xem trước">
                  <Eye className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
            {myConcerts.length === 0 && <EmptyState text="Chưa có sự kiện nào." />}
          </div>
        </DashboardPanel>

        {pendingRequests.length === 0 && (
          <DashboardPanel>
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 p-4">
              <Clock className="h-5 w-5 text-[#F5C842]" />
              <div>
                <p className="text-sm font-medium text-[#F0EDEB]">Không có hồ sơ đang chờ</p>
                <p className="mt-1 text-xs text-[#8585A0]">Các hồ sơ mới cần duyệt sẽ xuất hiện tại đây.</p>
              </div>
            </div>
          </DashboardPanel>
        )}
      </div>

      <div className="mt-6">
        <DashboardPanel>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#F0EDEB]">Tài khoản checker theo concert</h3>
              <p className="mt-1 text-xs text-[#8585A0]">Mật khẩu chỉ hiện một lần lúc admin duyệt; dashboard này hiển thị đầy đủ email, tên và concert tương ứng.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={checkerConcertId}
                onChange={(event) => changeCheckerFilter(event.target.value)}
                className="rounded-lg border border-white/[0.08] bg-[#0D0D15] px-2.5 py-1.5 text-xs text-[#F0EDEB] outline-none"
              >
                <option value="all">Tất cả concert</option>
                {checkerConcerts.map((concert) => (
                  <option key={concert.id} value={concert.id}>{concert.title}</option>
                ))}
              </select>
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#7B61FF]/10 px-2.5 py-1 text-xs font-semibold text-[#C9BCFF]">
                <UserCheck className="h-3.5 w-3.5" />
                {visibleCheckers.length.toLocaleString("vi-VN")} tài khoản
              </span>
            </div>
          </div>
          {visibleCheckers.length > 0 ? (
            <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {checkerGroups.map((group, index) => {
                // Chọn concert cụ thể → mở luôn; "Tất cả" → mặc định chỉ mở nhóm đầu.
                const open =
                  checkerConcertId !== "all" ||
                  (openGroupIds === null ? index === 0 : openGroupIds.includes(group.concertId));
                return (
                  <div key={group.concertId} className="overflow-hidden rounded-xl border border-white/[0.07]">
                    <button
                      type="button"
                      onClick={() => toggleCheckerGroup(group.concertId)}
                      className="flex w-full items-center justify-between gap-3 bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
                    >
                      <span className="min-w-0 break-words text-sm font-medium text-[#F0EDEB]">{group.concertTitle}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-[#8585A0]">
                        {group.checkers.length} tài khoản
                        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    {open && (
                      <div className="divide-y divide-white/[0.05]">
                        {group.checkers.map((checker) => (
                          <div key={checker.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                            <span className="text-sm font-medium text-[#F0EDEB]">{checker.full_name || "Checker chưa đặt tên"}</span>
                            <LongText value={checker.email} copyable className="min-w-0 text-xs text-[#C9BCFF]" />
                            <span className="ml-auto flex shrink-0 items-center gap-2">
                              <span className="rounded-full bg-[#7B61FF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C9BCFF]">{checker.status}</span>
                              <span className="text-[11px] text-[#8585A0]">{formatDate(checker.created_at)}</span>
                              <CopyIdButton value={checker.user_id} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="Chưa có tài khoản checker nào. Tài khoản sẽ được tạo sau khi admin duyệt hồ sơ BTC." />
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}

// Nút copy User ID gọn cho hàng checker — ID dài không cần hiển thị trên dashboard.
function CopyIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard bị chặn → bỏ qua
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy User ID: ${value}`}
      className="rounded p-1 text-[#8585A0] transition-colors hover:bg-white/10 hover:text-[#F0EDEB]"
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-[#2DBE6C]" /> : <ClipboardCopy className="h-3 w-3" />}
    </button>
  );
}

function groupCheckersByConcert(checkers: OrganizerCheckerAccount[]) {
  const groups = new Map<string, { concertId: string; concertTitle: string; checkers: OrganizerCheckerAccount[] }>();
  for (const checker of checkers) {
    const group = groups.get(checker.concert_id) ?? {
      concertId: checker.concert_id,
      concertTitle: checker.concert_title,
      checkers: [],
    };
    group.checkers.push(checker);
    groups.set(checker.concert_id, group);
  }
  return [...groups.values()];
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
                    <p className="w-full break-words text-center text-[11px] text-[#8585A0]">{concert.title}</p>
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
                    <p className="break-words text-sm font-semibold">{concert.title}</p>
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
                    <p className="break-words text-sm font-semibold">{view.title}</p>
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
    <div>
      {showForm && <NewRequestForm venues={venues} onSubmit={onSubmit} onClose={onCloseForm} />}

      <div className="mb-5 flex flex-wrap gap-2">
        {approvalStatuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onFilter(status)}
            className="rounded-lg px-4 py-2 text-sm transition-all"
            style={
              filter === status
                ? { background: "#7B61FF", color: "#fff", fontWeight: 600 }
                : { background: "rgba(255,255,255,0.05)", color: "#8585A0", border: "1px solid rgba(255,255,255,0.07)" }
            }
          >
            {approvalStatusLabel(status)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {requests.map((request) => (
          <OrganizerRequestCard
            key={request.id}
            request={request}
            venue={venues.find((venue) => venue.id === request.venue_id)}
            detail={details[request.id]}
            expanded={expandedId === request.id}
            onToggle={() => onToggle(request.id)}
          />
        ))}
        {requests.length === 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] py-12 text-center">
            <FileText className="mx-auto mb-2 h-10 w-10 text-[#8585A0]" />
            <p className="text-sm text-[#8585A0]">Chưa có hồ sơ nào</p>
          </div>
        )}
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
  return <TabbedNewRequestForm venues={venues} onSubmit={onSubmit} onClose={onClose} />;

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
    <form className="mb-6 overflow-hidden rounded-2xl border border-[#7B61FF]/30 bg-[#111118]" onSubmit={handleSubmit}>
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
      {/* Báo lỗi đặt ngay dưới nút nộp để thấy ngay khi submit thất bại. */}
      {error && <div className="mt-4"><Message text={error} error /></div>}
      </div>
    </form>
  );
}

function TabbedNewRequestForm({
  venues,
  onSubmit,
  onClose,
}: {
  venues: Venue[];
  onSubmit: (input: CreateOrganizerRequestInput) => Promise<void>;
  onClose: () => void;
}) {
  type DraftRequestZone = {
    id: string;
    code: string;
    name: string;
    capacity: string;
  };

  type DraftRequestTicket = {
    id: string;
    zoneId: string;
    name: string;
    price: string;
    totalQuantity: string;
    maxPerUser: string;
    saleStartAt: string;
    saleEndAt: string;
  };

  const nowLocal = toDateTimeLocal(new Date().toISOString());
  const defaultSaleEnd = toDateTimeLocal(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<"concert" | "zones" | "tickets">("concert");
  const [form, setForm] = useState({
    title: "",
    artistName: "",
    venueId: "",
    startsAt: "",
    endsAt: "",
    plannedPublishAt: "",
    gateCount: "2",
    checkerCount: "2",
    description: "",
  });
  const [zones, setZones] = useState<DraftRequestZone[]>([
    { id: "zone-1", code: "GA", name: "General Admission", capacity: "1000" },
  ]);
  const [tickets, setTickets] = useState<DraftRequestTicket[]>([
    {
      id: "ticket-1",
      zoneId: "zone-1",
      name: "Standard",
      price: "500000",
      totalQuantity: "1000",
      maxPerUser: "4",
      saleStartAt: nowLocal,
      saleEndAt: defaultSaleEnd,
    },
  ]);
  const sections = [
    { id: "concert" as const, label: "Thông tin concert" },
    { id: "zones" as const, label: "Zone" },
    { id: "tickets" as const, label: "Loại vé" },
  ];

  // Giữ File đã chọn; CHỈ upload lên Supabase khi bấm "Nộp hồ sơ" (tránh tạo file rác).
  // Ảnh concert + ảnh nghệ sĩ không upload riêng nữa — hệ thống tách từ press kit
  // (quy ước: ảnh trang 1 = ảnh concert, ảnh trang sau = ảnh nghệ sĩ).
  const [pressKitFile, setPressKitFile] = useState<File | null>(null);
  // Sơ đồ chỗ ngồi — cùng cơ chế: giữ File, upload khi nộp hồ sơ.
  // Ảnh PNG/JPEG hiển thị ở trang thông tin concert; SVG tương tác chỉ ở trang mua vé.
  const [seatMapImageFile, setSeatMapImageFile] = useState<File | null>(null);
  const [seatMapSvgFile, setSeatMapSvgFile] = useState<File | null>(null);

  function handlePressKitChange(event: ChangeEvent<HTMLInputElement>) {
    setPressKitFile(event.target.files?.[0] ?? null);
  }

  function handleSeatMapImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSeatMapImageFile(event.target.files?.[0] ?? null);
  }

  function handleSeatMapSvgFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSeatMapSvgFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (!form.title.trim() || !form.artistName.trim() || !form.venueId || !form.startsAt || !form.endsAt) {
        throw new Error("Vui lòng điền đầy đủ thông tin concert bắt buộc.");
      }
      if (zones.length === 0) {
        throw new Error("Hồ sơ cần ít nhất một zone.");
      }
      if (tickets.length === 0) {
        throw new Error("Hồ sơ cần ít nhất một loại vé.");
      }

      const ticketTypes = tickets.map((ticket) => {
        const zone = zones.find((item) => item.id === ticket.zoneId);
        if (!zone) {
          throw new Error("Mỗi loại vé cần chọn một zone hợp lệ.");
        }
        if (!zone.code.trim() || !zone.name.trim()) {
          throw new Error("Mỗi zone cần có mã và tên zone.");
        }
        if (!ticket.name.trim() || !ticket.saleStartAt || !ticket.saleEndAt) {
          throw new Error("Mỗi loại vé cần có tên vé, thời gian mở bán và kết thúc bán.");
        }

        return {
          zone_code: zone.code.trim().toUpperCase(),
          zone_name: zone.name.trim(),
          zone_capacity: Number(zone.capacity),
          name: ticket.name.trim(),
          price: { amount: Number(ticket.price), currency: "VND" as const },
          total_quantity: Number(ticket.totalQuantity),
          max_per_user: Number(ticket.maxPerUser),
          sale_start_at: dateTimeToIso(ticket.saleStartAt),
          sale_end_at: dateTimeToIso(ticket.saleEndAt),
        };
      });

      // Upload file MỘT LẦN tại đây (sau khi form đã hợp lệ) → mỗi lần nộp đúng 1 file.
      let pressKitUrl: string | undefined;
      if (pressKitFile) {
        pressKitUrl = (await uploadOrganizerPressKit(pressKitFile)).object_key;
      }
      let seatMapImageUrl: string | undefined;
      if (seatMapImageFile) {
        seatMapImageUrl = (await uploadOrganizerSeatMapImage(seatMapImageFile)).url;
      }
      let seatMapSvgUrl: string | undefined;
      if (seatMapSvgFile) {
        seatMapSvgUrl = (await uploadOrganizerSeatMapSvg(seatMapSvgFile)).url;
      }

      await onSubmit({
        venue_id: form.venueId,
        title: form.title.trim(),
        artist_name: form.artistName.trim(),
        description: form.description.trim() || undefined,
        starts_at: dateTimeToIso(form.startsAt),
        ends_at: dateTimeToIso(form.endsAt),
        planned_publish_at: optionalDateTimeToIso(form.plannedPublishAt),
        gate_count: Number(form.gateCount),
        checker_count: Number(form.checkerCount),
        press_kit_url: pressKitUrl,
        seat_map_url: seatMapSvgUrl,
        seat_map_image_url: seatMapImageUrl,
        ticket_types: ticketTypes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể nộp hồ sơ.");
    } finally {
      setSubmitting(false);
    }
  }

  function addZone() {
    const index = zones.length + 1;
    setZones((current) => [
      ...current,
      { id: `zone-${Date.now()}`, code: `ZONE${index}`, name: "", capacity: "100" },
    ]);
  }

  function updateZone(id: string, patch: Partial<DraftRequestZone>) {
    setZones((current) => current.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)));
  }

  function removeZone(id: string) {
    setZones((current) => current.filter((zone) => zone.id !== id));
    setTickets((current) => current.filter((ticket) => ticket.zoneId !== id));
  }

  function addTicket() {
    setTickets((current) => [
      ...current,
      {
        id: `ticket-${Date.now()}`,
        zoneId: zones[0]?.id ?? "",
        name: "",
        price: "0",
        totalQuantity: "1",
        maxPerUser: "4",
        saleStartAt: nowLocal,
        saleEndAt: form.startsAt || defaultSaleEnd,
      },
    ]);
  }

  function updateTicket(id: string, patch: Partial<DraftRequestTicket>) {
    setTickets((current) => current.map((ticket) => (ticket.id === id ? { ...ticket, ...patch } : ticket)));
  }

  function removeTicket(id: string) {
    setTickets((current) => current.filter((ticket) => ticket.id !== id));
  }

  return (
    <form className="mb-6 space-y-5" onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-[#7B61FF]/30 bg-[#111118] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Nộp hồ sơ tổ chức mới</h2>
            <p className="mt-1 text-sm text-[#8585A0]">
              Sau khi duyệt, hệ thống sẽ tạo concert nháp, zone, loại vé, cổng và tài khoản soát vé.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#8585A0] hover:bg-white/10" aria-label="Đóng biểu mẫu">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-white/[0.08]">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className="whitespace-nowrap px-4 py-2.5 text-sm transition-colors"
            style={{
              color: activeSection === section.id ? "#F5C842" : "#8585A0",
              borderBottom: activeSection === section.id ? "2px solid #F5C842" : "2px solid transparent",
              marginBottom: "-1px",
              fontWeight: activeSection === section.id ? 600 : 400,
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="max-w-5xl space-y-5">
        {activeSection === "concert" && (
          <EditorCard title="Thông tin concert">
            <div className="space-y-4">
              <EditorRow label="Tên concert *">
                <input className={editorInputClass} style={editorInputStyle} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
              </EditorRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <EditorRow label="Nghệ sĩ / lineup *">
                  <input className={editorInputClass} style={editorInputStyle} value={form.artistName} onChange={(event) => setForm({ ...form, artistName: event.target.value })} required />
                </EditorRow>
                <EditorRow label="Địa điểm *">
                  <select className={editorInputClass} style={editorInputStyle} value={form.venueId} onChange={(event) => setForm({ ...form, venueId: event.target.value })} required>
                    <option value="">Chọn địa điểm</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>{venue.name} - {venue.city}</option>
                    ))}
                  </select>
                </EditorRow>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <EditorRow label="Thời gian bắt đầu *">
                  <input type="datetime-local" className={editorInputClass} style={editorInputStyle} value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required />
                </EditorRow>
                <EditorRow label="Thời gian kết thúc *">
                  <input type="datetime-local" className={editorInputClass} style={editorInputStyle} value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} required />
                </EditorRow>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <EditorRow label="Dự kiến publish">
                  <input type="datetime-local" className={editorInputClass} style={editorInputStyle} value={form.plannedPublishAt} onChange={(event) => setForm({ ...form, plannedPublishAt: event.target.value })} />
                </EditorRow>
                <EditorRow label="Số cổng check-in *">
                  <input type="number" min="1" className={editorInputClass} style={editorInputStyle} value={form.gateCount} onChange={(event) => setForm({ ...form, gateCount: event.target.value })} required />
                </EditorRow>
                <EditorRow label="Tài khoản soát vé *">
                  <input type="number" min="1" className={editorInputClass} style={editorInputStyle} value={form.checkerCount} onChange={(event) => setForm({ ...form, checkerCount: event.target.value })} required />
                </EditorRow>
              </div>
              <EditorRow label="Hồ sơ nghệ sĩ / Press kit (PDF)">
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#F0EDEB] transition-colors hover:bg-white/10">
                    <Upload className="h-4 w-4" />
                    {pressKitFile ? "Đổi file PDF" : "Chọn file PDF"}
                    <input type="file" accept="application/pdf" className="hidden" onChange={handlePressKitChange} />
                  </label>
                  {pressKitFile ? (
                    <p className="text-xs text-[#2DBE6C]">✓ {pressKitFile.name} — sẽ tải lên khi nộp; AI tự sinh giới thiệu concert + bio nghệ sĩ và tách ảnh từ file này.</p>
                  ) : (
                    <p className="text-xs text-[#8585A0]">Tải PDF press kit: hệ thống tự sinh giới thiệu concert + bio nghệ sĩ và tách ảnh (ảnh trang 1 = ảnh concert, ảnh trang sau = ảnh nghệ sĩ).</p>
                  )}
                </div>
              </EditorRow>
              <EditorRow label="Mô tả">
                <textarea className={`${editorInputClass} min-h-24 resize-y`} style={editorInputStyle} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </EditorRow>
            </div>
          </EditorCard>
        )}

        {activeSection === "zones" && (
          <EditorCard title="Cấu hình zone">
            <div className="mb-4 rounded-xl border border-white/[0.07] bg-[#0A0A12] p-3.5">
              <p className="mb-2 text-sm font-semibold text-[#F5C842]">Ảnh sơ đồ chỗ ngồi (trang thông tin concert)</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#F0EDEB] transition-colors hover:bg-white/10">
                <Upload className="h-4 w-4" />
                {seatMapImageFile ? "Đổi ảnh sơ đồ" : "Chọn ảnh sơ đồ"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleSeatMapImageFileChange} />
              </label>
              {seatMapImageFile ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-[#2DBE6C]">✓ {seatMapImageFile.name} — sẽ tải lên khi nộp hồ sơ.</p>
                  <img src={URL.createObjectURL(seatMapImageFile)} alt="Xem trước sơ đồ chỗ ngồi" className="max-h-56 w-full rounded-lg object-contain" />
                  <button type="button" onClick={() => setSeatMapImageFile(null)} className="text-xs text-[#E8315B] hover:underline">Gỡ ảnh</button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#8585A0]">JPEG/PNG/WebP/GIF ≤ 10MB. Ảnh nên chú thích rõ màu và tên từng hạng vé — khán giả xem ở trang thông tin concert và trong email mời.</p>
              )}
            </div>
            <div className="mb-4 rounded-xl border border-white/[0.07] bg-[#0A0A12] p-3.5">
              <p className="mb-2 text-sm font-semibold text-[#F5C842]">Sơ đồ SVG tương tác (trang mua vé)</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#F0EDEB] transition-colors hover:bg-white/10">
                <Upload className="h-4 w-4" />
                {seatMapSvgFile ? "Đổi file SVG" : "Chọn file SVG"}
                <input type="file" accept="image/svg+xml,.svg" className="hidden" onChange={handleSeatMapSvgFileChange} />
              </label>
              {seatMapSvgFile ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-[#2DBE6C]">✓ {seatMapSvgFile.name} — sẽ tải lên khi nộp hồ sơ.</p>
                  <button type="button" onClick={() => setSeatMapSvgFile(null)} className="text-xs text-[#E8315B] hover:underline">Gỡ file</button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#8585A0]">SVG ≤ 10MB, mỗi khu vực đặt id dạng <code>zone-&lt;mã zone&gt;</code> để khán giả bấm chọn khu trực tiếp trên sơ đồ ở trang mua vé.</p>
              )}
            </div>
            <div className="space-y-3">
              {zones.map((zone) => (
                <div key={zone.id} className="rounded-xl border border-white/[0.07] bg-[#0A0A12] p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#F5C842]">Zone</span>
                    <button type="button" onClick={() => removeZone(zone.id)} disabled={zones.length === 1} className="rounded p-1 text-[#8585A0] transition-colors hover:bg-red-500/10 hover:text-[#E8315B] disabled:cursor-not-allowed disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <TicketTextField label="Mã zone" value={zone.code} onChange={(value) => updateZone(zone.id, { code: value.toUpperCase() })} />
                    <TicketTextField label="Tên zone" value={zone.name} onChange={(value) => updateZone(zone.id, { name: value })} />
                    <TicketNumberField label="Sức chứa" value={zone.capacity} onChange={(value) => updateZone(zone.id, { capacity: value })} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addZone} className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5C842]/15 bg-[#F5C842]/[0.08] px-4 py-2 text-sm text-[#F5C842]">
                <Plus className="h-4 w-4" />
                Thêm zone
              </button>
            </div>
          </EditorCard>
        )}

        {activeSection === "tickets" && (
          <EditorCard title="Cấu hình loại vé">
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-xl border border-white/[0.07] bg-[#0A0A12] p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#F5C842]">Loại vé</span>
                    <button type="button" onClick={() => removeTicket(ticket.id)} disabled={tickets.length === 1} className="rounded p-1 text-[#8585A0] transition-colors hover:bg-red-500/10 hover:text-[#E8315B] disabled:cursor-not-allowed disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-4">
                    <label>
                      <span className="mb-1 block text-xs text-[#8585A0]">Zone</span>
                      <select className={`${editorInputClass} min-h-9`} style={editorInputStyle} value={ticket.zoneId} onChange={(event) => updateTicket(ticket.id, { zoneId: event.target.value })}>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>{zone.name || zone.code} ({zone.code})</option>
                        ))}
                      </select>
                    </label>
                    <TicketTextField label="Tên vé" value={ticket.name} onChange={(value) => updateTicket(ticket.id, { name: value })} />
                    <TicketNumberField label="Giá vé VND" value={ticket.price} onChange={(value) => updateTicket(ticket.id, { price: value })} />
                    <TicketNumberField label="Số lượng" value={ticket.totalQuantity} onChange={(value) => updateTicket(ticket.id, { totalQuantity: value })} />
                    <TicketNumberField label="Tối đa mỗi người" value={ticket.maxPerUser} onChange={(value) => updateTicket(ticket.id, { maxPerUser: value })} />
                    <label>
                      <span className="mb-1 block text-xs text-[#8585A0]">Mở bán</span>
                      <input type="datetime-local" className={`${editorInputClass} min-h-9`} style={editorInputStyle} value={ticket.saleStartAt} onChange={(event) => updateTicket(ticket.id, { saleStartAt: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[#8585A0]">Kết thúc bán</span>
                      <input type="datetime-local" className={`${editorInputClass} min-h-9`} style={editorInputStyle} value={ticket.saleEndAt} onChange={(event) => updateTicket(ticket.id, { saleEndAt: event.target.value })} />
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addTicket} disabled={zones.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5C842]/15 bg-[#F5C842]/[0.08] px-4 py-2 text-sm text-[#F5C842] disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" />
                Thêm loại vé
              </button>
            </div>
          </EditorCard>
        )}
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

      {/* Báo lỗi đặt NGAY DƯỚI nút nộp để người dùng thấy ngay, không phải cuộn lên đầu form. */}
      {error && <Message text={error} error />}
    </form>
  );
}

function OrganizerRequestCard({
  request,
  venue,
  detail,
  expanded,
  onToggle,
}: {
  request: OrganizerRequestSummary;
  venue?: Venue;
  detail?: OrganizerRequestDetail;
  expanded: boolean;
  onToggle: () => void;
}) {
  const view = toOrganizerRequestView(request);
  const detailView = normalizeOrganizerRequestDetail(detail);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 px-5 py-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <ApprovalBadge status={view.status} />
          </div>
          <h2 className="text-sm font-semibold text-[#F0EDEB]">{view.title}</h2>
          <p className="mt-0.5 break-words text-xs text-[#8585A0]">
            {view.artistName} · {venue?.name ?? "Chưa rõ địa điểm"} · {formatDate(view.startsAt)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="mb-1 text-xs text-[#8585A0]">Nộp {formatDate(view.submittedAt)}</p>
          {expanded ? <ChevronUp className="ml-auto h-4 w-4 text-[#8585A0]" /> : <ChevronDown className="ml-auto h-4 w-4 text-[#8585A0]" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.07] px-5 pb-5">
          {!detailView ? (
            <p className="pt-4 text-sm text-[#8585A0]">Đang tải chi tiết...</p>
          ) : (
            <div>
              <div className="mb-4 grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-[#8585A0]">Mô tả</p>
                  <p className="text-sm leading-relaxed text-[#B0B0C0]">{detailView.description}</p>
                </div>
                <div className="space-y-2">
                  <InfoRow label="Địa điểm" value={venue?.name ?? detailView.venueId} />
                  <InfoRow label="Số cổng" value={`${detailView.gateCount} cổng check-in`} />
                  <InfoRow label="Số checker" value={`${detailView.checkerCount} nhân sự`} />
                  <InfoRow label="Dự kiến publish" value={detailView.plannedPublishAt ? formatDate(detailView.plannedPublishAt) : "Chưa đặt"} />
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-[#F0EDEB]">Loại vé đề xuất</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {normalizeTicketTypes(detailView.ticketTypes).map((ticket) => (
                    <div key={`${ticket.zone_code}-${ticket.name}`} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                      <p className="text-xs font-semibold text-[#F0EDEB]">{ticket.zone_name} - {ticket.name}</p>
                      <p className="mt-0.5 text-sm font-bold text-[#7B61FF]">{formatMoney(ticket.price.amount)}</p>
                      <p className="text-xs text-[#8585A0]">{ticket.total_quantity.toLocaleString("vi-VN")} vé · max {ticket.max_per_user}/người</p>
                    </div>
                  ))}
                  {normalizeTicketTypes(detailView.ticketTypes).length === 0 && (
                    <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-[#8585A0]">Chưa có loại vé đề xuất.</p>
                  )}
                </div>
              </div>

              {detailView.reviewNote && (
                <div
                  className="mb-3 flex gap-3 rounded-xl p-3"
                  style={{
                    background: detailView.status === "REJECTED" ? "rgba(232,49,91,0.08)" : "rgba(45,190,108,0.08)",
                    border: `1px solid ${detailView.status === "REJECTED" ? "rgba(232,49,91,0.2)" : "rgba(45,190,108,0.2)"}`,
                  }}
                >
                  {detailView.status === "REJECTED" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E8315B]" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2DBE6C]" />
                  )}
                  <div>
                    <p className="mb-0.5 text-xs font-semibold" style={{ color: detailView.status === "REJECTED" ? "#E8315B" : "#2DBE6C" }}>
                      Phản hồi từ Admin
                    </p>
                    <p className="text-xs text-[#B0B0C0]">{detailView.reviewNote}</p>
                  </div>
                </div>
              )}

              {detailView.status === "APPROVED" && detailView.concertId && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#2DBE6C]/20 bg-[#2DBE6C]/[0.08] p-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2DBE6C]" />
                  <div>
                    <p className="text-xs font-semibold text-[#2DBE6C]">Hồ sơ đã được duyệt - Concert đã tạo</p>
                    <p className="mt-1 text-xs text-[#8585A0]">Bạn có thể chỉnh sửa trong mục “Sự kiện của tôi”.</p>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-[#8585A0]">{label}</span>
      <span className="text-right text-[#F0EDEB]">{value}</span>
    </div>
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
          <h2 className="break-words text-sm font-semibold">{view.title}</h2>
          <p className="mt-1 break-words text-xs text-[#8585A0]">{view.artistName} - {formatDate(view.startsAt)}</p>
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
  venues,
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
  onCreateSeatZone,
  onCreateTicketType,
  onDeletionRequest,
}: {
  venues: Venue[];
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
  onCreateSeatZone: (concertId: string, input: CreateOrganizerSeatZoneInput) => Promise<OrganizerSeatZone>;
  onCreateTicketType: (concertId: string, input: CreateOrganizerTicketTypeInput) => Promise<OrganizerConcert["ticket_types"][number]>;
  onDeletionRequest: (concertId: string, reason: string) => Promise<void>;
}) {
  const editingConcert = editingId ? concerts.find((concert) => concert.id === editingId) : undefined;

  if (editingConcert) {
    return (
      <OrganizerConcertEditor
        concert={editingConcert}
        venues={venues}
        onBack={() => onEdit(null)}
        onSave={(input) => onUpdate(editingConcert.id, input)}
        onCreateSeatZone={(input) => onCreateSeatZone(editingConcert.id, input)}
        onCreateTicketType={(input) => onCreateTicketType(editingConcert.id, input)}
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111118] px-3 py-2.5">
          <Search className="h-4 w-4 text-[#8585A0]" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm kiếm sự kiện..."
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]"
            style={{ border: 0, background: "transparent" }}
          />
        </div>
        <select
          value={filter}
          onChange={(event) => onFilter(event.target.value as (typeof concertStatuses)[number])}
          className="rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}
        >
          {concertStatuses.map((status) => (
            <option key={status} value={status}>
              {vmConcertStatusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {concerts.map((concert) => (
          <OrganizerConcertCard
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
        {concerts.length === 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] py-12 text-center">
            <p className="text-sm text-[#8585A0]">Không tìm thấy sự kiện nào</p>
          </div>
        )}
      </div>
    </div>
  );
}

type EditableTicketType = {
  id: string;
  seatZoneId: string;
  name: string;
  description: string;
  price: string;
  totalQuantity: string;
  maxPerUser: string;
  saleStartAt: string;
  saleEndAt: string;
  soldQuantity: string;
  availableQuantity: string;
  isNew: boolean;
  saving?: boolean;
};

type EditableZone = {
  id: string;
  code: string;
  name: string;
  description: string;
  capacity: string;
  sortOrder: string;
  isNew: boolean;
  saving?: boolean;
};

function OrganizerConcertEditor({
  concert,
  venues,
  onBack,
  onSave,
  onCreateSeatZone,
  onCreateTicketType,
}: {
  concert: OrganizerConcert;
  venues: Venue[];
  onBack: () => void;
  onSave: (input: Record<string, string>) => Promise<void>;
  onCreateSeatZone: (input: CreateOrganizerSeatZoneInput) => Promise<OrganizerSeatZone>;
  onCreateTicketType: (input: CreateOrganizerTicketTypeInput) => Promise<OrganizerConcert["ticket_types"][number]>;
}) {
  const [activeSection, setActiveSection] = useState<"basic" | "zones" | "tickets" | "guests">(
    concert.status === "PUBLISHED" ? "guests" : "basic",
  );
  const [submitting, setSubmitting] = useState(false);
  const [zoneError, setZoneError] = useState("");
  const [ticketError, setTicketError] = useState("");
  const [form, setForm] = useState({
    title: concert.title,
    artistName: concert.artist_name,
    genre: "",
    description: concert.description ?? "",
    startsAt: toDateTimeLocal(concert.starts_at),
    endsAt: toDateTimeLocal(concert.ends_at),
    venueId: concert.venue.id,
    coverImageUrl: concert.cover_image_url ?? "",
    seatMapUrl: concert.seat_map_url ?? "",
    seatMapImageUrl: concert.seat_map_image_url ?? "",
  });
  const [seatMapUploading, setSeatMapUploading] = useState(false);
  const [seatMapError, setSeatMapError] = useState("");
  const [tickets, setTickets] = useState<EditableTicketType[]>(
    (concert.ticket_types ?? []).map((ticket) => ({
      id: ticket.id,
      seatZoneId: ticket.seat_zone_id,
      name: ticket.name,
      description: ticket.description ?? "",
      price: String(ticket.price.amount),
      totalQuantity: String(ticket.total_quantity),
      maxPerUser: String(ticket.max_per_user),
      saleStartAt: toDateTimeLocal(ticket.sale_start_at),
      saleEndAt: toDateTimeLocal(ticket.sale_end_at),
      soldQuantity: String(ticket.sold_quantity),
      availableQuantity: String(ticket.available_quantity),
      isNew: false,
    })),
  );
  const [zones, setZones] = useState<EditableZone[]>(
    (concert.seat_zones ?? []).map((zone) => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      description: zone.description ?? "",
      capacity: String(zone.capacity),
      sortOrder: String(zone.sort_order),
      isNew: false,
    })),
  );
  const seatZoneOptions = useMemo(() => {
    return zones
      .filter((zone) => !zone.isNew)
      .map((zone) => ({
        id: zone.id,
        label: `${zone.name} (${zone.code})`,
      }));
  }, [zones]);
  const sections = [
    { id: "basic" as const, label: "Thông tin cơ bản" },
    { id: "zones" as const, label: "Zone" },
    { id: "tickets" as const, label: "Loại vé" },
    { id: "guests" as const, label: "Khách mời" },
  ];

  // Concert đã PUBLISHED: thông tin/zone/vé khoá (chỉ đọc), chỉ sửa được khu Khách mời.
  const readOnly = concert.status === "PUBLISHED";

  async function handleSave() {
    setSubmitting(true);
    try {
      await onSave({
        title: form.title,
        artist_name: form.artistName,
        description: form.description,
        starts_at: dateTimeToIso(form.startsAt),
        ends_at: dateTimeToIso(form.endsAt),
        venue_id: form.venueId,
        cover_image_url: form.coverImageUrl,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Upload xong lưu URL vào concert luôn (gọi API trực tiếp, không đi qua nút
  // "Lưu thay đổi" của tab Thông tin cơ bản — luồng đó lọc bỏ chuỗi rỗng nên
  // không thể dùng để gỡ file). Ảnh → seat_map_image_url; SVG → seat_map_url.
  async function handleSeatMapImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSeatMapError("");
    setSeatMapUploading(true);
    try {
      const upload = await uploadOrganizerSeatMapImage(file);
      await updateOrganizerConcert(concert.id, { seat_map_image_url: upload.url });
      setForm((current) => ({ ...current, seatMapImageUrl: upload.url }));
    } catch (err) {
      setSeatMapError(err instanceof Error ? err.message : "Không thể upload ảnh sơ đồ.");
    } finally {
      setSeatMapUploading(false);
    }
  }

  async function handleSeatMapImageRemove() {
    setSeatMapError("");
    setSeatMapUploading(true);
    try {
      await updateOrganizerConcert(concert.id, { seat_map_image_url: null });
      setForm((current) => ({ ...current, seatMapImageUrl: "" }));
    } catch (err) {
      setSeatMapError(err instanceof Error ? err.message : "Không thể gỡ ảnh sơ đồ.");
    } finally {
      setSeatMapUploading(false);
    }
  }

  async function handleSeatMapSvgUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSeatMapError("");
    setSeatMapUploading(true);
    try {
      const upload = await uploadOrganizerSeatMapSvg(file);
      await updateOrganizerConcert(concert.id, { seat_map_url: upload.url });
      setForm((current) => ({ ...current, seatMapUrl: upload.url }));
    } catch (err) {
      setSeatMapError(err instanceof Error ? err.message : "Không thể upload file SVG sơ đồ.");
    } finally {
      setSeatMapUploading(false);
    }
  }

  async function handleSeatMapSvgRemove() {
    setSeatMapError("");
    setSeatMapUploading(true);
    try {
      await updateOrganizerConcert(concert.id, { seat_map_url: null });
      setForm((current) => ({ ...current, seatMapUrl: "" }));
    } catch (err) {
      setSeatMapError(err instanceof Error ? err.message : "Không thể gỡ file SVG sơ đồ.");
    } finally {
      setSeatMapUploading(false);
    }
  }

  function addZone() {
    const nextIndex = zones.length + 1;
    setZones((current) => [
      ...current,
      {
        id: `new-zone-${Date.now()}`,
        code: `ZONE${nextIndex}`,
        name: "",
        description: "",
        capacity: "100",
        sortOrder: String(nextIndex),
        isNew: true,
      },
    ]);
  }

  function updateZone(id: string, patch: Partial<EditableZone>) {
    setZones((current) => current.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)));
  }

  async function saveZone(zone: EditableZone) {
    setZoneError("");
    updateZone(zone.id, { saving: true });
    try {
      const saved = await onCreateSeatZone({
        code: zone.code,
        name: zone.name,
        description: zone.description || undefined,
        capacity: Number(zone.capacity),
        sort_order: Number(zone.sortOrder || 0),
      });
      setZones((current) =>
        current.map((item) =>
          item.id === zone.id
            ? {
                id: saved.id,
                code: saved.code,
                name: saved.name,
                description: saved.description ?? "",
                capacity: String(saved.capacity),
                sortOrder: String(saved.sort_order),
                isNew: false,
              }
            : item,
        ),
      );
    } catch (err) {
      setZoneError(err instanceof Error ? err.message : "Không thể lưu zone mới.");
    } finally {
      updateZone(zone.id, { saving: false });
    }
  }

  function removeZone(id: string) {
    setZones((current) => current.filter((zone) => zone.id !== id));
  }

  function addTicketType() {
    const defaultZoneId = seatZoneOptions[0]?.id ?? "";
    setTickets((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        seatZoneId: defaultZoneId,
        name: "",
        description: "",
        price: "0",
        totalQuantity: "0",
        maxPerUser: "4",
        saleStartAt: toDateTimeLocal(new Date().toISOString()),
        saleEndAt: form.startsAt,
        soldQuantity: "0",
        availableQuantity: "0",
        isNew: true,
      },
    ]);
  }

  function updateTicketType(id: string, patch: Partial<EditableTicketType>) {
    setTickets((current) => current.map((ticket) => (ticket.id === id ? { ...ticket, ...patch } : ticket)));
  }

  async function saveTicketType(ticket: EditableTicketType) {
    setTicketError("");
    updateTicketType(ticket.id, { saving: true });
    try {
      const saved = await onCreateTicketType({
        seat_zone_id: ticket.seatZoneId,
        name: ticket.name,
        description: ticket.description || undefined,
        price: { amount: Number(ticket.price), currency: "VND" },
        total_quantity: Number(ticket.totalQuantity),
        max_per_user: Number(ticket.maxPerUser),
        sale_start_at: dateTimeToIso(ticket.saleStartAt),
        sale_end_at: dateTimeToIso(ticket.saleEndAt),
      });
      setTickets((current) =>
        current.map((item) =>
          item.id === ticket.id
            ? {
                id: saved.id,
                seatZoneId: saved.seat_zone_id,
                name: saved.name,
                description: saved.description ?? "",
                price: String(saved.price.amount),
                totalQuantity: String(saved.total_quantity),
                maxPerUser: String(saved.max_per_user),
                saleStartAt: toDateTimeLocal(saved.sale_start_at),
                saleEndAt: toDateTimeLocal(saved.sale_end_at),
                soldQuantity: String(saved.sold_quantity),
                availableQuantity: String(saved.available_quantity),
                isNew: false,
              }
            : item,
        ),
      );
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : "Không thể lưu loại vé mới.");
    } finally {
      updateTicketType(ticket.id, { saving: false });
    }
  }

  function removeTicketType(id: string) {
    setTickets((current) => current.filter((ticket) => ticket.id !== id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={onBack} className="rounded-lg p-2 text-[#F0EDEB] transition-colors hover:bg-white/5">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-[1.75rem] font-bold text-[#F0EDEB]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Chỉnh sửa: {concert.title}
          </h2>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-white/[0.08]">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className="whitespace-nowrap px-4 py-2.5 text-sm transition-colors"
            style={{
              color: activeSection === section.id ? "#F5C842" : "#8585A0",
              borderBottom: activeSection === section.id ? "2px solid #F5C842" : "2px solid transparent",
              marginBottom: "-1px",
              fontWeight: activeSection === section.id ? 600 : 400,
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {readOnly && (
        <div className="mb-4 max-w-5xl rounded-xl border border-[#F5C842]/25 bg-[#F5C842]/10 px-4 py-2.5 text-xs text-[#F5C842]">
          Concert đã publish — thông tin sự kiện đã khoá, chỉ chỉnh sửa được khu <b>Khách mời</b>.
        </div>
      )}

      <div className="max-w-5xl space-y-6">
        {activeSection === "guests" && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
            <GuestSection concert={concert} />
          </div>
        )}
        <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-6 border-0 p-0">
        {activeSection === "basic" && (
          <EditorCard title="Thông tin cơ bản">
            <div className="space-y-4">
              <EditorRow label="Tên sự kiện *">
                <input className={editorInputClass} style={editorInputStyle} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </EditorRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <EditorRow label="Nghệ sĩ *">
                  <input className={editorInputClass} style={editorInputStyle} value={form.artistName} onChange={(event) => setForm({ ...form, artistName: event.target.value })} />
                </EditorRow>
                <EditorRow label="Thể loại">
                  <input className={editorInputClass} style={editorInputStyle} placeholder="VD: Indie/R&B" value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })} />
                </EditorRow>
              </div>
              <EditorRow label="Mô tả">
                <textarea
                  className={`${editorInputClass} min-h-24 resize-y`}
                  style={editorInputStyle}
                  placeholder="Mô tả ngắn về sự kiện..."
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </EditorRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <EditorRow label="Thời gian bắt đầu *">
                  <input type="datetime-local" className={editorInputClass} style={editorInputStyle} value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
                </EditorRow>
                <EditorRow label="Thời gian kết thúc *">
                  <input type="datetime-local" className={editorInputClass} style={editorInputStyle} value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
                </EditorRow>
              </div>
              <EditorRow label="Địa điểm">
                <select className={editorInputClass} style={editorInputStyle} value={form.venueId} onChange={(event) => setForm({ ...form, venueId: event.target.value })}>
                  <option value="">Chọn địa điểm</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>{venue.name} - {venue.city}</option>
                  ))}
                </select>
              </EditorRow>
              <EditorRow label="Ảnh bìa (URL)">
                {/* Ảnh bìa lấy tự động từ press kit (ảnh trang 1); ô URL chỉ là phương án chữa cháy. */}
                <input className={editorInputClass} style={editorInputStyle} placeholder="Tự tách từ press kit — chỉ nhập URL khi cần thay thế" value={form.coverImageUrl} onChange={(event) => setForm({ ...form, coverImageUrl: event.target.value })} />
                {form.coverImageUrl && (
                  <div className="mt-2 h-24 w-40 overflow-hidden rounded-lg bg-[#0D0D15]">
                    <img src={form.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
              </EditorRow>
              <div className="flex gap-3">
                <button type="button" disabled={submitting} onClick={handleSave} className="rounded-xl bg-[#7B61FF] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
                <button type="button" onClick={onBack} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[#8585A0]">
                  Hủy
                </button>
              </div>
            </div>
          </EditorCard>
        )}

        {activeSection === "zones" && (
          <EditorCard title="Cấu hình zone">
            <div className="mb-5 rounded-xl border border-white/[0.07] bg-[#0A0A12] p-4">
              <div className="mb-1 flex items-center gap-2">
                <h4 className="text-sm font-semibold text-[#F0EDEB]">Ảnh sơ đồ chỗ ngồi (trang thông tin concert)</h4>
                {seatMapUploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8585A0]" />}
              </div>
              <p className="mb-3 text-xs text-[#8585A0]">
                Ảnh nên chú thích rõ màu và tên từng khu/hạng vé để khán giả đối chiếu với bảng giá. Ảnh được lưu ngay khi tải lên hoặc gỡ, và được đính kèm trong email mời khách.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#7B61FF]/30 bg-[#7B61FF]/10 px-4 py-2 text-sm text-[#C9BCFF] transition-colors hover:bg-[#7B61FF]/20">
                  <Upload className="h-4 w-4" />
                  {seatMapUploading ? "Đang xử lý..." : form.seatMapImageUrl ? "Đổi ảnh sơ đồ" : "Chọn ảnh sơ đồ"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={seatMapUploading} onChange={handleSeatMapImageUpload} />
                </label>
                {form.seatMapImageUrl && (
                  <button type="button" disabled={seatMapUploading} onClick={() => void handleSeatMapImageRemove()} className="text-xs text-[#8585A0] underline-offset-2 hover:text-[#E8315B] hover:underline disabled:opacity-50">
                    Gỡ ảnh
                  </button>
                )}
              </div>
              {form.seatMapImageUrl && (
                <div className="mt-3 max-w-md overflow-hidden rounded-lg bg-[#0D0D15]">
                  <img src={form.seatMapImageUrl} alt="Sơ đồ hạng vé" className="w-full object-contain" />
                </div>
              )}
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <h4 className="mb-1 text-sm font-semibold text-[#F0EDEB]">Sơ đồ SVG tương tác (trang mua vé)</h4>
                <p className="mb-3 text-xs text-[#8585A0]">
                  SVG với id khu vực dạng <code>zone-&lt;mã zone&gt;</code>; khán giả bấm chọn khu trực tiếp trên sơ đồ ở trang mua vé.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#7B61FF]/30 bg-[#7B61FF]/10 px-4 py-2 text-sm text-[#C9BCFF] transition-colors hover:bg-[#7B61FF]/20">
                    <Upload className="h-4 w-4" />
                    {seatMapUploading ? "Đang xử lý..." : form.seatMapUrl ? "Đổi file SVG" : "Chọn file SVG"}
                    <input type="file" accept="image/svg+xml,.svg" className="hidden" disabled={seatMapUploading} onChange={handleSeatMapSvgUpload} />
                  </label>
                  {form.seatMapUrl && (
                    <button type="button" disabled={seatMapUploading} onClick={() => void handleSeatMapSvgRemove()} className="text-xs text-[#8585A0] underline-offset-2 hover:text-[#E8315B] hover:underline disabled:opacity-50">
                      Gỡ file SVG
                    </button>
                  )}
                </div>
              </div>
              {seatMapError && <p className="mt-2 text-xs text-[#E8315B]">{seatMapError}</p>}
            </div>

            {zoneError && (
              <div className="mb-4 rounded-xl border border-[#E8315B]/25 bg-[#E8315B]/10 px-3 py-2 text-sm text-[#E8315B]">
                {zoneError}
              </div>
            )}
            <div className="space-y-3">
              {zones.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
                  <p className="mb-4 text-sm text-[#8585A0]">Chưa có zone nào</p>
                  <button type="button" onClick={addZone} className="mx-auto inline-flex items-center gap-1.5 rounded-lg border border-[#F5C842]/20 bg-[#F5C842]/10 px-4 py-2 text-sm text-[#F5C842]">
                    <Plus className="h-4 w-4" />
                    Thêm zone
                  </button>
                </div>
              )}

              {zones.map((zone) => (
                zone.isNew ? (
                  <div key={zone.id} className="rounded-xl border border-[#F5C842]/20 bg-[#0D0D15] p-3.5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[#F5C842]">Zone mới</span>
                      <button type="button" onClick={() => removeZone(zone.id)} className="rounded p-1 text-[#8585A0] transition-colors hover:bg-red-500/10 hover:text-[#E8315B]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-4">
                      <TicketTextField label="Mã zone" value={zone.code} onChange={(value) => updateZone(zone.id, { code: value.toUpperCase() })} />
                      <TicketTextField label="Tên zone" value={zone.name} onChange={(value) => updateZone(zone.id, { name: value })} />
                      <TicketNumberField label="Sức chứa" value={zone.capacity} onChange={(value) => updateZone(zone.id, { capacity: value })} />
                      <TicketNumberField label="Thứ tự" value={zone.sortOrder} onChange={(value) => updateZone(zone.id, { sortOrder: value })} />
                      <label className="lg:col-span-4">
                        <span className="mb-1 block text-xs text-[#8585A0]">Mô tả</span>
                        <input className={`${editorInputClass} min-h-9`} style={editorInputStyle} value={zone.description} onChange={(event) => updateZone(zone.id, { description: event.target.value })} />
                      </label>
                      <div className="flex justify-end lg:col-span-4">
                        <button
                          type="button"
                          disabled={zone.saving}
                          onClick={() => void saveZone(zone)}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#F5C842] px-4 py-2 text-sm font-semibold text-[#0D0D14] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {zone.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Lưu zone
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={zone.id} className="rounded-2xl border border-white/[0.07] bg-[#0A0A12] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="rounded-lg bg-[#F5C842]/10 px-2 py-1 text-xs font-semibold text-[#F5C842]">{zone.code}</span>
                          <h4 className="break-words text-sm font-semibold text-[#F0EDEB]">{zone.name}</h4>
                        </div>
                        {zone.description && <p className="text-xs leading-5 text-[#8585A0]">{zone.description}</p>}
                      </div>
                      <div className="grid min-w-[220px] grid-cols-2 gap-3">
                        <TicketStat label="Sức chứa" value={Number(zone.capacity || 0).toLocaleString("vi-VN")} />
                        <TicketStat label="Thứ tự" value={String(zone.sortOrder || 0)} />
                      </div>
                    </div>
                  </div>
                )
              ))}

              {zones.length > 0 && (
                <button type="button" onClick={addZone} className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5C842]/15 bg-[#F5C842]/[0.08] px-4 py-2 text-sm text-[#F5C842]">
                  <Plus className="h-4 w-4" />
                  Thêm zone
                </button>
              )}
            </div>
          </EditorCard>
        )}

        {activeSection === "tickets" && (
          <EditorCard title="Cấu hình loại vé">
            {ticketError && (
              <div className="mb-4 rounded-xl border border-[#E8315B]/25 bg-[#E8315B]/10 px-3 py-2 text-sm text-[#E8315B]">
                {ticketError}
              </div>
            )}
            {tickets.length === 0 ? (
              <div className="py-8 text-center">
                <Ticket className="mx-auto mb-2 h-8 w-8 text-[#8585A0]" />
                <p className="mb-4 text-sm text-[#8585A0]">Chưa có loại vé nào</p>
                {seatZoneOptions.length === 0 && (
                  <p className="mx-auto mb-4 max-w-md text-xs text-[#8585A0]">Tạo ít nhất một zone trước khi thêm loại vé.</p>
                )}
                <button
                  type="button"
                  disabled={seatZoneOptions.length === 0}
                  onClick={addTicketType}
                  className="mx-auto inline-flex items-center gap-1.5 rounded-lg border border-[#F5C842]/20 bg-[#F5C842]/10 px-4 py-2 text-sm text-[#F5C842] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Thêm loại vé
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket, index) => (
                  ticket.isNew ? (
                    <div key={ticket.id} className="rounded-xl border border-[#F5C842]/20 bg-[#0D0D15] p-3.5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#F5C842]">Loại vé mới</span>
                        <button type="button" onClick={() => removeTicketType(ticket.id)} className="rounded p-1 text-[#8585A0] transition-colors hover:bg-red-500/10 hover:text-[#E8315B]">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-4">
                        <label>
                          <span className="mb-1 block text-xs text-[#8585A0]">Khu vực</span>
                          <select
                            className={`${editorInputClass} min-h-9`}
                            style={editorInputStyle}
                            value={ticket.seatZoneId}
                            onChange={(event) => updateTicketType(ticket.id, { seatZoneId: event.target.value })}
                          >
                            {seatZoneOptions.map((zone) => (
                              <option key={zone.id} value={zone.id}>{zone.label}</option>
                            ))}
                          </select>
                        </label>
                        <TicketTextField label="Tên loại vé" value={ticket.name} onChange={(value) => updateTicketType(ticket.id, { name: value })} />
                        <TicketNumberField label="Giá" value={ticket.price} onChange={(value) => updateTicketType(ticket.id, { price: value })} />
                        <TicketNumberField label="Tổng số lượng" value={ticket.totalQuantity} onChange={(value) => updateTicketType(ticket.id, { totalQuantity: value })} />
                        <TicketNumberField label="Tối đa / người" value={ticket.maxPerUser} onChange={(value) => updateTicketType(ticket.id, { maxPerUser: value })} />
                        <label>
                          <span className="mb-1 block text-xs text-[#8585A0]">Mở bán</span>
                          <input type="datetime-local" className={`${editorInputClass} min-h-9`} style={editorInputStyle} value={ticket.saleStartAt} onChange={(event) => updateTicketType(ticket.id, { saleStartAt: event.target.value })} />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs text-[#8585A0]">Đóng bán</span>
                          <input type="datetime-local" className={`${editorInputClass} min-h-9`} style={editorInputStyle} value={ticket.saleEndAt} onChange={(event) => updateTicketType(ticket.id, { saleEndAt: event.target.value })} />
                        </label>
                        <label className="lg:col-span-4">
                          <span className="mb-1 block text-xs text-[#8585A0]">Mô tả</span>
                          <input className={`${editorInputClass} min-h-9`} style={editorInputStyle} value={ticket.description} onChange={(event) => updateTicketType(ticket.id, { description: event.target.value })} />
                        </label>
                        <div className="flex justify-end lg:col-span-4">
                          <button
                            type="button"
                            disabled={ticket.saving || !ticket.seatZoneId}
                            onClick={() => void saveTicketType(ticket)}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#F5C842] px-4 py-2 text-sm font-semibold text-[#0D0D14] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {ticket.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Lưu loại vé
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={ticket.id} className="rounded-2xl border border-white/[0.07] bg-[#0A0A12] p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: ticketDotColor(index) }} />
                          <span className="break-words text-sm font-semibold text-[#F0EDEB]">{ticket.name}</span>
                        </div>
                        <div className="flex shrink-0 gap-2 text-[#8585A0]">
                          <button type="button" className="rounded p-1 transition-colors hover:bg-white/10 hover:text-[#7B61FF]" title="Chỉnh sửa loại vé">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => removeTicketType(ticket.id)} className="rounded p-1 transition-colors hover:bg-red-500/10 hover:text-[#E8315B]" title="Xóa loại vé">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <TicketStat label="Giá" value={formatMoney(Number(ticket.price || 0))} />
                        <TicketStat label="Tổng" value={Number(ticket.totalQuantity || 0).toLocaleString("vi-VN")} />
                        <TicketStat label="Đã bán" value={Number(ticket.soldQuantity || 0).toLocaleString("vi-VN")} />
                        <TicketStat label="Còn lại" value={Number(ticket.availableQuantity || 0).toLocaleString("vi-VN")} />
                      </div>
                    </div>
                  )
                ))}
                <button
                  type="button"
                  disabled={seatZoneOptions.length === 0}
                  onClick={addTicketType}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5C842]/15 bg-[#F5C842]/[0.08] px-4 py-2 text-sm text-[#F5C842] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Thêm loại vé
                </button>
              </div>
            )}
          </EditorCard>
        )}
        </fieldset>
      </div>
    </div>
  );
}

function OrganizerConcertCard({
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
  const canEdit = concert.status === "DRAFT" || concert.status === "PUBLISHED";
  const canDelete = concert.status !== "CANCELLED";
  const ticketTypeLabel = `${(concert.ticket_types ?? []).length.toLocaleString("vi-VN")} loại vé`;

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
      <div className="flex items-start gap-4 p-5">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#1A1A24]">
          {view.coverImageUrl ? (
            <img src={view.coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#8585A0]">
              <CalendarDays className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={view.status} />
              {deleting && (
                <span className="rounded-full bg-[#E8315B]/10 px-2 py-0.5 text-xs text-[#E8315B]">Đang xin hủy</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link to={`/organizer/concerts/${concert.id}/preview`} className="rounded-lg p-1.5 text-[#8585A0] transition-colors hover:bg-white/10 hover:text-[#F0EDEB]" title="Xem trước">
                <Eye className="h-4 w-4" />
              </Link>
              {canEdit && (
                <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-[#7B61FF] transition-colors hover:bg-white/10" title="Chỉnh sửa">
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
              {canDelete && (
                <button type="button" onClick={onDelete} className="rounded-lg p-1.5 text-[#E8315B] transition-colors hover:bg-white/10" title="Xin hủy concert">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <p className="text-sm font-semibold text-[#F0EDEB]">{view.title}</p>
          <p className="mb-2 mt-0.5 text-xs text-[#8585A0]">
            {view.artistName} · {formatDate(view.startsAt)} · {view.venueName}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <InlineMetric icon={<Ticket className="h-3.5 w-3.5" />} label={`${view.ticketsSold.toLocaleString("vi-VN")}/${view.ticketsTotal.toLocaleString("vi-VN")} vé (${view.soldPercent}%)`} tone="#7B61FF" />
            <InlineMetric icon={<TrendingUp className="h-3.5 w-3.5" />} label={formatMoney(view.revenue)} tone="#2DBE6C" />
            <InlineMetric icon={<Users className="h-3.5 w-3.5" />} label={ticketTypeLabel} tone="#F5C842" />
          </div>

          {view.ticketsTotal > 0 && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${view.soldPercent}%`,
                  background: view.soldPercent > 85 ? "#E8315B" : view.soldPercent > 60 ? "#F5C842" : "#2DBE6C",
                }}
              />
            </div>
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
        <div className="border-t border-[#E8315B]/20 bg-[#E8315B]/[0.03] px-5 pb-5">
          <div className="pt-4">
            <p className="mb-2 text-xs font-semibold text-[#E8315B]">Xin hủy concert - lý do</p>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Nhập lý do xin hủy concert này..."
              rows={2}
              className="mb-3 w-full resize-none rounded-lg px-3 py-2 text-sm outline-none placeholder:text-[#8585A0]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F0EDEB" }}
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={submitting || !reason.trim()}
                onClick={handleDeletionRequest}
                className="rounded-lg px-4 py-2 text-xs font-medium transition-transform hover:scale-105 disabled:opacity-40"
                style={{ background: "rgba(232,49,91,0.15)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.3)" }}
              >
                {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
              <button type="button" onClick={onDelete} className="rounded-lg px-3 py-2 text-xs text-[#8585A0] transition-colors hover:bg-white/5">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function GuestSection({ concert }: { concert: OrganizerConcert }) {
  const [folder, setFolder] = useState(concert.guest_drive_folder_id ?? "");
  const [savingFolder, setSavingFolder] = useState(false);
  const [folderMsg, setFolderMsg] = useState("");
  const [guests, setGuests] = useState<OrganizerGuest[] | null>(null);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [openGuests, setOpenGuests] = useState(false);

  // Chỉ khoá khi concert đã PUBLISHED và quá 0h ngày diễn (lúc cron import chạy).
  // Concert DRAFT chưa được nhập nên luôn cho sửa.
  const locked = concert.status === "PUBLISHED" && Date.now() >= guestFolderEditCutoff(concert.starts_at);

  async function saveFolder() {
    setSavingFolder(true);
    setFolderMsg("");
    try {
      const result = await setOrganizerConcertDriveFolder(concert.id, folder.trim());
      setFolder(result.guest_drive_folder_id ?? "");
      setFolderMsg("Đã lưu thư mục Drive.");
    } catch (err) {
      setFolderMsg(err instanceof Error ? err.message : "Không lưu được thư mục.");
    } finally {
      setSavingFolder(false);
    }
  }

  async function toggleGuests() {
    const next = !openGuests;
    setOpenGuests(next);
    if (next && guests === null) {
      setLoadingGuests(true);
      try {
        setGuests(await listOrganizerConcertGuests(concert.id));
      } catch {
        setGuests([]);
      } finally {
        setLoadingGuests(false);
      }
    }
  }

  return (
    <div className="border-t border-white/10 bg-white/[0.02] p-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#F0EDEB]">
        <Users className="h-4 w-4 text-[#2DBE6C]" />
        Khách mời
      </h3>

      <label className="mb-1 block text-xs font-semibold text-[#8585A0]">Thư mục Google Drive (CSV khách mời)</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
          disabled={locked}
          placeholder="Dán link thư mục Drive hoặc ID…"
          className={inputClass}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={saveFolder}
          disabled={locked || savingFolder}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#7B61FF] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {savingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Lưu
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-[#8585A0]">
        {locked
          ? "Đã khoá chỉnh sửa — quá 0h ngày diễn (hệ thống đã/đang nhập danh sách)."
          : "Share thư mục (Viewer) cho storage@ticketbox-500711.iam.gserviceaccount.com. Chỉ sửa được trước 0h ngày diễn."}
      </p>
      {folderMsg && <p className="mt-1 text-xs text-[#C9BCFF]">{folderMsg}</p>}

      <button type="button" onClick={toggleGuests} className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#F0EDEB]">
        Danh sách khách mời{guests ? ` (${guests.length})` : ""}
        {openGuests ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {openGuests && (
        <div className="mt-2">
          {loadingGuests && (
            <p className="flex items-center gap-2 text-xs text-[#8585A0]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải…
            </p>
          )}
          {!loadingGuests && guests && guests.length === 0 && (
            <p className="text-xs leading-5 text-[#8585A0]">
              Chưa có khách mời. Gán thư mục Drive rồi chờ hệ thống nhập lúc 0h, hoặc nhờ admin nhập ngay.
            </p>
          )}
          {!loadingGuests && guests && guests.length > 0 && (
            <div className="space-y-1.5">
              {guests.map((guest) => (
                <div key={guest.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="min-w-0 break-words">
                    <b className="text-[#F0EDEB]">{guest.full_name}</b>
                    <span className="break-all text-[#8585A0]"> · {guest.email}</span>
                  </span>
                  <span className="shrink-0 text-[#8585A0]">{guestStatusLabel(guest.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 0h (giờ VN) ngày diễn — mốc cron import chạy; sau đó khoá sửa folder.
function guestFolderEditCutoff(startsAtIso: string): number {
  const ICT = 7 * 60 * 60 * 1000;
  const wall = new Date(startsAtIso).getTime() + ICT;
  const dayStart = Math.floor(wall / 86_400_000) * 86_400_000;
  return dayStart - ICT;
}

function guestStatusLabel(status: OrganizerGuest["status"]) {
  return status === "CHECKED_IN" ? "Đã vào" : status === "CANCELLED" ? "Đã hủy" : "Đã mời";
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
          <h2 className="break-words text-base font-semibold">{view.title}</h2>
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
          <Link to={`/organizer/concerts/${concert.id}/preview`} className="rounded-lg p-2 text-[#8585A0] hover:bg-white/10 hover:text-[#F0EDEB]" title="Xem trước">
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
  const isDashboard = view === "dashboard";
  const isRequests = view === "requests";

  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
          <ShieldCheck className="h-4 w-4" />
          Không gian đối tác sự kiện
        </div>
        <h1 className="text-[1.75rem] font-bold text-[#F0EDEB]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          {isDashboard ? "Organizer Dashboard" : isRequests ? "Hồ sơ của tôi" : content[0]}
        </h1>
        <p className="mt-0.5 max-w-2xl text-sm text-[#8585A0]">
          {isDashboard ? "Quản lý sự kiện và hồ sơ BTC của bạn" : isRequests ? "Danh sách hồ sơ xin tổ chức concert bạn đã nộp" : content[1]}
        </p>
      </div>
      {isRequests ? (
        <button
          type="button"
          onClick={onNewRequest}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#7B61FF]/30 transition-transform hover:scale-105"
          style={{ background: "linear-gradient(135deg, #7B61FF, #5B41CF)" }}
        >
          <Plus className="h-4 w-4" />
          Nộp hồ sơ mới
        </button>
      ) : (
        <Link
          to="/organizer/requests/new"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#7B61FF]/30 transition-transform hover:scale-105"
          style={{ background: "linear-gradient(135deg, #7B61FF, #5B41CF)" }}
        >
          <Plus className="h-4 w-4" />
          Nộp hồ sơ mới
        </Link>
      )}
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

function DashboardPanel({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-white/[0.07] bg-[#111118] p-5 ${className}`}>
      {children}
    </section>
  );
}

type MonthlyRevenuePoint = {
  month: string;
  revenue: number;
};

function RevenueAreaChart({ data }: { data: MonthlyRevenuePoint[] }) {
  const width = 640;
  const height = 220;
  const padding = { top: 12, right: 16, bottom: 36, left: 54 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxRevenue = Math.max(...data.map((item) => item.revenue), 1);
  const points = data.map((item, index) => {
    const x = padding.left + (data.length <= 1 ? chartWidth : (index / (data.length - 1)) * chartWidth);
    const y = padding.top + chartHeight - (item.revenue / maxRevenue) * chartHeight;
    return { ...item, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${padding.left + chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;
  const gridRows = [0, 0.5, 1];

  return (
    <div className="h-[220px] w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Doanh thu theo tháng">
        <defs>
          <linearGradient id="organizerRevenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7B61FF" stopOpacity="0.35" />
            <stop offset="95%" stopColor="#7B61FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridRows.map((row) => {
          const y = padding.top + row * chartHeight;
          return (
            <line
              key={row}
              x1={padding.left}
              x2={padding.left + chartWidth}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 3"
            />
          );
        })}
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fill="#8585A0" fontSize="10">
          {compactMoney(maxRevenue)}
        </text>
        <text x={padding.left - 8} y={padding.top + chartHeight} textAnchor="end" fill="#8585A0" fontSize="10">
          0
        </text>
        <path d={areaPath} fill="url(#organizerRevenueGradient)" />
        <path d={linePath} fill="none" stroke="#7B61FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="#7B61FF" stroke="#111118" strokeWidth="2" />
            <text x={point.x} y={height - 12} textAnchor="middle" fill="#8585A0" fontSize="11">
              {point.month}
            </text>
            <title>{`${point.month}: ${formatMoney(point.revenue)}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function EditorCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
      <h3 className="mb-4 text-sm font-semibold text-[#F0EDEB]">{title}</h3>
      {children}
    </section>
  );
}

function EditorRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-[#8585A0]">{label}</span>
      {children}
    </label>
  );
}

function TicketNumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-1 block text-xs text-[#8585A0]">{label}</span>
      <input type="number" min="0" className={`${editorInputClass} min-h-9`} style={editorInputStyle} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TicketTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-1 block text-xs text-[#8585A0]">{label}</span>
      <input className={`${editorInputClass} min-h-9`} style={editorInputStyle} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TicketStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-[#8585A0]">{label}</p>
      <p className="text-sm font-semibold text-[#F0EDEB]">{value}</p>
    </div>
  );
}

function ticketDotColor(index: number) {
  return ["#F5C842", "#E8315B", "#A020F0", "#6B8CFF", "#2DBE6C", "#26A7DE"][index % 6];
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
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
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

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function buildMonthlyRevenue(orders: OrganizerOrder[]): MonthlyRevenuePoint[] {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      month: `T${date.getMonth() + 1}`,
      revenue: 0,
    };
  });
  const monthByKey = new Map(months.map((month) => [month.key, month]));

  for (const order of orders) {
    if (order.status !== "CONFIRMED") continue;
    const date = new Date(order.confirmed_at ?? order.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const point = monthByKey.get(key);
    if (point) point.revenue += Number(order.total_amount.amount || 0);
  }

  return months.map(({ month, revenue }) => ({ month, revenue }));
}

function compactMoney(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

const inputClass = "min-h-11 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]";

const editorInputClass = "w-full rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F0EDEB] outline-none placeholder:text-[#8585A0]";

const editorInputStyle = {
  background: "#0A0A12",
  borderColor: "rgba(255,255,255,0.08)",
  color: "#F0EDEB",
};

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  borderColor: "rgba(255,255,255,0.1)",
  color: "#F0EDEB",
};
