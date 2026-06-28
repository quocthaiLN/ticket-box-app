import { env } from "@ticketbox/config";
import { prisma } from "@ticketbox/database";
import { closeRedis } from "@ticketbox/redis";
import { closeAllQueues } from "@ticketbox/queue";
import { createApp } from "./app.js";

const port = Number(env.server.port);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`TicketBox API listening on http://localhost:${port}/v1`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;          // tránh gọi 2 lần (Ctrl+C nhanh)
  isShuttingDown = true;

  console.log(
    `\n[api-server] Received ${signal} — shutting down gracefully...`,
  );

  // 1. Ngừng nhận kết nối mới, chờ request đang xử lý hoàn tất
  server.close(() => {
    console.log("[api-server] HTTP server closed");
  });

  // 2. Đóng BullMQ queues (flush pending adds)
  await closeAllQueues().catch((err) =>
    console.error("[api-server] Queue close error:", err),
  );

  // 3. Đóng Redis
  await closeRedis().catch((err) =>
    console.error("[api-server] Redis close error:", err),
  );

  // 4. Đóng Prisma connection pool
  await prisma.$disconnect().catch((err) =>
    console.error("[api-server] Prisma disconnect error:", err),
  );

  console.log("[api-server] All connections closed. Exiting.");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
