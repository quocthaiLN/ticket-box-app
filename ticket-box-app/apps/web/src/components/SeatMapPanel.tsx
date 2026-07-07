import { X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { formatCurrency, type UiSeatZone, type UiTicketType } from "../lib/catalog-ui";

// Sơ đồ chỗ ngồi: ảnh do organizer upload (Concert.seatMapUrl) + legend hạng vé
// đồng bộ màu. Ảnh không có vùng click — audience đối chiếu màu/tên trên ảnh với
// chip legend; click chip → onSelectZone (highlight hạng vé). Click ảnh mở lightbox
// phóng to. Không có ảnh → lưới zone fallback.
export function SeatMapPanel({
  seatMapUrl,
  zones,
  ticketTypes,
  selectedZoneId,
  onSelectZone,
}: {
  seatMapUrl?: string;
  zones: UiSeatZone[];
  ticketTypes: UiTicketType[];
  selectedZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function zoneSoldOut(zoneId: string) {
    const zoneTickets = ticketTypes.filter((ticketType) => ticketType.seatZoneId === zoneId);
    if (zoneTickets.length === 0) return false;
    return zoneTickets.every(
      (ticketType) => ticketType.status === "SOLD_OUT" || ticketType.availableQuantity === 0,
    );
  }

  function zoneMinPrice(zoneId: string) {
    const prices = ticketTypes
      .filter((ticketType) => ticketType.seatZoneId === zoneId)
      .map((ticketType) => ticketType.price);
    return prices.length > 0 ? Math.min(...prices) : null;
  }

  return (
    <div>
      {seatMapUrl ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group relative block w-full overflow-hidden rounded-xl border border-white/10 bg-[#111118]"
          aria-label="Phóng to sơ đồ chỗ ngồi"
        >
          <ImageWithFallback src={seatMapUrl} alt="Sơ đồ chỗ ngồi" className="max-h-[420px] w-full object-contain" />
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs text-[#F0EDEB] opacity-80 backdrop-blur transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" />
            Phóng to
          </span>
        </button>
      ) : (
        <ZoneGridFallback zones={zones} selectedZoneId={selectedZoneId} onSelectZone={onSelectZone} zoneSoldOut={zoneSoldOut} />
      )}

      {zones.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {zones.map((zone) => {
            const soldOut = zoneSoldOut(zone.id);
            const minPrice = zoneMinPrice(zone.id);
            const selected = selectedZoneId === zone.id;
            return (
              <button
                key={zone.id}
                type="button"
                disabled={soldOut || !onSelectZone}
                onClick={() => onSelectZone?.(zone.id)}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-default"
                style={{
                  borderColor: selected ? zone.color : "rgba(255,255,255,0.1)",
                  background: selected ? `${zone.color}1f` : "transparent",
                  opacity: soldOut ? 0.5 : 1,
                }}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: soldOut ? "#4B4B58" : zone.color }} />
                <span className="font-medium text-[#F0EDEB]">{zone.name}</span>
                <span className="text-[#8585A0]">
                  {soldOut ? "Hết vé" : minPrice !== null ? `từ ${formatCurrency(minPrice)}` : `${zone.capacity.toLocaleString("vi-VN")} chỗ`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {lightboxOpen && seatMapUrl && (
        <SeatMapLightbox seatMapUrl={seatMapUrl} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}

function SeatMapLightbox({ seatMapUrl, onClose }: { seatMapUrl: string; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Sơ đồ chỗ ngồi phóng to"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-[#F0EDEB] transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={seatMapUrl}
        alt="Sơ đồ chỗ ngồi"
        className="max-h-full max-w-full rounded-xl object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

function ZoneGridFallback({
  zones,
  selectedZoneId,
  onSelectZone,
  zoneSoldOut,
}: {
  zones: UiSeatZone[];
  selectedZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
  zoneSoldOut: (zoneId: string) => boolean;
}) {
  if (zones.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-[#8585A0]">
        Sơ đồ chỗ ngồi đang được cập nhật.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#111118] p-5">
      <div className="mx-auto mb-4 flex h-9 max-w-xs items-center justify-center rounded-b-2xl bg-white/10 text-xs font-semibold tracking-widest text-[#F0EDEB]">
        SÂN KHẤU
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {zones.map((zone) => {
          const soldOut = zoneSoldOut(zone.id);
          const selected = selectedZoneId === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              disabled={soldOut || !onSelectZone}
              onClick={() => onSelectZone?.(zone.id)}
              className="rounded-xl border p-3 text-left transition-colors disabled:cursor-default"
              style={{
                borderColor: selected ? zone.color : "rgba(255,255,255,0.1)",
                background: soldOut ? "rgba(75,75,88,0.2)" : `${zone.color}14`,
                opacity: soldOut ? 0.55 : 1,
              }}
            >
              <div className="mb-1 h-1.5 w-8 rounded-full" style={{ background: soldOut ? "#4B4B58" : zone.color }} />
              <p className="text-sm font-medium text-[#F0EDEB]">{zone.name}</p>
              <p className="text-xs text-[#8585A0]">{soldOut ? "Hết vé" : `${zone.capacity.toLocaleString("vi-VN")} chỗ`}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
