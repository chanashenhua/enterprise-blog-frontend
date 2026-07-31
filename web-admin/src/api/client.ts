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
};
