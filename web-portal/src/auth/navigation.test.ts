import { describe, expect, it } from "vitest";
import { safeRedirect } from "./navigation";

describe("safeRedirect", () => {
  it("accepts a path inside the current SPA", () => expect(safeRedirect("/articles/42?tab=history")).toBe("/articles/42?tab=history"));
  it.each(["https://evil.example", "//evil.example", "/login", "/login?redirect=/", "/\\evil.example"])('rejects unsafe redirect "%s"', (path) => expect(safeRedirect(path)).toBe("/"));
});
