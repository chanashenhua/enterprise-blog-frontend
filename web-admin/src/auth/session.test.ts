import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import { authTesting, configureUnauthorizedHandler, initializeAuth, LocalDemoAuthProvider, login, logout, useAuth } from "./auth";

beforeEach(async () => {
  const values = new Map<string, string>();
  authTesting.replaceProvider(new LocalDemoAuthProvider({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  }, "test", "token"));
  await initializeAuth();
  await login("u-admin");
});
afterEach(() => vi.unstubAllGlobals());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const load = () => api.reviews();

describe("session request isolation", () => {
  it.each([200, 401])("discards a late %s from a previous login", async status => {
    const response = deferred<Response>();
    const started = deferred<void>();
    const redirect = vi.fn();
    configureUnauthorizedHandler(redirect);
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, init) => { signal = init.signal; started.resolve(); return response.promise; }));
    const pending = load();
    const result = expect(pending).rejects.toThrow("会话已结束");
    await started.promise;
    await logout();
    expect(signal?.aborted).toBe(true);
    await login("u-reader");
    response.resolve(new Response("[]", { status }));
    await result;
    expect(useAuth().user.value?.id).toBe("u-reader");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("invalidates once even when 401 responses arrive at different times", async () => {
    const late = deferred<Response>();
    let calls = 0;
    const bothStarted = deferred<void>();
    vi.stubGlobal("fetch", vi.fn(() => {
      if (++calls === 2) { bothStarted.resolve(); return late.promise; }
      return Promise.resolve(new Response("", { status: 401 }));
    }));
    const redirect = vi.fn(); configureUnauthorizedHandler(redirect);
    const results = Promise.allSettled([load(), load()]);
    await bothStarted.promise;
    await vi.waitFor(() => expect(redirect).toHaveBeenCalledOnce());
    late.resolve(new Response("", { status: 401 }));
    await results;
    expect(redirect).toHaveBeenCalledOnce();
    expect(useAuth().isAuthenticated.value).toBe(false);
  });

  it("does not send a request after logout", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await logout();
    await expect(load()).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects inherited object keys as demo identities", async () => {
    await expect(login("toString")).rejects.toThrow("有效的演示账号");
    await expect(login("__proto__")).rejects.toThrow("有效的演示账号");
  });
});

