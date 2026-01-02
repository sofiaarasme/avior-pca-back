import { Router, type NextFunction, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { isOperationsCollectionName, type OperationsCollectionName } from "./collections.js";

export const operationsRouter = Router();

// Helper para obtener la DB
function getDb(req: Request) {
  const mongo = req.app.locals.mongo;
  if (!mongo) throw new Error("Mongo not initialized");
  return mongo.db;
}

// Helper para validar la colección
function collectionFromParam(req: Request): OperationsCollectionName {
  const c = req.params.collection;
  if (!isOperationsCollectionName(c)) {
    const err: any = new Error("Invalid operations collection");
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

// 1. GET /api/operations/:collection (Listar)
operationsRouter.get("/:collection", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const skip = Math.max(Number(req.query.skip ?? 0), 0);

    const col = db.collection(collectionName);
    const [items, total] = await Promise.all([
      col.find({}).sort({ _id: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments({})
    ]);

    res.json({ items, page: { total, skip, limit } });
  } catch (e) { next(e); }
});

// 2. POST /api/operations/:collection/bulk (IMPORTANTE: Debe ir antes de /:collection/:id)
operationsRouter.post("/:collection/bulk", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const docs = Array.isArray(req.body) ? req.body : [];
    
    if (docs.length === 0) return res.status(400).json({ error: "empty_array" });

    const now = new Date();
    const docsWithDates = docs.map(d => ({ ...d, createdAt: now, updatedAt: now }));

    const result = await db.collection(collectionName).insertMany(docsWithDates);
    res.status(201).json({ insertedCount: result.insertedCount, ids: result.insertedIds });
  } catch (e) { next(e); }
});

// 3. GET /api/operations/:collection/:id (Obtener uno)
operationsRouter.get("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);
    const doc = await db.collection(collectionName).findOne({ _id });
    if (!doc) return res.status(404).json({ error: "not_found" });
    res.json(doc);
  } catch (e) { next(e); }
});

// 4. POST /api/operations/:collection (Crear uno)
operationsRouter.post("/:collection", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const payload = req.body ?? {};
    const now = new Date();
    const doc = { ...payload, createdAt: now, updatedAt: now };
    const result = await db.collection(collectionName).insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (e) { next(e); }
});

// 5. PUT /api/operations/:collection/:id (Actualizar)
operationsRouter.put("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);
    const { _id: _ignored, ...update } = req.body;
    const result = await db.collection(collectionName).findOneAndUpdate(
      { _id }, 
      { $set: { ...update, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!result) return res.status(404).json({ error: "not_found" });
    res.json(result);
  } catch (e) { next(e); }
});

// 6. DELETE /api/operations/:collection/:id (Eliminar)
operationsRouter.delete("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);
    const result = await db.collection(collectionName).deleteOne({ _id });
    if (result.deletedCount === 0) return res.status(404).json({ error: "not_found" });
    res.status(204).send();
  } catch (e) { next(e); }
});

// --- AÑADE ESTO: Normalización de Errores (Igual que en Marketing) ---
operationsRouter.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (!err) return next();
  const status = Number(err.status ?? 500);
  const message = status < 500 ? String(err.message ?? "bad_request") : "internal_error";
  res.status(status).json({ error: message });
});