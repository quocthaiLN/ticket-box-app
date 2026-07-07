import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { getStoredAuthSession } from "../../lib/auth-session";
import {
  listAdminUsers,
  deleteAdminUser,
  promoteAdminUserToOrganizer,
  type AdminUser,
  type AdminUserRole,
  type AdminUserStatus,
} from "../../services/admin-account.service";
import { AdminAccessState, AdminShell } from "./AdminShell";

type LoadState = "loading" | "ready" | "error";

const roleStyles: Record<AdminUserRole, { bg: string; color: string }> = {
  ADMIN: { bg: "rgba(232,49,91,0.1)", color: "#E8315B" },
  ORGANIZER: { bg: "rgba(245,200,66,0.1)", color: "#F5C842" },
  CHECKER: { bg: "rgba(123,97,255,0.1)", color: "#7B61FF" },
  AUDIENCE: { bg: "rgba(255,255,255,0.07)", color: "#8585A0" },
};

const statusStyles: Record<AdminUserStatus, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: "rgba(45,190,108,0.1)", color: "#2DBE6C", label: "Hoạt động" },
  LOCKED: { bg: "rgba(232,49,91,0.1)", color: "#E8315B", label: "Tạm khóa" },
  DISABLED: { bg: "rgba(255,255,255,0.07)", color: "#8585A0", label: "Tắt" },
};

export function AdminAccountsPage() {
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (canUseAdmin) void reload();
  }, [canUseAdmin]);

  async function reload() {
    setLoadState("loading");
    setMessage("");
    try {
      setUsers(await listAdminUsers());
      setLoadState("ready");
    } catch (err) {
      setLoadState("error");
      setMessage(err instanceof Error ? err.message : "Không thể tải danh sách account.");
    }
  }

  if (!canUseAdmin) {
    return <AdminAccessState role={session?.user.role} description="Quản lý account chỉ dành cho admin." />;
  }

  async function promoteToOrganizer(user: AdminUser) {
    if (user.role !== "AUDIENCE") return;
    setMessage("");
    try {
      await promoteAdminUserToOrganizer(user.id);
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, role: "ORGANIZER" } : item)));
      setMessage(`Đã nâng cấp ${user.email} lên Organizer.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể nâng cấp account.");
    }
  }

  async function removeUser(user: AdminUser) {
    if (!window.confirm(`Xóa account ${user.email}?`)) return;
    setMessage("");
    try {
      await deleteAdminUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setMessage(`Đã xóa account ${user.email}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không thể xóa account.");
    }
  }

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[1.75rem] font-bold text-[#F0EDEB]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Account
            </h1>
            <p className="mt-0.5 text-sm text-[#8585A0]">Quản lý tài khoản và phân quyền</p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-[#8585A0] transition-colors hover:bg-white/10 hover:text-[#F0EDEB]"
          >
            {loadState === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Làm mới
          </button>
        </div>

        {message && <Message text={message} error={loadState === "error" || message.toLowerCase().includes("không thể")} />}

        <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#111118]">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Họ tên", "Email", "Role", "Trạng thái", "Ngày tạo", ""].map((heading) => (
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
                    Đang tải account...
                  </td>
                </tr>
              )}
              {loadState === "ready" && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#8585A0]">
                    Chưa có account.
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <AccountRow
                  key={user.id}
                  user={user}
                  currentUserId={session.user.id}
                  onPromote={() => promoteToOrganizer(user)}
                  onDelete={() => removeUser(user)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

function AccountRow({
  user,
  currentUserId,
  onPromote,
  onDelete,
}: {
  user: AdminUser;
  currentUserId: string;
  onPromote: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"promote" | "delete" | null>(null);
  const roleStyle = roleStyles[user.role];
  const statusStyle = statusStyles[user.status];
  const canPromote = user.role === "AUDIENCE";
  const isCurrentUser = user.id === currentUserId;

  async function run(kind: "promote" | "delete", action: () => Promise<void>) {
    setBusy(kind);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  return (
    <tr className="border-b border-white/[0.04] transition-colors last:border-b-0 hover:bg-white/[0.03]">
      <td className="px-4 py-3 text-sm font-medium text-[#F0EDEB]">
        <span className="block max-w-[260px] break-words">{user.full_name || "Chưa đặt tên"}</span>
      </td>
      <td className="px-4 py-3 text-xs text-[#8585A0]">
        <span className="block max-w-[320px] break-all">{user.email}</span>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: roleStyle.bg, color: roleStyle.color }}>
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
          {statusStyle.label}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-[#8585A0]">{formatDate(user.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={!canPromote || busy !== null}
            onClick={() => run("promote", onPromote)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#F5C842]/20 bg-[#F5C842]/10 px-2.5 py-1 text-xs font-semibold text-[#F5C842] transition-colors hover:bg-[#F5C842]/15 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-[#8585A0]"
            title={canPromote ? "Nâng cấp lên Organizer" : "Chỉ Audience mới có thể nâng lên Organizer"}
          >
            {busy === "promote" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Organizer
          </button>
          <button
            type="button"
            disabled={isCurrentUser || busy !== null}
            onClick={() => run("delete", onDelete)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#E8315B]/25 bg-[#E8315B]/10 px-2.5 py-1 text-xs font-semibold text-[#E8315B] transition-colors hover:bg-[#E8315B]/15 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-[#8585A0]"
            title={isCurrentUser ? "Không thể xóa tài khoản đang đăng nhập" : "Xóa account"}
          >
            {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Xóa
          </button>
        </div>
      </td>
    </tr>
  );
}

function Message({ text, error }: { text: string; error?: boolean }) {
  return (
    <div
      className="mb-5 rounded-xl border px-4 py-3 text-sm"
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
