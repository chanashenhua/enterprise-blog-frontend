import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRecovery, writeRecovery, type DraftRecovery } from "../draftRecovery";
import {
  authTesting, authorizationContext, configureUnauthorizedHandler, handleUnauthorized,
  initializeAuth, LocalDemoAuthProvider, login, logout, useAuth,
} from "./auth";

const AUTH_KEY = "enterprise-blog.portal.auth.v1";
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
  };
}

function recovery(userId = "u-author", slot = "new"): DraftRecovery {
  return {
    schema: 1, userId, slot, articleId: slot === "new" ? "" : slot,
    clientDraftId: "337eab95-b8f6-4e80-a8b8-eed11b889c6c", revision: null, savedAt: Date.now(),
    draft: { title: "未保存", body: "草稿内容", format: "markdown", tagIds: [], categoryId: "" },
    visibilityType: "COMPANY", targetOrgIds: [], baseline: "[]", scopeBaseline: "[]",
  };
}

let browser: EventTarget & { localStorage: Storage; sessionStorage: Storage };
let provider: LocalDemoAuthProvider;
beforeEach(() => {
  browser = Object.assign(new EventTarget(), { localStorage: memoryStorage(), sessionStorage: memoryStorage() });
  vi.stubGlobal("window", browser);
  provider = new LocalDemoAuthProvider(browser.localStorage, AUTH_KEY, "test-token");
  authTesting.replaceProvider(provider);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function storageEvent(newValue: string | null, key: string | null = AUTH_KEY, storageArea = browser.localStorage) {
  browser.dispatchEvent(Object.assign(new Event("storage"), { key, newValue, storageArea }));
}

describe("recovery cleanup during authentication", () => {
  it("restores only the current account's unexpired recoveries", async () => {
    browser.localStorage.setItem(AUTH_KEY, JSON.stringify({ version: 1, userId: "u-author" }));
    expect(writeRecovery(recovery())).toBe(true);
    expect(writeRecovery(recovery("u-admin"))).toBe(true);
    const expired = recovery("u-author", "expired-article");
    expect(writeRecovery(expired)).toBe(true);
    const expiredKey = [...Array(browser.sessionStorage.length).keys()]
      .map(index => browser.sessionStorage.key(index)!).find(key => key.endsWith(":expired-article"))!;
    browser.sessionStorage.setItem(expiredKey, JSON.stringify({ ...expired, savedAt: Date.now() - 24 * 60 * 60 * 1000 }));

    await initializeAuth();

    expect(readRecovery("u-author", "new")).not.toBeNull();
    expect(browser.sessionStorage.length).toBe(1);
    expect(readRecovery("u-admin", "new")).toBeNull();
    expect(readRecovery("u-author", "expired-article")).toBeNull();
  });

  it("removes recoveries when there is no restorable session", async () => {
    writeRecovery(recovery());
    await initializeAuth();
    expect(browser.sessionStorage.length).toBe(0);
  });

  it("prunes another account's recovery when login switches accounts", async () => {
    await login("u-author");
    writeRecovery(recovery());
    writeRecovery(recovery("u-admin"));
    await login("u-admin");
    expect(readRecovery("u-author", "new")).toBeNull();
    expect(readRecovery("u-admin", "new")).not.toBeNull();
  });

  it.each(["logout", "401"])("clears recovery and aborts requests after %s", async trigger => {
    await login("u-author");
    writeRecovery(recovery());
    const context = await authorizationContext();
    const redirect = vi.fn();
    configureUnauthorizedHandler(redirect);

    if (trigger === "logout") await logout();
    else await handleUnauthorized(context.generation);

    expect(context.signal.aborted).toBe(true);
    expect(useAuth().isAuthenticated.value).toBe(false);
    expect(browser.sessionStorage.length).toBe(0);
    expect(browser.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(redirect).toHaveBeenCalledTimes(trigger === "401" ? 1 : 0);
  });
});

describe("account changes in another browser tab", () => {
  it.each([
    { key: AUTH_KEY, value: JSON.stringify({ version: 1, userId: "u-admin" }) },
    { key: AUTH_KEY, value: null },
    { key: null, value: null },
    { key: AUTH_KEY, value: "corrupt session" },
  ])("invalidates this tab without deleting the other tab's session: $value", async change => {
    await login("u-author");
    writeRecovery(recovery());
    const context = await authorizationContext();
    const logoutSpy = vi.spyOn(provider, "logout");
    const redirect = vi.fn();
    configureUnauthorizedHandler(redirect);
    if (change.value === null) browser.localStorage.removeItem(AUTH_KEY);
    else browser.localStorage.setItem(AUTH_KEY, change.value);

    storageEvent(change.value, change.key);
    await vi.waitFor(() => expect(redirect).toHaveBeenCalledOnce());

    expect(context.signal.aborted).toBe(true);
    expect(() => context.assertCurrent()).toThrow("会话已结束");
    expect(useAuth().isAuthenticated.value).toBe(false);
    expect(browser.sessionStorage.length).toBe(0);
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(browser.localStorage.getItem(AUTH_KEY)).toBe(change.value);
    await handleUnauthorized(context.generation);
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledOnce();
    await expect(authorizationContext()).rejects.toThrow("会话已结束");
  });

  it("keeps the current account for same-account, unrelated-key and sessionStorage events", async () => {
    await login("u-author");
    writeRecovery(recovery());
    const context = await authorizationContext();
    const redirect = vi.fn();
    configureUnauthorizedHandler(redirect);

    storageEvent(JSON.stringify({ version: 1, userId: "u-author" }));
    storageEvent(null, "unrelated-key");
    storageEvent(null, AUTH_KEY, browser.sessionStorage);

    expect(context.signal.aborted).toBe(false);
    expect(useAuth().user.value?.id).toBe("u-author");
    expect(readRecovery("u-author", "new")).not.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
});
