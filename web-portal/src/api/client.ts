import { AuthenticationRequiredError, authorizationHeaders, handleUnauthorized } from "@/auth/auth";

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

export type ArticleComment = {
  id: string;
  articleId: string;
  parentId: string | null;
  authorId: string;
  content: string | null;
  deleted: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PersonalInteractionItem = {
  articleId: string;
  interactionType: "FAVORITE" | "VIEW" | string;
  interactedAt: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  active: boolean;
};

export type ContentSubscription = {
  id: string;
  userId: string;
  targetType: "TAG" | "CATEGORY";
  targetId: string;
  createdAt: string;
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

export type HomeFeedItem = {
  articleId: string;
  authorId: string;
  title: string;
  summary: string;
  tagIds: string[];
  categoryId: string | null;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
};

export type HomeFeed = {
  latest: HomeFeedItem[];
  popular: HomeFeedItem[];
  subscribed: HomeFeedItem[];
  generatedAt: string;
};

export type ArticleDiscovery = {
  targetType: "CATEGORY" | "TAG";
  targetId: string;
  items: HomeFeedItem[];
  generatedAt: string;
};

export type KnowledgeCollectionSummary = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
  editable: boolean;
};

export type KnowledgeCollectionDetail = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  articles: HomeFeedItem[];
  createdAt: string;
  updatedAt: string;
  editable: boolean;
};

export type SaveKnowledgeCollection = {
  title: string;
  description: string;
  articleIds: string[];
};

type SearchResponse = { items: SearchArticle[]; total: number; page: number; size: number };

