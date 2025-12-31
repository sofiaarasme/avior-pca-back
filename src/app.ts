import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import "dotenv/config";

import { createMongoClient } from "./lib/mongo.js";
import { marketingRouter } from "./modules/marketing/marketing.routes.js";
import { marketingAnalyticsRouter } from "./modules/marketing/analytics/analytics.routes.js";
import { openapiSpec } from "./openapi.js";
import swaggerUi from "swagger-ui-express";

export interface AppOptions {
  /**
   * Allowed CORS origins.
   *
   * - string: a single origin
   * - string[]: whitelist
   * - undefined: defaults to env CORS_ORIGIN or localhost:5173
   */
  corsOrigin?: string | string[];
}

export function createApp(options: AppOptions = {}) {
  const CORS_ORIGIN = options.corsOrigin ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(
    cors({
      origin: CORS_ORIGIN,
      credentials: true,
    })
  );

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "avior-pca-back", time: new Date().toISOString() });
  });

  app.get("/openapi.json", (_req: Request, res: Response) => {
    res.json(openapiSpec);
  });

  // Swagger UI: mount at a stable, non-slash-suffixed path to avoid proxy rewrite loops.
  // swagger-ui-express serves its assets under the same base path.
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  // Mongo + routes
  const mongo = createMongoClient();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.app.locals.mongo = mongo;
    next();
  });

  app.use("/api/marketing", marketingRouter);
  app.use("/api/marketing/analytics", marketingAnalyticsRouter);

  // Basic error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return { app, mongo };
}
