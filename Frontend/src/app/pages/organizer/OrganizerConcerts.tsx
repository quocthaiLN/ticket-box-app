import { useState } from "react";
import { Link } from "react-router";
import { Search, Eye, Edit2, Trash2, TrendingUp, Users, Ticket } from "lucide-react";
import { CONCERTS, DELETION_REQUESTS, formatCurrency, formatDate } from "../../data/mockData";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  PUBLISHED: { bg: "rgba(45,190,108,0.1)", color: "#2DBE6C", label: "Đã đăng" },
  DRAFT:     { bg: "rgba(245,200,66,0.1)", color: "#F5C842", label: "Nháp" },
  CANCELLED: { bg: "rgba(232,49,91,0.1)",  color: "#E8315B", label: "Đã hủy" },
  COMPLETED: { bg: "rgba(255,255,255,0.08)", color: "#8585A0", label: "Hoàn thành" },
};

export function OrganizerConcerts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [requestingDeletion, setRequestingDeletion] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionSubmitted, setDeletionSubmitted] = useState(false);

  const myConcerts = CONCERTS.filter((c) => c.organizerId === "user-organizer-1");
  const filtered = myConcerts.filter((c) => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.artistName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDeleteRequest = (concertId: string) => {
    setTimeout(() => {
      setDeletionSubmitted(true);
      setTimeout(() => {
        setRequestingDeletion(null);
        setDeletionSubmitted(false);
        setDeletionReason("");
      }, 2000);
    }, 800);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>Sự kiện của tôi</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>{myConcerts.length} sự kiện · Chỉnh sửa DRAFT hoặc xin hủy concert</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#8585A0" }} />
          <input
            placeholder="Tìm kiếm sự kiện..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none text-sm flex-1"
            style={{ color: "#F0EDEB" }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}
        >
          <option value="all">Tất cả</option>
          <option value="PUBLISHED">Đã đăng</option>
          <option value="DRAFT">Nháp</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>

      {/* Concert list */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-12 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "#8585A0" }}>Không tìm thấy sự kiện nào</p>
          </div>
        )}
        {filtered.map((concert) => {
          const totalSold = concert.ticketTypes.reduce((s, t) => s + t.soldQuantity, 0);
          const totalQ = concert.ticketTypes.reduce((s, t) => s + t.totalQuantity, 0);
          const revenue = concert.ticketTypes.reduce((s, t) => s + t.soldQuantity * t.price, 0);
          const pct = totalQ > 0 ? Math.round((totalSold / totalQ) * 100) : 0;
          const sc = STATUS_CONFIG[concert.status] ?? STATUS_CONFIG.DRAFT;
          const hasPendingDeletion = DELETION_REQUESTS.some((r) => r.concertId === concert.id && r.status === "PENDING");
          const isDraft = concert.status === "DRAFT";

          return (
            <div key={concert.id} className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start gap-4 p-5">
                <ImageWithFallback src={concert.coverImageUrl} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      {hasPendingDeletion && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(232,49,91,0.1)", color: "#E8315B" }}>Đang xin hủy</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Link to={`/concerts/${concert.slug}`} target="_blank" className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: "#8585A0" }} title="Xem public">
                        <Eye className="w-4 h-4" />
                      </Link>
                      {isDraft && (
                        <button className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: "#7B61FF" }} title="Chỉnh sửa DRAFT">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {concert.status !== "CANCELLED" && !hasPendingDeletion && (
                        <button
                          onClick={() => setRequestingDeletion(concert.id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                          style={{ color: "#E8315B" }}
                          title="Xin hủy concert"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>{concert.title}</p>
                  <p className="text-xs mt-0.5 mb-2" style={{ color: "#8585A0" }}>{concert.artistName} · {formatDate(concert.startsAt)} · {concert.venue.name}</p>

                  {/* Stats row */}
                  {concert.ticketTypes.length > 0 && (
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5" style={{ color: "#7B61FF" }} />
                        <span className="text-xs" style={{ color: "#8585A0" }}>
                          {totalSold.toLocaleString("vi-VN")}/{totalQ.toLocaleString("vi-VN")} vé ({pct}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" style={{ color: "#2DBE6C" }} />
                        <span className="text-xs" style={{ color: "#8585A0" }}>{formatCurrency(revenue)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" style={{ color: "#F5C842" }} />
                        <span className="text-xs" style={{ color: "#8585A0" }}>{concert.ticketTypes.length} loại vé</span>
                      </div>
                    </div>
                  )}

                  {/* Progress bar */}
                  {totalQ > 0 && (
                    <div className="mt-2 w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 85 ? "#E8315B" : pct > 60 ? "#F5C842" : "#2DBE6C" }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Deletion request form */}
              {requestingDeletion === concert.id && (
                <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(232,49,91,0.2)", background: "rgba(232,49,91,0.03)" }}>
                  {deletionSubmitted ? (
                    <div className="pt-4 flex items-center gap-2">
                      <span className="text-sm" style={{ color: "#2DBE6C" }}>✓ Yêu cầu đã được gửi đến admin</span>
                    </div>
                  ) : (
                    <div className="pt-4">
                      <p className="text-xs font-semibold mb-2" style={{ color: "#E8315B" }}>Xin hủy concert — lý do</p>
                      <textarea
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                        placeholder="Nhập lý do xin hủy concert này..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none mb-3"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F0EDEB" }}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleDeleteRequest(concert.id)}
                          disabled={!deletionReason.trim()}
                          className="px-4 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105 disabled:opacity-40"
                          style={{ background: "rgba(232,49,91,0.15)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.3)" }}
                        >
                          Gửi yêu cầu
                        </button>
                        <button onClick={() => { setRequestingDeletion(null); setDeletionReason(""); }} className="px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/5" style={{ color: "#8585A0" }}>
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
