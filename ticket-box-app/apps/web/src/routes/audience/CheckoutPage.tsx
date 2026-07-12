import { AlertCircle, CheckCircle2, ChevronLeft, Clock, CreditCard, ExternalLink, Loader2, QrCode, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createOrder,
  createPayment,
  getOrder,
  newIdempotencyKey,
  type OrderDetail,
  type PaymentProvider,
} from "../../services/order.service";
import { ApiClientError, getApiErrorCode } from "../../lib/api-client";
import {
  clearPendingCheckout,
  formatCountdown,
  readHeldCheckouts,
  readPendingCheckout,
  remainingSeconds,
  writePendingCheckout,
  type PendingCheckout,
} from "./checkout-storage";

type CheckoutStep = "review" | "payment" | "processing" | "success";

// Thông báo tiếng Việt theo mã lỗi — không hiển thị detail thô của server
// (tiếng Anh + UUID nội bộ) cho người dùng cuối.
const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  SALE_WINDOW_CLOSED: "Vé chưa tới giờ mở bán hoặc đã hết thời gian bán. Vui lòng kiểm tra giờ mở bán trên trang sự kiện.",
  TICKET_TYPE_NOT_ON_SALE: "Loại vé này hiện không mở bán. Vui lòng chọn lại vé trên trang sự kiện.",
  TICKET_TYPE_NOT_FOUND: "Loại vé không còn tồn tại. Vui lòng chọn lại vé trên trang sự kiện.",
  TICKET_SOLD_OUT: "Rất tiếc, loại vé này vừa hết. Vui lòng chọn loại vé khác.",
  PER_USER_LIMIT_EXCEEDED: "Bạn đã đạt giới hạn số vé được mua cho loại vé này.",
  ORDER_NOT_HELD: "Đơn hàng đã hết hạn giữ vé. Vui lòng chọn vé và tạo đơn mới.",
};

