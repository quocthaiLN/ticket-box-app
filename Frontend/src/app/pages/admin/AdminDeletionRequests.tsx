import { useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { DELETION_REQUESTS, CONCERTS, ConcertDeletionRequest, ApprovalStatus } from "../../data/mockData";

const STATUS_CONFIG: Record<ApprovalStatus, { bg: string; color: string; label: string }> = {
  PENDING:  { bg: "rgba(245,200,66,0.1)",  color: "#F5C842", label: "Chờ duyệt" },
  APPROVED: { bg: "rgba(45,190,108,0.1)",  color: "#2DBE6C", label: "Đã duyệt" },
  REJECTED: { bg: "rgba(232,49,91,0.1)",   color: "#E8315B", label: "Từ chối" },
};

export function AdminDeletionRequests() {
  const [filter, setFilter] = useState<"all" | ApprovalStatus>("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [requests, setRequests] = useState(DELETION_REQUESTS);

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  const handleAction = (id: string, action: "APPROVED" | "REJECTED") => {
    setRequests((prev) =>
      prev.map((r) => r.id === id
        ? { ...r, status: action, reviewedAt: new Date().toISOString(), reviewNote: reviewNote || undefined }
        : r
      )
    );
    setReviewingId(null);
    setReviewNote("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>Yêu cầu Hủy Concert</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>Duyệt hoặc từ chối yêu cầu hủy/xóa concert từ BTC</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(232,49,91,0.1)", border: "1px solid rgba(232,49,91,0.25)" }}>
            <AlertTriangle className="w-4 h-4" style={{ color: "#E8315B" }} />
            <span className="text-sm font-semibold" style={{ color: "#E8315B" }}>{pendingCount} chờ duyệt</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["all", "PENDING", "APPROVED", "REJECTED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={filter === f
              ? { background: "#F5C842", color: "#0A0A0F", fontWeight: 600 }
              : { background: "rgba(255,255,255,0.05)", color: "#8585A0", border: "1px solid rgba(255,255,255,0.07)" }
            }
          >
            {f === "all" ? "Tất cả" : STATUS_CONFIG[f].label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: "#2DBE6C" }} />
            <p style={{ color: "#8585A0" }}>Không có yêu cầu nào</p>
          </div>
        )}
        {filtered.map((req) => {
          const concert = CONCERTS.find((c) => c.id === req.concertId);
          const sc = STATUS_CONFIG[req.status];
          return (
            <div key={req.id} className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-4 flex items-start gap-4">
                {/* Concert cover thumbnail */}
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "#1A1A24" }}>
                  {concert && <img src={concert.coverImageUrl} alt="" className="w-full h-full object-cover" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                    <span className="text-xs" style={{ color: "#8585A0" }}>#{req.id}</span>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>{req.concertTitle}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>BTC: {req.organizerName} · {new Date(req.createdAt).toLocaleDateString("vi-VN")}</p>

                  <div className="mt-2 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "#8585A0" }}>Lý do xin hủy</p>
                    <p className="text-sm" style={{ color: "#B0B0C0" }}>{req.reason}</p>
                  </div>

                  {req.reviewNote && (
                    <div className="mt-2 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <p className="text-xs font-semibold mb-0.5" style={{ color: "#8585A0" }}>Ghi chú admin</p>
                      <p className="text-xs" style={{ color: "#B0B0C0" }}>{req.reviewNote}</p>
                    </div>
                  )}
                </div>

                {req.status === "PENDING" && reviewingId !== req.id && (
                  <button
                    onClick={() => { setReviewingId(req.id); setReviewNote(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all hover:scale-105"
                    style={{ background: "rgba(232,49,91,0.12)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.3)" }}
                  >
                    Xem xét
                  </button>
                )}
              </div>

              {/* Review action panel */}
              {reviewingId === req.id && (
                <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(232,49,91,0.2)", background: "rgba(232,49,91,0.03)" }}>
                  <div className="flex items-start gap-3 mb-3 p-3 rounded-lg" style={{ background: "rgba(232,49,91,0.08)", border: "1px solid rgba(232,49,91,0.2)" }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#E8315B" }} />
                    <p className="text-xs" style={{ color: "#E8315B" }}>
                      Duyệt yêu cầu này sẽ hủy concert <strong>{req.concertTitle}</strong>. Hành động này không thể hoàn tác.
                    </p>
                  </div>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Ghi chú cho BTC (tùy chọn)..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none mb-3"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F0EDEB" }}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction(req.id, "APPROVED")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                      style={{ background: "rgba(232,49,91,0.15)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.3)" }}
                    >
                      <CheckCircle2 className="w-4 h-4" />Duyệt · Hủy concert
                    </button>
                    <button
                      onClick={() => handleAction(req.id, "REJECTED")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{ background: "rgba(45,190,108,0.12)", color: "#2DBE6C", border: "1px solid rgba(45,190,108,0.3)" }}
                    >
                      <XCircle className="w-4 h-4" />Từ chối yêu cầu
                    </button>
                    <button onClick={() => setReviewingId(null)} className="px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5" style={{ color: "#8585A0" }}>
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
