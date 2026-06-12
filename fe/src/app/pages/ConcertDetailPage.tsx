import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Calendar, MapPin, Clock, ChevronLeft, Info, AlertTriangle, CheckCircle, HelpCircle, Music } from "lucide-react";
import { CONCERTS, formatCurrency, formatDate, formatTime, getAvailableQuantity, getSoldPercent } from "../data/mockData";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export function ConcertDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const concert = CONCERTS.find((c) => c.slug === slug);
  const [activeTab, setActiveTab] = useState<"info" | "lineup" | "map">("info");

  if (!concert) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20" style={{ background: "#08080E", color: "#F0EDEB" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem" }}>Không tìm thấy sự kiện</h1>
        <Link to="/" className="mt-4 text-sm" style={{ color: "#F5C842" }}>← Quay lại trang chủ</Link>
      </div>
    );
  }

  const hasAvailableTickets = concert.ticketTypes.some((tt) => getAvailableQuantity(tt) > 0);

  const handleBuyTickets = () => {
    const expiresAt = Date.now() + 10 * 60 * 1000;
    sessionStorage.setItem("pendingOrder", JSON.stringify({ concertId: concert.id, expiresAt }));
    navigate(`/concerts/${concert.slug}/seats`);
  };

  const startTime = new Date(concert.startsAt);
  const endTime = new Date(concert.endsAt);
  const doorOpenTime = new Date(startTime.getTime() - 60 * 60 * 1000);

  return (
    <div style={{ background: "#08080E", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Hero */}
      <div className="relative" style={{ height: "55vh", minHeight: "380px" }}>
        <ImageWithFallback src={concert.coverImageUrl} alt={concert.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(8,8,14,0.3) 0%, rgba(8,8,14,0.7) 60%, rgba(8,8,14,1) 100%)" }} />
        <div className="absolute top-4 left-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/10"
            style={{ background: "rgba(8,8,14,0.7)", color: "#F0EDEB", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <ChevronLeft className="w-4 h-4" />
            Quay lại
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.25)" }}>
              {concert.genre}
            </span>
            {concert.tags.slice(1).map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.08)", color: "#8585A0" }}>
                {tag}
              </span>
            ))}
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.8rem,5vw,3rem)", fontWeight: 700, color: "#F0EDEB", lineHeight: 1.15 }}>
            {concert.title}
          </h1>
          <p className="mt-1 text-lg" style={{ color: "#F5C842" }}>{concert.artistName}</p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT — Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick info blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoBlock icon={<Calendar className="w-5 h-5" style={{ color: "#F5C842" }} />} label="Ngày diễn" value={formatDate(concert.startsAt)} />
            <InfoBlock icon={<Clock className="w-5 h-5" style={{ color: "#F5C842" }} />} label="Giờ diễn" value={`${formatTime(concert.startsAt)} – ${formatTime(concert.endsAt)}`} />
            <InfoBlock icon={<MapPin className="w-5 h-5" style={{ color: "#F5C842" }} />} label="Địa điểm" value={`${concert.venue.name}, ${concert.venue.city}`} />
          </div>

          {/* Tabs */}
          <div>
            <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {(["info", "lineup", "map"] as const).map((tab) => (
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
                  {tab === "info" ? "Thông tin" : tab === "lineup" ? "Nghệ sĩ" : "Sơ đồ ghế"}
                </button>
              ))}
            </div>

            {activeTab === "info" && (
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: "#F0EDEB" }}>Giới thiệu sự kiện</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#B0B0C0" }}>{concert.description}</p>
                </div>

                {/* Event details */}
                <div className="rounded-xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#F0EDEB" }}>
                      <Info className="w-4 h-4" style={{ color: "#F5C842" }} />
                      Thông tin chi tiết
                    </h3>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-4">
                    <DetailRow label="Ban tổ chức" value="TicketBox Events" />
                    <DetailRow label="Thể loại" value={concert.genre} />
                    <DetailRow label="Ngày mở cửa" value={formatDate(concert.startsAt)} />
                    <DetailRow label="Mở cửa đón khách" value={`${doorOpenTime.getHours().toString().padStart(2,"0")}:${doorOpenTime.getMinutes().toString().padStart(2,"0")}`} />
                    <DetailRow label="Bắt đầu chương trình" value={formatTime(concert.startsAt)} />
                    <DetailRow label="Dự kiến kết thúc" value={formatTime(concert.endsAt)} />
                    <DetailRow label="Địa điểm" value={concert.venue.name} />
                    <DetailRow label="Thành phố" value={concert.venue.city} />
                    <DetailRow label="Địa chỉ" value={concert.venue.address} />
                    <DetailRow label="Sức chứa" value={`${concert.venue.capacity.toLocaleString("vi-VN")} khán giả`} />
                  </div>
                </div>

                {/* Regulations */}
                <div className="rounded-xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#F0EDEB" }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: "#F5C842" }} />
                      Quy định sự kiện
                    </h3>
                  </div>
                  <div className="p-5 space-y-3">
                    {[
                      "Khán giả dưới 16 tuổi cần có người giám hộ đi kèm.",
                      "Không mang theo máy ảnh chuyên nghiệp, máy quay phim vào sự kiện.",
                      "Không mang theo đồ ăn, thức uống từ bên ngoài vào khu vực sự kiện.",
                      "Không hút thuốc, sử dụng ma túy hoặc chất kích thích trong khuôn viên.",
                      "Không gây mất trật tự, ảnh hưởng đến trải nghiệm của khán giả xung quanh.",
                      "Ban tổ chức có quyền từ chối hoặc mời ra ngoài những trường hợp vi phạm quy định.",
                    ].map((rule, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#F5C842" }} />
                        <p className="text-sm leading-relaxed" style={{ color: "#B0B0C0" }}>{rule}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guidelines */}
                <div className="rounded-xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#F0EDEB" }}>
                      <CheckCircle className="w-4 h-4" style={{ color: "#2DBE6C" }} />
                      Hướng dẫn tham dự
                    </h3>
                  </div>
                  <div className="p-5 space-y-4">
                    {[
                      { step: "01", title: "Đến sớm trước 60 phút", desc: "Cửa mở lúc " + `${doorOpenTime.getHours().toString().padStart(2,"0")}:${doorOpenTime.getMinutes().toString().padStart(2,"0")}` + ". Nên đến sớm để tránh tắc nghẽn tại cổng check-in." },
                      { step: "02", title: "Chuẩn bị mã QR", desc: "Mã QR vé điện tử sẽ được gửi qua email và hiển thị trong mục 'Vé của tôi'. Không cần in vé." },
                      { step: "03", title: "Check-in tại cổng", desc: "Xuất trình mã QR để nhân viên quét. Vui lòng chuẩn bị sẵn vé trên điện thoại khi đến cổng." },
                      { step: "04", title: "Tìm đúng khu vực ghế", desc: "Dựa theo khu vực (zone) ghi trên vé, đi theo biển chỉ dẫn của ban tổ chức để vào đúng vị trí." },
                    ].map((g) => (
                      <div key={g.step} className="flex gap-4">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                          style={{ background: "rgba(45,190,108,0.12)", color: "#2DBE6C" }}
                        >
                          {g.step}
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-0.5" style={{ color: "#F0EDEB" }}>{g.title}</p>
                          <p className="text-xs leading-relaxed" style={{ color: "#8585A0" }}>{g.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FAQ */}
                <div className="rounded-xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#F0EDEB" }}>
                      <HelpCircle className="w-4 h-4" style={{ color: "#7B61FF" }} />
                      Câu hỏi thường gặp
                    </h3>
                  </div>
                  <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    {[
                      { q: "Vé có hoàn trả được không?", a: "Vé đã mua không được hoàn trả, trừ trường hợp sự kiện bị hủy bởi ban tổ chức. Trong trường hợp hủy sự kiện, 100% giá vé sẽ được hoàn lại." },
                      { q: "Có thể mua vé tại cửa không?", a: "Tùy theo từng sự kiện. Thông thường vé chỉ bán online qua TicketBox. Vui lòng theo dõi thông báo từ ban tổ chức." },
                      { q: "Một tài khoản mua được bao nhiêu vé?", a: "Số lượng vé tối đa mỗi tài khoản được quy định theo từng loại vé và hiển thị trực tiếp trong trang mua vé." },
                      { q: "Vé điện tử có an toàn không?", a: "Mỗi mã QR là duy nhất, được mã hóa và chỉ dùng được một lần khi quét tại cổng. Ban tổ chức sẽ xác thực tính hợp lệ ngay tại sự kiện." },
                    ].map((faq, i) => (
                      <FAQItem key={i} question={faq.q} answer={faq.a} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "lineup" && (
              <div className="space-y-4">
                <div className="p-5 rounded-xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "rgba(245,200,66,0.1)" }}>
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-6 h-6" style={{ color: "#F5C842" }} />
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: "#F0EDEB" }}>{concert.artistName}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>Nghệ sĩ chính</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#B0B0C0" }}>{concert.artistBio || "Thông tin đang được cập nhật..."}</p>
                </div>
              </div>
            )}

            {activeTab === "map" && (
              <div className="space-y-4">
                {concert.seatZones.length > 0 ? (
                  <>
                    <div className="rounded-xl p-6" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <SeatMapVisualization zones={concert.seatZones} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {concert.seatZones.map((z) => (
                        <div key={z.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="w-3 h-10 rounded flex-shrink-0" style={{ background: z.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: "#F0EDEB" }}>{z.name}</p>
                            <p className="text-xs" style={{ color: "#8585A0" }}>{z.description}</p>
                          </div>
                          <span className="text-xs" style={{ color: "#8585A0" }}>{z.capacity.toLocaleString("vi-VN")} chỗ</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "#8585A0" }}>Sơ đồ chỗ ngồi chưa có sẵn</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Price list + buy button */}
        <div className="lg:col-span-1">
          <div
            className="sticky top-20 rounded-2xl overflow-hidden"
            style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Giá vé</h2>
              <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>Chọn chỗ ngồi để xác định loại vé</p>
            </div>

            <div className="p-4 space-y-2">
              {concert.ticketTypes.length === 0 && (
                <div className="text-center py-8">
                  <Info className="w-8 h-8 mx-auto mb-2" style={{ color: "#8585A0" }} />
                  <p className="text-sm" style={{ color: "#8585A0" }}>Vé chưa mở bán</p>
                </div>
              )}
              {concert.ticketTypes.map((tt) => {
                const available = getAvailableQuantity(tt);
                const pct = getSoldPercent(tt);
                const isSoldOut = available === 0;
                return (
                  <div
                    key={tt.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      opacity: isSoldOut ? 0.5 : 1,
                    }}
                  >
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: tt.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold" style={{ color: isSoldOut ? "#8585A0" : "#F0EDEB" }}>{tt.name}</p>
                        <p className="text-sm font-bold flex-shrink-0" style={{ color: isSoldOut ? "#8585A0" : tt.color }}>{formatCurrency(tt.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 85 ? "#E8315B" : pct > 60 ? "#F5C842" : "#2DBE6C" }} />
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: isSoldOut ? "#E8315B" : pct > 80 ? "#F5C842" : "#8585A0" }}>
                          {isSoldOut ? "Hết vé" : `Còn ${available.toLocaleString("vi-VN")}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 pb-4">
              <button
                onClick={handleBuyTickets}
                disabled={!hasAvailableTickets}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff", boxShadow: "0 8px 24px rgba(232,49,91,0.3)" }}
              >
                Mua vé →
              </button>
            </div>

            <div className="px-5 py-3" style={{ background: "rgba(245,200,66,0.04)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs leading-relaxed" style={{ color: "#8585A0" }}>
                <span style={{ color: "#F5C842" }}>Lưu ý:</span> Vé đã mua không hoàn trả trừ trường hợp sự kiện bị hủy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs mb-0.5" style={{ color: "#8585A0" }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: "#F0EDEB" }}>{value}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: "#8585A0" }}>{label}</p>
      <p className="text-sm" style={{ color: "#F0EDEB" }}>{value}</p>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-5 py-3 cursor-pointer" onClick={() => setOpen((v) => !v)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium" style={{ color: "#F0EDEB" }}>{question}</p>
        <span className="text-lg flex-shrink-0 transition-transform" style={{ color: "#8585A0", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </div>
      {open && (
        <p className="text-xs leading-relaxed mt-2" style={{ color: "#8585A0" }}>{answer}</p>
      )}
    </div>
  );
}


function SeatMapVisualization({ zones }: { zones: { id: string; code: string; name: string; color: string; capacity: number }[] }) {
  return (
    <div className="w-full">
      <div className="flex justify-center mb-5">
        <div
          className="px-10 py-2 rounded-lg text-xs font-semibold text-center"
          style={{ background: "rgba(255,255,255,0.08)", color: "#F0EDEB", border: "1px solid rgba(255,255,255,0.12)", minWidth: "140px" }}
        >
          🎤 SÂN KHẤU
        </div>
      </div>
      <div className="space-y-2">
        {zones.map((z, i) => {
          const widths = ["90%", "95%", "100%", "100%", "100%"];
          return (
            <div key={z.id} className="flex justify-center">
              <div
                className="rounded-lg px-4 py-2.5 text-xs font-medium text-center"
                style={{ background: `${z.color}1A`, border: `1px solid ${z.color}44`, color: z.color, width: widths[i] || "100%" }}
              >
                {z.name} — {z.capacity.toLocaleString("vi-VN")} chỗ
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs mt-4" style={{ color: "#8585A0" }}>
        Sơ đồ mô phỏng · Chọn ghế cụ thể ở bước tiếp theo
      </p>
    </div>
  );
}
