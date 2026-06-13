import express, { type Express } from 'express';
import { ControlStore, type FaultMode, type Provider } from './control.js';
import { momoRouter } from './momo.js';
import { vnpayRouter } from './vnpay.js';

const PROVIDERS: Provider[] = ['momo', 'vnpay'];

interface ControlBody {
  mode?: FaultMode;
  latencyMs?: number;
  failRate?: number;
}

/**
 * Builds the standalone mock payment server. Returns the Express app plus the
 * ControlStore so tests can drive fault injection programmatically (without HTTP).
 */
export function createMockPaymentServer(): { app: Express; control: ControlStore } {
  const control = new ControlStore();
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK' });
  });

  app.use('/momo', momoRouter(control));
  app.use('/vnpay', vnpayRouter(control));

  // ── Fault-injection control ───────────────────────────────────────────────
  app.post('/__control/reset', (_req, res) => {
    control.reset();
    res.json({ status: 'reset' });
  });

  app.post('/__control/:provider', (req, res) => {
    const provider = req.params.provider as Provider;
    if (!PROVIDERS.includes(provider)) {
      res.status(404).json({ error: `Unknown provider: ${provider}` });
      return;
    }
    const { mode, latencyMs, failRate } = req.body as ControlBody;
    const next = control.set(provider, {
      ...(mode !== undefined && { mode }),
      ...(latencyMs !== undefined && { latencyMs }),
      ...(failRate !== undefined && { failRate }),
    });
    res.json(next);
  });

  return { app, control };
}
