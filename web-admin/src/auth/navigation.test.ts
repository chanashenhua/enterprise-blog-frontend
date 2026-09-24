import { describe, expect, it } from "vitest";
import { safeRedirect } from "./navigation";

describe("admin safeRedirect", () => {
  it("preserves an internal management destination", () => expect(safeRedirect("/reviews?status=pending")).toBe("/reviews?status=pending"));
  it.each(["https://evil.example", "//evil.example", "/login", "/login#again"])('rejects unsafe redirect "%s"', (path) => expect(safeRedirect(path)).toBe("/"));
});
