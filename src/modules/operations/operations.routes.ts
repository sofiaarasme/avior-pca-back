import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { 
  FlightModel, 
  NotificationModel, 
  StatusHistoryModel, 
  AssignmentModel 
} from "./collections.js";

export const operationsRouter = Router();

// --- 1. ESQUEMAS DE VALIDACIÓN (ZOD) ---

const FlightSchemaZod = z.object({
  flightNumber: z.string().min(1),
  origin: z.string().min(2),
  destination: z.string().min(2),
  status: z.enum(["ON_TIME", "DELAYED", "CANCELLED", "LANDED"]).default("ON_TIME"),
  organizationId: z.string().optional(),
  version: z.number().optional(),
  remarks: z.string().optional(),
});

const NotificationSchemaZod = z.object({
  type: z.string().min(1),
  message: z.string().min(1),
  flightId: z.string().optional(),
  organizationId: z.string().optional(),
});

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  skip: z.coerce.number().min(0).default(0),
});

// --- 2. MIDDLEWARE DE VALIDACIÓN ---

const validate = (schema: z.ZodSchema) => 
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };

// --- 3. RUTAS DE VUELOS (FLIGHTS) ---

/**
 * @openapi
 * /api/operations/flights:
 *   get:
 *     summary: Listar todos los vuelos
 *     tags: [Operations]
 */
operationsRouter.get("/flights", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, skip } = QuerySchema.parse(req.query);
    const [items, total] = await Promise.all([
      FlightModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      FlightModel.countDocuments()
    ]);
    res.json({ items, page: { total, skip, limit } });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/operations/flights/bulk:
 *   post:
 *     summary: Carga masiva de vuelos
 *     tags: [Operations]
 */
operationsRouter.post("/flights/bulk", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = Array.isArray(req.body) ? req.body : [];
    if (docs.length === 0) return res.status(400).json({ error: "empty_array" });

    // Validamos cada documento con el esquema de vuelos
    const validatedDocs = docs.map(d => FlightSchemaZod.parse(d));
    const result = await FlightModel.insertMany(validatedDocs);
    
    res.status(201).json({ insertedCount: result.length, items: result });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/operations/flights/{id}:
 *   get:
 *     summary: Obtener detalle de un vuelo
 *     tags: [Operations]
 */
operationsRouter.get("/flights/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await FlightModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "not_found" });
    res.json(doc);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/operations/flights:
 *   post:
 *     summary: Crear un vuelo individual
 *     tags: [Operations]
 */
operationsRouter.post("/flights", validate(FlightSchemaZod), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.headers["x-user-id"] || "sistema_web";
    const doc = await FlightModel.create({
      ...req.body,
      createdBy: user,
      version: 1
    });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/operations/flights/{id}:
 *   put:
 *     summary: Actualizar vuelo con control de concurrencia
 *     tags: [Operations]
 */
operationsRouter.put("/flights/:id", validate(FlightSchemaZod.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawUser = req.headers["x-user-id"];
    const user = Array.isArray(rawUser) ? rawUser[0] : (rawUser || "sistema_mobile");
    const { version, remarks, ...updateData } = req.body;

    if (version === undefined) {
      return res.status(400).json({ error: "version_required_for_conflict_control" });
    }

    // Control de conflictos: buscamos por ID y Versión
    const doc = await FlightModel.findOneAndUpdate(
      { _id: req.params.id, version: version },
      { 
        $set: { ...updateData, updatedBy: user },
        $inc: { version: 1 } 
      },
      { new: true }
    );

    if (!doc) {
      const current = await FlightModel.findById(req.params.id);
      if (current) {
        return res.status(409).json({ 
          error: "conflict", 
          serverVersion: current.version,
          yourVersion: version 
        });
      }
      return res.status(404).json({ error: "not_found" });
    }

    // Si cambió el estado, registramos en el historial
    if (updateData.status) {
      await StatusHistoryModel.create({
        flightId: doc._id,
        organizationId: doc.organizationId,
        status: updateData.status,
        user: user,
        remarks: remarks || `Estado actualizado a ${updateData.status} (v${doc.version})`
      });
    }

    res.json(doc);
  } catch (e) { next(e); }
});

// --- 4. RUTAS DE NOTIFICACIONES ---

/**
 * @openapi
 * /api/operations/notifications:
 *   post:
 *     summary: Crear notificación y registrar historial
 *     tags: [Operations]
 */
operationsRouter.post("/notifications", validate(NotificationSchemaZod), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawUser = req.headers["x-user-id"];
    const user = Array.isArray(rawUser) ? rawUser[0] : (rawUser || "sistema_mobile");
    const notification = await NotificationModel.create({
      ...req.body,
      createdBy: user
    });

    // Registrar en el historial de estatus
    await StatusHistoryModel.create({
      organizationId: req.body.organizationId,
      flightId: req.body.flightId,
      status: req.body.type || "NOTIFICATION_SENT",
      user: user,
      remarks: req.body.message || "Notificación enviada",
      notificationId: notification._id
    });

    res.status(201).json(notification);
  } catch (e) { next(e); }
});

// --- 5. RUTA ESPECIALIZADA: MY-FLIGHTS ---

/**
 * @openapi
 * /api/operations/my-flights:
 *   get:
 *     summary: Obtener vuelos asignados al usuario actual (Aggregation)
 *     tags: [Operations]
 */
operationsRouter.get("/my-flights", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) return res.status(400).json({ error: "user_id_required" });

    const myFlights = await AssignmentModel.aggregate([
      { $match: { userId: userId } },
      {
        $lookup: {
          from: "flights",
          localField: "flightId",
          foreignField: "_id",
          as: "flightData"
        }
      },
      { $unwind: "$flightData" },
      {
        $project: {
          _id: "$flightData._id",
          flightNumber: "$flightData.flightNumber",
          status: "$flightData.status",
          origin: "$flightData.origin",
          destination: "$flightData.destination",
          roleInFlight: "$roleInFlight"
        }
      }
    ]);

    res.json(myFlights);
  } catch (e) { next(e); }
});

// --- 6. DELETE (GENÉRICO PERO RESTRINGIDO) ---

operationsRouter.delete("/flights/:id", async (req, res, next) => {
  try {
    const result = await FlightModel.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found" });
    res.status(204).send();
  } catch (e) { next(e); }
});

// --- 7. MANEJO DE ERRORES NORMALIZADO ---

operationsRouter.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ 
      error: "validation_error", 
      details: err.issues.map(i => ({ path: i.path, message: i.message })) 
    });
  }

  const status = err.status || 500;
  const message = status < 500 ? err.message : "internal_error";
  res.status(status).json({ error: message });
});