import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Clock, ChevronLeft, AlertCircle, X } from "lucide-react";
import { CONCERTS, formatCurrency, Concert, SeatZone } from "../data/mockData";

interface SelectedSeat {
  seatId: string;
  zoneName: string;
  zoneColor: string;
  ticketTypeId: string;
  ticketTypeName: string;
  price: number;
  row: string;
  col: number;
}

interface PendingOrder {
  concertId: string;
  expiresAt: number;
  // populated after seat selection
  items?: { ticketTypeId: string; quantity: number; unitPrice: number }[];
  totalPrice?: number;
  selectedSeats?: SelectedSeat[];
}

function isSeatTaken(zoneId: string, row: number, col: number, takenRatio: number): boolean {
  const hash = (zoneId.charCodeAt(0) * 31 + row * 17 + col * 13) % 100;
  return hash < takenRatio * 100;
}

function getGridDims(capacity: number): { rows: number; cols: number } {
  if (capacity <= 50)  return { rows: 5,  cols: 10 };
  if (capacity <= 200) return { rows: 10, cols: 20 };
  if (capacity <= 500) return { rows: 15, cols: 25 };
  return { rows: 20, cols: 30 };
}

const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function SeatSelectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [orderData, setOrderData] = useState<PendingOrder | null>(null);
  const [concert, setConcert] = useState<Concert | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
  const [takenSeats, setTakenSeats] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(600);
  const [expired, setExpired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("pendingOrder");
    if (!raw) { navigate("/"); return; }
    try {
      const parsed: PendingOrder = JSON.parse(raw);
      if (!parsed.expiresAt) { navigate("/"); return; }
      const remaining = Math.floor((parsed.expiresAt - Date.now()) / 1000);
      if (remaining <= 0) { setExpired(true); return; }
      setOrderData(parsed);
      setTimeLeft(remaining);
      const c = CONCERTS.find((x) => x.id === parsed.concertId);
      if (!c) { navigate("/"); return; }
      setConcert(c);
      if (c.seatZones.length > 0) setSelectedZoneId(c.seatZones[0].id);
    } catch { navigate("/"); }
  }, [navigate]);

  // Countdown using expiresAt reference — no drift
  useEffect(() => {
    if (!orderData?.expiresAt) return;
    const expiresAt = orderData.expiresAt;
    intervalRef.current = setInterval(() => {
      const remaining = Math.floor((expiresAt - Date.now()) / 1000);
      if (remaining <= 0) { clearInterval(intervalRef.current!); setExpired(true); setTimeLeft(0); }
      else setTimeLeft(remaining);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [orderData]);

  // Realtime: randomly mark a seat taken every ~8s
  useEffect(() => {
    if (!concert) return;
    realtimeRef.current = setInterval(() => {
      const zones = concert.seatZones;
      if (!zones.length) return;
      const zone = zones[Math.floor(Math.random() * zones.length)];
      const dims = getGridDims(zone.capacity);
      const row = Math.floor(Math.random() * dims.rows);
      const col = Math.floor(Math.random() * dims.cols);
      const key = `${zone.id}-${row}-${col}`;
      setTakenSeats((prev) => prev.has(key) ? prev : new Set([...prev, key]));
    }, 8000);
    return () => { if (realtimeRef.current) clearInterval(realtimeRef.current); };
  }, [concert]);

  // Get the ticket type for a given zone
  const getTicketTypeForZone = useCallback((zone: SeatZone) => {
    if (!concert) return null;
    return concert.ticketTypes.find((tt) => tt.seatZoneId === zone.id) ?? null;
  }, [concert]);

  const handleSeatClick = useCallback((zone: SeatZone, rowIdx: number, colIdx: number) => {
    const tt = getTicketTypeForZone(zone);
    if (!tt) return;

    const seatId = `${zone.id}-${rowIdx}-${colIdx}`;
    const alreadySelectedIdx = selectedSeats.findIndex((s) => s.seatId === seatId);

    // Deselect
    if (alreadySelectedIdx !== -1) {
      setSelectedSeats((prev) => prev.filter((s) => s.seatId !== seatId));
      return;
    }

    // Check taken
    const takenRatio = tt.soldQuantity / tt.totalQuantity;
    if (takenSeats.has(seatId) || isSeatTaken(zone.id, rowIdx, colIdx, takenRatio)) return;

    const rowLabel = ROW_LABELS[rowIdx] ?? String(rowIdx + 1);
    setSelectedSeats((prev) => [...prev, {
      seatId,
      zoneName: zone.name,
      zoneColor: zone.color,
      ticketTypeId: tt.id,
      ticketTypeName: tt.name,
      price: tt.price,
      row: rowLabel,
      col: colIdx + 1,
    }]);
  }, [getTicketTypeForZone, selectedSeats, takenSeats]);

  const handleContinue = () => {
    if (!orderData || selectedSeats.length === 0) return;

    // Group selected seats → items
    const grouped: Record<string, { ticketTypeId: string; quantity: number; unitPrice: number }> = {};
    for (const seat of selectedSeats) {
      if (grouped[seat.ticketTypeId]) grouped[seat.ticketTypeId].quantity += 1;
      else grouped[seat.ticketTypeId] = { ticketTypeId: seat.ticketTypeId, quantity: 1, unitPrice: seat.price };
    }
    const items = Object.values(grouped);
    const totalPrice = selectedSeats.reduce((s, x) => s + x.price, 0);

    sessionStorage.setItem("pendingOrder", JSON.stringify({ ...orderData, items, totalPrice, selectedSeats }));
    navigate("/checkout");
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isUrgent = timeLeft < 120;
  const totalPrice = selectedSeats.reduce((s, x) => s + x.price, 0);

  if (expired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 pt-20" style={{ background: "#08080E" }}>
        <div className="rounded-2xl p-8 text-center max-w-sm w-full" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#E8315B" }} />
          <h2 className="mb-2 text-lg font-semibold" style={{ color: "#F0EDEB", fontFamily: "'Cormorant Garamond', serif" }}>Phiên giữ chỗ đã hết hạn</h2>
          <p className="text-sm mb-6" style={{ color: "#8585A0" }}>Thời gian giữ chỗ 10 phút đã hết. Vui lòng quay lại và thử lại.</p>
          <Link to={`/concerts/${slug}`} className="block w-full py-3 rounded-xl text-sm font-semibold text-center" style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff" }}>
            Quay lại trang sự kiện
          </Link>
        </div>
      </div>
    );
  }

  if (!orderData || !concert) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#08080E", color: "#F0EDEB" }}><p>Đang tải...</p></div>;
  }

  const activeZone = concert.seatZones.find((z) => z.id === selectedZoneId);
  const dims = activeZone ? getGridDims(activeZone.capacity) : { rows: 0, cols: 0 };

  return (
    <div style={{ background: "#08080E", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingTop: "4.5rem" }}>
      {/* Header bar */}
      <div
        className="sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between"
        style={{ background: "rgba(8,8,14,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#F0EDEB" }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs" style={{ color: "#8585A0" }}>Chọn chỗ ngồi</p>
            <p className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>{concert.title}</p>
          </div>
        </div>

        {/* Hold timer */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: isUrgent ? "rgba(232,49,91,0.12)" : "rgba(245,200,66,0.08)", border: `1px solid ${isUrgent ? "rgba(232,49,91,0.3)" : "rgba(245,200,66,0.2)"}` }}
        >
          <Clock className="w-3.5 h-3.5" style={{ color: isUrgent ? "#E8315B" : "#F5C842" }} />
          <span className="text-sm font-mono font-semibold" style={{ color: isUrgent ? "#E8315B" : "#F5C842" }}>{formatTimer(timeLeft)}</span>
          <span className="text-xs" style={{ color: "#8585A0" }}>còn lại</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Seat map */}
        <div className="lg:col-span-2 space-y-4">
          {/* Zone selector tabs */}
          {concert.seatZones.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {concert.seatZones.map((zone) => {
                const tt = getTicketTypeForZone(zone);
                const selectedInZone = selectedSeats.filter((s) => s.ticketTypeId === tt?.id).length;
                return (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedZoneId(zone.id)}
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: selectedZoneId === zone.id ? `${zone.color}22` : "rgba(255,255,255,0.04)",
                      border: selectedZoneId === zone.id ? `1px solid ${zone.color}66` : "1px solid rgba(255,255,255,0.07)",
                      color: selectedZoneId === zone.id ? zone.color : "#8585A0",
                    }}
                  >
                    <div className="w-2 h-2 rounded-sm" style={{ background: zone.color }} />
                    {zone.name}
                    {tt && <span className="text-xs opacity-70">{formatCurrency(tt.price)}</span>}
                    {selectedInZone > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: `${zone.color}25`, color: zone.color }}>
                        {selectedInZone}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Stage */}
          <div className="flex justify-center">
            <div className="px-10 py-2 rounded-lg text-xs font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "#F0EDEB", border: "1px solid rgba(255,255,255,0.12)" }}>
              🎤 SÂN KHẤU
            </div>
          </div>

          {/* Seat grid */}
          {activeZone && (() => {
            const tt = getTicketTypeForZone(activeZone);
            const takenRatio = tt ? tt.soldQuantity / tt.totalQuantity : 0.3;
            const hasTicketType = !!tt;
            return (
              <div className="rounded-2xl p-5 overflow-x-auto" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: activeZone.color }}>{activeZone.name}</span>
                    {tt && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${activeZone.color}20`, color: activeZone.color }}>{formatCurrency(tt.price)} / ghế</span>}
                  </div>
                  <span className="text-xs" style={{ color: "#8585A0" }}>{activeZone.capacity.toLocaleString("vi-VN")} chỗ</span>
                </div>

                {/* Legend */}
                <div className="flex gap-4 mb-4 flex-wrap">
                  {[
                    { label: "Còn trống", bg: `${activeZone.color}22`, border: `${activeZone.color}55` },
                    { label: "Đã chọn", bg: activeZone.color, border: activeZone.color },
                    { label: "Đã bán", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.04)" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: "#8585A0" }}>
                      <div className="w-4 h-4 rounded-sm" style={{ background: l.bg, border: `1px solid ${l.border}` }} />
                      {l.label}
                    </div>
                  ))}
                </div>

                {!hasTicketType ? (
                  <p className="text-xs text-center py-6" style={{ color: "#8585A0" }}>Khu vực này chưa có loại vé tương ứng</p>
                ) : (
                  <div className="inline-block min-w-full">
                    {Array.from({ length: dims.rows }).map((_, rowIdx) => {
                      const rowLabel = ROW_LABELS[rowIdx] ?? String(rowIdx + 1);
                      return (
                        <div key={rowIdx} className="flex items-center gap-1 mb-1">
                          <span className="w-5 text-center text-xs flex-shrink-0" style={{ color: "#8585A0" }}>{rowLabel}</span>
                          <div className="flex gap-1 flex-wrap">
                            {Array.from({ length: dims.cols }).map((_, colIdx) => {
                              const seatId = `${activeZone.id}-${rowIdx}-${colIdx}`;
                              const isPreTaken = isSeatTaken(activeZone.id, rowIdx, colIdx, takenRatio);
                              const isTaken = isPreTaken || takenSeats.has(seatId);
                              const isSelected = selectedSeats.some((s) => s.seatId === seatId);
                              return (
                                <button
                                  key={colIdx}
                                  onClick={() => !isTaken && handleSeatClick(activeZone, rowIdx, colIdx)}
                                  disabled={isTaken}
                                  className="w-5 h-5 rounded-sm transition-all"
                                  style={{
                                    background: isSelected ? activeZone.color : isTaken ? "rgba(255,255,255,0.06)" : `${activeZone.color}22`,
                                    border: isSelected ? `1px solid ${activeZone.color}` : isTaken ? "1px solid rgba(255,255,255,0.04)" : `1px solid ${activeZone.color}44`,
                                    cursor: isTaken ? "not-allowed" : "pointer",
                                    opacity: isTaken ? 0.25 : 1,
                                  }}
                                  title={isTaken ? "Đã bán" : isSelected ? `${rowLabel}${colIdx + 1} – Đã chọn` : `${rowLabel}${colIdx + 1}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {concert.seatZones.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ color: "#8585A0" }}>Sự kiện này không có sơ đồ ghế ngồi</p>
            </div>
          )}
        </div>

        {/* Right — Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            {/* Selected seats list */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>Ghế đã chọn</h3>
                <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>{selectedSeats.length} ghế · Chọn tối thiểu 1 ghế</p>
              </div>

              <div className="p-4 space-y-2 min-h-[100px]">
                {selectedSeats.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: "#8585A0" }}>Chưa chọn ghế nào</p>
                ) : (
                  selectedSeats.map((seat) => (
                    <div key={seat.seatId} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: seat.zoneColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium" style={{ color: "#F0EDEB" }}>
                          {seat.zoneName} · Hàng {seat.row}, Ghế {seat.col}
                        </p>
                        <p className="text-xs" style={{ color: seat.zoneColor }}>{formatCurrency(seat.price)}</p>
                      </div>
                      <button
                        onClick={() => setSelectedSeats((prev) => prev.filter((s) => s.seatId !== seat.seatId))}
                        className="p-1 rounded transition-colors hover:bg-white/10 flex-shrink-0"
                        style={{ color: "#8585A0" }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {selectedSeats.length > 0 && (
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-xs" style={{ color: "#8585A0" }}>Tổng cộng</span>
                  <span className="font-semibold text-sm" style={{ color: "#F5C842" }}>{formatCurrency(totalPrice)}</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={handleContinue}
              disabled={selectedSeats.length === 0}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={
                selectedSeats.length > 0
                  ? { background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff", boxShadow: "0 8px 24px rgba(232,49,91,0.3)" }
                  : { background: "rgba(255,255,255,0.05)", color: "#8585A0" }
              }
            >
              {selectedSeats.length > 0 ? `Thanh toán ${formatCurrency(totalPrice)} →` : "Chọn ít nhất 1 ghế"}
            </button>

            {isUrgent && (
              <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: "rgba(232,49,91,0.1)", border: "1px solid rgba(232,49,91,0.25)" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#E8315B" }} />
                <p className="text-xs" style={{ color: "#E8315B" }}>Thời gian giữ chỗ sắp hết! Hãy thanh toán ngay.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
