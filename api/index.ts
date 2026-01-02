// Vercel types are not available in this environment; handler will use untyped parameters

import { createApp } from "../src/app.js";
import type { Request, Response } from "express";

// Vercel may reuse the same lambda instance between requests.
// Keep the connection promise cached to avoid reconnecting for every request.
let connectPromise: Promise<void> | null = null;

const { app, mongo } = createApp();

export default async function handler(req: unknown, res: unknown) {
  try {
    if (!connectPromise) {
      connectPromise = mongo.connect();
    }
    await connectPromise;

  // Delegate to Express - cast to a callable function
  const expressHandler = app as unknown as (...args: unknown[]) => unknown;
  return expressHandler(req as Request, res as Response);
  } catch (err) {
    console.error("Vercel handler error", err);
    // res might not be the Express Response type here, attempt a safe cast
    try {
      (res as Response).status(500).json({ error: "internal_error" });
    } catch {
      // fallback: nothing we can do
    }
  }
}
