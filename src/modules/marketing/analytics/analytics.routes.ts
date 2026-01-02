import { Router, type NextFunction, type Request, type Response } from "express";

export const marketingAnalyticsRouter = Router();

function getDb(req: Request) {
  const mongo = req.app.locals.mongo;
  if (!mongo) throw new Error("Mongo not initialized");
  return mongo.db;
}

function toInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * GET /api/marketing/analytics/:campaignId
 * Returns aggregated metrics for a campaign.
 *
 * Sources:
 * - metrics collection: if exists (latest document per campaignId)
 * - email_logs collection: aggregated counts (optional)
 */
marketingAnalyticsRouter.get(
  "/:campaignId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb(req);
      const campaignId = String(req.params.campaignId || "").trim();
      if (!campaignId) return res.status(400).json({ error: "invalid_campaignId" });

      // latest explicit metrics doc (if any)
      const metricsDoc = await db
        .collection("metrics")
        .find({ campaignId })
        .sort({ createdAt: -1, _id: -1 })
        .limit(1)
        .next();

      const includeLogs = String(req.query.includeLogs ?? "true") !== "false";

      let logsAgg: Record<string, number> | null = null;
      if (includeLogs) {
        const pipeline = [
          { $match: { campaignId } },
          {
            $group: {
              _id: "$event",
              count: { $sum: 1 },
            },
          },
        ];

        type AggRow = { _id: unknown; count?: number };
        const rows = (await db.collection("email_logs").aggregate(pipeline).toArray()) as AggRow[];
        logsAgg = rows.reduce<Record<string, number>>((acc, r) => {
          acc[String(r._id)] = Number(r.count ?? 0);
          return acc;
        }, {});
      }

      // normalize output
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
        metrics: metricsDoc ?? null,
        logs: logsAgg,
        stats: statsFromLogs,
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /api/marketing/analytics/:campaignId/logs
 * Returns email logs for a campaign (paginated).
 */
marketingAnalyticsRouter.get(
  "/:campaignId/logs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb(req);
      const campaignId = String(req.params.campaignId || "").trim();
      if (!campaignId) return res.status(400).json({ error: "invalid_campaignId" });

      const limit = Math.min(toInt(req.query.limit, 200), 1000);
      const skip = Math.max(toInt(req.query.skip, 0), 0);

      const col = db.collection("email_logs");
      const [items, total] = await Promise.all([
        col.find({ campaignId }).sort({ timestamp: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
        col.countDocuments({ campaignId }),
      ]);

      res.json({ items, page: { total, skip, limit } });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * POST /api/marketing/analytics/:campaignId/seed
 * Seeds demo metrics and logs for a campaign.
 */
marketingAnalyticsRouter.post(
  "/:campaignId/seed",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb(req);
      const campaignId = String(req.params.campaignId || "").trim();
      if (!campaignId) return res.status(400).json({ error: "invalid_campaignId" });

      const now = new Date();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const base = Math.max(10, toInt(body.sent, 1200));

      const delivered = Math.floor(base * 0.985);
      const uniqueOpens = Math.floor(delivered * 0.52);
      const opens = Math.floor(uniqueOpens * 1.25);
      const uniqueClicks = Math.floor(uniqueOpens * 0.18);
      const clicks = Math.floor(uniqueClicks * 1.3);
      const bounces = base - delivered;
      const unsubscribes = Math.max(0, Math.floor(delivered * 0.002));
      const complaints = Math.max(0, Math.floor(delivered * 0.0005));

      const metricsDoc = {
        campaignId,
        sent: base,
        delivered,
        opens,
        uniqueOpens,
        clicks,
        uniqueClicks,
        bounces,
        complaints,
        unsubscribes,
        createdAt: now,
        updatedAt: now,
      };

      const insertMetrics = await db.collection("metrics").insertOne(metricsDoc);

      // Create lightweight sample logs (not 1 per recipient - keep it small)
      const sampleSize = Math.min(base, 500);
  const logs: Array<Record<string, unknown>> = [];
      for (let i = 0; i < sampleSize; i++) {
        const recipientId = `seed-${i}`;
        logs.push({
          campaignId,
          recipientId,
          to: `seed${i}@example.com`,
          event: "sent",
          timestamp: now,
          meta: { seeded: true },
          createdAt: now,
          updatedAt: now,
        });
      }

      // a subset delivered
      for (let i = 0; i < Math.floor(sampleSize * 0.985); i++) {
        const recipientId = `seed-${i}`;
        logs.push({
          campaignId,
          recipientId,
          to: `seed${i}@example.com`,
          event: "delivered",
          timestamp: now,
          meta: { seeded: true },
          createdAt: now,
          updatedAt: now,
        });
      }

      // opens/clicks
      for (let i = 0; i < Math.floor(sampleSize * 0.52); i++) {
        const recipientId = `seed-${i}`;
        logs.push({
          campaignId,
          recipientId,
          to: `seed${i}@example.com`,
          event: "open",
          timestamp: now,
          meta: { seeded: true },
          createdAt: now,
          updatedAt: now,
        });
      }
      for (let i = 0; i < Math.floor(sampleSize * 0.18); i++) {
        const recipientId = `seed-${i}`;
        logs.push({
          campaignId,
          recipientId,
          to: `seed${i}@example.com`,
          event: "click",
          timestamp: now,
          meta: { seeded: true, url: "/ofertas/demo" },
          createdAt: now,
          updatedAt: now,
        });
      }

      await db.collection("email_logs").insertMany(logs);

      const created = await db.collection("metrics").findOne({ _id: insertMetrics.insertedId });
      res.status(201).json({ ok: true, metrics: created, logsInserted: logs.length });
    } catch (e) {
      next(e);
    }
  }
);

// Error normalization
marketingAnalyticsRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (!err) return next();
  // try to extract status/message in a safe way
  const status = Number((err as { status?: unknown })?.status ?? 500);
  const message = status < 500 ? String((err as { message?: unknown })?.message ?? "bad_request") : "internal_error";
  res.status(status).json({ error: message });
});
