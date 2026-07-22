export type MockUserId = "u-admin" | "u-author" | "u-reader";

export type Article = {
  id: string;
  authorId: string;
  title: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
  visibilityType: string | null;
  visibilityTargetIds: string[];
  tagIds: string[];
  contentJson: string;
  renderedHtml: string;
  plainText: string;
};

export type SearchArticle = {
  articleId: string;
  title: string;
  summary: string;
  tags: string[];
  authorId: string;
  authorName: string;
  publishedAt: string;
  updatedAt: string;
};

type SearchResponse = { items: SearchArticle[]; total: number; page: number; size: number };

const identities: Record<MockUserId, Record<string, string>> = {
  "u-admin": {
    "X-Mock-User": "u-admin",
    "X-Mock-Roles": "ADMIN,REVIEWER,AUTHOR,READER",
    "X-Mock-Departments": "d-platform",
    "X-Mock-Teams": "t-search",
  },
  "u-author": {
    "X-Mock-User": "u-author",
    "X-Mock-Roles": "AUTHOR,READER",
    "X-Mock-Departments": "d-platform",
    "X-Mock-Teams": "t-search",
  },
  "u-reader": {
    "X-Mock-User": "u-reader",
    "X-Mock-Roles": "READER",
    "X-Mock-Departments": "d-pay",
    "X-Mock-Teams": "t-pay",
  },
};

export function buildMockUserHeaders(userId: MockUserId): Record<string, string> {
  return { ...identities[userId] };
}

function requestHeaders(userId: MockUserId, hasBody = false): Headers {
  const headers = new Headers(buildMockUserHeaders(userId));
  if (hasBody) headers.set("Content-Type", "application/json");
  if (import.meta.env.VITE_MOCK_OIDC_TOKEN) {
    headers.set("X-Mock-Token", import.meta.env.VITE_MOCK_OIDC_TOKEN);
  }
  return headers;
}

async function request<T>(userId: MockUserId, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}${path}`, {
    ...init,
    headers: requestHeaders(userId, init.body !== undefined),
  });
  if (!response.ok) throw new Error(await response.text() || "请求失败");
  return response.json() as Promise<T>;
}

export function articleContentJson(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

export const api = {
  createDraft(userId: MockUserId, title: string, text: string, tagIds: string[]) {
    return request<Article>(userId, "/articles/drafts", {
      method: "POST",
      body: JSON.stringify({ title, contentJson: articleContentJson(text), tagIds }),
    });
  },
  publish(userId: MockUserId, articleId: string, visibilityType: string, targetOrgIds: string[], reviewRequired: boolean) {
    return request<Article>(userId, `/articles/${articleId}/submit-publish`, {
      method: "POST",
      body: JSON.stringify({ visibilityType, targetOrgIds, reviewRequired }),
    });
  },
  getArticle(userId: MockUserId, articleId: string) {
    return request<Article>(userId, `/articles/${articleId}`);
  },
  search(userId: MockUserId, query: string) {
    return request<SearchResponse>(userId, `/search/articles?q=${encodeURIComponent(query)}`);
  },
};
