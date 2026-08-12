export function safeRedirect(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/login#")) return fallback;
  return path;
}
