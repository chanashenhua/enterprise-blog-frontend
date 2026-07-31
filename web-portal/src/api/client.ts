export type MockUserId = "u-admin" | "u-author" | "u-reader";

export type Article = {
  id: string;
  authorId: string;
  title: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "WITHDRAWN" | "DELETED";
  visibilityType: string | null;
  visibilityTargetIds: string[];
  tagIds: string[];
  categoryId: string | null;
  contentJson: string;
  renderedHtml: string;
  plainText: string;
};

export type ArticleContentVersion = {
  articleId: string;
  versionNo: number;
  title: string;
  contentJson: string;
  renderedHtml: string;
  plainText: string;
  tagIds: string[];
  categoryId: string | null;
  createdBy: string;
  createdAt: string;
};

export type ArticleInteraction = {
  articleId: string;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  liked: boolean;
  favorited: boolean;
};

export type PersonalInteractionItem = {
  articleId: string;
  interactionType: "FAVORITE" | "VIEW" | string;
  interactedAt: string;
};

export type UserNotification = {
  id: string;
  type: "REVIEW_APPROVED" | "REVIEW_REJECTED" | "COMMENT_REPLY" | string;
  title: string;
  content: string;
  resourceType: string | null;
  resourceId: string | null;
  read: boolean;
  createdAt: string;
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
  if (!response.ok) {
    const rawMessage = await response.text();
    try {
      const error = JSON.parse(rawMessage) as { message?: string };
      throw new Error(error.message || "请求失败");
    } catch (reason) {
      if (reason instanceof SyntaxError) throw new Error(rawMessage || "请求失败");
      throw reason;
    }
  }
  return response.json() as Promise<T>;
}

export function articleContentJson(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

export const api = {
  createDraft(userId: MockUserId, title: string, text: string, tagIds: string[], categoryId: string | null = null) {
    return request<Article>(userId, "/articles/drafts", {
      method: "POST",
      body: JSON.stringify({ title, contentJson: articleContentJson(text), tagIds, categoryId }),
    });
  },
  updateDraft(
    userId: MockUserId,
    articleId: string,
    title: string,
    text: string,
    tagIds: string[],
    categoryId: string | null = null,
  ) {
    return request<Article>(userId, `/articles/${articleId}/draft`, {
      method: "PUT",
      body: JSON.stringify({ title, contentJson: articleContentJson(text), tagIds, categoryId }),
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
  listMyArticles(userId: MockUserId) {
    return request<Article[]>(userId, "/articles/mine");
  },
  listArticleVersions(userId: MockUserId, articleId: string) {
    return request<ArticleContentVersion[]>(userId, `/articles/${articleId}/versions`);
  },
  withdrawArticle(userId: MockUserId, articleId: string) {
    return request<Article>(userId, `/articles/${articleId}/withdraw`, { method: "POST" });
  },
  deleteArticle(userId: MockUserId, articleId: string) {
    return request<Article>(userId, `/articles/${articleId}`, { method: "DELETE" });
  },
  recordArticleView(userId: MockUserId, articleId: string) {
    return request<ArticleInteraction>(userId, `/articles/${articleId}/interactions/views`, { method: "POST" });
  },
  setArticleLike(userId: MockUserId, articleId: string, liked: boolean) {
    return request<ArticleInteraction>(userId, `/articles/${articleId}/interactions/likes`, {
      method: liked ? "PUT" : "DELETE",
    });
  },
  setArticleFavorite(userId: MockUserId, articleId: string, favorited: boolean) {
    return request<ArticleInteraction>(userId, `/articles/${articleId}/interactions/favorites`, {
      method: favorited ? "PUT" : "DELETE",
    });
  },
  listFavoriteArticles(userId: MockUserId, limit = 50) {
    return request<PersonalInteractionItem[]>(userId, `/me/knowledge/favorites?limit=${limit}`);
  },
  listRecentViews(userId: MockUserId, limit = 50) {
    return request<PersonalInteractionItem[]>(userId, `/me/knowledge/recent-views?limit=${limit}`);
  },
  listNotifications(userId: MockUserId) {
    return request<UserNotification[]>(userId, "/notifications");
  },
  notificationUnreadCount(userId: MockUserId) {
    return request<{ count: number }>(userId, "/notifications/unread-count");
  },
  markNotificationRead(userId: MockUserId, notificationId: string) {
    return request<UserNotification>(userId, `/notifications/${notificationId}/read`, { method: "PUT" });
  },
  markAllNotificationsRead(userId: MockUserId) {
    return request<{ count: number }>(userId, "/notifications/read-all", { method: "PUT" });
  },
  search(userId: MockUserId, query: string) {
    return request<SearchResponse>(userId, `/search/articles?q=${encodeURIComponent(query)}`);
  },
};
