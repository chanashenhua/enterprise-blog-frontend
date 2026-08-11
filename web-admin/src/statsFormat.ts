export function compactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function engagementRate(likes: number, favorites: number, views: number) {
  if (views <= 0) return "0%";
  return `${Math.round(((likes + favorites) / views) * 100)}%`;
}
