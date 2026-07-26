import { afterEach, describe, expect, it, vi } from "vitest";
import { api, buildMockUserHeaders } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildMockUserHeaders", () => {
  it("builds dev mock identity headers", () => {
    expect(buildMockUserHeaders("u-author")).toEqual({
      "X-Mock-User": "u-author",
      "X-Mock-Roles": "AUTHOR,READER",
      "X-Mock-Departments": "d-platform",
      "X-Mock-Teams": "t-search",
    });
  });

  it("loads the current user's articles through the gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await api.listMyArticles("u-author");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/articles/mine");
    expect((init.headers as Headers).get("X-Mock-User")).toBe("u-author");
  });

  it("sends the full draft projection when updating an article", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
    vi.stubGlobal("fetch", fetchMock);

    await api.updateDraft("u-author", "article-1", "新标题", "新正文", ["java"], "backend");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/articles/article-1/draft");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      title: "新标题",
      contentJson: JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "新正文" }] }],
      }),
      tagIds: ["java"],
      categoryId: "backend",
    });
  });

  it("uses idempotent endpoints for article likes and favorites", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
    vi.stubGlobal("fetch", fetchMock);

    await api.setArticleLike("u-reader", "article-1", true);
    await api.setArticleFavorite("u-reader", "article-1", false);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/articles/article-1/interactions/likes",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/articles/article-1/interactions/favorites",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
