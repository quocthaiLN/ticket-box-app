import { useState } from "react";
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Building2, Users, Calendar } from "lucide-react";
import { ORGANIZER_REQUESTS, VENUES, OrganizerRequest, ApprovalStatus, formatCurrency } from "../../data/mockData";

const STATUS_CONFIG: Record<ApprovalStatus, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
  PENDING:  { bg: "rgba(245,200,66,0.1)",  color: "#F5C842", label: "Chờ duyệt",  icon: <Clock className="w-3.5 h-3.5" /> },
  APPROVED: { bg: "rgba(45,190,108,0.1)",  color: "#2DBE6C", label: "Đã duyệt",   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  REJECTED: { bg: "rgba(232,49,91,0.1)",   color: "#E8315B", label: "Từ chối",    icon: <XCircle className="w-3.5 h-3.5" /> },
};

export function AdminOrganizerRequests() {
  const [filter, setFilter] = useState<"all" | ApprovalStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [requests, setRequests] = useState(ORGANIZER_REQUESTS);

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
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>Hồ sơ Ban Tổ Chức</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>Duyệt hồ sơ xin tổ chức concert</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.25)" }}>
            <Clock className="w-4 h-4" style={{ color: "#F5C842" }} />
            <span className="text-sm font-semibold" style={{ color: "#F5C842" }}>{pendingCount} chờ duyệt</span>
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
            {f === "PENDING" && pendingCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background: "rgba(232,49,91,0.2)", color: "#E8315B" }}>{pendingCount}</span>}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 rounded-2xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "#8585A0" }}>Không có hồ sơ nào</p>
          </div>
        )}
        {filtered.map((req) => (
          <RequestCard
            key={req.id}
            req={req}
            expanded={expandedId === req.id}
            onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
            reviewing={reviewingId === req.id}
            onStartReview={() => { setReviewingId(req.id); setReviewNote(""); }}
            onCancelReview={() => setReviewingId(null)}
            reviewNote={reviewNote}
            onNoteChange={setReviewNote}
            onApprove={() => handleAction(req.id, "APPROVED")}
            onReject={() => handleAction(req.id, "REJECTED")}
          />
        ))}
      </div>
    </div>
  );
}

function RequestCard({
  req, expanded, onToggle, reviewing, onStartReview, onCancelReview,
  reviewNote, onNoteChange, onApprove, onReject,
}: {
  req: OrganizerRequest; expanded: boolean; onToggle: () => void;
  reviewing: boolean; onStartReview: () => void; onCancelReview: () => void;
  reviewNote: string; onNoteChange: (v: string) => void;
  onApprove: () => void; onReject: () => void;
}) {
  const sc = STATUS_CONFIG[req.status];
  const venue = VENUES.find((v) => v.id === req.venueId);
  const startDate = new Date(req.startsAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Header row */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
              {sc.icon}{sc.label}
            </span>
            <span className="text-xs" style={{ color: "#8585A0" }}>#{req.id}</span>
          </div>
          <p className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>{req.title}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs flex items-center gap-1" style={{ color: "#8585A0" }}>
              <Users className="w-3 h-3" />{req.organizerName}
            </span>
            <span className="text-xs flex items-center gap-1" style={{ color: "#8585A0" }}>
              <Building2 className="w-3 h-3" />{venue?.name ?? req.venueId}
            </span>
            <span className="text-xs flex items-center gap-1" style={{ color: "#8585A0" }}>
              <Calendar className="w-3 h-3" />{startDate}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {req.status === "PENDING" && !reviewing && (
            <button
              onClick={onStartReview}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #F5C842, #E0A800)", color: "#0A0A0F" }}
            >
              Xem xét
            </button>
          )}
          <button onClick={onToggle} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#8585A0" }}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs mb-1" style={{ color: "#8585A0" }}>Mô tả</p>
              <p className="text-sm leading-relaxed" style={{ color: "#B0B0C0" }}>{req.description}</p>
            </div>
            <div className="space-y-2">
              <DetailItem label="Nghệ sĩ" value={req.artistName} />
              <DetailItem label="Số cổng check-in" value={`${req.gateCount} cổng`} />
              <DetailItem label="Số checker" value={`${req.checkerCount} người`} />
              <DetailItem label="Dự kiến publish" value={new Date(req.plannedPublishAt).toLocaleDateString("vi-VN")} />
              {req.pressKitUrl && <DetailItem label="Press Kit" value={req.pressKitUrl} />}
            </div>
          </div>

          {/* Ticket types */}
          <div className="mb-4">
            <p className="text-xs font-semibold mb-2" style={{ color: "#F0EDEB" }}>Loại vé đề xuất</p>
            <div className="space-y-2">
              {req.ticketTypes.map((tt) => (
                <div key={tt.zoneCode} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <span className="text-xs font-medium" style={{ color: "#F0EDEB" }}>{tt.zoneName} — {tt.name}</span>
                    <span className="text-xs ml-2" style={{ color: "#8585A0" }}>Capacity: {tt.zoneCapacity.toLocaleString("vi-VN")}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold" style={{ color: "#F5C842" }}>{formatCurrency(tt.price)}</p>
                    <p className="text-xs" style={{ color: "#8585A0" }}>{tt.totalQuantity.toLocaleString("vi-VN")} vé · max {tt.maxPerUser}/người</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Review note if reviewed */}
          {req.reviewNote && (
            <div className="p-3 rounded-lg mb-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#8585A0" }}>Ghi chú review</p>
              <p className="text-xs" style={{ color: "#B0B0C0" }}>{req.reviewNote}</p>
              {req.reviewedAt && <p className="text-xs mt-1" style={{ color: "#8585A0" }}>{new Date(req.reviewedAt).toLocaleString("vi-VN")}</p>}
            </div>
          )}
        </div>
      )}

      {/* Review panel */}
      {reviewing && (
        <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(245,200,66,0.2)", background: "rgba(245,200,66,0.03)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#F5C842" }}>Ghi chú review (tùy chọn)</p>
          <textarea
            value={reviewNote}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Nhập ghi chú cho BTC..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none mb-3"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F0EDEB" }}
          />
          <div className="flex gap-3">
            <button
              onClick={onApprove}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
              style={{ background: "rgba(45,190,108,0.15)", color: "#2DBE6C", border: "1px solid rgba(45,190,108,0.3)" }}
            >
              <CheckCircle2 className="w-4 h-4" />Duyệt hồ sơ
            </button>
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
              style={{ background: "rgba(232,49,91,0.12)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.3)" }}
            >
              <XCircle className="w-4 h-4" />Từ chối
            </button>
            <button onClick={onCancelReview} className="px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5" style={{ color: "#8585A0" }}>
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs" style={{ color: "#8585A0" }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: "#F0EDEB" }}>{value}</span>
    </div>
  );
}
