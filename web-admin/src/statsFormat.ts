export function compactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function engagementRate(likes: number, favorites: number, views: number) {
  if (views <= 0) return "0%";
  return `${Math.round(((likes + favorites) / views) * 100)}%`;
}

export function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export function interactionTotal(views: number, likes: number, favorites: number) {
  return views + likes + favorites;
}
