export type ReviewTicket = { id: string; articleId: string; status: string };
export type SearchTask = { id: string; articleId: string; status: string; retryCount: number };
export type Tag = { id: string; name: string };
export type AuditRecord = {
  id: string;
  eventId: string;
  sourceService: string;
  actorId: string;
  actorRoles: string[];
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  details?: string;
  traceId?: string;
  occurredAt: string;
  createdAt: string;
};
export type AuditFilters = {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
};
export type ArticleInteractionRanking = {
  articleId: string;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  engagementCount: number;
};
export type AdminInteractionOverview = {
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  activeArticleCount: number;
  engagedUserCount: number;
  topArticles: ArticleInteractionRanking[];
};
export type NotificationTypeSummary = { type: string; totalCount: number; unreadCount: number };
export type NotificationGovernanceOverview = {
  totalCount: number;
  unreadCount: number;
  readCount: number;
  recipientCount: number;
  typeSummaries: NotificationTypeSummary[];
};
export type AdminNotificationRecord = {
  id: string;
  eventId: string;
  recipientUserId: string;
  type: string;
  title: string;
  content: string;
  resourceType?: string;
  resourceId?: string;
  read: boolean;
  createdAt: string;
};
export type NotificationGovernanceFilters = {
  recipientUserId?: string;
  type?: string;
  state?: "ALL" | "READ" | "UNREAD";
};
export type CommentStatus = "ACTIVE" | "HIDDEN" | "DELETED";
export type AdminCommentRecord = {
  id: string;
  articleId: string;
  parentId?: string;
  authorId: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
};
export type CommentGovernanceFilters = {
  articleId?: string;
  authorId?: string;
  status?: "ALL" | CommentStatus;
};

const headers = () => {
  const values = new Headers({
    "X-Mock-User": "u-admin", "X-Mock-Roles": "ADMIN,REVIEWER,AUTHOR,READER",
    "X-Mock-Departments": "d-platform", "X-Mock-Teams": "t-search",
  });
  if (import.meta.env.VITE_MOCK_OIDC_TOKEN) values.set("X-Mock-Token", import.meta.env.VITE_MOCK_OIDC_TOKEN);
  return values;
};

async function request<T>(path: string, init: RequestInit = {}) {
  const requestHeaders = headers();
  if (init.body) requestHeaders.set("Content-Type", "application/json");
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}${path}`, { ...init, headers: requestHeaders });
  if (!response.ok) throw new Error(await response.text() || "请求失败");
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const api = {
  reviews: () => request<ReviewTicket[]>("/admin/reviews"),
  approve: (id: string) => request<ReviewTicket>(`/admin/reviews/${id}/approve`, { method: "POST" }),
  reject: (id: string, comment: string) => request<ReviewTicket>(`/admin/reviews/${id}/reject`, { method: "POST", body: JSON.stringify({ comment }) }),
  searchTasks: () => request<SearchTask[]>("/admin/search/tasks"),
  retryTask: (id: string) => request<void>(`/admin/search/tasks/${id}/retry`, { method: "POST" }),
  tags: () => request<Tag[]>("/admin/tags"),
  audits: (filters: AuditFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.size ? `?${params.toString()}` : "";
    return request<AuditRecord[]>(`/admin/audits${query}`);
  },
  interactionOverview: (limit = 10) => request<AdminInteractionOverview>(`/admin/stats/overview?limit=${limit}`),
  notificationGovernanceOverview: () => request<NotificationGovernanceOverview>("/admin/notifications/overview"),
  adminNotifications: (filters: NotificationGovernanceFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.size ? `?${params.toString()}` : "";
    return request<AdminNotificationRecord[]>(`/admin/notifications${query}`);
  },
  adminComments: (filters: CommentGovernanceFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.size ? `?${params.toString()}` : "";
    return request<AdminCommentRecord[]>(`/admin/comments${query}`);
  },
  hideComment: (commentId: string, reason: string) => request<AdminCommentRecord>(
    `/admin/comments/${commentId}/hide`,
    { method: "POST", body: JSON.stringify({ reason }) },
  ),
  restoreComment: (commentId: string, reason: string) => request<AdminCommentRecord>(
    `/admin/comments/${commentId}/restore`,
    { method: "POST", body: JSON.stringify({ reason }) },
  ),
};
