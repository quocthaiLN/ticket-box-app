export type FaultMode = 'ok' | 'fail' | 'timeout';

export interface ProviderControl {
  mode: FaultMode;
  latencyMs: number;
  failRate: number; // 0..1 — probability a request fails even in 'ok' mode
}

export type Provider = 'momo' | 'vnpay';

const defaults = (): ProviderControl => ({ mode: 'ok', latencyMs: 0, failRate: 0 });

/**
 * In-memory fault-injection knobs, set per provider via POST /__control/:provider.
 * Lets resilience tests deterministically trip the circuit breaker (mode=fail)
 * or saturate the bulkhead (mode=timeout / high latencyMs).
 */
export class ControlStore {
  private state: Record<Provider, ProviderControl> = {
    momo: defaults(),
    vnpay: defaults(),
  };

  get(provider: Provider): ProviderControl {
    return this.state[provider];
  }

  set(provider: Provider, patch: Partial<ProviderControl>): ProviderControl {
    this.state[provider] = { ...this.state[provider], ...patch };
    return this.state[provider];
  }

  reset(): void {
    this.state = { momo: defaults(), vnpay: defaults() };
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface FaultDecision {
  fail: boolean;
}

/**
 * Applies the configured latency, then decides whether this call should fail.
 * 'timeout' holds the response open long enough for the client's AbortController
 * to fire first (the client never sees a response).
 */
export async function applyFault(control: ProviderControl): Promise<FaultDecision> {
  if (control.mode === 'timeout') {
    await sleep(control.latencyMs > 0 ? control.latencyMs : 60_000);
    return { fail: true };
  }

  if (control.latencyMs > 0) {
    await sleep(control.latencyMs);
  }

  if (control.mode === 'fail') {
    return { fail: true };
  }

  if (control.failRate > 0 && Math.random() < control.failRate) {
    return { fail: true };
  }

  return { fail: false };
}
