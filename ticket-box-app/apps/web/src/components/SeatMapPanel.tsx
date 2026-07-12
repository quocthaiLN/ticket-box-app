import { X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { formatCurrency, type UiSeatZone, type UiTicketType } from "../lib/catalog-ui";

type TooltipState = { x: number; y: number; zoneId: string } | null;

// Trang quyết định loại sơ đồ: svgUrl = SVG tương tác (trang mua vé),
// imageUrl = ảnh tĩnh (trang thông tin concert). Truyền cả hai → ưu tiên SVG,
// ảnh làm fallback khi SVG lỗi.
export function SeatMapPanel({
  svgUrl,
  imageUrl,
  zones,
  ticketTypes,
  selectedZoneId,
  onSelectZone,
}: {
  svgUrl?: string;
  imageUrl?: string;
  zones: UiSeatZone[];
  ticketTypes: UiTicketType[];
  selectedZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function zoneSoldOut(zoneId: string) {
    const zoneTickets = ticketTypes.filter((ticketType) => ticketType.seatZoneId === zoneId);
    return zoneTickets.length > 0 && zoneTickets.every(
      (ticketType) => ticketType.status === "SOLD_OUT" || ticketType.availableQuantity === 0,
    );
  }

  function zoneMinPrice(zoneId: string) {
    const prices = ticketTypes
      .filter((ticketType) => ticketType.seatZoneId === zoneId)
      .map((ticketType) => ticketType.price);
    return prices.length > 0 ? Math.min(...prices) : null;
  }

  const staticImage = imageUrl ? (
    <button
      type="button"
      onClick={() => setLightboxOpen(true)}
      className="group relative block w-full overflow-hidden rounded-xl border border-white/10 bg-[#111118]"
      aria-label="Phóng to sơ đồ chỗ ngồi"
    >
      <ImageWithFallback src={imageUrl} alt="Sơ đồ chỗ ngồi" className="max-h-[420px] w-full object-contain" />
      <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs text-[#F0EDEB] opacity-80 backdrop-blur transition-opacity group-hover:opacity-100">
        <ZoomIn className="h-3.5 w-3.5" />
        Phóng to
      </span>
    </button>
  ) : null;

  const gridFallback = (
    <ZoneGridFallback zones={zones} selectedZoneId={selectedZoneId} onSelectZone={onSelectZone} zoneSoldOut={zoneSoldOut} />
  );

  return (
    <div>
      {svgUrl ? (
        <InteractiveSvgSeatMap
          seatMapUrl={svgUrl}
          zones={zones}
          ticketTypes={ticketTypes}
          selectedZoneId={selectedZoneId}
          onSelectZone={onSelectZone}
          zoneSoldOut={zoneSoldOut}
          fallback={staticImage ?? gridFallback}
        />
      ) : (
        staticImage ?? gridFallback
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

      {lightboxOpen && imageUrl && (
        <SeatMapLightbox seatMapUrl={imageUrl} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}

function InteractiveSvgSeatMap({
  seatMapUrl,
  zones,
  ticketTypes,
  selectedZoneId,
  onSelectZone,
  zoneSoldOut,
  fallback,
}: {
  seatMapUrl: string;
  zones: UiSeatZone[];
  ticketTypes: UiTicketType[];
  selectedZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
  zoneSoldOut: (zoneId: string) => boolean;
  fallback: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  useEffect(() => {
    const controller = new AbortController();
    setSvgMarkup(null);
    setLoadError(false);
    fetch(seatMapUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((source) => setSvgMarkup(sanitizeSvg(source)))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, [seatMapUrl]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !svgMarkup) return;

    root.querySelectorAll<SVGElement>("[id^='zone-']").forEach((element) => {
      const zone = findZoneForSvgId(element.id, zones);
      if (!zone) return;
      const soldOut = zoneSoldOut(zone.id);
      element.dataset.seatZoneId = zone.id;
      element.dataset.soldOut = String(soldOut);
      element.dataset.selected = String(selectedZoneId === zone.id);
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", `${zone.name}${soldOut ? ", hết vé" : ""}`);
      element.setAttribute("aria-disabled", String(soldOut || !onSelectZone));
      element.setAttribute("tabindex", soldOut || !onSelectZone ? "-1" : "0");
    });
  }, [svgMarkup, zones, selectedZoneId, onSelectZone, zoneSoldOut]);

  function zoneFromTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    const element = target.closest<SVGElement>("[data-seat-zone-id], [id^='zone-']");
    if (!element) return null;
    return zones.find((zone) => zone.id === element.dataset.seatZoneId)
      ?? findZoneForSvgId(element.id, zones)
      ?? null;
  }

  function availableForZone(zoneId: string) {
    const values = ticketTypes
      .filter((ticketType) => ticketType.seatZoneId === zoneId)
      .map((ticketType) => ticketType.availableQuantity)
      .filter((value): value is number => value !== null);
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
  }

  if (loadError) {
    return <>{fallback}</>;
  }

  if (!svgMarkup) {
    return <div className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" aria-label="Đang tải sơ đồ chỗ ngồi" />;
  }

  const tooltipZone = tooltip ? zones.find((zone) => zone.id === tooltip.zoneId) : null;
  const tooltipAvailable = tooltipZone ? availableForZone(tooltipZone.id) : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#111118]">
      <style>{`
        .interactive-seat-map svg { display: block; width: 100%; max-height: 520px; }
        .interactive-seat-map [id^="zone-"],
        .interactive-seat-map [id^="zone-"] * { cursor: pointer; outline: none; }
        .interactive-seat-map [data-seat-zone-id][data-sold-out="true"] { cursor: not-allowed; filter: grayscale(1); opacity: .35; }
      `}</style>
      <div
        ref={containerRef}
        className="interactive-seat-map"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
        onClick={(event) => {
          const zone = zoneFromTarget(event.target);
          if (zone && !zoneSoldOut(zone.id)) onSelectZone?.(zone.id);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const zone = zoneFromTarget(event.target);
          if (zone && !zoneSoldOut(zone.id)) {
            event.preventDefault();
            onSelectZone?.(zone.id);
          }
        }}
        onMouseMove={(event) => {
          const zone = zoneFromTarget(event.target);
          if (!zone) return setTooltip(null);
          const bounds = event.currentTarget.getBoundingClientRect();
          setTooltip({ x: event.clientX - bounds.left + 12, y: event.clientY - bounds.top + 12, zoneId: zone.id });
        }}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && tooltipZone && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-xs text-[#F0EDEB] shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-semibold">Khu {tooltipZone.name}</p>
          <p className="text-[#B8B8C8]">
            {zoneSoldOut(tooltipZone.id) ? "Hết vé" : tooltipAvailable === null ? "Số vé đang cập nhật" : `Còn ${tooltipAvailable.toLocaleString("vi-VN")} vé`}
          </p>
        </div>
      )}
    </div>
  );
}

function findZoneForSvgId(svgId: string, zones: UiSeatZone[]) {
  const suffix = normalizeCode(svgId.replace(/^zone-/i, ""));
  return [...zones]
    .sort((left, right) => normalizeCode(right.code).length - normalizeCode(left.code).length)
    .find((zone) => suffix === normalizeCode(zone.code) || suffix.startsWith(`${normalizeCode(zone.code)}-`));
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sanitizeSvg(source: string) {
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  if (document.querySelector("parsererror") || document.documentElement.localName !== "svg") {
    throw new Error("Invalid SVG");
  }

  document.querySelectorAll("script, foreignObject, iframe, object, embed, audio, video").forEach((node) => node.remove());
  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || /javascript:|data:text\/html/i.test(value)) {
        element.removeAttribute(attribute.name);
      } else if ((name === "href" || name === "xlink:href") && value && !value.startsWith("#")) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return new XMLSerializer().serializeToString(document.documentElement);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-label="Sơ đồ chỗ ngồi phóng to">
      <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-[#F0EDEB] transition-colors hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
      <img src={seatMapUrl} alt="Sơ đồ chỗ ngồi" className="max-h-full max-w-full rounded-xl object-contain" onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

function ZoneGridFallback({ zones, selectedZoneId, onSelectZone, zoneSoldOut }: {
  zones: UiSeatZone[];
  selectedZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
  zoneSoldOut: (zoneId: string) => boolean;
}) {
  if (zones.length === 0) {
    return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-[#8585A0]">Sơ đồ chỗ ngồi đang được cập nhật.</p>;
  }
  return (
    <div className="rounded-xl border border-white/10 bg-[#111118] p-5">
      <div className="mx-auto mb-4 flex h-9 max-w-xs items-center justify-center rounded-b-2xl bg-white/10 text-xs font-semibold tracking-widest text-[#F0EDEB]">SÂN KHẤU</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {zones.map((zone) => {
          const soldOut = zoneSoldOut(zone.id);
          const selected = selectedZoneId === zone.id;
          return (
            <button key={zone.id} type="button" disabled={soldOut || !onSelectZone} onClick={() => onSelectZone?.(zone.id)} className="rounded-xl border p-3 text-left transition-colors disabled:cursor-default" style={{ borderColor: selected ? zone.color : "rgba(255,255,255,0.1)", background: soldOut ? "rgba(75,75,88,0.2)" : `${zone.color}14`, opacity: soldOut ? 0.55 : 1 }}>
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