function checkoutErrorMessage(err: unknown, fallback: string): string {
  const code = getApiErrorCode(err);
  if (code === "RATE_LIMITED") {
    if (err instanceof ApiClientError && err.retryAfter) {
      return `Bạn đang thao tác quá nhanh. Vui lòng thử lại sau ${err.retryAfter} giây.`;
    }
    return "Bạn đang thao tác quá nhanh. Vui lòng thử lại sau giây lát.";
  }
  if (code && CHECKOUT_ERROR_MESSAGES[code]) return CHECKOUT_ERROR_MESSAGES[code];
  return err instanceof Error && err.message ? err.message : fallback;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const checkoutDraft = (location.state as { checkoutDraft?: PendingCheckout } | null)?.checkoutDraft;
  const [pending, setPending] = useState<PendingCheckout | null>(() => checkoutDraft ?? readPendingCheckout());
  const [step, setStep] = useState<CheckoutStep>("review");
  const [timeLeft, setTimeLeft] = useState(() => remainingSeconds((checkoutDraft ?? readPendingCheckout())?.expiresAt ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [failedProviders, setFailedProviders] = useState<PaymentProvider[]>([]);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [heldCheckouts, setHeldCheckouts] = useState<PendingCheckout[]>(() => readHeldCheckouts());

  useEffect(() => {
    if (!pending || pending.items.length === 0) {
      navigate("/events", { replace: true });
      return;
    }
    setTimeLeft(remainingSeconds(pending.expiresAt));
  }, [navigate, pending]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!pending) return;
      const remaining = remainingSeconds(pending.expiresAt);
      setTimeLeft(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  useEffect(() => {
    if (!pending?.orderId) return;
    setOrder(null);
    let stopped = false;
    let timeoutId: number | undefined;
    let pollAttempt = 0;

    const scheduleNextPoll = (delayMs: number) => {
      if (stopped) return;
      timeoutId = window.setTimeout(() => {
        timeoutId = undefined;
        void poll();
      }, delayMs);
    };

    const poll = async () => {
      if (document.hidden) return;

      try {
        const detail = await getOrder(pending.orderId!);
        if (stopped) return;
        setOrder(detail);
        if (detail.status === "CONFIRMED") {
          clearPendingCheckout(detail.id);
          setHeldCheckouts(readHeldCheckouts());
          setStep("success");
        } else if (detail.status === "CANCELLED" || detail.status === "EXPIRED") {
          setStep("payment");
        } else {
          const delays = [3_000, 5_000, 10_000];
          const delay = delays[Math.min(pollAttempt, delays.length - 1)];
          pollAttempt += 1;
          scheduleNextPoll(delay);
        }
      } catch (err) {
        // Keep the checkout screen stable; manual retry remains available.
        const retryAfterMs = err instanceof ApiClientError && err.retryAfter
          ? err.retryAfter * 1_000
          : 10_000;
        scheduleNextPoll(retryAfterMs);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        timeoutId = undefined;
        return;
      }
      if (timeoutId === undefined) void poll();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void poll();
    return () => {
      stopped = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pending?.orderId]);

  const orderStatus = order?.status ?? (pending?.orderId ? "HELD" : null);
  const paymentStatus = order?.payment?.status ?? null;
  const isExpired = timeLeft <= 0 && step !== "success";

  const providerLabel = pending?.paymentProvider === "MOMO" ? "MoMo" : "VNPAY";

  async function submitOrder() {
    if (!pending || pending.items.length === 0) return;
    setBusy(true);
    setError("");
    setPaymentError("");
    setStep("processing");
    try {
      const result = await createOrder(
        {
          concert_id: pending.concertId,
          items: pending.items.map((item) => ({
            ticket_type_id: item.ticketTypeId,
            quantity: item.quantity,
          })),
        },
        pending.idempotencyKey,
      );
      const nextPending = {
        ...pending,
        orderId: result.order_id,
        expiresAt: result.hold_expires_at ? new Date(result.hold_expires_at).getTime() : pending.expiresAt,
      };
      writePendingCheckout(nextPending);
      setPending(nextPending);
      setHeldCheckouts(readHeldCheckouts());
      setTimeLeft(remainingSeconds(nextPending.expiresAt));
      setStep("payment");
    } catch (err) {
      setError(checkoutErrorMessage(err, "Không thể tạo đơn hàng."));
      setStep("payment");
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment() {
    if (!pending?.orderId) return;
    setBusy(true);
    setError("");
    setPaymentError("");
    setStep("processing");
    try {
      const paymentIdempotencyKey = pending.paymentIdempotencyKey ?? newIdempotencyKey();
      const pendingPayment = {
        ...pending,
        paymentIdempotencyKey,
      };

      // Persist before the request so a retry/reload reuses the same operation key
      // even when the backend succeeds but its response never reaches the browser.
      writePendingCheckout(pendingPayment);
      setPending(pendingPayment);
      setHeldCheckouts(readHeldCheckouts());

      const result = await createPayment(
        pending.orderId,
        pendingPayment.paymentProvider,
        paymentIdempotencyKey,
      );
      const nextPending = {
        ...pendingPayment,
        checkoutUrl: result.checkout_url,
        expiresAt: new Date(result.hold_expires_at).getTime(),
      };
      writePendingCheckout(nextPending);
      setPending(nextPending);
      setHeldCheckouts(readHeldCheckouts());
      setTimeLeft(remainingSeconds(nextPending.expiresAt));
      setStep("payment");
      // Redirect in the current tab so browser popup policies cannot block checkout.
      window.location.assign(result.checkout_url);
    } catch (err) {
      if (getApiErrorCode(err) === "PAYMENT_PROVIDER_UNAVAILABLE") {
        const failedProvider = pending.paymentProvider;
        const nextFailed = failedProviders.includes(failedProvider)
          ? failedProviders
          : [...failedProviders, failedProvider];
        setFailedProviders(nextFailed);
        setPaymentError(
          nextFailed.length === 2
            ? "Các cổng thanh toán đang tạm thời không khả dụng. Vé vẫn được giữ, vui lòng thử lại."
            : `${failedProvider === "MOMO" ? "MoMo" : "VNPAY"} đang tạm thời không khả dụng.`,
        );
      } else {
        setPaymentError("");
        setError(checkoutErrorMessage(err, "Không thể tạo yêu cầu thanh toán."));
      }
      setStep("payment");
    } finally {
      setBusy(false);
    }
  }

  async function refreshOrder() {
    if (!pending?.orderId) return;
    setBusy(true);
    setError("");
    try {
      const detail = await getOrder(pending.orderId);
      setOrder(detail);
      if (detail.status === "CONFIRMED") {
        clearPendingCheckout(detail.id);
        setHeldCheckouts(readHeldCheckouts());
        setStep("success");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kiểm tra đơn hàng.");
    } finally {
      setBusy(false);
    }
  }

  function updateProvider(provider: PaymentProvider) {
    if (!pending || pending.checkoutUrl) return;
    const next = {
      ...pending,
      paymentProvider: provider,
      paymentIdempotencyKey: undefined,
    };
    if (next.orderId) writePendingCheckout(next);
    setPending(next);
    if (next.orderId) setHeldCheckouts(readHeldCheckouts());
    setError("");
    setPaymentError("");
  }

  function selectHeldCheckout(checkout: PendingCheckout) {
    writePendingCheckout(checkout);
    setPending(checkout);
    setOrder(null);
    setTimeLeft(remainingSeconds(checkout.expiresAt));
    setStep("payment");
    setError("");
    setPaymentError("");
    setFailedProviders([]);
  }

  const otherHeldCheckouts = useMemo(
    () => heldCheckouts.filter(
      (checkout) => checkout.orderId !== pending?.orderId && checkout.expiresAt > Date.now(),
    ),
    [heldCheckouts, pending?.orderId, timeLeft],
  );

  if (!pending) return null;

  if (step === "success" || order?.status === "CONFIRMED") {
    return <SuccessState order={order} />;
  }

  if (isExpired && otherHeldCheckouts.length === 0) {
    return <ExpiredState concertId={pending.concertId} />;
  }

  return (
    <main className="min-h-screen bg-[#08080E] px-4 pb-12 pt-24 text-[#F0EDEB] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="rounded-lg p-2 text-[#F0EDEB] hover:bg-white/10" aria-label="Quay lại">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs text-[#8585A0]">Thanh toán</p>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                Xác nhận đơn vé
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#F5C842]/25 bg-[#F5C842]/10 px-3 py-2 text-sm font-semibold text-[#F5C842]">
            <Clock className="h-4 w-4" />
            {formatCountdown(timeLeft)}
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-[#E8315B]/25 bg-[#E8315B]/10 px-4 py-3 text-sm text-[#E8315B]">
            {error}
          </div>
        )}

        {otherHeldCheckouts.length > 0 && (
          <section className="mb-5 rounded-2xl border border-[#F5C842]/25 bg-[#F5C842]/10 p-4">
            <p className="text-sm font-semibold text-[#F5C842]">
              Bạn còn {otherHeldCheckouts.length} đơn vé đang giữ
            </p>
            <p className="mt-1 text-xs text-[#8585A0]">Mỗi đơn cần được thanh toán riêng trước khi hết thời gian giữ vé.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {otherHeldCheckouts.map((checkout) => (
                <button
                  key={checkout.orderId}
                  type="button"
                  onClick={() => selectHeldCheckout(checkout)}
                  className="rounded-lg border border-[#F5C842]/25 bg-[#08080E]/40 px-3 py-2 text-left text-xs text-[#F0EDEB] hover:border-[#F5C842]/60"
                >
                  <span className="block font-semibold">{checkout.items.reduce((sum, item) => sum + item.quantity, 0)} vé · {formatMoney(checkout.totalPrice)}</span>
                  <span className="mt-0.5 block text-[#8585A0]">Còn {formatCountdown(remainingSeconds(checkout.expiresAt))}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mb-8 flex items-center gap-2">
          <StepDot active={step === "review"} done={step !== "review"} label="1. Xem lại" />
          <div className="h-px flex-1 bg-white/10" />
          <StepDot active={step === "payment" || step === "processing"} done={false} label="2. Thanh toán" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <SectionCard title="Thông tin sự kiện">
              <div className="flex items-center gap-3">
                {pending.coverImageUrl && <img src={pending.coverImageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{pending.concertTitle}</p>
                  <p className="mt-1 text-xs text-[#8585A0]">{pending.artistName}</p>
                  <p className="mt-1 text-xs text-[#8585A0]">{pending.venueName}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Chi tiết vé">
              <div className="space-y-2.5">
                {pending.items.map((item) => (
                  <div key={item.ticketTypeId} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.zoneColor }} />
                      <span className="break-words text-sm">{item.ticketTypeName}</span>
                      <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-xs text-[#8585A0]">x{item.quantity}</span>
                    </div>
                    <span className="text-sm">{formatMoney(item.quantity * item.unitPrice)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-white/10 pt-3 text-sm">
                  <span className="font-medium">Phí dịch vụ</span>
                  <span className="text-[#8585A0]">Miễn phí</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Chọn phương thức thanh toán">
              <div className="space-y-2">
                <PaymentOption
                  active={pending.paymentProvider === "VNPAY"}
                  disabled={Boolean(pending.checkoutUrl)}
                  icon={<CreditCard className="h-5 w-5" />}
                  label="VNPAY"
                  sublabel="Thẻ ATM, QR, Internet Banking"
                  tone="#0066CC"
                  onClick={() => updateProvider("VNPAY")}
                />
                <PaymentOption
                  active={pending.paymentProvider === "MOMO"}
                  disabled={Boolean(pending.checkoutUrl)}
                  icon={<Smartphone className="h-5 w-5" />}
                  label="MoMo"
                  sublabel="Thanh toán qua ví điện tử MoMo"
                  tone="#A50064"
                  onClick={() => updateProvider("MOMO")}
                />
              </div>
            </SectionCard>

            {pending.orderId && (
              <SectionCard title="Trạng thái đơn hàng">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatusTile label="Đơn hàng" value={orderStatus ?? "HELD"} tone={statusTone(orderStatus)} />
                  <StatusTile label="Thanh toán" value={paymentStatus ?? "PENDING"} tone={statusTone(paymentStatus)} />
                  <StatusTile label="Mã đơn" value={pending.orderId} tone="#7B61FF" />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {pending.checkoutUrl && (
                    <a href={pending.checkoutUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#F5C842]/30 bg-[#F5C842]/10 px-4 py-2.5 text-sm font-semibold text-[#F5C842]">
                      <ExternalLink className="h-4 w-4" />
                      Mở lại cổng {providerLabel}
                    </a>
                  )}
                  <button type="button" onClick={refreshOrder} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-[#F0EDEB] disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Kiểm tra lại
                  </button>
                </div>
              </SectionCard>
            )}
          </section>

          <aside>
            <div className="sticky top-24 space-y-4">
              <SectionCard title="Tóm tắt đơn hàng">
                <div className="space-y-2">
                  {pending.items.map((item) => (
                    <div key={item.ticketTypeId} className="flex justify-between text-xs">
                      <span className="text-[#8585A0]">{item.ticketTypeName} x{item.quantity}</span>
                      <span>{formatMoney(item.quantity * item.unitPrice)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-white/10 pt-3 text-sm font-semibold">
                    <span>Tổng cộng</span>
                    <span className="text-[#F5C842]">{formatMoney(pending.totalPrice)}</span>
                  </div>
                </div>
              </SectionCard>

              <div className="flex items-start gap-2 rounded-xl border border-[#2DBE6C]/20 bg-[#2DBE6C]/10 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2DBE6C]" />
                <p className="text-xs leading-5 text-[#8585A0]">Đơn hàng dùng Idempotency-Key để tránh tạo trùng khi bấm thanh toán nhiều lần.</p>
              </div>

              {!pending.orderId ? (
                <button type="button" onClick={submitOrder} disabled={busy || step === "processing"} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#E8315B] to-[#C41E42] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#E8315B]/25 disabled:opacity-50">
                  {busy || step === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Giữ vé và tiếp tục
                </button>
              ) : (
                <div className="space-y-3">
                  {!pending.checkoutUrl && paymentError && (
                    <div className="rounded-xl border border-[#E8315B]/25 bg-[#E8315B]/10 p-3">
                      <p className="text-sm text-[#E8315B]">{paymentError}</p>
                      <div className="mt-3 grid gap-2">
                        {failedProviders.length === 1 && (
                          <button
                            type="button"
                            onClick={() => updateProvider(failedProviders[0] === "MOMO" ? "VNPAY" : "MOMO")}
                            disabled={busy}
                            className="rounded-lg bg-[#F0EDEB] px-3 py-2.5 text-sm font-semibold text-[#111118] disabled:opacity-50"
                          >
                            Chuyển sang {failedProviders[0] === "MOMO" ? "VNPAY" : "MoMo"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={submitPayment}
                          disabled={busy || isExpired}
                          className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-semibold text-[#F0EDEB] disabled:opacity-50"
                        >
                          {busy ? "Đang thử lại..." : `Thử lại ${providerLabel}`}
                        </button>
                      </div>
                    </div>
                  )}
                  {!pending.checkoutUrl && !paymentError && (
                    <button type="button" onClick={submitPayment} disabled={busy || isExpired} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#E8315B] to-[#C41E42] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#E8315B]/25 disabled:opacity-50">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      {failedProviders.includes(pending.paymentProvider) ? "Thử lại" : "Gửi yêu cầu thanh toán qua"} {providerLabel}
                    </button>
                  )}
                  <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center text-xs text-[#8585A0]">
                    {pending.checkoutUrl
                      ? "Đang chờ xác nhận từ cổng thanh toán. Trang này tự kiểm tra mỗi 3 giây."
                      : "Vé đã được giữ. Hãy gửi yêu cầu thanh toán trước khi thời gian giữ vé kết thúc."}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SuccessState({ order }: { order: OrderDetail | null }) {
  return (
    <main className="min-h-screen bg-[#08080E] px-4 pt-28 text-center text-[#F0EDEB]">
      <section className="mx-auto max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#2DBE6C]/30 bg-[#2DBE6C]/15">
          <CheckCircle2 className="h-10 w-10 text-[#2DBE6C]" />
        </div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Đặt vé thành công</h1>
        <p className="mt-3 text-sm leading-6 text-[#8585A0]">Vé điện tử đã được phát hành. Bạn có thể xem mã QR trong mục Vé của tôi.</p>
        {order && <p className="mt-3 text-xs text-[#8585A0]">Mã đơn: <span className="text-[#F5C842]">{order.id}</span></p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/my-tickets" className="inline-flex items-center gap-2 rounded-xl bg-[#E8315B] px-5 py-3 text-sm font-semibold text-white">
            <QrCode className="h-4 w-4" />
            Xem vé của tôi
          </Link>
          <Link to="/" className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm text-[#F0EDEB]">Về trang chủ</Link>
        </div>
      </section>
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111118]">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: done ? "#2DBE6C" : active ? "#F5C842" : "rgba(255,255,255,0.1)", color: done || active ? "#0D0D14" : "#8585A0" }}>
        {done ? "✓" : active ? "•" : ""}
      </span>
      <span className="text-xs" style={{ color: active ? "#F0EDEB" : "#8585A0" }}>{label}</span>
    </div>
  );
}

function PaymentOption({ active, disabled, icon, label, sublabel, tone, onClick }: { active: boolean; disabled?: boolean; icon: React.ReactNode; label: string; sublabel: string; tone: string; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-70" style={{ background: active ? `${tone}18` : "rgba(255,255,255,0.04)", border: active ? `1.5px solid ${tone}66` : "1px solid rgba(255,255,255,0.07)" }}>
      <span style={{ color: tone }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-[#8585A0]">{sublabel}</span>
      </span>
      <span className="flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: active ? tone : "rgba(255,255,255,0.2)" }}>
        {active && <span className="h-2 w-2 rounded-full" style={{ background: tone }} />}
      </span>
    </button>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-[#8585A0]">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold" style={{ color: tone }}>{statusLabel(value)}</p>
    </div>
  );
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    HELD: "Đang giữ",
    CONFIRMED: "Đã xác nhận",
    CANCELLED: "Đã hủy",
    EXPIRED: "Hết hạn",
    PENDING: "Đang chờ",
    SUCCEEDED: "Thành công",
    FAILED: "Thất bại",
    REFUNDED: "Đã hoàn",
  };
  return labels[value] ?? value;
}

function statusTone(value?: string | null) {
  if (value === "CONFIRMED" || value === "SUCCEEDED") return "#2DBE6C";
  if (value === "CANCELLED" || value === "EXPIRED" || value === "FAILED") return "#E8315B";
  if (value === "HELD" || value === "PENDING") return "#F5C842";
  return "#8585A0";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}
