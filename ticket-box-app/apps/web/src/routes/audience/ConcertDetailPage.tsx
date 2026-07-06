import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  Clock,
  HelpCircle,
  Info,
  LogIn,
  MapPin,
  Music,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { getStoredAuthSession } from "../../lib/auth-session";
import {
  formatCurrency,
  formatDate,
  formatTime,
  getAvailableQuantity,
  getSoldPercent,
  type UiConcert,
} from "../../lib/catalog-ui";
import { getCatalogConcertDetail } from "../../services/catalog.service";
import { createPendingCheckout, writePendingCheckout } from "./checkout-storage";

type LoadStatus = "loading" | "ready" | "error";

export function ConcertDetailPage() {
  const { concertId } = useParams<{ concertId: string }>();
  const navigate = useNavigate();
  const [concert, setConcert] = useState<UiConcert | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    if (!concertId) return;
    let mounted = true;
    setStatus("loading");

    getCatalogConcertDetail(concertId)
      .then((concertData) => {
        if (!mounted) return;
        setConcert(concertData);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, [concertId]);

  if (status === "loading") {
    return <CenteredState text="Đang tải chi tiết concert..." />;
  }

  if (status === "error" || !concert) {
    return <CenteredState text="Không thể tải chi tiết concert." actionLabel="Về trang chủ" />;
  }

  function handleBuyTickets() {
    const currentConcert = concert;
    if (!currentConcert) return;

    const session = getStoredAuthSession();
    if (!session) {
      setShowLoginPrompt(true);
      return;
    }

    const pending = createPendingCheckout(currentConcert.id);
    writePendingCheckout({
      ...pending,
      concertTitle: currentConcert.title,
      artistName: currentConcert.artistName,
      coverImageUrl: currentConcert.coverImageUrl,
      venueName: currentConcert.venue.name,
      startsAt: currentConcert.startsAt,
    });
    // URL người dùng dùng slug; checkout nội bộ vẫn dùng concert.id đã resolve.
    navigate(`/concerts/${currentConcert.slug}/seats`);
  }

  return (
    <>
      <ConcertDetailView concert={concert} onBuyTickets={handleBuyTickets} />
      {showLoginPrompt && (
        <LoginPrompt concertSlug={concert.slug} onClose={() => setShowLoginPrompt(false)} />
      )}
    </>
  );
}

type ConcertDetailViewProps = {
  concert: UiConcert;
  onBuyTickets?: () => void;
  // Preview Admin/Organizer: khóa nút mua vé bất kể tồn kho.
  buyDisabledOverride?: boolean;
  buyLabel?: string;
};

export function ConcertDetailView({
  concert,
  onBuyTickets,
  buyDisabledOverride = false,
  buyLabel = "Mua vé",
}: ConcertDetailViewProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"info" | "lineup" | "map">("info");
  const hasAvailableTickets = concert.ticketTypes.some((ticketType) => {
    const available = ticketType.availableQuantity;
    return ticketType.status === "ON_SALE" && (available === null || available > 0);
  });
  const startTime = new Date(concert.startsAt);
  const doorOpenTime = new Date(startTime.getTime() - 60 * 60 * 1000);

  return (
    <div className="min-h-screen bg-[#08080E]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="relative min-h-[380px]" style={{ height: "55vh" }}>
        <ImageWithFallback src={concert.coverImageUrl} alt={concert.title} className="h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(8,8,14,0.3) 0%, rgba(8,8,14,0.7) 60%, rgba(8,8,14,1) 100%)",
          }}
        />
        <div className="absolute left-4 top-20">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#08080E]/70 px-3 py-2 text-sm text-[#F0EDEB] backdrop-blur transition-colors hover:bg-white/10"
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
            Quay lại
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-7xl px-4 pb-6 sm:px-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full border border-[#F5C842]/25 bg-[#F5C842]/15 px-2.5 py-1 text-xs font-medium text-[#F5C842]">
              {concert.genre}
            </span>
            {concert.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs text-[#8585A0]">
                {tag}
              </span>
            ))}
          </div>
          <h1
            className="text-[#F0EDEB]"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(1.8rem,5vw,3rem)",
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            {concert.title}
          </h1>
          <p className="mt-1 text-lg text-[#F5C842]">{concert.artistName}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InfoBlock icon={<Calendar className="h-5 w-5 text-[#F5C842]" />} label="Ngày diễn" value={formatDate(concert.startsAt)} />
            <InfoBlock icon={<Clock className="h-5 w-5 text-[#F5C842]" />} label="Giờ diễn" value={`${formatTime(concert.startsAt)} - ${formatTime(concert.endsAt)}`} />
            <InfoBlock icon={<MapPin className="h-5 w-5 text-[#F5C842]" />} label="Địa điểm" value={`${concert.venue.name}, ${concert.venue.city}`} />
          </div>

          <div>
            <div className="mb-4 flex gap-1 border-b border-white/10">
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
                  type="button"
                >
                  {tab === "info" ? "Thông tin" : tab === "lineup" ? "Nghệ sĩ" : "Sơ đồ ghế"}
                </button>
              ))}
            </div>

            {activeTab === "info" && (
              <div className="space-y-6">
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-[#F0EDEB]">Giới thiệu sự kiện</h3>
                  <p className="text-sm leading-relaxed text-[#B0B0C0]">{concert.description}</p>
                </section>

                <Panel title="Thông tin chi tiết" icon={<Info className="h-4 w-4 text-[#F5C842]" />}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DetailRow label="Ban tổ chức" value="TicketBox Events" />
                    <DetailRow label="Thể loại" value={concert.genre} />
                    <DetailRow label="Ngày diễn" value={formatDate(concert.startsAt)} />
                    <DetailRow label="Mở cửa đón khách" value={formatTime(doorOpenTime.toISOString())} />
                    <DetailRow label="Bắt đầu chương trình" value={formatTime(concert.startsAt)} />
                    <DetailRow label="Dự kiến kết thúc" value={formatTime(concert.endsAt)} />
                    <DetailRow label="Địa điểm" value={concert.venue.name} />
                    <DetailRow label="Thành phố" value={concert.venue.city} />
                    <DetailRow label="Địa chỉ" value={concert.venue.address || "Đang cập nhật"} />
                    <DetailRow label="Sức chứa" value={`${concert.venue.capacity.toLocaleString("vi-VN")} khán giả`} />
                  </div>
                </Panel>

                <Panel title="Quy định sự kiện" icon={<AlertTriangle className="h-4 w-4 text-[#F5C842]" />}>
                  <RuleList
                    items={[
                      "Khán giả cần xuất trình e-ticket hợp lệ có mã QR tại cổng.",
                      "Không mang đồ ăn, thức uống từ bên ngoài vào khu vực sự kiện.",
                      "Vé đã hủy, đã check-in hoặc sai cổng không thể sử dụng.",
                      "Ban tổ chức có quyền từ chối vào cổng khi vi phạm quy định an ninh.",
                    ]}
                  />
                </Panel>

                <Panel title="Hướng dẫn tham dự" icon={<CheckCircle className="h-4 w-4 text-[#2DBE6C]" />}>
                  <div className="space-y-4">
                    {[
                      { step: "01", title: "Đến sớm trước 60 phút", desc: `Cổng mở lúc ${formatTime(doorOpenTime.toISOString())}.` },
                      { step: "02", title: "Chuẩn bị mã QR", desc: "E-ticket sẽ xuất hiện trong Vé của tôi sau khi thanh toán thành công." },
                      { step: "03", title: "Check-in tại cổng", desc: "Xuất trình mã QR để nhân sự soát vé quét và xác thực." },
                    ].map((guide) => (
                      <div key={guide.step} className="flex gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2DBE6C]/15 text-xs font-bold text-[#2DBE6C]">
                          {guide.step}
                        </div>
                        <div>
                          <p className="mb-0.5 text-sm font-medium text-[#F0EDEB]">{guide.title}</p>
                          <p className="text-xs leading-relaxed text-[#8585A0]">{guide.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Câu hỏi thường gặp" icon={<HelpCircle className="h-4 w-4 text-[#7B61FF]" />}>
                  <FAQItem question="Vé có hoàn trả được không?" answer="Vé đã mua không được hoàn trả, trừ trường hợp sự kiện bị hủy bởi ban tổ chức. Trong trường hợp hủy sự kiện, 100% giá vé sẽ được hoàn lại." />
                  <FAQItem question="Có thể mua vé tại cửa không?" answer="Tùy theo từng sự kiện. Thông thường vé chỉ bán online qua TicketBox. Vui lòng theo dõi thông báo từ ban tổ chức." />
                  <FAQItem question="Một tài khoản mua được bao nhiêu vé?" answer="Giới hạn phụ thuộc từng loại vé và sẽ được kiểm tra lại khi tạo đơn hàng." />
                  <FAQItem question="E-ticket có an toàn không?" answer="Mỗi vé có QR payload riêng và chỉ có thể check-in một lần tại đúng cổng hoặc đúng khu." />
                </Panel>
              </div>
            )}

            {activeTab === "lineup" && (
              <Panel
                title={concert.artists.length > 1 ? `Lineup nghệ sĩ (${concert.artists.length})` : "Nghệ sĩ chính"}
                icon={<Music className="h-4 w-4 text-[#F5C842]" />}
              >
                <div className="space-y-6">
                  {concert.artists.map((artist, index) => (
                    <div
                      key={`${artist.name}-${index}`}
                      className="flex flex-col gap-4 border-t border-white/[0.06] pt-6 first:border-t-0 first:pt-0 sm:flex-row"
                    >
                      {artist.imageUrl ? (
                        <img
                          src={artist.imageUrl}
                          alt={artist.name}
                          className="h-40 w-40 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 text-xs text-[#8585A0]">
                          Chưa có ảnh
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 font-semibold text-[#F0EDEB]">{artist.name}</p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-[#B0B0C0]">
                          {artist.bio || "Thông tin nghệ sĩ đang được cập nhật."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {activeTab === "map" && (
              <div className="space-y-4">
                {concert.seatMapUrl ? (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111118]">
                    <ImageWithFallback src={concert.seatMapUrl} alt="Sơ đồ ghế" className="max-h-[420px] w-full object-contain" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-[#111118] p-6">
                    <SeatMapVisualization zones={concert.seatZones} />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {concert.seatZones.map((zone) => (
                    <div key={zone.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111118] p-3">
                      <div className="h-10 w-3 shrink-0 rounded" style={{ background: zone.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#F0EDEB]">{zone.name}</p>
                        <p className="text-xs text-[#8585A0]">{zone.description}</p>
                      </div>
                      <span className="text-xs text-[#8585A0]">{zone.capacity.toLocaleString("vi-VN")} chỗ</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside>
          <div id="ticket-list" className="sticky top-20 overflow-hidden rounded-2xl border border-white/10 bg-[#111118]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-[#F0EDEB]">Giá vé</h2>
              <p className="mt-0.5 text-xs text-[#8585A0]">Dữ liệu lấy từ Ticket Types và Inventory API.</p>
            </div>

            <div className="space-y-2 p-4">
              {concert.ticketTypes.length === 0 && (
                <div className="py-8 text-center">
                  <Info className="mx-auto mb-2 h-8 w-8 text-[#8585A0]" />
                  <p className="text-sm text-[#8585A0]">Vé chưa mở bán</p>
                </div>
              )}

              {concert.ticketTypes.map((ticketType) => {
                const available = getAvailableQuantity(ticketType);
                const percent = getSoldPercent(ticketType);
                const isSoldOut = ticketType.status === "SOLD_OUT" || available === 0;

                return (
                  <div key={ticketType.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" style={{ opacity: isSoldOut ? 0.58 : 1 }}>
                    <div className="self-stretch w-1 shrink-0 rounded-full" style={{ background: ticketType.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-[#F0EDEB]">{ticketType.name}</p>
                        <p className="shrink-0 text-sm font-bold" style={{ color: ticketType.color }}>{formatCurrency(ticketType.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${percent}%`,
                              background: percent > 85 ? "#E8315B" : percent > 60 ? "#F5C842" : "#2DBE6C",
                            }}
                          />
                        </div>
                        <span className="shrink-0 text-xs text-[#8585A0]">
                          {isSoldOut ? "Hết vé" : ticketType.availableQuantity === null ? "Đang mở bán" : `Còn ${available.toLocaleString("vi-VN")}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 pb-4">
              <button
                type="button"
                disabled={buyDisabledOverride || !hasAvailableTickets}
                onClick={onBuyTickets}
                className="w-full rounded-xl bg-gradient-to-br from-[#E8315B] to-[#C41E42] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#E8315B]/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buyLabel}
              </button>
            </div>

            <div className="border-t border-white/10 bg-[#F5C842]/[0.04] px-5 py-3">
              <p className="text-xs leading-relaxed text-[#8585A0]">
                <span className="text-[#F5C842]">Lưu ý:</span> Vé đã mua không hoàn trả trừ trường hợp sự kiện bị hủy.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CenteredState({ text, actionLabel }: { text: string; actionLabel?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#08080E] px-4 pt-20 text-center text-[#F0EDEB]">
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "2rem" }}>{text}</h1>
      {actionLabel && (
        <Link to="/" className="mt-4 text-sm text-[#F5C842]">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#111118] p-4">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="mb-0.5 text-xs text-[#8585A0]">{label}</p>
        <p className="text-sm font-medium text-[#F0EDEB]">{value}</p>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#111118]">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-sm font-semibold text-[#F0EDEB]">
        {icon}
        {title}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-xs text-[#8585A0]">{label}</p>
      <p className="text-sm text-[#F0EDEB]">{value}</p>
    </div>
  );
}

function RuleList({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5C842]" />
          <p className="text-sm leading-relaxed text-[#B0B0C0]">{item}</p>
        </div>
      ))}
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cursor-pointer border-t border-white/[0.06] py-3 first:border-t-0" onClick={() => setOpen((value) => !value)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#F0EDEB]">{question}</p>
        <span className="shrink-0 text-lg text-[#8585A0]" style={{ transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </div>
      {open && <p className="mt-2 text-xs leading-relaxed text-[#8585A0]">{answer}</p>}
    </div>
  );
}

function SeatMapVisualization({ zones }: { zones: { id: string; name: string; color: string; capacity: number }[] }) {
  if (zones.length === 0) {
    return <p className="text-center text-sm text-[#8585A0]">Sơ đồ ghế chưa sẵn sàng.</p>;
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex justify-center">
        <div className="min-w-[140px] rounded-lg border border-white/10 bg-white/[0.08] px-10 py-2 text-center text-xs font-semibold text-[#F0EDEB]">
          SÂN KHẤU
        </div>
      </div>
      <div className="space-y-2">
        {zones.map((zone, index) => {
          const widths = ["90%", "95%", "100%", "100%", "100%"];
          return (
            <div key={zone.id} className="flex justify-center">
              <div
                className="rounded-lg px-4 py-2.5 text-center text-xs font-medium"
                style={{
                  background: `${zone.color}1A`,
                  border: `1px solid ${zone.color}44`,
                  color: zone.color,
                  width: widths[index] ?? "100%",
                }}
              >
                {zone.name} - {zone.capacity.toLocaleString("vi-VN")} chỗ
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-[#8585A0]">Sơ đồ mô phỏng từ Seat Zone API.</p>
    </div>
  );
}

function LoginPrompt({ concertSlug, onClose }: { concertSlug: string; onClose: () => void }) {
  function rememberRedirect() {
    sessionStorage.setItem("ticketbox.redirectAfterLogin", `/concerts/${concertSlug}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur" onClick={onClose}>
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111118] p-8 text-center" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E8315B]/25 bg-[#E8315B]/10 text-[#E8315B]">
          <LogIn className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Đăng nhập để mua vé</h2>
        <p className="mt-2 text-sm leading-6 text-[#8585A0]">
          Bạn cần đăng nhập bằng tài khoản khán giả để tiếp tục chọn vé và thanh toán.
        </p>
        <div className="mt-6 grid gap-3">
          <Link to="/login" onClick={rememberRedirect} className="rounded-xl bg-[#E8315B] px-4 py-3 text-sm font-semibold text-white">
            Đăng nhập ngay
          </Link>
          <Link to="/register" onClick={rememberRedirect} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-[#F0EDEB]">
            Tạo tài khoản miễn phí
          </Link>
          <button type="button" onClick={onClose} className="text-sm text-[#8585A0]">
            Tiếp tục xem
          </button>
        </div>
      </section>
    </div>
  );
}
