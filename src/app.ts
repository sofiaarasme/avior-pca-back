import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import "dotenv/config";

import { createMongoClient } from "./lib/mongo.js";
import { marketingRouter } from "./modules/marketing/marketing.routes.js";
import { operationsRouter } from "./modules/operations/operations.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.reoutes.js";
import { marketingAnalyticsRouter } from "./modules/marketing/analytics/analytics.routes.js";
import { openapiSpec } from "./openapi.js";
import swaggerUi from "swagger-ui-express";
import path from "path";
import { fileURLToPath } from "url";

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
  const app = express();

  // --- CONFIGURACIÓN DE CORS DEFINITIVA ---
  
  // 1. Lista blanca base
  const whitelist = [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://lovable.dev",
    "https://lovable.app",
    "https://avior-pca-back.vercel.app" 
  ];

  // 2. Integración de variables de entorno y opciones
  if (process.env.CORS_ORIGIN) {
    const envOrigins = process.env.CORS_ORIGIN.split(",").map(o => o.trim());
    whitelist.push(...envOrigins);
  }
  if (options.corsOrigin) {
    const opts = Array.isArray(options.corsOrigin) ? options.corsOrigin : [options.corsOrigin];
    whitelist.push(...opts);
  }

  // 3. Aplicar Middleware de CORS (Debe ser el primero)
  app.use(
    cors({
      origin: (origin, callback) => {
        // Permitir peticiones sin origen (como Postman o llamadas internas)
        if (!origin) return callback(null, true);

        // Lógica de validación:
        // - Si está en la whitelist por coincidencia exacta o inicio (startsWith)
        // - O si es un subdominio de lovable.app (crucial para previsualizaciones)
        // - O si es un subdominio de vercel.app
        const isAllowed = 
          whitelist.some(domain => origin.startsWith(domain)) || 
          origin.endsWith(".lovable.app") || 
          origin.endsWith(".vercel.app");

        if (isAllowed) {
          callback(null, true);
        } else {
          console.error(`CORS Bloqueado para: ${origin}`);
          callback(new Error("No permitido por CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "accept"]
    })
  );

  app.use(express.json({ limit: "2mb" }));

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // --- RUTAS Y SERVICIOS ---

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "avior-pca-back",
      docs: "/docs/",
      openapi: "/openapi.json",
      time: new Date().toISOString(),
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "avior-pca-back", time: new Date().toISOString() });
  });

  app.get("/openapi.json", (_req: Request, res: Response) => {
    res.json(openapiSpec);
  });

  // Swagger UI (Vercel-safe)
  const publicDir = path.resolve(__dirname, "../public");
  app.use("/public", express.static(publicDir));
  app.get(["/docs", "/docs/"], (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, "swagger.html"));
  });

  app.use("/docs-express", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  // Mongo + routes injection
  const mongo = createMongoClient();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.app.locals.mongo = mongo;
    next();
  });

  app.use("/api/marketing", marketingRouter);
  app.use("/api/marketing/analytics", marketingAnalyticsRouter);
  app.use("/api/operations", operationsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/auth", authRouter);

  // --- MANEJO DE ERRORES ---

  // Middleware para capturar errores 404 de API
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "endpoint_not_found" });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("ERROR CAPTURADO:", err); // Esto imprime el error en la terminal

    res.status(err.status || 500).json({ 
      error: err.message || "internal_error", // <--- Cambia esto para ver el mensaje real
      stack: err.stack, // <--- Esto te dirá la línea exacta del error
    });
  });

  return { app, mongo };
}