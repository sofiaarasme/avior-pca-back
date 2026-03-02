import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { UserModel } from "../admin/collections.js"; // Importamos el modelo de Mongoose
// import jwt from "jsonwebtoken"; // Necesitarás instalarlo: npm install jsonwebtoken @types/jsonwebtoken

export const authRouter = Router();

// --- 1. ESQUEMA DE VALIDACIÓN (Zod) ---
const LoginSchema = z.object({
  email: z.string().email("Email inválido").toLowerCase().trim(),
  password: z.string().min(1, "La contraseña es requerida"),
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 */
authRouter.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 2. VALIDACIÓN DE ENTRADA CON ZOD
    // Sustituimos las validaciones manuales de if(!email)
    const { email, password } = await LoginSchema.parseAsync(req.body);

    // 3. USO DE MONGOOSE (Evitamos acceso dinámico y getDb)
    // Buscamos usando el modelo estricto. Mongoose maneja la conexión internamente.
    const user = await UserModel.findOne({ email }).select("+password"); 
    // .select("+password") es necesario si en el Schema pusiste password: { select: false }

    if (!user) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    // 4. VALIDACIÓN DE PASSWORD
    // Por ahora comparas texto plano, pero aquí iría: await bcrypt.compare(password, user.password)
    if (user.password !== password) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    if (!user.active) {
      return res.status(403).json({ error: "user_inactive" });
    }

    // 5. PROTECCIÓN DE RUTAS (Generación de Token)
    // Para proteger las rutas, el login debe devolver algo que identifique al usuario.
    // Ejemplo básico (deberías usar una librería como jsonwebtoken):
    const token = "JWT_GENERADO_AQUÍ"; 

    // Actualizamos el último login (Mongoose facilita esto)
    user.lastLogin = new Date();
    await user.save();

    // 6. RESPUESTA TIPADA (Sin any)
    res.json({
      message: "login_success",
      token, // Este token lo usará el móvil en los headers
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId
      }
    });
  } catch (e) {
    next(e); // El manejador de errores de Zod que hicimos en Admin se encargará si falla el parseAsync
  }
});

// Middleware de Error específico para este router (o puedes usar uno global)
authRouter.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ 
      error: "validation_error", 
      details: err.issues.map(i => ({ path: i.path, message: i.message })) 
    });
  }
  res.status(err.status || 500).json({ error: err.message || "internal_error" });
});