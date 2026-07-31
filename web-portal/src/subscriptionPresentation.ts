import type { CatalogItem, ContentSubscription } from "@/api/client";

export function subscriptionKey(type: ContentSubscription["targetType"], targetId: string): string {
  return `${type}:${targetId}`;
}

export function subscriptionName(
  subscription: ContentSubscription,
  tags: CatalogItem[],
  categories: CatalogItem[],
): string {
  const catalog = subscription.targetType === "TAG" ? tags : categories;
  return catalog.find((item) => item.id === subscription.targetId)?.name ?? subscription.targetId;
}
