import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { OrganizationModel, UserModel } from "./collections.js";

export const adminRouter = Router();

// --- ESQUEMAS DE VALIDACIÓN (ZOD) ---
console.log("Cargando rutas de Admin...");
adminRouter.get("/test", (req, res) => res.send("OK"));
const OrganizationSchemaZod = z.object({
  name: z.string().min(2),
  taxId: z.string().min(5),
  logo: z.string().url().optional(),
  colors: z.object({
    main: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  type: z.enum(["AIRLINE", "GROUND_HANDLING"]),
  active: z.boolean().optional(),
});

const UserSchemaZod = z.object({
  organizationId: z.string().uuid("ID de organización inválido"),
  email: z.string().email(),
  user: z.string().min(3),
  password: z.string().min(6).optional(),
  fullName: z.string().min(3),
  role: z.enum(["ADMIN", "PILOT", "GROUND_STAFF", "GATE_AGENT"]),
  fcmToken: z.string().optional(),
  active: z.boolean().optional(),
});

/**
 * Middleware de validación corregido
 * Usamos z.ZodSchema para evitar el error de AnyZodObject
 */
const validate = (schema: z.ZodSchema) => 
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // parseAsync valida y devuelve el objeto limpio
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next({ status: 400, message: error });
    }
  };

// --- RUTAS DE ORGANIZACIONES ---

// 1. Listar Organizaciones
adminRouter.get("/organizations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const skip = Math.max(Number(req.query.skip ?? 0), 0);

    const [items, total] = await Promise.all([
      OrganizationModel.find().sort({ name: 1 }).skip(skip).limit(limit),
      OrganizationModel.countDocuments()
    ]);

    res.json({ items, page: { total, skip, limit } });
  } catch (e) { next(e); }
});

// 2. Crear Organización
adminRouter.post("/organizations", validate(OrganizationSchemaZod), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newOrg = new OrganizationModel({
      ...req.body,
      // Mantenemos la lógica de auditoría que tenías
      createdBy: req.headers["x-user-id"] || "admin_system",
      version: 1
    });
    await newOrg.save();
    res.status(201).json(newOrg);
  } catch (e) { next(e); }
});

// 3. Carga masiva Organizaciones
adminRouter.post("/organizations/bulk", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = Array.isArray(req.body) ? req.body : [];
    if (docs.length === 0) return res.status(400).json({ error: "empty_array" });
    
    // Validamos cada documento con el esquema de Zod
    const validatedDocs = docs.map(d => OrganizationSchemaZod.parse(d));
    
    const now = new Date();
    const docsToInsert = validatedDocs.map(d => ({
      ...d,
      createdAt: now,
      updatedAt: now,
      version: 1
    }));

    const result = await OrganizationModel.insertMany(docsToInsert);
    res.status(201).json({ insertedCount: result.length, items: result });
  } catch (e) { next(e); }
});

// 4. Rutas por ID de Organización (GET, PUT, DELETE)
adminRouter.route("/organizations/:id")
  .get(async (req, res, next) => {
    try {
      const doc = await OrganizationModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: "not_found" });
      res.json(doc);
    } catch (e) { next(e); }
  })
  .put(validate(OrganizationSchemaZod.partial()), async (req, res, next) => {
    try {
      const updater = req.headers["x-user-id"] || "admin_system";
      const doc = await OrganizationModel.findByIdAndUpdate(
        req.params.id,
        { 
          $set: { ...req.body, updatedAt: new Date(), updatedBy: updater },
          $inc: { version: 1 } 
        },
        { new: true }
      );
      if (!doc) return res.status(404).json({ error: "not_found" });
      res.json(doc);
    } catch (e) { next(e); }
  })
  .delete(async (req, res, next) => {
    try {
      const result = await OrganizationModel.findByIdAndDelete(req.params.id);
      if (!result) return res.status(404).json({ error: "not_found" });
      res.status(204).send();
    } catch (e) { next(e); }
  });


// --- RUTAS DE USUARIOS ---

// 1. Listar Usuarios
adminRouter.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const skip = Math.max(Number(req.query.skip ?? 0), 0);
    
    const filter: Record<string, any> = {};
    if (req.query.organizationId) filter.organizationId = req.query.organizationId;

    const [items, total] = await Promise.all([
      UserModel.find(filter).populate('organizationId').skip(skip).limit(limit),
      UserModel.countDocuments(filter)
    ]);

    res.json({ items, page: { total, skip, limit } });
  } catch (e) { next(e); }
});

// 2. Crear Usuario
adminRouter.post("/users", validate(UserSchemaZod), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newUser = new UserModel({
      ...req.body,
      createdBy: req.headers["x-user-id"] || "admin_system",
      version: 1
    });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (e) { next(e); }
});

// 3. Rutas por ID de Usuario
adminRouter.route("/users/:id")
  .get(async (req, res, next) => {
    try {
      const doc = await UserModel.findById(req.params.id).populate('organizationId');
      if (!doc) return res.status(404).json({ error: "not_found" });
      res.json(doc);
    } catch (e) { next(e); }
  })
  .put(validate(UserSchemaZod.partial()), async (req, res, next) => {
    try {
      const doc = await UserModel.findByIdAndUpdate(
        req.params.id,
        { $set: req.body, $inc: { version: 1 } },
        { new: true }
      );
      if (!doc) return res.status(404).json({ error: "not_found" });
      res.json(doc);
    } catch (e) { next(e); }
  })
  .delete(async (req, res, next) => {
    try {
      const result = await UserModel.findByIdAndDelete(req.params.id);
      if (!result) return res.status(404).json({ error: "not_found" });
      res.status(204).send();
    } catch (e) { next(e); }
  });

// --- MANEJO DE ERRORES CENTRALIZADO ---
adminRouter.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Errores de Zod
  if (err instanceof z.ZodError) {
    return res.status(400).json({ 
      error: "validation_error", 
      details: err.issues.map(e => ({ path: e.path, message: e.message }))
    });
  }

  const status = err.status || 500;
  const message = status < 500 ? err.message : "internal_error";
  
  res.status(status).json({ error: message });
});