import { ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { getStoredAuthSession } from "../../lib/auth-session";
import {
  listAdminAuditLogs,
  type AdminAuditFilter,
  type AdminAuditLog,
} from "../../services/admin-audit.service";
import { LongText } from "../../components/LongText";
import { AdminAccessState, AdminShell } from "./AdminShell";

type LoadState = "loading" | "ready" | "error";

// Gợi ý các action đã có trong hệ thống để filter nhanh (vẫn nhập tự do được).
const knownActions = [
  "CONCERT_AUTO_PUBLISHED",
  "CONCERT_PUBLISHED",
  "ORGANIZER_REQUEST_APPROVED",
  "ORGANIZER_REQUEST_REJECTED",
  "CONCERT_DELETION_APPROVED",
];

const emptyFilter: AdminAuditFilter = {
  action: "",
  entity_type: "",
  entity_id: "",
  from: "",
  to: "",
};

export function AdminAuditLogPage() {
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [form, setForm] = useState<AdminAuditFilter>(emptyFilter);
  const [activeFilter, setActiveFilter] = useState<AdminAuditFilter>(emptyFilter);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (canUseAdmin) void load(activeFilter);
  }, [canUseAdmin, activeFilter]);

  async function load(filter: AdminAuditFilter) {
    setLoadState("loading");
    setMessage("");
    try {
      const page = await listAdminAuditLogs(toQueryFilter(filter));
      setLogs(page.items);
      setNextCursor(page.nextCursor);
      setLoadState("ready");
    } catch (err) {
      setLoadState("error");
      setMessage(err instanceof Error ? err.message : "Không thể tải audit log.");
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await listAdminAuditLogs(toQueryFilter(activeFilter), nextCursor);
      setLogs((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể tải thêm audit log.");
    } finally {
      setLoadingMore(false);
    }
  }

  function applyFilter(event: FormEvent) {
    event.preventDefault();
    setExpandedId(null);
    setActiveFilter({ ...form });
  }

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} description="Audit log chỉ dành cho admin." />;
  }

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-[1.75rem] font-bold text-[#F0EDEB]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Audit log
          </h1>
          <p className="mt-0.5 text-sm text-[#8585A0]">Lịch sử thao tác hệ thống: publish, duyệt hồ sơ, tạo tài khoản...</p>
        </div>

        <form onSubmit={applyFilter} className="mb-5 grid gap-3 rounded-2xl border border-white/[0.07] bg-[#111118] p-4 sm:grid-cols-2 lg:grid-cols-5">
          <FilterField label="Action">
            <input
              list="audit-action-options"
              value={form.action}
              onChange={(event) => setForm((current) => ({ ...current, action: event.target.value }))}
              placeholder="VD: CONCERT_AUTO_PUBLISHED"
              className={filterInputClass}
            />
            <datalist id="audit-action-options">
              {knownActions.map((action) => (
                <option key={action} value={action} />
              ))}
            </datalist>
          </FilterField>
          <FilterField label="Entity type">
            <input
              value={form.entity_type}
              onChange={(event) => setForm((current) => ({ ...current, entity_type: event.target.value }))}
              placeholder="VD: CONCERT"
              className={filterInputClass}
            />
          </FilterField>
          <FilterField label="Entity ID">
            <input
              value={form.entity_id}
              onChange={(event) => setForm((current) => ({ ...current, entity_id: event.target.value }))}
              placeholder="UUID"
              className={filterInputClass}
            />
          </FilterField>
          <FilterField label="Từ">
            <input
              type="datetime-local"
              value={form.from}
              onChange={(event) => setForm((current) => ({ ...current, from: event.target.value }))}
              className={filterInputClass}
            />
          </FilterField>
          <FilterField label="Đến">
            <input
              type="datetime-local"
              value={form.to}
              onChange={(event) => setForm((current) => ({ ...current, to: event.target.value }))}
              className={filterInputClass}
            />
          </FilterField>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[#F5C842]/15 px-4 py-2 text-xs font-semibold text-[#F5C842] transition-colors hover:bg-[#F5C842]/25">
              <Search className="h-3.5 w-3.5" />
              Lọc
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(emptyFilter);
                setActiveFilter(emptyFilter);
              }}
              className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-[#8585A0] transition-colors hover:bg-white/10 hover:text-[#F0EDEB]"
            >
              Xóa lọc
            </button>
          </div>
        </form>

        {message && <p className="mb-4 rounded-xl border border-[#E8315B]/30 bg-[#E8315B]/10 px-4 py-3 text-sm text-[#E8315B]">{message}</p>}

        <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#111118]">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Thời gian", "Actor", "Action", "Entity", "IP", ""].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-[#8585A0]">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadState === "loading" && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#8585A0]">
                    <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                    Đang tải audit log...
                  </td>
                </tr>
              )}
              {loadState === "ready" && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#8585A0]">
                    Không có bản ghi nào khớp bộ lọc.
                  </td>
                </tr>
              )}
              {loadState !== "loading" &&
                logs.map((log) => (
                  <AuditRow
                    key={log.id}
                    log={log}
                    expanded={expandedId === log.id}
                    onToggle={() => setExpandedId((current) => (current === log.id ? null : log.id))}
                  />
                ))}
            </tbody>
          </table>
        </div>

        {nextCursor && loadState === "ready" && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-[#8585A0] transition-colors hover:bg-white/10 hover:text-[#F0EDEB] disabled:opacity-50"
            >
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Tải thêm
            </button>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function AuditRow({ log, expanded, onToggle }: { log: AdminAuditLog; expanded: boolean; onToggle: () => void }) {
  const hasDetail = log.metadata !== null || log.user_agent !== null;

  return (
    <>
      <tr
        className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-b-0 hover:bg-white/[0.03]"
        onClick={onToggle}
      >
        <td className="whitespace-nowrap px-4 py-3 text-xs text-[#8585A0]">{formatDateTime(log.created_at)}</td>
        <td className="px-4 py-3 text-xs">
          {log.actor ? (
            <div className="min-w-0 max-w-[240px]">
              <p className="break-words text-[#F0EDEB]">{log.actor.full_name || log.actor.role}</p>
              <LongText value={log.actor.email} className="text-[11px] text-[#8585A0]" />
            </div>
          ) : (
            <span className="text-[#8585A0]">Hệ thống</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="rounded-full bg-[#7B61FF]/10 px-2 py-1 font-mono text-[11px] font-semibold text-[#C9BCFF]">{log.action}</span>
        </td>
        <td className="px-4 py-3 text-xs text-[#8585A0]">
          <p className="text-[#F0EDEB]">{log.entity_type}</p>
          {log.entity_id && <LongText value={log.entity_id} copyable className="max-w-[220px] text-[11px]" />}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-[#8585A0]">{log.ip_address ?? "—"}</td>
        <td className="px-4 py-3 text-right">
          {hasDetail && (expanded ? <ChevronUp className="ml-auto h-4 w-4 text-[#8585A0]" /> : <ChevronDown className="ml-auto h-4 w-4 text-[#8585A0]" />)}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr className="border-b border-white/[0.04] bg-white/[0.02] last:border-b-0">
          <td colSpan={6} className="px-4 py-3">
            {log.metadata && (
              <pre className="mb-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-[#0D0D15] p-3 font-mono text-[11px] leading-5 text-[#C9BCFF]">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            )}
            {log.user_agent && <p className="break-words text-[11px] text-[#8585A0]">User agent: {log.user_agent}</p>}
          </td>
        </tr>
      )}
    </>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[#8585A0]">
      {label}
      {children}
    </label>
  );
}

const filterInputClass =
  "rounded-lg border border-white/[0.08] bg-[#0D0D15] px-3 py-2 text-xs text-[#F0EDEB] outline-none placeholder:text-[#8585A0]/60 focus:border-[#F5C842]/40";

// Schema backend yêu cầu datetime có offset → convert giá trị datetime-local sang ISO.
function toQueryFilter(filter: AdminAuditFilter): AdminAuditFilter {
  return {
    ...filter,
    from: toIsoOrEmpty(filter.from),
    to: toIsoOrEmpty(filter.to),
  };
}

function toIsoOrEmpty(value?: string) {
  if (!value?.trim()) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
