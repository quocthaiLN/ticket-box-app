import { env } from '@ticketbox/config';

// Lỗi trả về ngay khi provider đã dùng hết số request chạy đồng thời được phép.
// Bulkhead không xếp hàng chờ, giúp tránh làm cạn tài nguyên khi provider chậm/lỗi.
export class BulkheadRejectedError extends Error {
  readonly statusCode = 503;
  readonly code = 'PAYMENT_PROVIDER_UNAVAILABLE';

  // Đính kèm trạng thái slot để log/monitoring biết nguyên nhân bị từ chối.
  constructor(provider: string, active: number, limit: number) {
    super(`Bulkhead limit reached for ${provider}: ${active}/${limit} concurrent slots in use`);
    this.name = 'BulkheadRejectedError';
  }
}

export class PaymentBulkhead {
  // Số lời gọi provider đang thực thi trong process hiện tại.
  private active = 0;
  private readonly provider: string;
  private readonly limit: number;

  // Mỗi bulkhead gắn với một provider và giới hạn concurrency riêng.
  constructor(provider: string, limit: number) {
    this.provider = provider;
    this.limit = limit;
  }

  // Chạy lời gọi provider nếu còn slot; nếu hết slot thì fail-fast với lỗi 503.
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      throw new BulkheadRejectedError(this.provider, this.active, this.limit);
    }

    // Giữ slot trong toàn bộ thời gian Promise đang chạy.
    this.active++;
    try {
      return await fn();
    } finally {
      // Luôn trả slot, kể cả khi provider timeout hoặc ném lỗi.
      this.active--;
    }
  }

  // Cung cấp số liệu runtime cho health check hoặc endpoint monitoring.
  getStatus() {
    return {
      provider: this.provider,
      active: this.active,
      limit: this.limit,
      available: this.limit - this.active,
    };
  }
}

export const vnpayBulkhead = new PaymentBulkhead('VNPAY', env.vnpay.bulkheadLimit);
export const momoBulkhead = new PaymentBulkhead('MOMO', env.momo.bulkheadLimit);

// Trả về bulkhead đúng với provider được chọn trong luồng thanh toán.
export function getBulkhead(provider: 'VNPAY' | 'MOMO'): PaymentBulkhead {
  return provider === 'VNPAY' ? vnpayBulkhead : momoBulkhead;
}
