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
    const user = req.headers["x-user-id"] || "sistema_web"; 
    const payload = req.body ?? {};
    
    if (typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "invalid_body" });
    }

    const now = new Date();
    const doc = { 
      ...payload, 
      createdAt: now, 
      updatedAt: now,
      createdBy: user, 
      updatedBy: user, 
      version: 1       
    };

    const result = await db.collection(collectionName).insertOne(doc);
    const insertedId = result.insertedId;
    if (collectionName === "notifications") {
      try {
        await db.collection("status_history").insertOne({
          organizationId: payload.organizationId ? parseObjectId(payload.organizationId) : null,
          flightId: payload.flightId ? parseObjectId(payload.flightId) : null,
          status: payload.type || "NOTIFICATION_SENT",
          timestamp: now,
          user: user,
          remarks: payload.message || "Notificación enviada",
          notificationId: insertedId,
          createdAt: now
        });
      } catch (histError) {
        console.error("Error creando historial de notificación:", histError);
      }
    }

    res.status(201).json({ _id: insertedId, ...doc });
  } catch (e) { 
    next(e); 
  }
});

// 5. PUT /api/operations/:collection/:id (Actualizar)
operationsRouter.put("/:collection/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionName = collectionFromParam(req);
    const db = getDb(req);
    const _id = parseObjectId(req.params.id);
    const user = req.headers["x-user-id"] || "sistema_mobile";
    const payload = req.body ?? {};
    
    if (typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "invalid_body" });
    }
    const now = new Date();
    const { _id: _ignored, createdAt: _ignoredDate, createdBy: _ignoredUser, ...updateData } = payload as any;
    let query: any = { _id };
    if (collectionName === "flights") {
      if (typeof payload.version === "undefined") {
        return res.status(400).json({ error: "version_required_for_conflict_control" });
      }
      query.version = Number(payload.version);
    }
    const result = await db.collection(collectionName).findOneAndUpdate(
      query, 
      { 
        $set: { 
          ...updateData, 
          updatedAt: now,
          updatedBy: user 
        },
        $inc: { version: 1 } 
      },
      { returnDocument: "after" }
    );
    if (!result) {
      const actualDoc = await db.collection(collectionName).findOne({ _id });
      
      if (actualDoc && collectionName === "flights") {
        return res.status(409).json({ 
          error: "conflict", 
          message: "Ya este vuelo fue actualizado por otra persona. Por favor refresca los datos.",
          serverVersion: actualDoc.version,
          yourVersion: payload.version
        });
      }
      return res.status(404).json({ error: "not_found" });
    }
    if (collectionName === "flights" && updateData.status) {
      try {
        await db.collection("status_history").insertOne({
          organizationId: result.organizationId ? result.organizationId : null,
          flightId: _id,
          status: updateData.status,
          timestamp: now,
          user: user,
          remarks: updateData.remarks || `Estado actualizado a ${updateData.status} (v${result.version})`,
          createdAt: now
        });
      } catch (histError) {
        console.error("Error creando historial de vuelo:", histError);
      }
    }
    res.json(result);
  } catch (e) { 
    next(e); 
  }
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

// 7. GET /api/operations/my-flights
// El móvil envía su ID de usuario en los headers o query
operationsRouter.get("/my-flights", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb(req);
    const userId = req.headers["x-user-id"] as string;

    if (!userId) return res.status(400).json({ error: "user_id_required" });

    const userObjectId = parseObjectId(userId);

    // Usamos Aggregation para buscar asignaciones y traer los datos del vuelo de una vez
    const myFlights = await db.collection("assignments").aggregate([
      { 
        // 1. Buscamos las asignaciones del usuario
        $match: { userId: userObjectId } 
      },
      {
        // 2. Hacemos un "JOIN" con la colección de flights
        $lookup: {
          from: "flights",
          localField: "flightId",
          foreignField: "_id",
          as: "flightData"
        }
      },
      { 
        // 3. Convertimos el array de flightData en un objeto simple
        $unwind: "$flightData" 
      },
      {
        // 4. Limpiamos la respuesta para que solo devuelva los datos del vuelo + tu rol
        $project: {
          _id: "$flightData._id",
          flightNumber: "$flightData.flightNumber",
          status: "$flightData.status",
          origin: "$flightData.origin",
          destination: "$flightData.destination",
          roleInFlight: "$roleInFlight" // Tu rol específico en ese vuelo
        }
      }
    ]).toArray();

    res.json(myFlights);
  } catch (e) { next(e); }
});

// --- AÑADE ESTO: Normalización de Errores (Igual que en Marketing) ---
operationsRouter.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (!err) return next();
  const status = Number(err.status ?? 500);
  const message = status < 500 ? String(err.message ?? "bad_request") : "internal_error";
  res.status(status).json({ error: message });
});