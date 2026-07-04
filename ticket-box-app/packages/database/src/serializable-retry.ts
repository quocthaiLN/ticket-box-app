import { Prisma } from "@prisma/client";

/**
 * Dưới isolation level Serializable, PostgreSQL có thể abort một transaction khi
 * phát hiện xung đột với transaction chạy song song (serialization failure /
 * deadlock). Đây là lỗi *tạm thời* — cách xử lý đúng là chạy lại transaction.
 *
 * Prisma bề mặt lỗi này theo 2 cách:
 *   - P2034: "write conflict or deadlock" (đường ORM)
 *   - PG SQLSTATE 40001 (serialization_failure) / 40P01 (deadlock_detected)
 *     lẫn trong message khi dùng $queryRaw / $executeRaw
 *
 * Các lỗi nghiệp vụ (typed error, ApiError, …) KHÔNG khớp điều kiện dưới đây nên
 * sẽ ném ra ngay, không bị retry.
 */
function isRetryableTxError(err: unknown): boolean {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2034"
  ) {
    return true;
  }
  const message = err instanceof Error ? err.message : "";
  return message.includes("40001") || message.includes("40P01");
}

export type SerializableRetryOptions = {
  /** Số lần thử tối đa (bao gồm lần đầu). Mặc định 3. */
  maxAttempts?: number;
  /** Backoff cơ sở tính bằng ms. Mặc định 25ms. */
  baseDelayMs?: number;
};

/**
 * Chạy `fn` (thường là một lời gọi prisma.$transaction) với retry khi gặp
 * serialization failure. Backoff tăng dần kèm jitter để tránh các transaction
 * cùng đụng độ lại đồng loạt.
 */
export async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  options: SerializableRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 25;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryableTxError(err) || attempt === maxAttempts) {
        throw err;
      }
      lastError = err;
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * baseDelayMs;
      await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
    }
  }
  // Không bao giờ tới đây, nhưng giữ cho TypeScript yên tâm.
  throw lastError;
}
