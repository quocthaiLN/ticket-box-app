import express, { type Express } from 'express';
import { ControlStore, type FaultMode, type Provider } from './control.js';
import { momoRouter } from './momo.js';
import { vnpayRouter } from './vnpay.js';

interface ControlBody {
  mode?: FaultMode;
  latencyMs?: number;
  failRate?: number;
}

/**
 * Builds one standalone provider mock. Returns the Express app plus the
 * ControlStore so tests can drive fault injection programmatically (without HTTP).
 */
function createProviderMockServer(hostedProvider: Provider): { app: Express; control: ControlStore } {
  const control = new ControlStore();
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK' });
  });

  if (hostedProvider === 'momo') {
    app.use('/momo', momoRouter(control));
  } else {
    app.use('/vnpay', vnpayRouter(control));
  }

  // ── Fault-injection control ───────────────────────────────────────────────
  app.post('/__control/reset', (_req, res) => {
    control.set(hostedProvider, { mode: 'ok', latencyMs: 0, failRate: 0 });
    res.json({ status: 'reset' });
  });

  app.post('/__control/:provider', (req, res) => {
    const provider = req.params.provider as Provider;
    if (provider !== hostedProvider) {
      res.status(404).json({ error: `Provider ${req.params.provider} is not hosted by this mock server` });
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

export const createMomoMockServer = () => createProviderMockServer('momo');
export const createVnpayMockServer = () => createProviderMockServer('vnpay');
