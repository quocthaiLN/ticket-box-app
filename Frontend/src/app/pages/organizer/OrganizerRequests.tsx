import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, XCircle, Clock, Plus, ChevronDown, ChevronUp, FileText, AlertCircle } from "lucide-react";
import { ORGANIZER_REQUESTS, VENUES, OrganizerRequest, ApprovalStatus, formatCurrency } from "../../data/mockData";

const STATUS_CONFIG: Record<ApprovalStatus, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
  PENDING:  { bg: "rgba(245,200,66,0.1)",  color: "#F5C842", label: "Chờ duyệt",  icon: <Clock className="w-3.5 h-3.5" /> },
  APPROVED: { bg: "rgba(45,190,108,0.1)",  color: "#2DBE6C", label: "Đã duyệt",   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  REJECTED: { bg: "rgba(232,49,91,0.1)",   color: "#E8315B", label: "Từ chối",    icon: <XCircle className="w-3.5 h-3.5" /> },
};

export function OrganizerRequests() {
  const [filter, setFilter] = useState<"all" | ApprovalStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const requests = ORGANIZER_REQUESTS;
  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>Hồ sơ của tôi</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>Danh sách hồ sơ xin tổ chức concert bạn đã nộp</p>
        </div>
        <button
          onClick={() => setExpandedId("NEW_FORM")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #7B61FF, #5B41CF)", color: "#fff", boxShadow: "0 6px 20px rgba(123,97,255,0.3)" }}
        >
          <Plus className="w-4 h-4" />
          Nộp hồ sơ mới
        </button>
      </div>

      {/* New request form */}
      {expandedId === "NEW_FORM" && (
        <NewRequestForm onClose={() => setExpandedId(null)} />
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["all", "PENDING", "APPROVED", "REJECTED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={filter === f
              ? { background: "#7B61FF", color: "#fff", fontWeight: 600 }
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
            <FileText className="w-10 h-10 mx-auto mb-2" style={{ color: "#8585A0" }} />
            <p style={{ color: "#8585A0" }}>Chưa có hồ sơ nào</p>
          </div>
        )}
        {filtered.map((req) => (
          <RequestItem
            key={req.id}
            req={req}
            expanded={expandedId === req.id}
            onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RequestItem({ req, expanded, onToggle }: { req: OrganizerRequest; expanded: boolean; onToggle: () => void }) {
  const sc = STATUS_CONFIG[req.status];
  const venue = VENUES.find((v) => v.id === req.venueId);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
      <button className="w-full text-left px-5 py-4 flex items-center gap-4" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
              {sc.icon}{sc.label}
            </span>
          </div>
          <p className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>{req.title}</p>
          <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>
            {req.artistName} · {venue?.name} · {new Date(req.startsAt).toLocaleDateString("vi-VN")}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs mb-1" style={{ color: "#8585A0" }}>Nộp {new Date(req.createdAt).toLocaleDateString("vi-VN")}</p>
          {expanded ? <ChevronUp className="w-4 h-4 ml-auto" style={{ color: "#8585A0" }} /> : <ChevronDown className="w-4 h-4 ml-auto" style={{ color: "#8585A0" }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs mb-1" style={{ color: "#8585A0" }}>Mô tả</p>
              <p className="text-sm leading-relaxed" style={{ color: "#B0B0C0" }}>{req.description}</p>
            </div>
            <div className="space-y-2">
              {[
                ["Địa điểm", venue?.name ?? req.venueId],
                ["Số cổng", `${req.gateCount} cổng check-in`],
                ["Số checker", `${req.checkerCount} nhân sự`],
                ["Dự kiến publish", new Date(req.plannedPublishAt).toLocaleDateString("vi-VN")],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span style={{ color: "#8585A0" }}>{k}</span>
                  <span style={{ color: "#F0EDEB" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket types */}
          <div className="mb-4">
            <p className="text-xs font-semibold mb-2" style={{ color: "#F0EDEB" }}>Loại vé đề xuất</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {req.ticketTypes.map((tt) => (
                <div key={tt.zoneCode} className="px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs font-semibold" style={{ color: "#F0EDEB" }}>{tt.zoneName}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: "#7B61FF" }}>{formatCurrency(tt.price)}</p>
                  <p className="text-xs" style={{ color: "#8585A0" }}>{tt.totalQuantity.toLocaleString("vi-VN")} vé · max {tt.maxPerUser}/người</p>
                </div>
              ))}
            </div>
          </div>

          {/* Review feedback */}
          {req.reviewNote && (
            <div className="p-3 rounded-xl flex gap-3" style={{
              background: req.status === "REJECTED" ? "rgba(232,49,91,0.08)" : "rgba(45,190,108,0.08)",
              border: `1px solid ${req.status === "REJECTED" ? "rgba(232,49,91,0.2)" : "rgba(45,190,108,0.2)"}`,
            }}>
              {req.status === "REJECTED"
                ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#E8315B" }} />
                : <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#2DBE6C" }} />
              }
              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: req.status === "REJECTED" ? "#E8315B" : "#2DBE6C" }}>
                  Phản hồi từ Admin
                </p>
                <p className="text-xs" style={{ color: "#B0B0C0" }}>{req.reviewNote}</p>
              </div>
            </div>
          )}

          {req.status === "APPROVED" && req.concertId && (
            <div className="mt-3 p-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(45,190,108,0.08)", border: "1px solid rgba(45,190,108,0.2)" }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: "#2DBE6C" }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: "#2DBE6C" }}>Hồ sơ đã được duyệt — Concert đã tạo</p>
                <p className="text-xs" style={{ color: "#8585A0" }}>Bạn có thể chỉnh sửa trong mục "Sự kiện của tôi"</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewRequestForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", artistName: "", venueId: "", description: "",
    startsAt: "", endsAt: "", gateCount: "2", checkerCount: "3",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 1200);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl p-8 text-center mb-6" style={{ background: "#111118", border: "1px solid rgba(45,190,108,0.25)" }}>
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: "#2DBE6C" }} />
        <p className="text-lg font-semibold mb-1" style={{ color: "#F0EDEB", fontFamily: "'Cormorant Garamond', serif" }}>Hồ sơ đã được nộp!</p>
        <p className="text-sm mb-4" style={{ color: "#8585A0" }}>Admin sẽ xem xét hồ sơ và phản hồi trong vòng 1–3 ngày làm việc.</p>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#F0EDEB" }}>Đóng</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl overflow-hidden mb-6" style={{ background: "#111118", border: "1px solid rgba(123,97,255,0.3)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Nộp hồ sơ tổ chức concert mới</h3>
        <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>Admin sẽ duyệt và tạo concert DRAFT cho bạn sau khi approve</p>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Tên concert *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="VD: Night Lights 2027" />
        <FormField label="Nghệ sĩ / Lineup *" value={form.artistName} onChange={(v) => setForm({ ...form, artistName: v })} placeholder="VD: Grey D" />
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "#8585A0" }}>Địa điểm *</label>
          <select
            value={form.venueId}
            onChange={(e) => setForm({ ...form, venueId: e.target.value })}
            required
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "#0D0D15", border: "1px solid rgba(255,255,255,0.08)", color: form.venueId ? "#F0EDEB" : "#8585A0" }}
          >
            <option value="">Chọn địa điểm...</option>
            {VENUES.map((v) => <option key={v.id} value={v.id}>{v.name}, {v.city}</option>)}
          </select>
        </div>
        <FormField label="Ngày bắt đầu *" value={form.startsAt} onChange={(v) => setForm({ ...form, startsAt: v })} type="datetime-local" />
        <FormField label="Ngày kết thúc *" value={form.endsAt} onChange={(v) => setForm({ ...form, endsAt: v })} type="datetime-local" />
        <FormField label="Số cổng check-in" value={form.gateCount} onChange={(v) => setForm({ ...form, gateCount: v })} type="number" placeholder="2" />
        <FormField label="Số nhân sự checker" value={form.checkerCount} onChange={(v) => setForm({ ...form, checkerCount: v })} type="number" placeholder="3" />
        <div className="sm:col-span-2">
          <label className="text-xs block mb-1.5" style={{ color: "#8585A0" }}>Mô tả concert</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Mô tả ngắn về chương trình..."
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: "#0D0D15", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}
          />
        </div>
        <div className="sm:col-span-2 p-3 rounded-xl flex gap-2" style={{ background: "rgba(123,97,255,0.07)", border: "1px solid rgba(123,97,255,0.2)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#7B61FF" }} />
          <p className="text-xs" style={{ color: "#8585A0" }}>Thông tin loại vé và zone sẽ được khai báo chi tiết sau khi hồ sơ được admin xem xét lần đầu.</p>
        </div>
      </div>
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #7B61FF, #5B41CF)", color: "#fff" }}
        >
          {submitting ? "Đang nộp..." : "Nộp hồ sơ →"}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm transition-colors hover:bg-white/5" style={{ color: "#8585A0" }}>
          Hủy
        </button>
      </div>
    </form>
  );
}

function FormField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs block mb-1.5" style={{ color: "#8585A0" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
        style={{ background: "#0D0D15", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}
      />
    </div>
  );
}