async function requestHeaders(hasBody = false): Promise<Headers> {
  const headers = new Headers(await authorizationHeaders());
  if (hasBody) headers.set("Content-Type", "application/json");
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}${path}`, {
    ...init,
    headers: await requestHeaders(init.body !== undefined),
  });
  if (response.status === 401) {
    await handleUnauthorized();
    throw new AuthenticationRequiredError();
  }
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
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function articleContentJson(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

export const api = {
  createDraft(title: string, text: string, tagIds: string[], categoryId: string | null = null) {
    return request<Article>("/articles/drafts", {
      method: "POST",
      body: JSON.stringify({ title, contentJson: articleContentJson(text), tagIds, categoryId }),
    });
  },
  updateDraft(
    articleId: string,
    title: string,
    text: string,
    tagIds: string[],
    categoryId: string | null = null,
  ) {
    return request<Article>(`/articles/${articleId}/draft`, {
      method: "PUT",
      body: JSON.stringify({ title, contentJson: articleContentJson(text), tagIds, categoryId }),
    });
  },
  publish(articleId: string, visibilityType: string, targetOrgIds: string[], reviewRequired: boolean) {
    return request<Article>(`/articles/${articleId}/submit-publish`, {
      method: "POST",
      body: JSON.stringify({ visibilityType, targetOrgIds, reviewRequired }),
    });
  },
  getArticle(articleId: string) {
    return request<Article>(`/articles/${articleId}`);
  },
  listMyArticles() {
    return request<Article[]>("/articles/mine");
  },
  listArticleVersions(articleId: string) {
    return request<ArticleContentVersion[]>(`/articles/${articleId}/versions`);
  },
  withdrawArticle(articleId: string) {
    return request<Article>(`/articles/${articleId}/withdraw`, { method: "POST" });
  },
  deleteArticle(articleId: string) {
    return request<Article>(`/articles/${articleId}`, { method: "DELETE" });
  },
  recordArticleView(articleId: string) {
    return request<ArticleInteraction>(`/articles/${articleId}/interactions/views`, { method: "POST" });
  },
  setArticleLike(articleId: string, liked: boolean) {
    return request<ArticleInteraction>(`/articles/${articleId}/interactions/likes`, {
      method: liked ? "PUT" : "DELETE",
    });
  },
  setArticleFavorite(articleId: string, favorited: boolean) {
    return request<ArticleInteraction>(`/articles/${articleId}/interactions/favorites`, {
      method: favorited ? "PUT" : "DELETE",
    });
  },
  listArticleComments(articleId: string) {
    return request<ArticleComment[]>(`/articles/${articleId}/comments`);
  },
  createArticleComment(articleId: string, content: string, parentId: string | null = null) {
    return request<ArticleComment>(`/articles/${articleId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, parentId }),
    });
  },
  updateArticleComment(articleId: string, commentId: string, content: string) {
    return request<ArticleComment>(`/articles/${articleId}/comments/${commentId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  },
  deleteArticleComment(articleId: string, commentId: string) {
    return request<void>(`/articles/${articleId}/comments/${commentId}`, { method: "DELETE" });
  },
  listFavoriteArticles(limit = 50) {
    return request<PersonalInteractionItem[]>(`/me/knowledge/favorites?limit=${limit}`);
  },
  listRecentViews(limit = 50) {
    return request<PersonalInteractionItem[]>(`/me/knowledge/recent-views?limit=${limit}`);
  },
  listTags() {
    return request<CatalogItem[]>("/tags");
  },
  listCategories() {
    return request<CatalogItem[]>("/categories");
  },
  listSubscriptions() {
    return request<ContentSubscription[]>("/subscriptions");
  },
  subscribe(targetType: ContentSubscription["targetType"], targetId: string) {
    return request<ContentSubscription>(
      `/subscriptions/${targetType}/${encodeURIComponent(targetId)}`,
      { method: "PUT" },
    );
  },
  unsubscribe(targetType: ContentSubscription["targetType"], targetId: string) {
    return request<void>(
      `/subscriptions/${targetType}/${encodeURIComponent(targetId)}`,
      { method: "DELETE" },
    );
  },
  listNotifications() {
    return request<UserNotification[]>("/notifications");
  },
  notificationUnreadCount() {
    return request<{ count: number }>("/notifications/unread-count");
  },
  markNotificationRead(notificationId: string) {
    return request<UserNotification>(`/notifications/${notificationId}/read`, { method: "PUT" });
  },
  markAllNotificationsRead() {
    return request<{ count: number }>("/notifications/read-all", { method: "PUT" });
  },
  search(query: string) {
    return request<SearchResponse>(`/search/articles?q=${encodeURIComponent(query)}`);
  },
  homeFeed(limit = 6) {
    return request<HomeFeed>(`/articles/feed?limit=${limit}`);
  },
  discoverArticles(targetType: ArticleDiscovery["targetType"], targetId: string, limit = 30) {
    const query = new URLSearchParams({ type: targetType, targetId, limit: String(limit) });
    return request<ArticleDiscovery>(`/articles/discovery?${query.toString()}`);
  },
  listKnowledgeCollections(mine = false, limit = 20) {
    const query = new URLSearchParams({ mine: String(mine), limit: String(limit) });
    return request<KnowledgeCollectionSummary[]>(`/collections?${query.toString()}`);
  },
  getKnowledgeCollection(collectionId: string) {
    return request<KnowledgeCollectionDetail>(`/collections/${encodeURIComponent(collectionId)}`);
  },
  listCollectionCandidates(limit = 50) {
    return request<HomeFeedItem[]>(`/collections/candidates?limit=${limit}`);
  },
  createKnowledgeCollection(collection: SaveKnowledgeCollection) {
    return request<KnowledgeCollectionDetail>("/collections", {
      method: "POST",
      body: JSON.stringify(collection),
    });
  },
  updateKnowledgeCollection(collectionId: string, collection: SaveKnowledgeCollection) {
    return request<KnowledgeCollectionDetail>(`/collections/${encodeURIComponent(collectionId)}`, {
      method: "PUT",
      body: JSON.stringify(collection),
    });
  },
  deleteKnowledgeCollection(collectionId: string) {
    return request<void>(`/collections/${encodeURIComponent(collectionId)}`, { method: "DELETE" });
  },
};
