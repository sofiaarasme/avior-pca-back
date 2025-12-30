import "dotenv/config";

import http from "http";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

const { app, mongo } = createApp();
const server = http.createServer(app);

async function start() {
  await mongo.connect();
  server.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log(`Swagger UI on   http://localhost:${PORT}/docs`);
  });
}

start().catch((e) => {
  console.error("Failed to start server", e);
  process.exit(1);
});
