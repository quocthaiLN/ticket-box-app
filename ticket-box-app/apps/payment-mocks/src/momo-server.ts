import { createMomoMockServer } from './server.js';

const port = Number(process.env.MOMO_MOCK_PORT ?? 4101);
const { app } = createMomoMockServer();

app.listen(port, () => {
  console.log(`MoMo mock listening on http://localhost:${port}`);
  console.log(`  Create:  POST /momo/v2/gateway/api/create`);
  console.log(`  Query:   POST /momo/v2/gateway/api/query`);
  console.log(`  Control: POST /__control/momo { mode, latencyMs, failRate }`);
});
