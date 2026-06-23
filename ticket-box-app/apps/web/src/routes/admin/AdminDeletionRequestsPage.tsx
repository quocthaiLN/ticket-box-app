import {
  AlertTriangle,
  ChevronRight,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Ticket,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getStoredAuthSession } from "../../lib/auth-session";

export function AdminDeletionRequestsPage() {
  const session = getStoredAuthSession();
  const canUseAdmin = session?.user.role === "ADMIN";

  if (!canUseAdmin) {
    return (
      <main className="min-h-screen bg-[#08080E] px-4 pt-28 text-[#F0EDEB]">
        <section className="mx-auto max-w-xl rounded-2xl border border-white/[0.07] bg-[#111118] p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8315B]/15 text-[#E8315B]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="mb-2 text-xl font-semibold">Chỉ dành cho admin</h1>
          <p className="mb-5 text-sm leading-6 text-[#8585A0]">
            Vai trò hiện tại: {session?.user.role ?? "khách"}. Công cụ duyệt yêu cầu hủy concert chỉ dành cho quản trị viên.
          </p>
          <Link to="/" className="inline-flex items-center gap-2 rounded-lg bg-[#E8315B] px-4 py-2.5 text-sm font-semibold text-white">
            Về trang chủ
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#08080E] pt-16 text-[#F0EDEB]">
      <aside className="fixed bottom-0 left-0 top-16 hidden w-56 flex-col border-r border-white/[0.07] bg-[#0D0D15] px-3 py-6 md:flex">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-widest text-[#8585A0]">Quản trị</div>
        <nav className="flex-1 space-y-1">
          <SideLink to="/admin" active={false} icon={<LayoutDashboard className="h-4 w-4" />} label="Tổng quan" />
          <SideLink to="/admin/organizer-requests" active={false} icon={<FileText className="h-4 w-4" />} label="Hồ sơ BTC" />
          <SideLink to="/admin/deletion-requests" active icon={<Trash2 className="h-4 w-4" />} label="Yêu cầu hủy" />
          <SideLink to="/admin/catalog" active={false} icon={<Ticket className="h-4 w-4" />} label="Danh mục" />
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
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#E8315B]">
                <AlertTriangle className="h-4 w-4" />
                Đang chờ backend
              </div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                Yêu cầu hủy concert
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#8585A0]">
                Màn hình này sẽ dùng các endpoint admin duyệt hủy concert khi API được triển khai.
              </p>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-[#E8315B]/25 bg-[#111118]">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-2 text-[#E8315B]">
                <Trash2 className="h-4 w-4" />
                <h2 className="text-sm font-semibold">API chưa sẵn sàng</h2>
              </div>
            </div>
            <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="text-sm leading-6 text-[#B0B0C0]">
                  Blueprint đã định nghĩa `GET /admin/concert-deletion-requests` và các thao tác duyệt/từ chối,
                  nhưng web app hiện chưa có service tương ứng và API server chưa expose route admin này trong nhánh hiện tại.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#8585A0]">Hành vi dự kiến</p>
                <p className="mt-3 text-sm leading-6 text-[#B0B0C0]">
                  Khi backend có endpoint, trang sẽ hiển thị các yêu cầu `PENDING`, cho admin duyệt để chuyển concert sang `CANCELLED`
                  hoặc từ chối kèm ghi chú cho ban tổ chức.
                </p>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function SideLink({ to, active, icon, label }: { to: string; active: boolean; icon: ReactNode; label: string }) {
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
    </Link>
  );
}
