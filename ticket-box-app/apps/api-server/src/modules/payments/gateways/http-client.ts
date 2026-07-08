import { ProviderBusinessError } from './payment.gateway.js';

// HTTP helper dùng chung cho các provider gọi API bằng JSON POST.
// Timeout, lỗi mạng và HTTP khác 2xx đều reject để circuit breaker ghi nhận lỗi.
export async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  // AbortController đảm bảo request không chiếm bulkhead slot vô thời hạn.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Chuẩn hóa body/header cho API provider.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    // Mọi HTTP lỗi được chuyển thành exception cho caller xử lý thống nhất.
    if (!res.ok) {
      if (res.status >= 400 && res.status < 500) {
        throw new ProviderBusinessError(`Upstream rejected request ${res.status}`);
      }
      throw new Error(`Upstream responded ${res.status}`);
    }

    return (await res.json()) as T;
  } finally {
    // Hủy timer dù request thành công, lỗi mạng hay bị abort.
    clearTimeout(timer);
  }
}
