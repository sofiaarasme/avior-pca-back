import { MongoClient } from "mongodb";

export function createMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI in environment");
  }

  const client = new MongoClient(uri);

  // Db name: try to infer from URI path; fallback
  const dbName = (() => {
    try {
      const u = new URL(uri);
      const name = u.pathname?.replace(/^\//, "");
      return name || "avior_pca";
    } catch {
      return "avior_pca";
    }
  })();

  return {
    client,
    get db() {
      return client.db(dbName);
    },
    async connect() {
      await client.connect();
    }
  };
}
