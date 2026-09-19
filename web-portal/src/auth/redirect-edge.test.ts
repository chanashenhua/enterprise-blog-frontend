import { expect, it } from "vitest";
import { safeRedirect } from "./navigation";
it.each(["/login/", "/LOGIN", "/a/../login", "/%2f%2fevil.test", "/%5cevil.test", "/%0Aevil", "/%255cevil.test", "/%"] )("rejects encoded and normalized redirects: %s", path => {
  expect(safeRedirect(path)).toBe("/");
});
