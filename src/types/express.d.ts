import type { MongoClient, Db } from "mongodb";

declare global {
  namespace Express {
    interface Locals {
      mongo?: {
        client: MongoClient;
        db: Db;
      };
    }
  }
}

export {};
