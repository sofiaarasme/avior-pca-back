export const marketingCollections = [
  "campaigns",
  "templates",
  "segments",
  "recipients",
  "flights",
  "notifications",
  "email_logs",
  "metrics"
] as const;

export type MarketingCollectionName = (typeof marketingCollections)[number];

export function isMarketingCollectionName(value: string): value is MarketingCollectionName {
  return (marketingCollections as readonly string[]).includes(value);
}
