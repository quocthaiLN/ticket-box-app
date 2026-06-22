// Nạp .env gốc monorepo trước mọi import khác (Prisma/Redis đọc process.env).
import "@ticketbox/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`TicketBox API listening on http://localhost:${port}/v1`);
});
