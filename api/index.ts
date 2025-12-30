// Vercel types are not available in this environment; handler will use untyped parameters

import { createApp } from "../src/app.js";

// Vercel may reuse the same lambda instance between requests.
// Keep the connection promise cached to avoid reconnecting for every request.
let connectPromise: Promise<void> | null = null;

const { app, mongo } = createApp();

export default async function handler(req: any, res: any) {
  try {
    if (!connectPromise) {
      connectPromise = mongo.connect();
    }
    await connectPromise;

    // Delegate to Express
    return app(req as any, res as any);
  } catch (err) {
    console.error("Vercel handler error", err);
    res.status(500).json({ error: "internal_error" });
  }
}
