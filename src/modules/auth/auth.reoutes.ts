import { Router, type Request, type Response, type NextFunction } from "express";
import { ObjectId } from "mongodb";

export const authRouter = Router();

function getDb(req: Request) {
  const mongo = req.app.locals.mongo;
  if (!mongo) throw new Error("Mongo not initialized");
  return mongo.db;
}

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const db = getDb(req);

    if (!email || !password) {
      return res.status(400).json({ error: "email_and_password_required" });
    }

    // Buscamos al usuario
    const user = await db.collection("users").findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (!user) {
      return res.status(401).json({ error: "user_not_found" });
    }

    // Validación temporal (luego usaremos bcrypt)
    if (user.password !== password) {
      return res.status(401).json({ error: "invalid_password" });
    }

    // Respondemos con los datos necesarios para el móvil
    res.json({
      message: "login_success",
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId
      }
    });
  } catch (e) {
    next(e);
  }
});