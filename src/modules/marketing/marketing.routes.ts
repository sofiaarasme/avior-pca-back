import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { 
  CampaignModel, 
  TemplateModel, 
  MetricModel, 
  EmailLogModel 
} from "./collections.js"; // Asegúrate de que este archivo exporte los modelos de Mongoose

export const marketingRouter = Router();

// --- 1. ESQUEMAS DE VALIDACIÓN (ZOD) ---
// Esto sustituye a tus interfaces manuales y asegura "Any-less" code.

const CampaignSchemaZod = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  subject: z.string().min(1, "El asunto es obligatorio"),
  templateId: z.string().uuid("Template ID debe ser un UUID válido"),
  segmentId: z.string().min(1, "Segment ID es obligatorio"),
  status: z.enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "ARCHIVED"]).default("DRAFT"),
  scheduledAt: z.coerce.date().optional(),
  createdBy: z.string().min(1, "El creador es obligatorio"),
});

const TemplateSchemaZod = z.object({
  name: z.string().min(3),
  content: z.string().min(1),
  active: z.boolean().default(true),
});

const MetricSchemaZod = z.object({
  campaignId: z.string().uuid(),
  sent: z.number().nonnegative().default(0),
  delivered: z.number().nonnegative().default(0),
  opens: z.number().nonnegative().default(0),
  clicks: z.number().nonnegative().default(0),
});

/**
 * Esquema para validación de Query Params (Paginación y Filtros)
 * Sustituye a las funciones manuales de parseSort y limit/skip
 */
const QuerySchemaZod = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  skip: z.coerce.number().min(0).default(0),
  q: z.string().optional(), // Para búsquedas de texto
  sortBy: z.string().default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// --- 2. MIDDLEWARES DE APOYO ---

/**
 * Middleware de validación genérico
 * Elimina el uso de 'any' y asegura que req.body esté limpio
 */
const validate = (schema: z.ZodSchema) => 
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error); // El error será capturado por el manejador centralizado
    }
  };

/**
 * Utility para construir el sort de Mongoose sin usar JSON.parse inseguro
 */
const getSortOptions = (sortBy: string, order: "asc" | "desc"): Record<string, 1 | -1> => {
  return { [sortBy]: order === "asc" ? 1 : -1 };
};

const SegmentSchemaZod = z.object({
  name: z.string().min(1, "missing_name"),
  description: z.string().optional(),
  operator: z.enum(["AND", "OR"]).default("AND"),
  status: z.enum(["active", "paused", "archived"]).default("active"),
  conditions: z.array(z.object({
    id: z.string().optional(),
    field: z.string().min(1),
    operator: z.string().min(1),
    value: z.unknown()
  })).default([]),
  audienceSize: z.number().optional(),
});

const NotificationPayloadSchemaZod = z.object({
  flightId: z.string().optional(),
  type: z.string().min(1, "missing_type"),
  message: z.string().min(1, "missing_message"),
  channels: z.array(z.string()).default([]),
  sentAt: z.string().datetime().optional(),
  deliveryStats: z.object({
    sent: z.number().optional(),
    delivered: z.number().optional(),
    failed: z.number().optional(),
  }).optional(),
  createdBy: z.string().optional(),
});

// --- 2. LÓGICA DE BÚSQUEDA REUTILIZABLE (Sin Any) ---

/**
 * Procesa la búsqueda de texto 'q' para Mongoose
 */
const getSearchFilter = (q?: string) => {
  if (!q) return {};
  const searchRegex = { $regex: q, $options: "i" };
  return {
    $or: [
      { name: searchRegex },
      { subject: searchRegex },
      { title: searchRegex },
      { email: searchRegex },
      { message: searchRegex }
    ]
  };
};

// --- 3. RUTAS EXPLÍCITAS (Elimina el acceso dinámico /:collection) ---

/**
 * @openapi
 * /api/marketing/campaigns:
 *   get:
 *     summary: Listar campañas con filtros y paginación
 *     tags: [Marketing]
 */
marketingRouter.get("/campaigns", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, skip, q, sortBy, order } = QuerySchemaZod.parse(req.query);
    const filter = getSearchFilter(q);
    const sort = getSortOptions(sortBy, order);

    const [items, total] = await Promise.all([
      CampaignModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      CampaignModel.countDocuments(filter)
    ]);

    res.json({ items, page: { total, skip, limit } });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/marketing/templates:
 *   get:
 *     summary: Listar plantillas
 *     tags: [Marketing]
 */
