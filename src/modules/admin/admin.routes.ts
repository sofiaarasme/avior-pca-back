// src/modules/admin/admin.routes.ts
import { Router, type NextFunction, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { isAdminCollectionName, type AdminCollectionName } from "./collections.js";

export const adminRouter = Router();

// Helper para obtener la DB
function getDb(req: Request) {
  const mongo = req.app.locals.mongo;
  if (!mongo) throw new Error("Mongo not initialized");
  return mongo.db;
}

// Helper para validar la colección permitida en Admin
function collectionFromParam(req: Request): AdminCollectionName {
  const c = req.params.collection;
  if (!isAdminCollectionName(c)) {
    const err: any = new Error("Invalid admin collection");
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

/**
 * Procesa el cuerpo de la petición para convertir strings de ID en ObjectIds reales
 * Especialmente necesario para 'organizationId' en la colección de usuarios.
 */
function preparePayload(payload: any) {
  const data = { ...payload };
  // Si viene un organizationId como string, lo convertimos
  if (data.organizationId && typeof data.organizationId === "string") {
    data.organizationId = parseObjectId(data.organizationId);
  }
  return data;
}

// 1. GET /api/admin/:collection (Listar)
adminRouter.get("/:collection", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const skip = Math.max(Number(req.query.skip ?? 0), 0);

    // Filtro opcional por organización si viene en el query
    const filter: any = {};
    if (req.query.organizationId) {
      filter.organizationId = parseObjectId(req.query.organizationId as string);
    }

    const col = db.collection(collectionName);
    const [items, total] = await Promise.all([
      col.find(filter).sort({ name: 1, _id: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter)
    ]);

    res.json({ items, page: { total, skip, limit } });
  } catch (e) { next(e); }
});

// 2. POST /api/admin/:collection/bulk (Carga masiva)
adminRouter.post("/:collection/bulk", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const docs = Array.isArray(req.body) ? req.body : [];
    
    if (docs.length === 0) return res.status(400).json({ error: "empty_array" });

    const now = new Date();
    const docsToInsert = docs.map(d => ({
      ...preparePayload(d),
      createdAt: now,
      updatedAt: now,
      version: 1
    }));

    const result = await db.collection(collectionName).insertMany(docsToInsert);
    res.status(201).json({ insertedCount: result.insertedCount, ids: result.insertedIds });
  } catch (e) { next(e); }
});

// 3. GET /api/admin/:collection/:id (Obtener uno)
adminRouter.get("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);
    const doc = await db.collection(collectionName).findOne({ _id });
    if (!doc) return res.status(404).json({ error: "not_found" });
    res.json(doc);
  } catch (e) { next(e); }
});

// 4. POST /api/admin/:collection (Crear uno)
adminRouter.post("/:collection", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const creator = req.headers["x-user-id"] || "admin_system"; 
    
    let payload = req.body ?? {};
    if (typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "invalid_body" });
    }

    payload = preparePayload(payload);

    const now = new Date();
    const doc = { 
      ...payload, 
      createdAt: now, 
      updatedAt: now,
      createdBy: creator,
      active: payload.active ?? true,
      version: 1       
    };

    const result = await db.collection(collectionName).insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (e) { next(e); }
});

// 5. PUT /api/admin/:collection/:id (Actualizar)
adminRouter.put("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);
    const updater = req.headers["x-user-id"] || "admin_system";

    let payload = req.body ?? {};
    if (typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "invalid_body" });
    }

    // Limpiamos el payload para no sobreescribir campos críticos
    const { _id: _ignored, createdAt: _ignoredDate, createdBy: _ignoredUser, ...updateData } = payload as any;
    const finalUpdateData = preparePayload(updateData);

    const result = await db.collection(collectionName).findOneAndUpdate(
      { _id }, 
      { 
        $set: { 
          ...finalUpdateData, 
          updatedAt: new Date(),
          updatedBy: updater 
        },
        $inc: { version: 1 }
      },
      { returnDocument: "after" }
    );

    if (!result) return res.status(404).json({ error: "not_found" });
    res.json(result);
  } catch (e) { next(e); }
});

// 6. DELETE /api/admin/:collection/:id (Eliminar)
adminRouter.delete("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);
    
    // NOTA: En Admin, a veces es mejor hacer "Soft Delete" (active: false)
    // Pero para mantener consistencia con tu módulo de operaciones, usamos delete real:
    const result = await db.collection(collectionName).deleteOne({ _id });
    
    if (result.deletedCount === 0) return res.status(404).json({ error: "not_found" });
    res.status(204).send();
  } catch (e) { next(e); }
});

// Normalización de Errores
adminRouter.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (!err) return next();
  const status = Number(err.status ?? 500);
  const message = status < 500 ? String(err.message ?? "bad_request") : "internal_error";
  res.status(status).json({ error: message });
});