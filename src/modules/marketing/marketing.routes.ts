import { Router, type NextFunction, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { isMarketingCollectionName, type MarketingCollectionName } from "./collections.js";

export const marketingRouter = Router();

let indexesEnsured = false;

function getDb(req: Request) {
  const mongo = req.app.locals.mongo;
  if (!mongo) throw new Error("Mongo not initialized");
  return mongo.db;
}

function collectionFromParam(req: Request): MarketingCollectionName {
  const c = req.params.collection;
  if (!isMarketingCollectionName(c)) {
    const err = new Error("Invalid collection") as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  return c;
}

function parseObjectId(id: string) {
  if (!ObjectId.isValid(id)) {
    const err = new Error("Invalid id") as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  return new ObjectId(id);
}

function parseSort(raw: unknown): Record<string, 1 | -1> {
  if (!raw || typeof raw !== "string") return { _id: -1 };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, 1 | -1> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === 1 || v === -1) out[k] = v;
    }
    return Object.keys(out).length ? out : { _id: -1 };
  } catch {
    return { _id: -1 };
  }
}

type SegmentCondition = {
  id?: string;
  field: string;
  operator: string;
  value: unknown;
};

type SegmentDoc = {
  name: string;
  description?: string;
  operator?: "AND" | "OR";
  conditions?: SegmentCondition[];
  status?: "active" | "paused" | "archived";
  audienceSize?: number;
  createdAt?: Date | string;
  updatedAt?: Date;
};

