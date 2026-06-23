import { useState } from "react";
import { Link } from "react-router";
import { Calendar, MapPin, Download, QrCode, X, CheckCircle, Clock, Ban } from "lucide-react";
import { MY_TICKETS, formatCurrency, formatDate, formatTime, Ticket } from "../data/mockData";

export function MyTicketsPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "all">("upcoming");
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);

  const now = new Date();
  const filtered = MY_TICKETS.filter((t) => {
    const eventDate = new Date(t.concert.startsAt);
    if (activeTab === "upcoming") return eventDate >= now && t.status === "ISSUED";
    if (activeTab === "past") return eventDate < now || t.status === "CHECKED_IN";
    return true;
  });

  return (
    <div style={{ background: "#08080E", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingTop: "4.5rem" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", color: "#F0EDEB", fontWeight: 700 }}>
            Vé của tôi
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#8585A0" }}>Quản lý và xem tất cả vé điện tử của bạn</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {(["upcoming", "past", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2.5 text-sm transition-colors"
              style={{
                color: activeTab === tab ? "#F5C842" : "#8585A0",
                borderBottom: activeTab === tab ? "2px solid #F5C842" : "2px solid transparent",
                marginBottom: "-1px",
                fontWeight: activeTab === tab ? 600 : 400,
              }}
            >
              {tab === "upcoming" ? "Sắp diễn ra" : tab === "past" ? "Đã qua" : "Tất cả"}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <QrCode className="w-12 h-12 mx-auto mb-4" style={{ color: "#8585A0" }} />
            <p className="text-sm mb-4" style={{ color: "#8585A0" }}>Không có vé nào</p>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff" }}
            >
              Khám phá sự kiện
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onView={() => setViewingTicket(ticket)} />
            ))}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {viewingTicket && (
        <QRModal ticket={viewingTicket} onClose={() => setViewingTicket(null)} />
      )}
    </div>
  );
}

function TicketCard({ ticket, onView }: { ticket: Ticket; onView: () => void }) {
  const isUpcoming = new Date(ticket.concert.startsAt) >= new Date() && ticket.status === "ISSUED";
  const isCheckedIn = ticket.status === "CHECKED_IN";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Status bar */}
      <div
        className="h-1"
        style={{
          background: isCheckedIn ? "#2DBE6C" : isUpcoming ? "#F5C842" : "rgba(255,255,255,0.15)",
        }}
      />

      <div className="p-5 flex flex-col sm:flex-row gap-4">
        {/* Cover */}
        <div className="w-full sm:w-24 sm:h-24 flex-shrink-0 rounded-xl overflow-hidden">
          <img src={ticket.concert.coverImageUrl} alt="" className="w-full h-full object-cover" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", color: "#F0EDEB", fontWeight: 600 }}>
              {ticket.concert.title}
            </h3>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-sm mb-2" style={{ color: "#8585A0" }}>{ticket.concert.artistName}</p>

          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#8585A0" }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: "#F5C842" }} />
              {formatDate(ticket.concert.startsAt)} · {formatTime(ticket.concert.startsAt)}
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#8585A0" }}>
              <MapPin className="w-3.5 h-3.5" style={{ color: "#F5C842" }} />
              {ticket.concert.venue.name}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ background: `${ticket.ticketType.color}20`, color: ticket.ticketType.color, border: `1px solid ${ticket.ticketType.color}40` }}
            >
              {ticket.ticketType.name}
            </div>
            <span className="text-xs" style={{ color: "#8585A0" }}>
              {ticket.seatZone.name}
            </span>
            <span className="text-xs font-semibold" style={{ color: "#F5C842" }}>
              {formatCurrency(ticket.ticketType.price)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col gap-2 sm:w-28">
          <button
            onClick={onView}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #E8315B22, #E8315B10)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.3)" }}
          >
            <QrCode className="w-3.5 h-3.5" />
            Xem QR
          </button>
          <button
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.06)", color: "#8585A0", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Download className="w-3.5 h-3.5" />
            Tải về
          </button>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-5 py-2.5 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <span className="text-xs font-mono" style={{ color: "#8585A0" }}>#{ticket.qrTokenHash}</span>
        {ticket.checkedInAt && (
          <span className="text-xs" style={{ color: "#8585A0" }}>
            Check-in: {new Date(ticket.checkedInAt).toLocaleString("vi-VN")}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Ticket["status"] }) {
  if (status === "ISSUED") return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(245,200,66,0.12)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.25)", flexShrink: 0 }}>
      <Clock className="w-3 h-3" />Chờ sử dụng
    </span>
  );
  if (status === "CHECKED_IN") return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(45,190,108,0.12)", color: "#2DBE6C", border: "1px solid rgba(45,190,108,0.25)", flexShrink: 0 }}>
      <CheckCircle className="w-3 h-3" />Đã check-in
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(232,49,91,0.12)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.25)", flexShrink: 0 }}>
      <Ban className="w-3 h-3" />Đã hủy
    </span>
  );
}

function QRModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        className="relative rounded-3xl overflow-hidden max-w-sm w-full"
        style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold top stripe */}
        <div className="h-1.5" style={{ background: "linear-gradient(90deg, #F5C842, #E8315B)" }} />

        <div className="p-6">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "#8585A0" }}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Concert info */}
          <div className="text-center mb-5">
            <img src={ticket.concert.coverImageUrl} alt="" className="w-16 h-16 rounded-xl mx-auto mb-3 object-cover" />
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.3rem", color: "#F0EDEB", fontWeight: 700 }}>
              {ticket.concert.title}
            </h2>
            <p className="text-xs mt-1" style={{ color: "#8585A0" }}>{ticket.concert.artistName}</p>
          </div>

          {/* Dashed divider */}
          <div className="relative my-4" style={{ borderTop: "1.5px dashed rgba(255,255,255,0.1)" }}>
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full" style={{ background: "#08080E" }} />
            <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full" style={{ background: "#08080E" }} />
          </div>

          {/* Ticket details */}
          <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
            <TicketDetail label="Ngày" value={new Date(ticket.concert.startsAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} />
            <TicketDetail label="Giờ" value={formatTime(ticket.concert.startsAt)} />
            <TicketDetail label="Loại vé" value={ticket.ticketType.name} color={ticket.ticketType.color} />
            <TicketDetail label="Khu" value={ticket.seatZone.name} />
          </div>

          {/* QR Code (simulated) */}
          <div
            className="flex justify-center items-center rounded-2xl p-4 mb-4"
            style={{ background: "#fff" }}
          >
            <svg viewBox="0 0 120 120" width="140" height="140">
              {/* Finder patterns */}
              <rect x="5" y="5" width="35" height="35" rx="4" fill="#0A0A0F" />
              <rect x="9" y="9" width="27" height="27" rx="2" fill="white" />
              <rect x="13" y="13" width="19" height="19" rx="2" fill="#0A0A0F" />
              <rect x="80" y="5" width="35" height="35" rx="4" fill="#0A0A0F" />
              <rect x="84" y="9" width="27" height="27" rx="2" fill="white" />
              <rect x="88" y="13" width="19" height="19" rx="2" fill="#0A0A0F" />
              <rect x="5" y="80" width="35" height="35" rx="4" fill="#0A0A0F" />
              <rect x="9" y="84" width="27" height="27" rx="2" fill="white" />
              <rect x="13" y="88" width="19" height="19" rx="2" fill="#0A0A0F" />
              {/* Data modules - simplified pattern */}
              {Array.from({ length: 7 }, (_, r) =>
                Array.from({ length: 7 }, (_, c) => {
                  if ((r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3)) return null;
                  const x = 47 + c * 10, y = 47 + r * 10;
                  return Math.random() > 0.45 ? <rect key={`${r}${c}`} x={x} y={y} width="7" height="7" fill="#0A0A0F" rx="1" /> : null;
                })
              )}
              {Array.from({ length: 4 }, (_, r) =>
                Array.from({ length: 7 }, (_, c) => {
                  const x = 47 + c * 10, y = 5 + r * 10;
                  if (c > 3 && r < 4) return null;
                  return Math.random() > 0.5 ? <rect key={`d${r}${c}`} x={x} y={y} width="7" height="7" fill="#0A0A0F" rx="1" /> : null;
                })
              )}
            </svg>
          </div>

          <p className="text-xs text-center font-mono mb-1" style={{ color: "#8585A0" }}>{ticket.qrTokenHash}</p>
          <p className="text-xs text-center" style={{ color: "#8585A0" }}>
            {ticket.status === "CHECKED_IN" ? "✅ Đã được sử dụng" : "Xuất trình tại cổng soát vé"}
          </p>

          <button
            onClick={onClose}
            className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.07)", color: "#F0EDEB", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketDetail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ color: "#8585A0" }}>{label}</p>
      <p className="font-medium mt-0.5" style={{ color: color || "#F0EDEB" }}>{value}</p>
    </div>
  );
}
