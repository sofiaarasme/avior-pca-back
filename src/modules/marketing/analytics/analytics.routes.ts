import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { MetricModel, EmailLogModel } from "../collections.js";

export const marketingAnalyticsRouter = Router();

// --- 1. ESQUEMAS DE VALIDACIÓN (ZOD) ---

const CampaignParamsSchema = z.object({
  campaignId: z.string().min(1, "campaignId es requerido"),
});

const AnalyticsQuerySchema = z.object({
  // Convierte "true"/"false" de la URL a booleano real
  includeLogs: z.preprocess((val) => val === "true" || val === undefined, z.boolean()).optional().default(true),
});

const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).default(200),
  skip: z.coerce.number().min(0).default(0),
});

const SeedBodySchema = z.object({
  sent: z.coerce.number().min(10).optional().default(1200),
});

// Interface para el resultado de la agregación (Evita el uso de Record<string, number> genérico)
interface AggregationResult {
  _id: string;
  count: number;
}

// --- 2. RUTAS ---

marketingAnalyticsRouter.get(
  "/:campaignId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = CampaignParamsSchema.parse(req.params);
      const { includeLogs } = AnalyticsQuerySchema.parse(req.query);

      // Usamos .lean() para obtener un objeto JS puro (más rápido)
      const metricsDoc = await MetricModel.findOne({ campaignId }).sort({ createdAt: -1 }).lean();

      let logsAgg: Record<string, number> | null = null;

      if (includeLogs) {
        // Tipamos el resultado de la agregación
        const rows = await EmailLogModel.aggregate<AggregationResult>([
          { $match: { campaignId } },
          { $group: { _id: "$event", count: { $sum: 1 } } },
        ]);

        logsAgg = rows.reduce((acc, r) => {
          acc[r._id] = r.count;
          return acc;
        }, {} as Record<string, number>);
      }

      const statsFromLogs = logsAgg
        ? {
            sent: logsAgg.sent ?? 0,
            delivered: logsAgg.delivered ?? 0,
            opens: logsAgg.open ?? 0,
            uniqueOpens: metricsDoc?.uniqueOpens ?? 0,
            clicks: logsAgg.click ?? 0,
            uniqueClicks: metricsDoc?.uniqueClicks ?? 0,
            bounces: logsAgg.bounce ?? 0,
            complaints: logsAgg.complaint ?? 0,
            unsubscribes: logsAgg.unsubscribe ?? 0,
          }
        : null;

      res.json({
        campaignId,
        metrics: metricsDoc,
        logs: logsAgg,
        stats: statsFromLogs,
      });
    } catch (e) { next(e); }
  }
);

marketingAnalyticsRouter.get(
  "/:campaignId/logs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = CampaignParamsSchema.parse(req.params);
      const { limit, skip } = PaginationQuerySchema.parse(req.query);

      const [items, total] = await Promise.all([
        EmailLogModel.find({ campaignId })
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        EmailLogModel.countDocuments({ campaignId }),
      ]);

      res.json({ items, page: { total, skip, limit } });
    } catch (e) { next(e); }
  }
);

marketingAnalyticsRouter.post(
  "/:campaignId/seed",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = CampaignParamsSchema.parse(req.params);
      const { sent: base } = SeedBodySchema.parse(req.body);

      const delivered = Math.floor(base * 0.985);
      const uniqueOpens = Math.floor(delivered * 0.52);
      const opens = Math.floor(uniqueOpens * 1.25);
      const uniqueClicks = Math.floor(uniqueOpens * 0.18);
      const clicks = Math.floor(uniqueClicks * 1.3);
      const bounces = base - delivered;
      const unsubscribes = Math.max(0, Math.floor(delivered * 0.002));
      const complaints = Math.max(0, Math.floor(delivered * 0.0005));

      // SOLUCIÓN AL ERROR TS(2769): 
      // Eliminamos createdAt y updatedAt porque Mongoose los maneja solo
      const metricsDoc = await MetricModel.create({
        campaignId,
        sent: base,
        delivered,
        opens,
        uniqueOpens,
        clicks,
        uniqueClicks,
        bounces,
        complaints,
        unsubscribes
      });

      const sampleSize = Math.min(base, 500);
      const logsToInsert = [];
      const now = new Date();

      for (let i = 0; i < sampleSize; i++) {
        const recipientId = `seed-${i}`;
        const email = `seed${i}@example.com`;
        
        logsToInsert.push({
          campaignId,
          recipientId,
          to: email,
          event: "sent",
          timestamp: now,
          meta: { seeded: true }
        });

        if (i < Math.floor(sampleSize * 0.985)) {
          logsToInsert.push({ campaignId, recipientId, to: email, event: "delivered", timestamp: now, meta: { seeded: true } });
        }
        if (i < Math.floor(sampleSize * 0.52)) {
          logsToInsert.push({ campaignId, recipientId, to: email, event: "open", timestamp: now, meta: { seeded: true } });
        }
        if (i < Math.floor(sampleSize * 0.18)) {
          logsToInsert.push({ campaignId, recipientId, to: email, event: "click", timestamp: now, meta: { seeded: true } });
        }
      }

      await EmailLogModel.insertMany(logsToInsert);

      res.status(201).json({ 
        ok: true, 
        metrics: metricsDoc, 
        logsInserted: logsToInsert.length 
      });
    } catch (e) { next(e); }
  }
);

// --- 3. MANEJO DE ERRORES (SIN ANY) ---

marketingAnalyticsRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ 
      error: "validation_error", 
      details: err.issues.map(i => ({ path: i.path, message: i.message })) 
    });
  }

  // Tipado seguro para errores desconocidos
  const status = (err as { status?: number }).status || 500;
  const message = status < 500 ? (err as Error).message : "internal_error";
  
  if (status >= 500) console.error(err);

  res.status(status).json({ error: message });
});