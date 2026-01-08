import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import "dotenv/config";

import { createMongoClient } from "./lib/mongo.js";
import { marketingRouter } from "./modules/marketing/marketing.routes.js";
import { operationsRouter } from "./modules/operations/operations.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
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
  // --- CONFIGURACIÓN DE CORS MEJORADA ---
  
  // 1. Definimos los orígenes permitidos por defecto (incluyendo tu puerto 8080)
  const whitelist = [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://lovable.dev",
    "https://avior-pca-back.vercel.app" 
  ];

  // 2. Agregamos el origen de la variable de entorno si existe
  if (process.env.CORS_ORIGIN) {
    // Si la variable contiene múltiples URLs separadas por coma, las procesamos todas
    const envOrigins = process.env.CORS_ORIGIN.split(",").map(o => o.trim());
    whitelist.push(...envOrigins);
  }

  // 3. Agregamos los orígenes pasados por opciones al llamar a createApp
  if (options.corsOrigin) {
    const opts = Array.isArray(options.corsOrigin) ? options.corsOrigin : [options.corsOrigin];
    whitelist.push(...opts);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // 4. Aplicamos el Middleware de CORS con lógica de validación
  app.use(
    cors({
      origin: (origin, callback) => {
        // Permitir peticiones sin origen (como Postman o llamadas entre servidores)
        if (!origin) return callback(null, true);

        // Verificamos si el origen de la petición comienza con alguno de nuestra lista blanca
        // Usamos .startsWith para que coincida con las URLs dinámicas de Lovable
        const isAllowed = whitelist.some(allowed => origin.startsWith(allowed));

        if (isAllowed) {
          callback(null, true);
        } else {
          console.error(`CORS Error: El origen ${origin} no está en la lista blanca.`);
          callback(new Error("No permitido por CORS"));
        }
      },
      credentials: true,
    })
  );
  
  // --- RESTO DEL CÓDIGO (SIN CAMBIOS) ---

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

  // Mongo + routes
  const mongo = createMongoClient();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.app.locals.mongo = mongo;
    next();
  });

  app.use("/api/marketing", marketingRouter);
  app.use("/api/marketing/analytics", marketingAnalyticsRouter);
  app.use("/api/operations", operationsRouter);
  app.use("/api/admin", adminRouter);

  // Basic error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const status = (err as any).status || 500;
    res.status(status).json({ error: (err as any).message || "internal_error" });
  });

  return { app, mongo };
}