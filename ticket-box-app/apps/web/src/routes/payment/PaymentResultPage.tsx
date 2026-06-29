import { CheckCircle2, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

// Trang hiển thị kết quả sau khi backend xử lý VNPAY return rồi redirect về đây.
// Trạng thái thật đã được backend verify chữ ký + confirm đơn; trang này chỉ hiển thị.
export function PaymentResultPage() {
  const [params] = useSearchParams();
  const success = params.get("status") === "success";
  const orderId = params.get("order_id") ?? "";
  const code = params.get("code") ?? "";

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

      <div className="mt-4 flex gap-3">
        <Link
          to="/events"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Tiếp tục mua vé
        </Link>
        <Link
          to="/"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
