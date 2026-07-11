import { Ban, Calendar, CheckCircle, Download, Loader2, QrCode, Ticket as TicketIcon, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMyTicketQr,
  listMyTickets,
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (ticket: TicketListItem) => {
    if (downloadingId) return;
    setDownloadingId(ticket.id);
    try {
      const qrData = await getMyTicketQr(ticket.id);
      const qrContent = JSON.stringify({ ...qrData.payload, qr_signature: qrData.qr_signature });

      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 300,
        color: { dark: "#08080E", light: "#FFFFFF" },
      });

      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 900;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      const gradient = ctx.createLinearGradient(0, 0, 0, 900);
      gradient.addColorStop(0, "#111118");
      gradient.addColorStop(1, "#08080E");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 900);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, 560, 860);

      const brandGradient = ctx.createLinearGradient(20, 0, 580, 0);
      brandGradient.addColorStop(0, "#F5C842");
      brandGradient.addColorStop(1, "#E8315B");
      ctx.fillStyle = brandGradient;
      ctx.fillRect(20, 20, 560, 10);

      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillStyle = "#F5C842";
      ctx.font = "bold 24px serif";
      ctx.fillText("TICKETBOX", 300, 55);

      ctx.fillStyle = "#F0EDEB";
      ctx.font = "bold 28px sans-serif";
      const words = ticket.concert_title.split(" ");
      let line = "";
      let y = 110;
      const maxWidth = 500;
      const lineHeight = 36;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, 300, y);
          line = words[n] + " ";
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 300, y);

      const infoStartY = y + 60;

      const drawDetail = (label: string, value: string, detailY: number) => {
        ctx.textAlign = "left";
        ctx.fillStyle = "#8585A0";
        ctx.font = "14px sans-serif";
        ctx.fillText(label.toUpperCase(), 60, detailY);

        ctx.fillStyle = "#F0EDEB";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText(value, 60, detailY + 22);
      };

      drawDetail("Loại vé / Ticket Type", ticket.ticket_type_name, infoStartY);
      drawDetail("Khu vực / Zone", `Khu ${ticket.zone_code}`, infoStartY + 65);
      drawDetail("Ngày phát hành / Issued Date", formatDate(ticket.issued_at), infoStartY + 130);
      drawDetail("Mã vé / Ticket ID", `#${ticket.id}`, infoStartY + 195);

      const lineY = infoStartY + 270;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(40, lineY);
      ctx.lineTo(560, lineY);
      ctx.stroke();
      ctx.setLineDash([]);

      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 175, lineY + 30, 250, 250);
          resolve();
        };
        qrImg.onerror = reject;
        qrImg.src = qrDataUrl;
      });

      ctx.textAlign = "center";
      ctx.fillStyle = "#8585A0";
      ctx.font = "13px sans-serif";
      ctx.fillText("Xuất trình mã này tại cổng soát vé.", 300, lineY + 300);

      const finalDataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = finalDataUrl;
      const cleanTitle = ticket.concert_title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      link.download = `ticket-${cleanTitle}-${ticket.id.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Lỗi khi tải vé:", err);
      alert("Không thể tải vé. Vui lòng thử lại sau.");
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    setStatus("loading");
    listMyTickets({ limit: 100 })
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
  }, []);

  const counts = useMemo(
    () => ({
      all: tickets.length,
      issued: tickets.filter((ticket) => ticket.status === "ISSUED").length,
      checkedIn: tickets.filter((ticket) => ticket.status === "CHECKED_IN").length,
    }),
    [tickets],
  );

  const filteredTickets = useMemo(
    () =>
      tickets
        .filter((ticket) => activeTab === "all" || ticket.status === activeTab)
        .sort((a, b) => {
          const timeA = new Date(a.issued_at).getTime();
          const timeB = new Date(b.issued_at).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return b.id.localeCompare(a.id);
        }),
    [activeTab, tickets],
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

        <div className="mb-6 flex flex-wrap gap-1 border-b border-white/10">
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
        {status === "ready" && filteredTickets.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#111118] px-6 py-16 text-center">
            <QrCode className="mx-auto mb-4 h-12 w-12 text-[#8585A0]" />
            <p className="mb-4 text-sm text-[#8585A0]">Chưa có vé nào trong bộ lọc này.</p>
            <Link to="/events" className="inline-flex rounded-xl bg-[#E8315B] px-5 py-2.5 text-sm font-semibold text-white">
              Khám phá sự kiện
            </Link>
          </div>
        )}

        {filteredTickets.length > 0 && (
          <div className="space-y-4">
            {filteredTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onViewQr={() => setSelectedTicket(ticket)}
                onDownload={() => handleDownload(ticket)}
                isDownloading={downloadingId === ticket.id}
              />
            ))}
          </div>
        )}
      </section>

      {selectedTicket && <QrModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
    </main>
  );
}

function TicketCard({
  ticket,
  onViewQr,
  onDownload,
  isDownloading,
}: {
  ticket: TicketListItem;
  onViewQr: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#111118]">
      <div className="h-1" style={{ background: statusColor(ticket.status) }} />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#F5C842]/10 text-[#F5C842]">
          <TicketIcon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="break-words text-base font-semibold">{ticket.concert_title}</h2>
            <StatusBadge status={ticket.status} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[#8585A0]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#F5C842]" />Phát hành {formatDate(ticket.issued_at)}
            </span>
            <span>{ticket.ticket_type_name}</span>
            <span>Khu {ticket.zone_code}</span>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <button
            type="button"
            onClick={onViewQr}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E8315B]/30 bg-[#E8315B]/10 px-3 py-2 text-xs font-semibold text-[#E8315B]"
          >
            <QrCode className="h-3.5 w-3.5" />
            Xem QR
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-[#8585A0] ${
              isDownloading ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"
            }`}
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F5C842]" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {isDownloading ? "Đang tải..." : "Tải về"}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.02] px-5 py-2.5">
        <span className="break-all font-mono text-xs text-[#8585A0]">#{ticket.id}</span>
      </div>
    </article>
  );
}

