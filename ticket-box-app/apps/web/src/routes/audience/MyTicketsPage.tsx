import { Ban, Calendar, CheckCircle, Download, QrCode, Ticket as TicketIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMyTicket,
  getMyTicketQr,
  listMyTickets,
  type TicketDetail,
  type TicketListItem,
  type TicketQr,
  type TicketStatus,
} from "../../services/ticket.service";

type TicketTab = "all" | TicketStatus;

const tabs: Array<{ value: TicketTab; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "ISSUED", label: "Chờ sử dụng" },
  { value: "CHECKED_IN", label: "Đã check-in" },
  { value: "CANCELLED", label: "Đã hủy" },
  { value: "REFUNDED", label: "Đã hoàn" },
];

export function MyTicketsPage() {
  const [activeTab, setActiveTab] = useState<TicketTab>("all");
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedTicket, setSelectedTicket] = useState<TicketListItem | null>(null);

  useEffect(() => {
    let mounted = true;
    setStatus("loading");
    listMyTickets({ status: activeTab, limit: 100 })
      .then((items) => {
        if (!mounted) return;
        setTickets(items);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, [activeTab]);

  const counts = useMemo(
    () => ({
      all: tickets.length,
      issued: tickets.filter((ticket) => ticket.status === "ISSUED").length,
      checkedIn: tickets.filter((ticket) => ticket.status === "CHECKED_IN").length,
    }),
    [tickets],
  );

  return (
    <main className="min-h-screen bg-[#08080E] px-4 pb-12 pt-24 text-[#F0EDEB] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Vé của tôi</h1>
          <p className="mt-1 text-sm text-[#8585A0]">Quản lý e-ticket và mở mã QR để check-in tại cổng.</p>
        </header>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Tổng vé" value={counts.all} tone="#F5C842" />
          <Stat label="Chờ sử dụng" value={counts.issued} tone="#7B61FF" />
          <Stat label="Đã check-in" value={counts.checkedIn} tone="#2DBE6C" />
        </div>

        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className="shrink-0 px-4 py-2.5 text-sm transition-colors"
              style={{
                color: activeTab === tab.value ? "#F5C842" : "#8585A0",
                borderBottom: activeTab === tab.value ? "2px solid #F5C842" : "2px solid transparent",
                marginBottom: "-1px",
                fontWeight: activeTab === tab.value ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {status === "loading" && <StatePanel text="Đang tải vé..." />}
        {status === "error" && <StatePanel text="Không thể tải danh sách vé. Vui lòng đăng nhập bằng tài khoản khán giả." tone="error" />}
        {status === "ready" && tickets.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#111118] px-6 py-16 text-center">
            <QrCode className="mx-auto mb-4 h-12 w-12 text-[#8585A0]" />
            <p className="mb-4 text-sm text-[#8585A0]">Chưa có vé nào trong bộ lọc này.</p>
            <Link to="/events" className="inline-flex rounded-xl bg-[#E8315B] px-5 py-2.5 text-sm font-semibold text-white">
              Khám phá sự kiện
            </Link>
          </div>
        )}

        {tickets.length > 0 && (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onViewQr={() => setSelectedTicket(ticket)} />
            ))}
          </div>
        )}
      </section>

      {selectedTicket && <QrModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
    </main>
  );
}

function TicketCard({ ticket, onViewQr }: { ticket: TicketListItem; onViewQr: () => void }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#111118]">
      <div className="h-1" style={{ background: statusColor(ticket.status) }} />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#F5C842]/10 text-[#F5C842]">
          <TicketIcon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{ticket.concert_title}</h2>
            <StatusBadge status={ticket.status} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[#8585A0]">
            <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-[#F5C842]" />Phát hành {formatDate(ticket.issued_at)}</span>
            <span>{ticket.ticket_type_name}</span>
            <span>Khu {ticket.zone_code}</span>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <button type="button" onClick={onViewQr} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E8315B]/30 bg-[#E8315B]/10 px-3 py-2 text-xs font-semibold text-[#E8315B]">
            <QrCode className="h-3.5 w-3.5" />
            Xem QR
          </button>
          <button type="button" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-[#8585A0]">
            <Download className="h-3.5 w-3.5" />
            Tải về
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.02] px-5 py-2.5">
        <span className="truncate font-mono text-xs text-[#8585A0]">#{ticket.id}</span>
      </div>
    </article>
  );
}

function QrModal({ ticket, onClose }: { ticket: TicketListItem; onClose: () => void }) {
  const [qr, setQr] = useState<TicketQr | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    setStatus("loading");
    Promise.all([getMyTicketQr(ticket.id), getMyTicket(ticket.id)])
      .then(([qrData, detailData]) => {
        if (!mounted) return;
        setQr(qrData);
        setDetail(detailData);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, [ticket.id]);

  const qrText = qr ? JSON.stringify(qr.payload) : ticket.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur" onClick={onClose}>
      <section className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#111118]" onClick={(event) => event.stopPropagation()}>
        <div className="h-1.5 bg-gradient-to-r from-[#F5C842] to-[#E8315B]" />
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-[#8585A0] hover:bg-white/10" aria-label="Đóng">
          <X className="h-4 w-4" />
        </button>
        <div className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#F5C842]/10 text-[#F5C842]">
            <QrCode className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{ticket.concert_title}</h2>
          <p className="mt-1 text-xs text-[#8585A0]">{ticket.ticket_type_name} - {detail?.seat_zone.name ?? `Khu ${ticket.zone_code}`}</p>

          <div className="my-5 rounded-2xl bg-white p-4">
            {status === "loading" ? (
              <div className="flex h-44 items-center justify-center text-sm text-[#0D0D14]">Đang tải QR...</div>
            ) : status === "error" ? (
              <div className="flex h-44 items-center justify-center text-sm text-[#0D0D14]">Không thể tải QR</div>
            ) : (
              <PseudoQr text={qrText} />
            )}
          </div>

          {qr && <p className="break-all font-mono text-[11px] leading-5 text-[#8585A0]">{qr.payload.qr_token}</p>}
          <p className="mt-2 text-xs text-[#8585A0]">{ticket.status === "CHECKED_IN" ? "Vé đã được sử dụng." : "Xuất trình mã này tại cổng soát vé."}</p>
          <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.07] py-2.5 text-sm text-[#F0EDEB]">
            Đóng
          </button>
        </div>
      </section>
    </div>
  );
}

function PseudoQr({ text }: { text: string }) {
  const cells = Array.from({ length: 121 }, (_, index) => {
    const x = index % 11;
    const y = Math.floor(index / 11);
    const finder =
      (x < 3 && y < 3) ||
      (x > 7 && y < 3) ||
      (x < 3 && y > 7);
    const value = finder || hash(`${text}:${index}`) % 5 > 1;
    return value;
  });

  return (
    <svg viewBox="0 0 132 132" className="mx-auto h-44 w-44" role="img" aria-label="QR vé">
      <rect width="132" height="132" fill="#fff" />
      {cells.map((value, index) => {
        if (!value) return null;
        const x = index % 11;
        const y = Math.floor(index / 11);
        return <rect key={index} x={x * 12 + 2} y={y * 12 + 2} width="9" height="9" rx="1" fill="#0A0A0F" />;
      })}
    </svg>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  if (status === "ISSUED") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[#F5C842]/10 px-2 py-0.5 text-xs text-[#F5C842]"><Calendar className="h-3 w-3" />Chờ sử dụng</span>;
  }
  if (status === "CHECKED_IN") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[#2DBE6C]/10 px-2 py-0.5 text-xs text-[#2DBE6C]"><CheckCircle className="h-3 w-3" />Đã check-in</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#E8315B]/10 px-2 py-0.5 text-xs text-[#E8315B]"><Ban className="h-3 w-3" />{status === "REFUNDED" ? "Đã hoàn" : "Đã hủy"}</span>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111118] p-4">
      <p className="text-xs text-[#8585A0]">{label}</p>
      <p className="mt-2 text-2xl font-bold" style={{ color: tone }}>{value}</p>
    </div>
  );
}

function StatePanel({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111118] px-5 py-16 text-center text-sm" style={{ color: tone === "error" ? "#E8315B" : "#8585A0" }}>
      {text}
    </div>
  );
}

function statusColor(status: TicketStatus) {
  if (status === "ISSUED") return "#F5C842";
  if (status === "CHECKED_IN") return "#2DBE6C";
  return "#E8315B";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}
