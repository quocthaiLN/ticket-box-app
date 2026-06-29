import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, CreditCard, Smartphone, ShieldCheck, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { CONCERTS, formatCurrency } from "../data/mockData";

type PaymentMethod = "vnpay" | "momo" | "card";
type CheckoutStep = "review" | "payment" | "processing" | "success";

interface CartItem {
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
}

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
  items: CartItem[];
  totalPrice: number;
  expiresAt?: number;
  selectedSeats?: SelectedSeat[];
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>("review");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("vnpay");
  const [timeLeft, setTimeLeft] = useState(600);
  const [orderData, setOrderData] = useState<PendingOrder | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("pendingOrder");
    if (!raw) { navigate("/"); return; }
    const parsed: PendingOrder = JSON.parse(raw);
    setOrderData(parsed);
    if (parsed.expiresAt) {
      const remaining = Math.max(0, Math.floor((parsed.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (!orderData?.expiresAt) return;
    if (step !== "review" && step !== "payment") return;
    const expiresAt = orderData.expiresAt;
    const timer = setInterval(() => {
      const remaining = Math.floor((expiresAt - Date.now()) / 1000);
      if (remaining <= 0) { clearInterval(timer); navigate("/"); setTimeLeft(0); return; }
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [step, navigate, orderData]);

  const concert = orderData ? CONCERTS.find((c) => c.id === orderData.concertId) : null;

  const getTicketType = (id: string) =>
    concert?.ticketTypes.find((tt) => tt.id === id);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handlePay = () => {
    setStep("processing");
    setTimeout(() => setStep("success"), 2500);
  };

  if (!orderData || !concert) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20" style={{ background: "#08080E", color: "#F0EDEB" }}>
        <p>Giỏ hàng trống. <Link to="/" style={{ color: "#F5C842" }}>Quay về trang chủ</Link></p>
      </div>
    );
  }

  return (
    <div style={{ background: "#08080E", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingTop: "4.5rem" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {step !== "success" && (
              <button onClick={() => navigate(-1)} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#F0EDEB" }}>
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem", color: "#F0EDEB", fontWeight: 600 }}>
              {step === "success" ? "Đặt vé thành công!" : "Thanh toán"}
            </h1>
          </div>

          {(step === "review" || step === "payment") && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: timeLeft < 60 ? "rgba(232,49,91,0.15)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Clock className="w-4 h-4" style={{ color: timeLeft < 60 ? "#E8315B" : "#F5C842" }} />
              <span className="text-sm font-medium" style={{ color: timeLeft < 60 ? "#E8315B" : "#F5C842" }}>
                {formatTimer(timeLeft)}
              </span>
            </div>
          )}
        </div>

        {/* Steps indicator */}
        {step !== "success" && step !== "processing" && (
          <div className="flex items-center gap-2 mb-8">
            <StepDot active={step === "review"} done={step === "payment"} label="1. Xem lại đơn" />
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
            <StepDot active={step === "payment"} done={false} label="2. Thanh toán" />
          </div>
        )}

        {/* Processing */}
        {step === "processing" && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: "rgba(245,200,66,0.1)" }}>
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "#F5C842 transparent transparent transparent" }} />
            </div>
            <p className="text-sm" style={{ color: "#8585A0" }}>Đang xử lý thanh toán...</p>
          </div>
        )}

        {/* Success */}
        {step === "success" && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6" style={{ background: "rgba(45,190,108,0.15)", border: "2px solid rgba(45,190,108,0.3)" }}>
              <CheckCircle2 className="w-10 h-10" style={{ color: "#2DBE6C" }} />
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 600 }} className="mb-2">
              Chúc mừng! Đặt vé thành công
            </h2>
            <p className="text-sm mb-2" style={{ color: "#8585A0" }}>
              Vé điện tử đã được gửi đến email của bạn. Mang mã QR đến cổng để check-in.
            </p>
            <p className="text-xs mb-8" style={{ color: "#8585A0" }}>
              Mã đơn hàng: <span style={{ color: "#F5C842" }}>TB-{Date.now().toString(36).toUpperCase()}</span>
            </p>

            {/* Ticket preview */}
            <div
              className="max-w-md mx-auto p-5 rounded-2xl mb-6 text-left"
              style={{ background: "#111118", border: "1px solid rgba(245,200,66,0.2)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
                  style={{ background: "#1A1A24" }}
                >
                  <img src={concert.coverImageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: "#F0EDEB" }}>{concert.title}</p>
                  <p className="text-xs" style={{ color: "#8585A0" }}>{concert.artistName}</p>
                </div>
              </div>

              <div className="space-y-1 mb-4">
                {orderData.items.map((item) => {
                  const tt = getTicketType(item.ticketTypeId);
                  return (
                    <div key={item.ticketTypeId} className="flex justify-between text-xs">
                      <span style={{ color: "#8585A0" }}>{tt?.name} × {item.quantity}</span>
                      <span style={{ color: "#F0EDEB" }}>{formatCurrency(item.quantity * item.unitPrice)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Simulated QR */}
              <div className="flex justify-center py-4" style={{ borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
                <div
                  className="w-24 h-24 rounded-lg flex items-center justify-center"
                  style={{ background: "#fff" }}
                >
                  <svg viewBox="0 0 80 80" width="80" height="80">
                    {/* Simplified QR pattern */}
                    {[0,1,2,3,4,5,6].map(r => [0,1,2,3,4,5,6].map(c => {
                      const isCorner = (r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3);
                      const val = Math.random() > 0.4 || isCorner;
                      return val ? <rect key={`${r}-${c}`} x={r*11+2} y={c*11+2} width="9" height="9" fill="#0A0A0F" rx="1" /> : null;
                    }))}
                  </svg>
                </div>
              </div>
              <p className="text-xs text-center" style={{ color: "#8585A0" }}>TB-{Date.now().toString(16).toUpperCase().slice(-8)}</p>
            </div>

            <div className="flex gap-3 justify-center">
              <Link
                to="/my-tickets"
                className="px-6 py-3 rounded-xl font-semibold text-sm"
                style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff" }}
              >
                Xem vé của tôi
              </Link>
              <Link
                to="/"
                className="px-6 py-3 rounded-xl font-medium text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "#F0EDEB", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Về trang chủ
              </Link>
            </div>
          </div>
        )}

        {/* Review step */}
        {step === "review" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <SectionCard title="Thông tin sự kiện">
                <div className="flex items-center gap-3">
                  <img src={concert.coverImageUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm" style={{ color: "#F0EDEB" }}>{concert.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>{concert.artistName}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#8585A0" }}>{new Date(concert.startsAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" })} · {concert.venue.name}</p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Chi tiết vé">
                <div className="space-y-2.5">
                  {orderData.items.map((item) => {
                    const tt = getTicketType(item.ticketTypeId);
                    return (
                      <div key={item.ticketTypeId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-sm" style={{ background: tt?.color || "#8585A0" }} />
                          <span className="text-sm" style={{ color: "#F0EDEB" }}>{tt?.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "#8585A0" }}>×{item.quantity}</span>
                        </div>
                        <span className="text-sm" style={{ color: "#F0EDEB" }}>{formatCurrency(item.quantity * item.unitPrice)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="text-sm font-medium" style={{ color: "#F0EDEB" }}>Phí dịch vụ</span>
                    <span className="text-sm" style={{ color: "#8585A0" }}>Miễn phí</span>
                  </div>
                </div>
              </SectionCard>

              {orderData.selectedSeats && orderData.selectedSeats.length > 0 && (
                <SectionCard title="Ghế đã chọn">
                  <div className="space-y-2">
                    {orderData.selectedSeats.map((seat) => (
                      <div key={seat.seatId} className="flex items-center gap-3 text-xs">
                        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: seat.zoneColor }} />
                        <span style={{ color: "#F0EDEB" }}>{seat.zoneName} · Hàng {seat.row}, Ghế {seat.col}</span>
                        <span className="ml-auto" style={{ color: "#8585A0" }}>{seat.ticketTypeName}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Thông tin liên hệ">
                <div className="space-y-3">
                  <input
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    placeholder="Họ và tên"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}
                    defaultValue="Nguyễn Văn A"
                  />
                  <input
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    placeholder="Email"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}
                    defaultValue="nguyen@example.com"
                  />
                  <input
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    placeholder="Số điện thoại"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }}
                    defaultValue="0901234567"
                  />
                </div>
              </SectionCard>
            </div>

            <div className="lg:col-span-2">
              <div className="sticky top-20 space-y-4">
                <SectionCard title="Tóm tắt đơn hàng">
                  <div className="space-y-2">
                    {orderData.items.map((item) => {
                      const tt = getTicketType(item.ticketTypeId);
                      return (
                        <div key={item.ticketTypeId} className="flex justify-between text-xs">
                          <span style={{ color: "#8585A0" }}>{tt?.name} ×{item.quantity}</span>
                          <span style={{ color: "#F0EDEB" }}>{formatCurrency(item.quantity * item.unitPrice)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                      <span className="font-semibold text-sm" style={{ color: "#F0EDEB" }}>Tổng cộng</span>
                      <span className="font-semibold text-sm" style={{ color: "#F5C842" }}>{formatCurrency(orderData.totalPrice)}</span>
                    </div>
                  </div>
                </SectionCard>

                <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: "rgba(45,190,108,0.08)", border: "1px solid rgba(45,190,108,0.2)" }}>
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#2DBE6C" }} />
                  <p className="text-xs" style={{ color: "#8585A0" }}>Thanh toán an toàn được bảo mật bởi SSL 256-bit. Vé chính hãng từ TicketBox.</p>
                </div>

                <button
                  onClick={() => setStep("payment")}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff", boxShadow: "0 8px 24px rgba(232,49,91,0.3)" }}
                >
                  Tiếp tục →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment step */}
        {step === "payment" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <SectionCard title="Chọn phương thức thanh toán">
                <div className="space-y-2">
                  <PaymentOption
                    id="vnpay"
                    active={paymentMethod === "vnpay"}
                    onClick={() => setPaymentMethod("vnpay")}
                    label="VNPAY"
                    sublabel="Thẻ ATM, QR, Internet Banking"
                    icon="💳"
                    color="#0066CC"
                  />
                  <PaymentOption
                    id="momo"
                    active={paymentMethod === "momo"}
                    onClick={() => setPaymentMethod("momo")}
                    label="MoMo"
                    sublabel="Ví điện tử MoMo"
                    icon="💜"
                    color="#A50064"
                  />
                  <PaymentOption
                    id="card"
                    active={paymentMethod === "card"}
                    onClick={() => setPaymentMethod("card")}
                    label="Thẻ quốc tế"
                    sublabel="Visa, Mastercard, JCB"
                    icon="💳"
                    color="#F5C842"
                  />
                </div>
              </SectionCard>

              {paymentMethod === "card" && (
                <SectionCard title="Thông tin thẻ">
                  <div className="space-y-3">
                    <input placeholder="Số thẻ" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" defaultValue="4111 1111 1111 1111" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }} />
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="MM/YY" className="px-3 py-2.5 rounded-lg text-sm outline-none" defaultValue="12/28" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }} />
                      <input placeholder="CVV" className="px-3 py-2.5 rounded-lg text-sm outline-none" defaultValue="123" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }} />
                    </div>
                    <input placeholder="Tên chủ thẻ" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" defaultValue="NGUYEN VAN A" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB" }} />
                  </div>
                </SectionCard>
              )}

              {(paymentMethod === "vnpay" || paymentMethod === "momo") && (
                <div
                  className="p-5 rounded-xl text-center"
                  style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <p className="text-sm mb-2" style={{ color: "#8585A0" }}>
                    Bạn sẽ được chuyển hướng đến trang thanh toán của{" "}
                    <span style={{ color: "#F0EDEB" }}>{paymentMethod === "vnpay" ? "VNPAY" : "MoMo"}</span>
                  </p>
                  <div
                    className="inline-block px-4 py-2 rounded-lg text-sm"
                    style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.2)" }}
                  >
                    Môi trường sandbox — không trừ tiền thật
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="sticky top-20 space-y-4">
                <SectionCard title="Xác nhận đơn hàng">
                  <div className="space-y-2">
                    {orderData.items.map((item) => {
                      const tt = getTicketType(item.ticketTypeId);
                      return (
                        <div key={item.ticketTypeId} className="flex justify-between text-xs">
                          <span style={{ color: "#8585A0" }}>{tt?.name} ×{item.quantity}</span>
                          <span style={{ color: "#F0EDEB" }}>{formatCurrency(item.quantity * item.unitPrice)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between pt-2.5 font-semibold text-sm" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", color: "#F0EDEB" }}>
                      <span>Tổng cộng</span>
                      <span style={{ color: "#F5C842" }}>{formatCurrency(orderData.totalPrice)}</span>
                    </div>
                  </div>
                </SectionCard>

                <button
                  onClick={handlePay}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #E8315B, #C41E42)", color: "#fff", boxShadow: "0 8px 30px rgba(232,49,91,0.35)" }}
                >
                  Xác nhận thanh toán {formatCurrency(orderData.totalPrice)}
                </button>
                <button
                  onClick={() => setStep("review")}
                  className="w-full py-2 rounded-xl text-sm transition-colors hover:bg-white/5"
                  style={{ color: "#8585A0" }}
                >
                  ← Quay lại
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "#F0EDEB" }}>{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
        style={{
          background: done ? "#2DBE6C" : active ? "#F5C842" : "rgba(255,255,255,0.1)",
          color: done || active ? "#0A0A0F" : "#8585A0",
        }}
      >
        {done ? "✓" : active ? "●" : "○"}
      </div>
      <span className="text-xs" style={{ color: active ? "#F0EDEB" : "#8585A0" }}>{label}</span>
    </div>
  );
}

function PaymentOption({ id, active, onClick, label, sublabel, icon, color }: {
  id: string; active: boolean; onClick: () => void; label: string; sublabel: string; icon: string; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-all text-left"
      style={{
        background: active ? `${color}15` : "rgba(255,255,255,0.04)",
        border: active ? `1.5px solid ${color}50` : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: "#F0EDEB" }}>{label}</p>
        <p className="text-xs" style={{ color: "#8585A0" }}>{sublabel}</p>
      </div>
      <div
        className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: active ? color : "rgba(255,255,255,0.2)" }}
      >
        {active && <div className="w-2 h-2 rounded-full" style={{ background: color }} />}
      </div>
    </button>
  );
}
