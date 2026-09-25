import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authTesting, configureUnauthorizedHandler, initializeAuth, LocalDemoAuthProvider, login, useAuth } from "@/auth/auth";
import { api } from "./client";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

beforeEach(async () => {
  authTesting.replaceProvider(new LocalDemoAuthProvider(memoryStorage(), "test-session", "test-token"));
  await initializeAuth();
  await login("u-author");
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("authenticated API client", () => {
  it("loads organization options with the current identity and memberships", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"departments":[],"teams":[]}'));
    vi.stubGlobal("fetch", fetchMock);
    await api.listPublishOrganizations();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/organizations/publish-options");
    expect((init.headers as Headers).get("X-Mock-Departments")).toBe("d-platform");
    expect((init.headers as Headers).get("X-Mock-Teams")).toBe("t-search");
  });
  it("injects the current session identity without a userId argument", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await api.listMyArticles();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(url).toBe("/api/articles/mine");
    expect(headers.get("X-Mock-Token")).toBe("test-token");
    expect(headers.get("X-Mock-User")).toBe("u-author");
    expect(headers.get("X-Mock-Roles")).toBe("AUTHOR,READER");
  });

  it("sends the complete draft projection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await api.updateDraft("article-1", "新标题", "新正文", ["java"], "backend");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/articles/article-1/draft");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ title: "新标题", contentJson: JSON.stringify({ type: "markdown", version: 1, source: "新正文" }), tagIds: ["java"], categoryId: "backend" });
  });

  it("clears the session and redirects only once on concurrent 401 responses", async () => {
    const redirect = vi.fn();
    configureUnauthorizedHandler(redirect);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));
    await Promise.allSettled([api.listMyArticles(), api.listNotifications()]);
    expect(useAuth().isAuthenticated.value).toBe(false);
    expect(redirect).toHaveBeenCalledOnce();
  });

  it("keeps the session on 403", async () => {
    const redirect = vi.fn();
    configureUnauthorizedHandler(redirect);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("无权访问", { status: 403 })));
    await expect(api.listMyArticles()).rejects.toThrow("无权访问");
    expect(useAuth().isAuthenticated.value).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("previews through the current identity without a draft write", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"renderedHtml":"<h1>标题</h1>","plainText":"标题"}'));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.previewArticle("# 标题\n")).resolves.toEqual({ renderedHtml: "<h1>标题</h1>", plainText: "标题" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/articles/preview");
    expect((init.headers as Headers).get("X-Mock-User")).toBe("u-author");
    expect(JSON.parse(JSON.parse(init.body as string).contentJson)).toEqual({ type: "markdown", version: 1, source: "# 标题\n" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