type NotificationDoc = {
  flightId?: string;
  type: string;
  message: string;
  channels: string[];
  sentAt?: string;
  deliveryStats?: { sent?: number; delivered?: number; failed?: number };
  createdBy?: string;
  createdAt?: Date | string;
  updatedAt?: Date;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSegmentPayload(payload: unknown): SegmentDoc {
  if (!isPlainObject(payload)) {
    const err = new Error("invalid_body") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const name = String(payload.name ?? "").trim();
  if (!name) {
    const err = new Error("missing_name") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const operatorRaw = payload.operator;
  const operator = operatorRaw === "OR" ? "OR" : "AND";

  const conditionsRaw = payload.conditions;
  const conditions = Array.isArray(conditionsRaw)
    ? (conditionsRaw
        .filter((c): c is Record<string, unknown> => isPlainObject(c))
        .map((c) => ({
          id: typeof c.id === "string" ? c.id : undefined,
          field: String(c.field ?? ""),
          operator: String(c.operator ?? ""),
          value: c.value,
        }))
        .filter((c) => c.field && c.operator))
    : [];

  return {
    name,
    description: typeof payload.description === "string" ? payload.description : undefined,
    operator,
    conditions,
    status:
      payload.status === "paused" || payload.status === "archived" || payload.status === "active"
        ? payload.status
        : "active",
    audienceSize: typeof payload.audienceSize === "number" ? payload.audienceSize : undefined,
    createdAt: payload.createdAt instanceof Date || typeof payload.createdAt === "string" ? payload.createdAt : undefined,
  };
}

function validateNotificationPayload(payload: unknown): NotificationDoc {
  if (!isPlainObject(payload)) {
    const err = new Error("invalid_body") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const type = String(payload.type ?? "").trim();
  const message = String(payload.message ?? "").trim();
  const channelsRaw = payload.channels;
  const channels = Array.isArray(channelsRaw)
    ? channelsRaw.map((c) => String(c)).filter(Boolean)
    : [];

  if (!type) {
    const err = new Error("missing_type") as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  if (!message) {
    const err = new Error("missing_message") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  return {
    flightId: typeof payload.flightId === "string" ? payload.flightId : undefined,
    type,
    message,
    channels,
    sentAt: typeof payload.sentAt === "string" ? payload.sentAt : undefined,
    deliveryStats: isPlainObject(payload.deliveryStats)
      ? {
          sent: typeof payload.deliveryStats.sent === "number" ? payload.deliveryStats.sent : undefined,
          delivered: typeof payload.deliveryStats.delivered === "number" ? payload.deliveryStats.delivered : undefined,
          failed: typeof payload.deliveryStats.failed === "number" ? payload.deliveryStats.failed : undefined,
        }
      : undefined,
    createdBy: typeof payload.createdBy === "string" ? payload.createdBy : undefined,
    createdAt: payload.createdAt instanceof Date || typeof payload.createdAt === "string" ? payload.createdAt : undefined,
  };
}

async function ensureIndexes(db: ReturnType<typeof getDb>) {
  // Avoid re-creating indexes per request (per process)
  if (indexesEnsured) return;

  await Promise.all([
    db.collection("segments").createIndex({ name: 1 }, { unique: false }),
    db.collection("segments").createIndex({ status: 1, updatedAt: -1 }),
    db.collection("notifications").createIndex({ sentAt: -1, _id: -1 }),
    db.collection("notifications").createIndex({ flightId: 1, sentAt: -1 }),
    db.collection("recipients").createIndex({ email: 1 }),
    db.collection("flights").createIndex({ flightNumber: 1, operationDate: 1 }),
  ]);

  indexesEnsured = true;
}

// GET /api/marketing/:collection?limit=&skip=&sort=&q=
marketingRouter.get("/:collection", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    await ensureIndexes(db);

    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const skip = Math.max(Number(req.query.skip ?? 0), 0);

    // optional JSON sort: {"createdAt":-1}
    const sort = parseSort(req.query.sort);

    // optional naive text query: q=foo => searches name/title/subject/email (if exists)
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filter: Record<string, unknown> = {};
    if (q) {
      const or: Record<string, unknown>[] = [
        { name: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { subject: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { message: { $regex: q, $options: "i" } },
        { type: { $regex: q, $options: "i" } },
      ];
      filter.$or = or;
    }

    const col = db.collection(collectionName);
    const [items, total] = await Promise.all([
      col.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter)
    ]);

    res.json({ items, page: { total, skip, limit } });
  } catch (e) {
    next(e);
  }
});

// GET /api/marketing/:collection/:id
marketingRouter.get("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);

    const doc = await db.collection(collectionName).findOne({ _id });
    if (!doc) return res.status(404).json({ error: "not_found" });

    res.json(doc);
  } catch (e) {
    next(e);
  }
});

// POST /api/marketing/:collection
marketingRouter.post("/:collection", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    await ensureIndexes(db);

    const rawPayload: unknown = req.body ?? {};

    const payload = (() => {
      if (collectionName === "segments") return validateSegmentPayload(rawPayload);
      if (collectionName === "notifications") return validateNotificationPayload(rawPayload);
      if (!isPlainObject(rawPayload)) {
        const err = new Error("invalid_body") as Error & { status?: number };
        err.status = 400;
        throw err;
      }
      return rawPayload;
    })();

  const now = new Date();
  const createdAtRaw = (payload as Record<string, unknown>).createdAt;
  const createdAt = createdAtRaw instanceof Date || typeof createdAtRaw === "string" ? createdAtRaw : now;

  const doc = { ...payload, createdAt, updatedAt: now };

    const result = await db.collection(collectionName).insertOne(doc);
    const created = await db.collection(collectionName).findOne({ _id: result.insertedId });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// PUT /api/marketing/:collection/:id
marketingRouter.put("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);
    await ensureIndexes(db);

    const rawPayload: unknown = req.body ?? {};

    const payload = (() => {
      if (collectionName === "segments") return validateSegmentPayload(rawPayload);
      if (collectionName === "notifications") return validateNotificationPayload(rawPayload);
      if (!isPlainObject(rawPayload)) {
        const err = new Error("invalid_body") as Error & { status?: number };
        err.status = 400;
        throw err;
      }
      return rawPayload;
    })();

    // Avoid changing _id
    const { _id: _ignored, ...rest } = payload as Record<string, unknown>;
    // reference to satisfy unused-var linter
    void _ignored;

  const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };

    const result = await db
      .collection(collectionName)
      .findOneAndUpdate({ _id }, { $set: update }, { returnDocument: "after" });

    const updated = result?.value;
    if (!updated) return res.status(404).json({ error: "not_found" });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/marketing/:collection/:id
marketingRouter.delete("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);

    const result = await db.collection(collectionName).deleteOne({ _id });
    if (result.deletedCount === 0) return res.status(404).json({ error: "not_found" });

    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// Error normalization
marketingRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (!err) return next();
  const e = err as { status?: unknown; message?: unknown };
  const status = Number(e.status ?? 500);
  const message = status < 500 ? String(e.message ?? "bad_request") : "internal_error";
  res.status(status).json({ error: message });
});
