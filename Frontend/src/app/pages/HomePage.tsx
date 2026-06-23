import { useState } from "react";
import { Link } from "react-router";
import { Search, ArrowRight, Zap, Shield, Smartphone, Star } from "lucide-react";
import { ConcertCard } from "../components/ConcertCard";
import { CONCERTS } from "../data/mockData";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { AnimatedSection } from "../components/AnimatedSection";

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Tất cả");

  const filters = ["Tất cả", "Indie/R&B", "Pop", "Classical", "Acoustic", "Festival"];
  const published = CONCERTS.filter((c) => c.status === "PUBLISHED");

  const filtered = published.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.artistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.venue.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "Tất cả" || c.genre.includes(activeFilter) || c.tags.some((t) => t.includes(activeFilter));
    return matchesSearch && matchesFilter;
  });

  const featured = published[0];

  return (
    <div style={{ background: "#08080E", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      {featured && (
        <section className="relative pt-16 overflow-hidden" style={{ minHeight: "92vh" }}>
          {/* BG image */}
          <div className="absolute inset-0">
            <ImageWithFallback
              src={featured.coverImageUrl}
              alt={featured.title}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to right, rgba(8,8,14,0.95) 40%, rgba(8,8,14,0.6) 70%, rgba(8,8,14,0.3) 100%), linear-gradient(to top, rgba(8,8,14,1) 0%, transparent 50%)" }}
            />
          </div>

          {/* Grain overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-30"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E\")" }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center" style={{ minHeight: "92vh", paddingTop: "6rem", paddingBottom: "4rem" }}>
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
                  style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.3)" }}
                >
                  Nổi bật
                </span>
                <span className="text-xs" style={{ color: "#8585A0" }}>{featured.genre}</span>
              </div>

              <h1
                className="mb-3 leading-tight"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                  fontWeight: 700,
                  color: "#F0EDEB",
                  lineHeight: 1.1,
                }}
              >
                {featured.title}
              </h1>

              <p className="text-lg mb-2" style={{ color: "#F5C842", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {featured.artistName}
              </p>

              <p className="text-sm mb-6 max-w-lg leading-relaxed" style={{ color: "#8585A0" }}>
                {featured.description.substring(0, 150)}...
              </p>

              <div className="flex items-center gap-2 mb-8 flex-wrap">
                <InfoBadge label={`${new Date(featured.startsAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" })}`} />
                <InfoBadge label={featured.venue.name} />
                <InfoBadge label={featured.venue.city} />
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  to={`/concerts/${featured.slug}`}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff", boxShadow: "0 8px 30px rgba(232,49,91,0.4)" }}
                >
                  Mua vé ngay
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to={`/concerts/${featured.slug}`}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.07)", color: "#F0EDEB", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  Xem chi tiết
                </Link>
              </div>
            </div>
          </div>

          {/* Upcoming pills at bottom */}
          <div className="absolute bottom-8 left-0 right-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                {published.slice(1, 4).map((c) => (
                  <Link
                    key={c.id}
                    to={`/concerts/${c.slug}`}
                    className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/10"
                    style={{ background: "rgba(17,17,24,0.8)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      <ImageWithFallback src={c.coverImageUrl} alt={c.title} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-medium line-clamp-1" style={{ color: "#F0EDEB" }}>{c.title}</p>
                      <p className="text-xs" style={{ color: "#8585A0" }}>{c.artistName}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Search & Filter ──────────────────────────────────────────────────── */}
      <AnimatedSection>
      <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div
            className="flex items-center gap-3 flex-1 px-4 py-3 rounded-xl"
            style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#8585A0" }} />
            <input
              type="text"
              placeholder="Tìm kiếm nghệ sĩ, sự kiện, địa điểm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none flex-1 text-sm"
              style={{ color: "#F0EDEB" }}
            />
          </div>
        </div>

        {/* Genre filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-all"
              style={
                activeFilter === f
                  ? { background: "#F5C842", color: "#0A0A0F", fontWeight: 600 }
                  : { background: "rgba(255,255,255,0.06)", color: "#8585A0", border: "1px solid rgba(255,255,255,0.07)" }
              }
            >
              {f}
            </button>
          ))}
        </div>
      </section>
      </AnimatedSection>

      {/* ── Concert Grid ─────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <AnimatedSection>
          <div className="flex items-center justify-between mb-6">
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#F0EDEB", fontSize: "1.75rem", fontWeight: 600 }}>
              Sự kiện {activeFilter !== "Tất cả" ? activeFilter : "sắp diễn ra"}
            </h2>
            <Link
              to="/events"
              className="flex items-center gap-1 text-sm transition-colors hover:text-amber-400"
              style={{ color: "#8585A0" }}
            >
              Xem tất cả
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </AnimatedSection>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p style={{ color: "#8585A0" }}>Không tìm thấy sự kiện phù hợp</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((concert, i) => (
              <AnimatedSection key={concert.id} delay={i * 0.07}>
                <ConcertCard concert={concert} featured={i === 0 && !searchQuery} />
              </AnimatedSection>
            ))}
          </div>
        )}
      </section>

      {/* ── Features Banner ──────────────────────────────────────────────────── */}
      <section className="py-16" style={{ background: "#0D0D15" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-10">
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#F0EDEB", fontSize: "2rem", fontWeight: 600 }}>
                Vì sao chọn TicketBox?
              </h2>
              <p className="mt-2 text-sm" style={{ color: "#8585A0" }}>Nền tảng mua vé đáng tin cậy nhất Việt Nam</p>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <Zap className="w-6 h-6" />, title: "Thanh toán siêu tốc", desc: "Hỗ trợ VNPAY, MoMo, thẻ ngân hàng. Thanh toán trong vòng 60 giây." },
              { icon: <Shield className="w-6 h-6" />, title: "Vé chính hãng 100%", desc: "Mã QR độc quyền chống làm giả. Hoàn tiền nếu sự kiện hủy." },
              { icon: <Smartphone className="w-6 h-6" />, title: "E-ticket tiện lợi", desc: "Vé điện tử gửi qua email & app. Không cần in, chỉ cần quét QR." },
              { icon: <Star className="w-6 h-6" />, title: "Ưu đãi độc quyền", desc: "Thành viên TicketBox nhận ưu đãi sớm và vé Early Bird giá tốt nhất." },
            ].map((f, i) => (
              <AnimatedSection key={f.title} delay={i * 0.1} direction="up">
                <FeatureCard icon={f.icon} title={f.title} desc={f.desc} />
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────────── */}
      <section
        className="py-16 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1A0A14 0%, #0A0A1A 100%)" }}
      >
        <div className="absolute inset-0 opacity-20"
          style={{ background: "radial-gradient(circle at 30% 50%, rgba(232,49,91,0.5) 0%, transparent 60%), radial-gradient(circle at 70% 50%, rgba(123,97,255,0.4) 0%, transparent 60%)" }}
        />
        <AnimatedSection direction="none">
        <div className="relative z-10 max-w-2xl mx-auto text-center px-4">
          <h2
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#F0EDEB", fontSize: "2.25rem", fontWeight: 700 }}
            className="mb-3"
          >
            Đừng bỏ lỡ sự kiện yêu thích
          </h2>
          <p className="text-sm mb-6" style={{ color: "#8585A0" }}>
            Đăng ký ngay để nhận thông báo mở bán vé sớm nhất và những ưu đãi độc quyền từ TicketBox.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              to="/register"
              className="px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff", boxShadow: "0 8px 30px rgba(232,49,91,0.35)" }}
            >
              Tạo tài khoản miễn phí
            </Link>
            <Link
              to="/events"
              className="px-6 py-3 rounded-xl font-medium text-sm transition-all hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.07)", color: "#F0EDEB", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              Khám phá sự kiện
            </Link>
          </div>
        </div>
        </AnimatedSection>
      </section>
    </div>
  );
}

function InfoBadge({ label }: { label: string }) {
  return (
    <span
      className="px-3 py-1 rounded-lg text-xs"
      style={{ background: "rgba(255,255,255,0.08)", color: "#F0EDEB", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {label}
    </span>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      className="p-6 rounded-2xl"
      style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842" }}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-sm font-semibold" style={{ color: "#F0EDEB" }}>{title}</h3>
      <p className="text-xs leading-relaxed" style={{ color: "#8585A0" }}>{desc}</p>
    </div>
  );
}
