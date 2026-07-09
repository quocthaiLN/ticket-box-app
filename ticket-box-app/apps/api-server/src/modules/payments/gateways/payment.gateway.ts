// Các provider được payment module hỗ trợ tại thời điểm hiện tại.
export type PaymentProvider = 'VNPAY' | 'MOMO';

// Input chung từ Payment service khi bắt đầu một payment attempt. Gateway chuyển
// object này sang tên field, đơn vị tiền và định dạng chữ ký riêng của VNPAY/MoMo.
// Payment service không cần biết contract HTTP cụ thể của từng provider.
export interface CheckoutInput {
  orderId: string; // Mã order nội bộ, dùng làm reference khi provider callback/query.
  amount: string; // Tổng tiền dạng decimal string để tránh mất độ chính xác Number.
  currency: string; // Mã tiền tệ ISO, ví dụ VND.
  orderInfo: string; // Nội dung hiển thị/mô tả giao dịch tại trang thanh toán.
}

// Kết quả chuẩn hóa sau khi provider chấp nhận yêu cầu tạo checkout. Payment service
// lưu kết quả này vào payment record; client dùng payUrl để chuyển user sang provider.
export interface CheckoutResult {
  payUrl: string; // URL thanh toán/redirect do provider trả về hoặc gateway tự tạo.
  providerRef: string; // Mã tham chiếu provider để đối soát nếu khác orderId.
}

// Input chung để hỏi provider trạng thái giao dịch sau khi đã tạo payment. Luồng này
// phục vụ reconciliation khi webhook đến muộn, thất lạc hoặc cần kiểm tra thủ công.
export interface StatusInput {
  orderId: string; // Mã order/reference đã gửi cho provider lúc tạo checkout.
  /** Provider transaction date, format yyyyMMddHHmmss (required by VNPay QueryDR). */
  transactionDate: string;
}

// Kết quả provider được rút gọn cho logic nghiệp vụ: service chỉ cần biết thanh toán
// thành công hay không, nhưng vẫn giữ raw response để audit, debug và đối soát sau này.
export interface StatusResult {
  paid: boolean; // true khi provider xác nhận giao dịch đã thanh toán thành công.
  raw: Record<string, unknown>; // Response gốc đã parse, không phụ thuộc provider cụ thể.
}

// Provider đã phản hồi bình thường nhưng từ chối vì lý do nghiệp vụ. Lỗi này
// không chứng minh hạ tầng provider bị hỏng nên không được mở circuit breaker.
export class ProviderBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderBusinessError';
  }
}

// Contract adapter chung. Payment service gọi qua contract này thay vì biết API
// riêng từng provider; network I/O được service bọc bởi bulkhead/circuit breaker.
export interface PaymentGateway {
  readonly provider: PaymentProvider;
  // True khi createCheckout thực sự gọi mạng tới provider. VNPay chỉ true trong
  // mock mode; sandbox/production vẫn ký URL local.
  readonly checkoutHitsNetwork: boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  queryStatus(input: StatusInput): Promise<StatusResult>;
}
