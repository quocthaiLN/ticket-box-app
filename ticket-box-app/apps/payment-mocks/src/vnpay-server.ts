import { createVnpayMockServer } from './server.js';

const port = Number(process.env.VNPAY_MOCK_PORT ?? 4102);
const { app } = createVnpayMockServer();

app.listen(port, () => {
  console.log(`VNPay mock listening on http://localhost:${port}`);
  console.log(`  Prepare: POST /vnpay/prepare`);
  console.log(`  QueryDR: POST /vnpay/merchant_webapi/api/transaction`);
  console.log(`  Control: POST /__control/vnpay { mode, latencyMs, failRate }`);
});
