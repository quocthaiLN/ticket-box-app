import { env } from "@ticketbox/config";
import { createApp } from "./app.js";

const port = Number(env.server.port);
const app = createApp();

app.listen(port, () => {
  console.log(`TicketBox API listening on http://localhost:${port}/v1`);
});
