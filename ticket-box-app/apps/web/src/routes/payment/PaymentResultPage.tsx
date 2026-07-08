import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  clearPendingCheckout,
  readHeldCheckouts,
  writePendingCheckout,
} from "../audience/checkout-storage";

// Trang hiển thị kết quả sau khi backend xử lý VNPAY return rồi redirect về đây.
// Trạng thái thật đã được backend verify chữ ký + confirm đơn; trang này chỉ hiển thị.
export function PaymentResultPage() {
  const [params] = useSearchParams();
  const success = params.get("status") === "success";
  const orderId = params.get("order_id") ?? "";
  const code = params.get("code") ?? "";
  const [remainingHeldCount, setRemainingHeldCount] = useState(0);

  useEffect(() => {
    if (!orderId) return;

    // The verified return has finished this payment flow, successfully or not.
    // Remove its order from local checkout state and activate the next HELD order.
    clearPendingCheckout(orderId);
    const remaining = readHeldCheckouts().filter((checkout) => checkout.expiresAt > Date.now());
    const nextCheckout = remaining[0];
    if (nextCheckout) writePendingCheckout(nextCheckout);
    setRemainingHeldCount(remaining.length);
  }, [orderId]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      {success ? (
        <CheckCircle2 className="h-16 w-16 text-green-500" />
      ) : (
        <XCircle className="h-16 w-16 text-red-500" />
      )}

      <h1 className="text-2xl font-semibold">
        {success ? "Thanh toán thành công" : "Thanh toán thất bại"}
      </h1>

      <p className="text-muted-foreground">
        {success
          ? "Vé của bạn đã được xác nhận. Kiểm tra trong My Tickets."
          : "Giao dịch chưa hoàn tất. Bạn có thể thử thanh toán lại."}
      </p>

      {orderId && (
        <p className="text-sm text-muted-foreground">
          Mã đơn: <span className="font-mono">{orderId}</span>
          {code && !success ? ` · Mã lỗi VNPAY: ${code}` : ""}
        </p>
      )}

      {remainingHeldCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Bạn còn {remainingHeldCount} đơn vé đang được giữ và chưa thanh toán.
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {remainingHeldCount > 0 && (
          <Link
            to="/checkout"
            className="rounded-md border-2 border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Thanh toán đơn tiếp theo
          </Link>
        )}
        <Link
          to="/events"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Tiếp tục mua vé
        </Link>
        <Link
          to="/"
          className={
            remainingHeldCount > 0
              ? "rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              : "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          }
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
