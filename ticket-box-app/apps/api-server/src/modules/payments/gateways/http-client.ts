/**
 * Minimal JSON POST helper with an AbortController timeout. A timed-out or
 * network-failed call rejects, which lets the circuit breaker count it as a
 * failure. Non-2xx responses also reject so the caller treats them uniformly.
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Upstream responded ${res.status}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
