import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authTesting, configureUnauthorizedHandler, initializeAuth, LocalDemoAuthProvider, login, useAuth } from "@/auth/auth";
import { api } from "./client";

function storage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }; }
beforeEach(async () => { authTesting.replaceProvider(new LocalDemoAuthProvider(storage(), "session", "token")); await initializeAuth(); await login("u-admin"); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("admin API authentication", () => {
  it("injects the current administrator session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock); await api.reviews();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get("X-Mock-User")).toBe("u-admin");
    expect((init.headers as Headers).get("X-Mock-Token")).toBe("token");
  });

  it("clears the session on 401 but keeps it on 403", async () => {
    const redirect = vi.fn(); configureUnauthorizedHandler(redirect);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("forbidden", { status: 403 })).mockResolvedValueOnce(new Response("unauthorized", { status: 401 })));
    await expect(api.reviews()).rejects.toThrow("forbidden");
    expect(useAuth().isAuthenticated.value).toBe(true);
    await expect(api.reviews()).rejects.toThrow("登录状态已失效");
    expect(useAuth().isAuthenticated.value).toBe(false);
    expect(redirect).toHaveBeenCalledOnce();
  });
});
