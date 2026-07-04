import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Loader2,
  RefreshCw,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getStoredAuthSession } from "../../lib/auth-session";
import { listAdminConcerts, type ConcertSummary } from "../../lib/api-client";
import {
  GUEST_DRIVE_SERVICE_ACCOUNT,
  listConcertGuests,
  listConcertImportJobs,
  listImportJobErrors,
  setConcertDriveFolder,
  triggerConcertGuestImport,
  type GuestImportError,
  type GuestImportJob,
  type GuestSummary,
} from "../../services/guest-list.service";
import { AdminAccessState, AdminShell } from "./AdminShell";

export function AdminGuestListPage() {
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";

  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [concertId, setConcertId] = useState("");
  const [folder, setFolder] = useState("");
  const [jobs, setJobs] = useState<GuestImportJob[]>([]);
  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [errors, setErrors] = useState<Record<string, GuestImportError[]>>({});
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "import" | "refresh">("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!canUseAdmin) return;
    listAdminConcerts()
      .then(setConcerts)
      .catch((err) => setMessage(err instanceof Error ? err.message : "Không tải được danh sách concert."));
  }, [canUseAdmin]);

  async function reload(id = concertId) {
    if (!id) return;
    const [jobList, guestList] = await Promise.all([
      listConcertImportJobs(id).catch(() => []),
      listConcertGuests(id).catch(() => []),
    ]);
    setJobs(jobList);
    setGuests(guestList);
  }

  useEffect(() => {
    if (!concertId) return;
    setErrors({});
    setExpandedJob(null);
    // Hiện link Drive đã gán của concert (nếu có).
    setFolder(concerts.find((concert) => concert.id === concertId)?.guest_drive_folder_id ?? "");
    void reload(concertId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concertId]);

  async function handleSaveFolder() {
    if (!concertId) return;
    setBusy("save");
    setMessage("");
    try {
      await setConcertDriveFolder(concertId, folder.trim());
      setMessage("Đã lưu thư mục Drive cho concert.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không lưu được thư mục.");
    } finally {
      setBusy("");
    }
  }

  async function handleImport() {
    if (!concertId) return;
    setBusy("import");
    setMessage("");
    try {
      await triggerConcertGuestImport(concertId);
      setMessage("Đã gửi yêu cầu nhập. Worker đang quét Drive — kết quả cập nhật sau vài giây.");
      // Worker xử lý nền → refresh vài nhịp để bắt trạng thái job.
      window.setTimeout(() => void reload(), 2500);
      window.setTimeout(() => void reload(), 6000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không gửi được yêu cầu nhập.");
    } finally {
      setBusy("");
    }
  }

  async function handleRefresh() {
    setBusy("refresh");
    try {
      await reload();
    } finally {
      setBusy("");
    }
  }

  async function toggleErrors(jobId: string) {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobId);
    if (!errors[jobId]) {
      const list = await listImportJobErrors(jobId).catch(() => []);
      setErrors((current) => ({ ...current, [jobId]: list }));
    }
  }

  const selectedConcert = useMemo(
    () => concerts.find((concert) => concert.id === concertId),
    [concerts, concertId],
  );

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} />;
  }

  return (
    <AdminShell>
      <section className="mx-auto max-w-5xl">
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#F5C842]">
            <Users className="h-4 w-4" />
            Khách mời
          </div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Nhập khách mời từ Google Drive
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#8585A0]">
            BTC bỏ file CSV vào thư mục Drive của concert; hệ thống tự nhập lúc 0h (giờ VN). Trang này cho
            phép gán thư mục, nhập thủ công và theo dõi kết quả.
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-2xl border border-[#7B61FF]/25 bg-[#7B61FF]/10 px-4 py-3 text-sm text-[#C9BCFF]">
            {message}
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
          <label className="grid gap-1.5 text-xs font-semibold text-[#8585A0]">
            Chọn concert
            <select
              value={concertId}
              onChange={(event) => setConcertId(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#1A1A24] px-3 py-2.5 text-sm text-[#F0EDEB]"
            >
              <option value="">— Chọn concert —</option>
              {concerts.map((concert) => (
                <option key={concert.id} value={concert.id}>
                  {concert.title} ({concert.status})
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedConcert && (
          <div className="space-y-5">
            {/* Thư mục Drive */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <FolderOpen className="h-4 w-4 text-[#F5C842]" />
                Thư mục Google Drive khách mời
              </h2>
              <input
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                placeholder="Dán link thư mục Drive hoặc ID thư mục…"
                className="w-full rounded-lg border border-white/10 bg-[#1A1A24] px-3 py-2.5 text-sm text-[#F0EDEB]"
              />
              {selectedConcert?.guest_drive_folder_id && (
                <a
                  href={`https://drive.google.com/drive/folders/${selectedConcert.guest_drive_folder_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[#7B61FF] hover:underline"
                >
                  Mở thư mục Drive đã gán ↗
                </a>
              )}
              <p className="mt-2 text-xs leading-5 text-[#8585A0]">
                Nhớ share thư mục (quyền Viewer) cho service account:{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-[#C9BCFF]">{GUEST_DRIVE_SERVICE_ACCOUNT}</code>
              </p>
              <button
                type="button"
                onClick={handleSaveFolder}
                disabled={busy === "save" || folder.trim().length === 0}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#F5C842] px-4 py-2 text-sm font-semibold text-[#0D0D14] disabled:opacity-50"
              >
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Lưu thư mục
              </button>
            </div>

            {/* Nhập + lịch sử job */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Upload className="h-4 w-4 text-[#7B61FF]" />
                  Nhập khách mời
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={busy === "refresh"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#8585A0] hover:bg-white/5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${busy === "refresh" ? "animate-spin" : ""}`} />
                    Làm mới
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={busy === "import"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#7B61FF] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busy === "import" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Nhập ngay
                  </button>
                </div>
              </div>

              {jobs.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#8585A0]">Chưa có lần nhập nào.</p>
              ) : (
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div key={job.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <JobStatusBadge status={job.status} />
                        <span className="text-[#8585A0]">
                          Tổng <b className="text-[#F0EDEB]">{job.total_rows}</b> · Thành công{" "}
                          <b className="text-[#2DBE6C]">{job.success_rows}</b> · Lỗi{" "}
                          <b className="text-[#E8315B]">{job.error_rows}</b>
                        </span>
                        {job.completed_at && <span className="text-[#8585A0]">{formatDateTime(job.completed_at)}</span>}
                        {job.error_rows > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleErrors(job.id)}
                            className="ml-auto text-[#F5C842] hover:underline"
                          >
                            {expandedJob === job.id ? "Ẩn lỗi" : "Xem lỗi"}
                          </button>
                        )}
                      </div>
                      {job.error_message && (
                        <p className="mt-1.5 text-xs text-[#E8315B]">{job.error_message}</p>
                      )}
                      {expandedJob === job.id && (
                        <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                          {(errors[job.id] ?? []).map((row) => (
                            <p key={row.id} className="text-xs text-[#8585A0]">
                              Dòng {row.row_number}:{" "}
                              <span className="text-[#E8315B]">{row.error_code}</span> — {row.error_message}
                            </p>
                          ))}
                          {(errors[job.id]?.length ?? 0) === 0 && (
                            <p className="text-xs text-[#8585A0]">Đang tải lỗi…</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Danh sách guest */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <UserCheck className="h-4 w-4 text-[#2DBE6C]" />
                Khách mời ({guests.length})
              </h2>
              {guests.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#8585A0]">Chưa có khách mời.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-[#8585A0]">
                        <th className="px-2 py-2 font-semibold">Họ tên</th>
                        <th className="px-2 py-2 font-semibold">Email</th>
                        <th className="px-2 py-2 font-semibold">SĐT</th>
                        <th className="px-2 py-2 font-semibold">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guests.map((guest) => (
                        <tr key={guest.guest_id} className="border-t border-white/[0.06]">
                          <td className="px-2 py-2">{guest.full_name}</td>
                          <td className="px-2 py-2 text-[#8585A0]">{guest.email}</td>
                          <td className="px-2 py-2 text-[#8585A0]">{guest.phone_masked ?? "—"}</td>
                          <td className="px-2 py-2">
                            <GuestStatusBadge status={guest.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function JobStatusBadge({ status }: { status: GuestImportJob["status"] }) {
  const map: Record<GuestImportJob["status"], { color: string; bg: string }> = {
    PENDING: { color: "#8585A0", bg: "rgba(255,255,255,0.08)" },
    PROCESSING: { color: "#F5C842", bg: "rgba(245,200,66,0.1)" },
    DONE: { color: "#2DBE6C", bg: "rgba(45,190,108,0.1)" },
    PARTIAL: { color: "#F5C842", bg: "rgba(245,200,66,0.1)" },
    FAILED: { color: "#E8315B", bg: "rgba(232,49,91,0.1)" },
  };
  const item = map[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: item.bg, color: item.color }}>
      {status === "FAILED" && <AlertTriangle className="h-3 w-3" />}
      {status}
    </span>
  );
}

function GuestStatusBadge({ status }: { status: GuestSummary["status"] }) {
  const map: Record<GuestSummary["status"], { label: string; color: string; bg: string }> = {
    INVITED: { label: "Đã mời", color: "#8585A0", bg: "rgba(255,255,255,0.08)" },
    CHECKED_IN: { label: "Đã vào", color: "#2DBE6C", bg: "rgba(45,190,108,0.1)" },
    CANCELLED: { label: "Đã hủy", color: "#E8315B", bg: "rgba(232,49,91,0.1)" },
  };
  const item = map[status];
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: item.bg, color: item.color }}>
      {item.label}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
