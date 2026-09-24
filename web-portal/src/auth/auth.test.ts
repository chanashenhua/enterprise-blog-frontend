import { describe, expect, it } from "vitest";
import { DEMO_USERS, LocalDemoAuthProvider, type AuthStorage } from "./auth";

function storage(initial?: Record<string, string>): AuthStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial ?? {}));
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

describe("LocalDemoAuthProvider", () => {
  it("defines all three demo identities", () => {
    expect(Object.keys(DEMO_USERS)).toEqual(["u-admin", "u-author", "u-reader"]);
    expect(DEMO_USERS["u-admin"].roles).toContain("ADMIN");
    expect(DEMO_USERS["u-author"].roles).toEqual(["AUTHOR", "READER"]);
    expect(DEMO_USERS["u-reader"].departmentIds).toEqual(["d-pay"]);
  });

  it("logs in, restores after refresh and never persists the mock token", async () => {
    const state = storage();
    const provider = new LocalDemoAuthProvider(state, "session", "super-secret-token");
    await provider.login("u-author");
    expect(state.getItem("session")).toBe(JSON.stringify({ version: 1, userId: "u-author" }));
    expect(state.getItem("session")).not.toContain("super-secret-token");
    const restored = await new LocalDemoAuthProvider(state, "session", "super-secret-token").initialize();
    expect(restored?.user).toEqual(DEMO_USERS["u-author"]);
  });

  it.each(["not-json", JSON.stringify({ version: 2, userId: "u-author" }), JSON.stringify({ version: 1, userId: "missing" })])("clears invalid storage: %s", async (stored) => {
    const state = storage({ session: stored });
    expect(await new LocalDemoAuthProvider(state, "session", "token").initialize()).toBeNull();
    expect(state.getItem("session")).toBeNull();
  });

  it("clears the session on logout", async () => {
    const state = storage(); const provider = new LocalDemoAuthProvider(state, "session", "token");
    await provider.login("u-reader"); await provider.logout();
    expect(state.getItem("session")).toBeNull();
    await expect(provider.authorizationHeaders()).rejects.toThrow("登录状态已失效");
  });

  it("refuses local login without a mock token", async () => {
    await expect(new LocalDemoAuthProvider(storage(), "session", undefined).login("u-admin")).rejects.toThrow("VITE_MOCK_OIDC_TOKEN");
  });
});
