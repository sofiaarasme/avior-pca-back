import { Router, type NextFunction, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { isMarketingCollectionName, type MarketingCollectionName } from "./collections.js";

export const marketingRouter = Router();

function getDb(req: Request) {
  const mongo = req.app.locals.mongo;
  if (!mongo) throw new Error("Mongo not initialized");
  return mongo.db;
}

function collectionFromParam(req: Request): MarketingCollectionName {
  const c = req.params.collection;
  if (!isMarketingCollectionName(c)) {
    const err: any = new Error("Invalid collection");
    err.status = 400;
    throw err;
  }
  return c;
}

function parseObjectId(id: string) {
  if (!ObjectId.isValid(id)) {
    const err: any = new Error("Invalid id");
    err.status = 400;
    throw err;
  }
  return new ObjectId(id);
}

// GET /api/marketing/:collection?limit=&skip=&sort=&q=
marketingRouter.get("/:collection", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);

    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const skip = Math.max(Number(req.query.skip ?? 0), 0);

    // optional JSON sort: {"createdAt":-1}
    const sort = (() => {
      const raw = req.query.sort;
      if (!raw) return { _id: -1 };
      if (typeof raw !== "string") return { _id: -1 };
      try {
        return JSON.parse(raw);
      } catch {
        return { _id: -1 };
      }
    })();

    // optional naive text query: q=foo => searches name/title/subject/email (if exists)
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { subject: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } }
      ];
    }

    const col = db.collection(collectionName);
    const [items, total] = await Promise.all([
      col.find(filter).sort(sort as any).skip(skip).limit(limit).toArray(),
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

    const payload = req.body ?? {};
    if (typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "invalid_body" });
    }

    const now = new Date();
    const doc = { ...payload, createdAt: (payload as any).createdAt ?? now, updatedAt: now };

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

    const payload = req.body ?? {};
    if (typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "invalid_body" });
    }

    // Avoid changing _id
    const { _id: _ignored, ...rest } = payload as any;

    const update = { ...rest, updatedAt: new Date() };

    const result = await db
      .collection(collectionName)
      .findOneAndUpdate({ _id }, { $set: update }, { returnDocument: "after" });

    if (!result) return res.status(404).json({ error: "not_found" });

    res.json(result);
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
marketingRouter.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (!err) return next();
  const status = Number(err.status ?? 500);
  const message = status < 500 ? String(err.message ?? "bad_request") : "internal_error";
  res.status(status).json({ error: message });
});
