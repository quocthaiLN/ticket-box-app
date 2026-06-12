import { Link } from "react-router";
import { Calendar, MapPin, Tag } from "lucide-react";
import { Concert, formatCurrency, formatDate, formatTime, getAvailableQuantity } from "../data/mockData";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface ConcertCardProps {
  concert: Concert;
  featured?: boolean;
}

export function ConcertCard({ concert, featured = false }: ConcertCardProps) {
  const minPrice = Math.min(...concert.ticketTypes.map((t) => t.price));
  const totalAvailable = concert.ticketTypes.reduce((sum, t) => sum + getAvailableQuantity(t), 0);
  const isSoldOut = concert.ticketTypes.length > 0 && totalAvailable === 0;

  return (
    <Link
      to={`/concerts/${concert.slug}`}
      className="group block rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: "#111118",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(245,200,66,0.25)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Cover image */}
      <div className="relative overflow-hidden" style={{ paddingBottom: featured ? "50%" : "60%" }}>
        <ImageWithFallback
          src={concert.coverImageUrl}
          alt={concert.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(17,17,24,1) 0%, rgba(17,17,24,0.3) 50%, transparent 100%)" }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: "rgba(0,0,0,0.7)", color: "#F0EDEB", backdropFilter: "blur(8px)" }}
          >
            {concert.genre}
          </span>
          {concert.status === "PUBLISHED" && isSoldOut && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: "rgba(232,49,91,0.85)", color: "#fff" }}
            >
              Hết vé
            </span>
          )}
          {concert.status === "DRAFT" && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: "rgba(245,200,66,0.85)", color: "#1A1A00" }}
            >
              Sắp mở bán
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3
          className="mb-1 line-clamp-2 group-hover:text-amber-400 transition-colors"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            color: "#F0EDEB",
            fontSize: featured ? "1.35rem" : "1.1rem",
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          {concert.title}
        </h3>
        <p className="text-sm mb-3" style={{ color: "#8585A0" }}>{concert.artistName}</p>

        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#8585A0" }}>
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#F5C842" }} />
            <span>{formatDate(concert.startsAt)} · {formatTime(concert.startsAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#8585A0" }}>
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#F5C842" }} />
            <span className="truncate">{concert.venue.name}, {concert.venue.city}</span>
          </div>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {concert.ticketTypes.length > 0 ? (
            <div>
              <span className="text-xs" style={{ color: "#8585A0" }}>Từ </span>
              <span className="font-semibold text-sm" style={{ color: "#F5C842" }}>
                {formatCurrency(minPrice)}
              </span>
            </div>
          ) : (
            <span className="text-xs" style={{ color: "#8585A0" }}>Thông báo sớm</span>
          )}

          {!isSoldOut && concert.status === "PUBLISHED" ? (
            <span
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: "rgba(232,49,91,0.15)", color: "#E8315B", border: "1px solid rgba(232,49,91,0.3)" }}
            >
              Mua vé
            </span>
          ) : concert.status === "DRAFT" ? (
            <span className="text-xs" style={{ color: "#8585A0" }}>Notify me</span>
          ) : (
            <span
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.05)", color: "#8585A0" }}
            >
              Hết vé
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
