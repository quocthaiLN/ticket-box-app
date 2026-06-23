import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Plus, Search, Edit2, Trash2, Eye, ChevronLeft, Save,
  Calendar, MapPin, Tag, Users, Upload, Cpu, CheckCircle
} from "lucide-react";
import { CONCERTS, VENUES, formatCurrency } from "../../data/mockData";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";

export function AdminConcertList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = CONCERTS.filter((c) => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.artistName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>Quản lý Sự kiện</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>{CONCERTS.length} sự kiện tổng cộng</p>
        </div>
        <Link
          to="/admin/organizer-requests"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.07)", color: "#F0EDEB", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Concert được tạo qua duyệt hồ sơ →
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div
          className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl"
          style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}
        >
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
          <option value="all">Tất cả trạng thái</option>
          <option value="PUBLISHED">Đã đăng</option>
          <option value="DRAFT">Nháp</option>
          <option value="CANCELLED">Đã hủy</option>
          <option value="COMPLETED">Đã kết thúc</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Sự kiện", "Nghệ sĩ", "Ngày", "Địa điểm", "Vé bán", "Doanh thu", "Trạng thái", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#8585A0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((concert) => {
              const totalSold = concert.ticketTypes.reduce((s, t) => s + t.soldQuantity, 0);
              const totalQ = concert.ticketTypes.reduce((s, t) => s + t.totalQuantity, 0);
              const revenue = concert.ticketTypes.reduce((s, t) => s + t.soldQuantity * t.price, 0);

              return (
                <tr
                  key={concert.id}
                  className="transition-colors hover:bg-white/[0.03]"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ImageWithFallback src={concert.coverImageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      <span className="text-sm font-medium truncate max-w-[160px]" style={{ color: "#F0EDEB" }}>{concert.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "#8585A0" }}>{concert.artistName}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#8585A0" }}>
                    {new Date(concert.startsAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#8585A0" }}>
                    <span className="truncate block max-w-[120px]">{concert.venue.city}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: totalQ > 0 ? `${Math.round((totalSold / totalQ) * 100)}%` : "0%", background: "#F5C842" }}
                        />
                      </div>
                      <span className="text-xs" style={{ color: "#8585A0" }}>
                        {totalQ > 0 ? `${Math.round((totalSold / totalQ) * 100)}%` : "–"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: "#F5C842" }}>
                    {formatCurrency(revenue)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={concert.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/concerts/${concert.slug}`}
                        target="_blank"
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                        style={{ color: "#8585A0" }}
                        title="Xem trang sự kiện"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        to={`/organizer/concerts/${concert.id}`}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                        style={{ color: "#7B61FF" }}
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                        style={{ color: "#8585A0" }}
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminConcertForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const concert = isNew ? null : CONCERTS.find((c) => c.id === id);
  const [saved, setSaved] = useState(false);
  const [aiBioLoading, setAiBioLoading] = useState(false);
  const [aiBio, setAiBio] = useState(concert?.artistBio || "");
  const [activeSection, setActiveSection] = useState("basic");

  const [form, setForm] = useState({
    title: concert?.title || "",
    artistName: concert?.artistName || "",
    genre: concert?.genre || "",
    description: concert?.description || "",
    startsAt: concert?.startsAt?.substring(0, 16) || "",
    endsAt: concert?.endsAt?.substring(0, 16) || "",
    venueId: concert?.venueId || "",
    status: concert?.status || "DRAFT",
    coverImageUrl: concert?.coverImageUrl || "",
  });

  const sections = [
    { id: "basic", label: "Thông tin cơ bản" },
    { id: "tickets", label: "Loại vé" },
    { id: "ai-bio", label: "AI Artist Bio" },
    { id: "publish", label: "Xuất bản" },
  ];

  const handleAIGenerate = () => {
    setAiBioLoading(true);
    setTimeout(() => {
      setAiBio(`${form.artistName} là một trong những nghệ sĩ tiên phong trong làng nhạc Việt Nam đương đại. Với phong cách âm nhạc độc đáo pha trộn giữa ${form.genre} và những giai điệu đậm chất dân tộc, họ đã ghi dấu ấn sâu sắc trong lòng hàng triệu khán giả. Mỗi buổi biểu diễn là một hành trình cảm xúc đặc biệt, nơi âm nhạc kết nối những trái tim và tạo nên những kỷ niệm không thể quên. Sự kết hợp hoàn hảo giữa kỹ thuật điêu luyện và chiều sâu nghệ thuật đã làm nên tên tuổi vang danh trong và ngoài nước.`);
      setAiBioLoading(false);
    }, 2000);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); navigate("/organizer/concerts"); }, 1500);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/organizer/concerts")} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#F0EDEB" }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>
            {isNew ? "Tạo sự kiện mới" : `Chỉnh sửa: ${concert?.title}`}
          </h1>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="px-4 py-2.5 text-sm whitespace-nowrap transition-colors"
            style={{
              color: activeSection === s.id ? "#F5C842" : "#8585A0",
              borderBottom: activeSection === s.id ? "2px solid #F5C842" : "2px solid transparent",
              marginBottom: "-1px",
              fontWeight: activeSection === s.id ? 600 : 400,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="max-w-3xl space-y-6">
        {activeSection === "basic" && (
          <FormCard title="Thông tin cơ bản">
            <div className="space-y-4">
              <FormRow label="Tên sự kiện *">
                <input className="form-input" placeholder="VD: Ánh Sáng Màn Đêm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </FormRow>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Nghệ sĩ *">
                  <input className="form-input" placeholder="Tên nghệ sĩ" value={form.artistName} onChange={(e) => setForm({ ...form, artistName: e.target.value })} />
                </FormRow>
                <FormRow label="Thể loại">
                  <input className="form-input" placeholder="VD: Indie/R&B" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
                </FormRow>
              </div>
              <FormRow label="Mô tả">
                <textarea
                  className="form-input min-h-[80px] resize-y"
                  placeholder="Mô tả ngắn về sự kiện..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormRow>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Thời gian bắt đầu *">
                  <input type="datetime-local" className="form-input" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                </FormRow>
                <FormRow label="Thời gian kết thúc *">
                  <input type="datetime-local" className="form-input" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                </FormRow>
              </div>
              <FormRow label="Địa điểm">
                <select className="form-input" value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })}>
                  <option value="">Chọn địa điểm</option>
                  {VENUES.map((v) => <option key={v.id} value={v.id}>{v.name} – {v.city}</option>)}
                </select>
              </FormRow>
              <FormRow label="Ảnh bìa (URL)">
                <input className="form-input" placeholder="https://..." value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} />
                {form.coverImageUrl && (
                  <div className="mt-2 w-32 h-20 rounded-lg overflow-hidden">
                    <img src={form.coverImageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </FormRow>
            </div>
          </FormCard>
        )}

        {activeSection === "tickets" && (
          <FormCard title="Cấu hình loại vé">
            {(concert?.ticketTypes || []).length === 0 ? (
              <div className="text-center py-8">
                <Tag className="w-8 h-8 mx-auto mb-2" style={{ color: "#8585A0" }} />
                <p className="text-sm mb-4" style={{ color: "#8585A0" }}>Chưa có loại vé nào</p>
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm mx-auto"
                  style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.2)" }}
                >
                  <Plus className="w-4 h-4" />
                  Thêm loại vé
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {(concert?.ticketTypes || []).map((tt) => (
                  <div key={tt.id} className="p-3.5 rounded-xl" style={{ background: "#0D0D15", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ background: tt.color }} />
                        <span className="text-sm font-medium" style={{ color: "#F0EDEB" }}>{tt.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-1 rounded transition-colors hover:bg-white/10" style={{ color: "#8585A0" }}><Edit2 className="w-3.5 h-3.5" /></button>
                        <button className="p-1 rounded transition-colors hover:bg-red-500/10" style={{ color: "#8585A0" }}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <Stat label="Giá" value={formatCurrency(tt.price)} />
                      <Stat label="Tổng" value={tt.totalQuantity.toLocaleString("vi-VN")} />
                      <Stat label="Đã bán" value={tt.soldQuantity.toLocaleString("vi-VN")} />
                      <Stat label="Còn lại" value={(tt.totalQuantity - tt.soldQuantity - tt.heldQuantity).toLocaleString("vi-VN")} />
                    </div>
                  </div>
                ))}
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm"
                  style={{ background: "rgba(245,200,66,0.08)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.15)" }}
                >
                  <Plus className="w-4 h-4" />
                  Thêm loại vé
                </button>
              </div>
            )}
          </FormCard>
        )}

        {activeSection === "ai-bio" && (
          <FormCard title="AI Artist Bio">
            <div className="mb-4">
              <p className="text-xs mb-3" style={{ color: "#8585A0" }}>
                Upload file PDF/Press kit để hệ thống tự động trích xuất và tạo bio nghệ sĩ bằng AI.
              </p>
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-amber-400/40"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
              >
                <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: "#8585A0" }} />
                <p className="text-sm mb-1" style={{ color: "#F0EDEB" }}>Kéo thả hoặc click để upload</p>
                <p className="text-xs" style={{ color: "#8585A0" }}>PDF, Word, TXT – tối đa 10MB</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-xs" style={{ color: "#8585A0" }}>hoặc</span>
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>

            <button
              onClick={handleAIGenerate}
              disabled={aiBioLoading || !form.artistName}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium mb-4 transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "rgba(123,97,255,0.15)", color: "#7B61FF", border: "1px solid rgba(123,97,255,0.3)" }}
            >
              <Cpu className="w-4 h-4" />
              {aiBioLoading ? "Đang sinh bio bằng AI..." : "Sinh Artist Bio bằng AI"}
            </button>

            {aiBioLoading && (
              <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "#7B61FF" }}>
                <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: "#7B61FF transparent transparent transparent" }} />
                Đang gọi AI model...
              </div>
            )}

            <FormRow label="Bio nghệ sĩ (hiển thị công khai)">
              <textarea
                className="form-input min-h-[120px] resize-y"
                placeholder="Nhập hoặc để AI sinh tự động..."
                value={aiBio}
                onChange={(e) => setAiBio(e.target.value)}
              />
            </FormRow>

            {aiBio && !aiBioLoading && (
              <div className="flex items-center gap-2 text-xs mt-2" style={{ color: "#2DBE6C" }}>
                <CheckCircle className="w-3.5 h-3.5" />
                Bio đã sẵn sàng để xuất bản
              </div>
            )}
          </FormCard>
        )}

        {activeSection === "publish" && (
          <FormCard title="Xuất bản">
            <div className="space-y-4">
              <FormRow label="Trạng thái">
                <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                  <option value="DRAFT">Nháp</option>
                  <option value="PUBLISHED">Đã đăng (hiện trên trang khách)</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </FormRow>
              <div className="p-4 rounded-xl" style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.15)" }}>
                <p className="text-xs" style={{ color: "#8585A0" }}>
                  <strong style={{ color: "#F5C842" }}>Lưu ý:</strong> Khi chuyển sang "Đã đăng", sự kiện sẽ hiện ngay lập tức trên trang chủ và người dùng có thể mua vé.
                </p>
              </div>
            </div>
          </FormCard>
        )}

        {/* Save button */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff" }}
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Đã lưu!" : "Lưu thay đổi"}
          </button>
          <button
            onClick={() => navigate("/organizer/concerts")}
            className="px-5 py-2.5 rounded-xl text-sm transition-colors hover:bg-white/5"
            style={{ color: "#8585A0" }}
          >
            Hủy
          </button>
        </div>
      </div>

      <style>{`
        .form-input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #F0EDEB;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .form-input:focus {
          border-color: rgba(245,200,66,0.4);
        }
        .form-input option {
          background: #1A1A24;
        }
      `}</style>
    </div>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: "#8585A0" }}>{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ color: "#8585A0" }}>{label}</p>
      <p className="font-medium mt-0.5" style={{ color: "#F0EDEB" }}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PUBLISHED: { bg: "rgba(45,190,108,0.1)", color: "#2DBE6C", label: "Đã đăng" },
    DRAFT: { bg: "rgba(245,200,66,0.1)", color: "#F5C842", label: "Nháp" },
    CANCELLED: { bg: "rgba(232,49,91,0.1)", color: "#E8315B", label: "Đã hủy" },
    COMPLETED: { bg: "rgba(255,255,255,0.08)", color: "#8585A0", label: "Xong" },
  };
  const s = map[status] || map.DRAFT;
  return <span className="px-2 py-0.5 rounded text-xs" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}
