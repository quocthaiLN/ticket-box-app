import { createMockPaymentServer } from './server.js';

const port = Number(process.env.MOCK_PAYMENTS_PORT ?? 4100);
const { app } = createMockPaymentServer();

app.listen(port, () => {
  console.log(`Payment mock server listening on http://localhost:${port}`);
  console.log(`  MoMo create:   POST /momo/v2/gateway/api/create`);
  console.log(`  VNPay querydr: POST /vnpay/merchant_webapi/api/transaction`);
  console.log(`  Control:       POST /__control/:provider { mode, latencyMs, failRate }`);
});
