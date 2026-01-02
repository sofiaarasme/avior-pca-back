export type OperationsCollectionName = "flights" | "notifications";

export function isOperationsCollectionName(val: unknown): val is OperationsCollectionName {
  return val === "flights" || val === "notifications";
}