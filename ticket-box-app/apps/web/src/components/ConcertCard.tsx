import { Calendar, MapPin, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatCurrency,
  formatDate,
  formatTime,
  type UiConcert,
} from "../lib/catalog-ui";
import { ImageWithFallback } from "./figma/ImageWithFallback";

type ConcertCardProps = {
  concert: UiConcert;
  featured?: boolean;
};

export function ConcertCard({ concert, featured = false }: ConcertCardProps) {
  const isSoldOut =
    concert.ticketTypes.length > 0 &&
    concert.ticketTypes.every((ticketType) => ticketType.availableQuantity === 0);

  return (
    <Link
      to={`/concerts/${concert.slug}`}
      className="group block overflow-hidden rounded-2xl bg-[#111118] transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/30 hover:shadow-2xl hover:shadow-black/40"
      style={{ border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="relative overflow-hidden" style={{ paddingBottom: featured ? "50%" : "60%" }}>
        <ImageWithFallback
          src={concert.coverImageUrl}
          alt={concert.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(17,17,24,1) 0%, rgba(17,17,24,0.3) 50%, transparent 100%)",
          }}
        />

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-[#F0EDEB] backdrop-blur">
            {concert.genre}
          </span>
          {isSoldOut && (
            <span className="rounded-full bg-[#E8315B]/85 px-2.5 py-1 text-xs font-semibold text-white">
              Sold out
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3
          className="mb-1 break-words font-semibold leading-snug text-[#F0EDEB] transition-colors group-hover:text-amber-400"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: featured ? "1.35rem" : "1.1rem",
          }}
        >
          {concert.title}
        </h3>
        <p className="mb-3 text-sm text-[#8585A0]">{concert.artistName}</p>

        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-[#8585A0]">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#F5C842]" />
            <span>
              {formatDate(concert.startsAt)} - {formatTime(concert.startsAt)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#8585A0]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#F5C842]" />
            <span className="min-w-0 break-words">
              {concert.venue.name}, {concert.venue.city}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          {concert.minPrice !== null ? (
            <div>
              <span className="text-xs text-[#8585A0]">Từ </span>
              <span className="text-sm font-semibold text-[#F5C842]">
                {formatCurrency(concert.minPrice)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-[#8585A0]">Thông báo sớm</span>
          )}

          <span className="inline-flex items-center gap-1 rounded-lg border border-[#E8315B]/30 bg-[#E8315B]/15 px-3 py-1.5 text-xs font-medium text-[#E8315B]">
            <Ticket className="h-3 w-3" />
            Mua vé
          </span>
        </div>
      </div>
    </Link>
  );
}
