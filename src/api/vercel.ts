import { createApp } from "../app.js";

// Vercel may reuse the same lambda instance between requests.
// Cache the initial Mongo connection promise to avoid reconnecting on every request.
let connectPromise: Promise<void> | null = null;

const { app, mongo } = createApp();

export default async function handler(req: any, res: any) {
  try {
    if (!connectPromise) {
      connectPromise = mongo.connect();
    }
    await connectPromise;

    return app(req as any, res as any);
  } catch (err) {
    console.error("Vercel handler error", err);
    res.status(500).json({ error: "internal_error" });
  }
}
