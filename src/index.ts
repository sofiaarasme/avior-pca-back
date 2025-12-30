import http from "http";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import "dotenv/config";

import { createMongoClient } from "./lib/mongo.js";
import { marketingRouter } from "./modules/marketing/marketing.routes.js";
import { openapiSpec } from "./openapi.js";
import swaggerUi from "swagger-ui-express";

const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "avior-pca-back", time: new Date().toISOString() });
});

app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openapiSpec);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Mongo + routes
const mongo = createMongoClient();
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.app.locals.mongo = mongo;
  next();
});

app.use("/api/marketing", marketingRouter);

// Basic error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

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