function QrModal({ ticket, onClose }: { ticket: TicketListItem; onClose: () => void }) {
  const [qr, setQr] = useState<TicketQr | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    setStatus("loading");
    getMyTicketQr(ticket.id)
      .then((qrData) => {
        if (!mounted) return;
        setQr(qrData);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, [ticket.id]);

  // Nội dung QR = payload (các field server đã ký) GỘP với chữ ký. Không bọc thêm
  // lớp ngoài: checker canonicalize payload (bỏ qr_signature) rồi verify Ed25519, nên
  // object phải đúng bằng object server đã ký thì chữ ký mới khớp.
  const qrContent = qr
    ? JSON.stringify({ ...qr.payload, qr_signature: qr.qr_signature })
    : "";

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
          <p className="mt-1 text-xs text-[#8585A0]">{ticket.ticket_type_name} - Khu {ticket.zone_code}</p>

          <div className="my-5 rounded-2xl border border-white/10 bg-[#08080E] p-4">
            {status === "loading" ? (
              <div className="flex h-44 items-center justify-center text-sm text-[#8585A0]">Đang tải QR...</div>
            ) : status === "error" ? (
              <div className="flex h-44 items-center justify-center text-sm text-[#E8315B]">Không thể tải QR</div>
            ) : (
              <QrImage content={qrContent} />
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

// Render chuỗi đã ký thành ảnh QR thật. Mức sửa lỗi 'M' đủ bền khi in/chụp màn hình;
// nền trắng + ô tối để máy quét đọc tốt dù app dùng theme tối.
function QrImage({ content }: { content: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!content) return;
    let mounted = true;
    QRCode.toDataURL(content, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
      color: { dark: "#08080E", light: "#FFFFFF" },
    })
      .then((url) => {
        if (mounted) setDataUrl(url);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [content]);

  if (failed) {
    return <div className="flex h-44 items-center justify-center text-sm text-[#E8315B]">Không thể tạo QR</div>;
  }
  if (!dataUrl) {
    return <div className="flex h-44 items-center justify-center text-sm text-[#8585A0]">Đang tạo QR...</div>;
  }
  return (
    <img
      src={dataUrl}
      alt="Mã QR vé"
      className="mx-auto h-56 w-56 rounded-xl bg-white p-2"
    />
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