marketingRouter.get("/templates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, skip, q, sortBy, order } = QuerySchemaZod.parse(req.query);
    const filter = getSearchFilter(q);
    const sort = getSortOptions(sortBy, order);

    const [items, total] = await Promise.all([
      TemplateModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      TemplateModel.countDocuments(filter)
    ]);

    res.json({ items, page: { total, skip, limit } });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/marketing/metrics:
 *   get:
 *     summary: Listar métricas de campañas
 *     tags: [Marketing]
 */
marketingRouter.get("/metrics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, skip, sortBy, order } = QuerySchemaZod.parse(req.query);
    const sort = getSortOptions(sortBy, order);

    const [items, total] = await Promise.all([
      MetricModel.find().sort(sort).skip(skip).limit(limit).lean(),
      MetricModel.countDocuments()
    ]);

    res.json({ items, page: { total, skip, limit } });
  } catch (e) { next(e); }
});


/**
 * @openapi
 * /api/marketing/campaigns/{id}:
 *   get:
 *     summary: Obtener una campaña por ID
 *     tags: [Campaigns]
 */
marketingRouter.get("/campaigns/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await CampaignModel.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "not_found" });
    res.json(doc);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/marketing/campaigns:
 *   post:
 *     summary: Crear una nueva campaña
 *     tags: [Campaigns]
 */
marketingRouter.post("/campaigns", validate(CampaignSchemaZod), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await CampaignModel.create(req.body);
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/marketing/campaigns/{id}:
 *   put:
 *     summary: Actualizar una campaña
 *     tags: [Campaigns]
 */
marketingRouter.put("/campaigns/:id", validate(CampaignSchemaZod.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await CampaignModel.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: "not_found" });
    res.json(doc);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/marketing/campaigns/{id}:
 *   delete:
 *     summary: Eliminar una campaña
 *     tags: [Campaigns]
 */
marketingRouter.delete("/campaigns/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CampaignModel.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found" });
    res.status(204).send();
  } catch (e) { next(e); }
});


// --- 2. RUTAS DE PLANTILLAS (TEMPLATES) ---

/**
 * @openapi
 * /api/marketing/templates/{id}:
 *   get:
 *     summary: Obtener una plantilla por ID
 *     tags: [Templates]
 */
marketingRouter.get("/templates/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await TemplateModel.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "not_found" });
    res.json(doc);
  } catch (e) { next(e); }
});

marketingRouter.post("/templates", validate(TemplateSchemaZod), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await TemplateModel.create(req.body);
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

marketingRouter.put("/templates/:id", validate(TemplateSchemaZod.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await TemplateModel.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: "not_found" });
    res.json(doc);
  } catch (e) { next(e); }
});

marketingRouter.delete("/templates/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await TemplateModel.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "not_found" });
    res.status(204).send();
  } catch (e) { next(e); }
});


// --- 3. RUTAS DE MÉTRICAS (METRICS) - Solo Lectura ---

/**
 * @openapi
 * /api/marketing/metrics/{campaignId}:
 *   get:
 *     summary: Obtener métricas de una campaña específica
 *     tags: [Metrics]
 */
marketingRouter.get("/metrics/:campaignId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await MetricModel.findOne({ campaignId: req.params.campaignId }).lean();
    if (!doc) return res.status(404).json({ error: "metrics_not_found" });
    res.json(doc);
  } catch (e) { next(e); }
});


// --- 4. MANEJO DE ERRORES CENTRALIZADO (SIN ANY) ---

interface CustomError extends Error {
  status?: number;
}

marketingRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // 1. Errores de Validación de Zod
  if (err instanceof z.ZodError) {
    return res.status(400).json({ 
      error: "validation_error", 
      details: err.issues.map(i => ({ path: i.path, message: i.message })) 
    });
  }

  // 2. Errores de Mongoose (CastError por IDs mal formados, etc)
  if (err && typeof err === 'object' && 'name' in err && err.name === 'CastError') {
    return res.status(400).json({ error: "invalid_id_format" });
  }

  // 3. Errores genéricos controlados
  const error = err as CustomError;
  const status = error.status || 500;
  const message = status < 500 ? error.message : "internal_error";

  // Log de errores 500 para el desarrollador
  if (status >= 500) {
    console.error("Critical Error:", error);
  }

  res.status(status).json({ error: message });
});