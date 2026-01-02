import { createApp } from "../app.js";
import type { Request, Response } from "express";

// Vercel may reuse the same lambda instance between requests.
// Cache the initial Mongo connection promise to avoid reconnecting on every request.
let connectPromise: Promise<void> | null = null;

const { app, mongo } = createApp();

export default async function handler(req: unknown, res: unknown) {
  try {
    if (!connectPromise) {
      connectPromise = mongo.connect();
    }
    await connectPromise;

    const expressHandler = app as unknown as (...args: unknown[]) => unknown;
    return expressHandler(req as Request, res as Response);
  } catch (err) {
    console.error("Vercel handler error", err);
    try {
      (res as Response).status(500).json({ error: "internal_error" });
    } catch {
      // ignore
    }
  }
}
