import { AlertCircle, ChevronLeft, Clock, Minus, Plus, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { formatCurrency, formatDate, type UiConcert, type UiTicketType } from "../../lib/catalog-ui";
import { getCatalogConcertDetail } from "../../services/catalog.service";
import {
  createPendingCheckout,
  formatCountdown,
  readPendingCheckout,
  remainingSeconds,
  writePendingCheckout,
  type PendingCheckoutItem,
} from "./checkout-storage";

export function SeatSelectionPage() {
  const { concertId } = useParams<{ concertId: string }>();
  const navigate = useNavigate();
  const [concert, setConcert] = useState<UiConcert | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(600);

  useEffect(() => {
    if (!concertId) return;
    let mounted = true;
    setStatus("loading");
    getCatalogConcertDetail(concertId)
      .then((data) => {
        if (!mounted) return;
        setConcert(data);
        const pending = readPendingCheckout() ?? createPendingCheckout(data.id);
        const nextPending = {
          ...pending,
          concertId: data.id,
          concertTitle: data.title,
          artistName: data.artistName,
          coverImageUrl: data.coverImageUrl,
          venueName: data.venue.name,
          startsAt: data.startsAt,
        };
        writePendingCheckout(nextPending);
        setTimeLeft(remainingSeconds(nextPending.expiresAt));
        setQuantities(Object.fromEntries(nextPending.items.map((item) => [item.ticketTypeId, item.quantity])));
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, [concertId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const pending = readPendingCheckout();
      if (!pending) return;
      const remaining = remainingSeconds(pending.expiresAt);
      setTimeLeft(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedItems = useMemo(() => {
    if (!concert) return [];
    return concert.ticketTypes
      .map((ticketType) => toPendingItem(ticketType, concert, quantities[ticketType.id] ?? 0))
      .filter((item): item is PendingCheckoutItem => item !== null && item.quantity > 0);
  }, [concert, quantities]);

  const totalPrice = selectedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  function updateQuantity(ticketType: UiTicketType, nextValue: number) {
    const available = ticketType.availableQuantity ?? ticketType.maxPerUser;
    const max = Math.max(0, Math.min(ticketType.maxPerUser, available));
    const value = Math.max(0, Math.min(max, nextValue));
    setQuantities((current) => ({ ...current, [ticketType.id]: value }));
  }

  function continueToCheckout() {
    if (!concert || selectedItems.length === 0) return;
    const pending = readPendingCheckout() ?? createPendingCheckout(concert.id);
    writePendingCheckout({
      ...pending,
      concertId: concert.id,
      concertTitle: concert.title,
      artistName: concert.artistName,
      coverImageUrl: concert.coverImageUrl,
      venueName: concert.venue.name,
      startsAt: concert.startsAt,
      items: selectedItems,
      totalPrice,
    });
    navigate("/checkout");
  }

  if (status === "loading") return <CenteredState text="Đang tải khu vé..." />;
  if (status === "error" || !concert) return <CenteredState text="Không thể tải khu vé." actionLabel="Về danh sách sự kiện" />;
  if (timeLeft <= 0) return <ExpiredState concertId={concert.id} />;

  return (
    <main className="min-h-screen bg-[#08080E] pt-16 text-[#F0EDEB]">
      <header className="sticky top-16 z-30 border-b border-white/10 bg-[#08080E]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="rounded-lg p-2 text-[#F0EDEB] hover:bg-white/10" aria-label="Quay lại">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-[#8585A0]">Chọn loại vé</p>
              <p className="truncate text-sm font-semibold">{concert.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#F5C842]/25 bg-[#F5C842]/10 px-3 py-1.5 text-sm font-semibold text-[#F5C842]">
            <Clock className="h-4 w-4" />
            {formatCountdown(timeLeft)}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111118]">
            <div className="relative h-48">
              <ImageWithFallback src={concert.coverImageUrl} alt={concert.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111118] to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-xs text-[#F5C842]">{formatDate(concert.startsAt)} - {concert.venue.name}</p>
                <h1 className="mt-1 text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{concert.title}</h1>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111118] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Loại vé đang mở bán</h2>
                <p className="mt-1 text-xs text-[#8585A0]">Chọn số lượng theo từng khu. Hệ thống sẽ giữ vé khi tạo đơn ở bước thanh toán.</p>
              </div>
              <Ticket className="h-5 w-5 text-[#F5C842]" />
            </div>

            <div className="space-y-3">
              {concert.ticketTypes.map((ticketType) => {
                const quantity = quantities[ticketType.id] ?? 0;
                const available = ticketType.availableQuantity;
                const max = Math.max(0, Math.min(ticketType.maxPerUser, available ?? ticketType.maxPerUser));
                const soldOut = ticketType.status === "SOLD_OUT" || available === 0 || max === 0;
                return (
                  <article key={ticketType.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4" style={{ opacity: soldOut ? 0.55 : 1 }}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm" style={{ background: ticketType.color }} />
                          <h3 className="text-sm font-semibold">{ticketType.name}</h3>
                        </div>
                        <p className="text-xs text-[#8585A0]">
                          Khu {ticketType.zoneCode || "chưa gán"} - tối đa {ticketType.maxPerUser} vé/tài khoản
                        </p>
                        <p className="mt-2 text-sm font-semibold" style={{ color: ticketType.color }}>{formatCurrency(ticketType.price)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button" disabled={quantity <= 0 || soldOut} onClick={() => updateQuantity(ticketType, quantity - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[#F0EDEB] disabled:opacity-35">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                        <button type="button" disabled={quantity >= max || soldOut} onClick={() => updateQuantity(ticketType, quantity + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[#F0EDEB] disabled:opacity-35">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${ticketType.soldPercent}%`, background: ticketType.soldPercent > 85 ? "#E8315B" : ticketType.color }} />
                    </div>
                    <p className="mt-2 text-xs text-[#8585A0]">
                      {soldOut ? "Hết vé" : available === null ? "Đang mở bán" : `Còn ${available.toLocaleString("vi-VN")} vé`}
                    </p>
                  </article>
                );
              })}
              {concert.ticketTypes.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-[#8585A0]">Concert này chưa có loại vé đang bán.</p>}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="sticky top-36 overflow-hidden rounded-2xl border border-white/10 bg-[#111118]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold">Tóm tắt lựa chọn</h2>
              <p className="mt-1 text-xs text-[#8585A0]">{totalQuantity} vé đã chọn</p>
            </div>
            <div className="space-y-2 p-4">
              {selectedItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#8585A0]">Chưa chọn vé nào</p>
              ) : (
                selectedItems.map((item) => (
                  <div key={item.ticketTypeId} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.ticketTypeName}</p>
                      <p className="text-xs text-[#8585A0]">{item.zoneName} x {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#F5C842]">{formatCurrency(item.quantity * item.unitPrice)}</p>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-white/10 px-5 py-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-[#8585A0]">Tổng cộng</span>
                <span className="text-lg font-bold text-[#F5C842]">{formatCurrency(totalPrice)}</span>
              </div>
              <button type="button" disabled={selectedItems.length === 0} onClick={continueToCheckout} className="w-full rounded-xl bg-gradient-to-br from-[#E8315B] to-[#C41E42] py-3 text-sm font-semibold text-white shadow-lg shadow-[#E8315B]/25 disabled:cursor-not-allowed disabled:opacity-45">
                Tiếp tục thanh toán
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function toPendingItem(ticketType: UiTicketType, concert: UiConcert, quantity: number): PendingCheckoutItem | null {
  if (quantity <= 0) return null;
  const zone = concert.seatZones.find((item) => item.id === ticketType.seatZoneId);
  return {
    ticketTypeId: ticketType.id,
    ticketTypeName: ticketType.name,
    zoneName: zone?.name ?? ticketType.zoneCode ?? "Khu vé",
    zoneColor: zone?.color ?? ticketType.color,
    quantity,
    unitPrice: ticketType.price,
  };
}

function CenteredState({ text, actionLabel }: { text: string; actionLabel?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#08080E] px-4 pt-20 text-center text-[#F0EDEB]">
      <p className="text-sm text-[#8585A0]">{text}</p>
      {actionLabel && <Link to="/events" className="mt-4 text-sm font-semibold text-[#F5C842]">{actionLabel}</Link>}
    </main>
  );
}

function ExpiredState({ concertId }: { concertId: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08080E] px-4 pt-20 text-center text-[#F0EDEB]">
      <section className="max-w-sm rounded-2xl border border-white/10 bg-[#111118] p-8">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-[#E8315B]" />
        <h1 className="text-lg font-semibold">Phiên giữ vé đã hết hạn</h1>
        <p className="mt-2 text-sm text-[#8585A0]">Vui lòng quay lại trang sự kiện và chọn vé lại.</p>
        <Link to={`/concerts/${concertId}`} className="mt-6 inline-flex rounded-xl bg-[#E8315B] px-5 py-3 text-sm font-semibold text-white">
          Quay lại sự kiện
        </Link>
      </section>
    </main>
  );
}
