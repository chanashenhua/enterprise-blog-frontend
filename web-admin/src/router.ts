import { createRouter, createWebHistory, createMemoryHistory } from "vue-router";
import { initializeAuth, useAuth } from "./auth/auth";
import DashboardView from "./views/DashboardView.vue";
import ReviewQueueView from "./views/ReviewQueueView.vue";
import SearchIndexTasksView from "./views/SearchIndexTasksView.vue";
import TagManagementView from "./views/TagManagementView.vue";
import AuditLogView from "./views/AuditLogView.vue";
import InteractionStatsView from "./views/InteractionStatsView.vue";
import NotificationGovernanceView from "./views/NotificationGovernanceView.vue";
import CommentGovernanceView from "./views/CommentGovernanceView.vue";
import ForbiddenView from "./views/ForbiddenView.vue";
import LoginView from "./views/LoginView.vue";

export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
const router = createRouter({ history, routes: [
  { path: "/login", name: "login", component: LoginView, meta: { publicLayout: true } },
  { path: "/forbidden", name: "forbidden", component: ForbiddenView, meta: { publicLayout: true, requiresAuth: true } },
  { path: "/", component: DashboardView, meta: { requiresAuth: true, requiresRole: "ADMIN" } },
  { path: "/reviews", component: ReviewQueueView, meta: { requiresAuth: true, requiresRole: "ADMIN" } },
  { path: "/search-tasks", component: SearchIndexTasksView, meta: { requiresAuth: true, requiresRole: "ADMIN" } },
  { path: "/tags", component: TagManagementView, meta: { requiresAuth: true, requiresRole: "ADMIN" } },
  { path: "/audits", component: AuditLogView, meta: { requiresAuth: true, requiresRole: "ADMIN" } },
  { path: "/interaction-stats", component: InteractionStatsView, meta: { requiresAuth: true, requiresRole: "ADMIN" } },
  { path: "/notification-governance", component: NotificationGovernanceView, meta: { requiresAuth: true, requiresRole: "ADMIN" } },
  { path: "/comment-governance", component: CommentGovernanceView, meta: { requiresAuth: true, requiresRole: "ADMIN" } },
] });

router.beforeEach(async (to) => {
  await initializeAuth();
  const { isAuthenticated, hasRole } = useAuth();
  if (to.name === "login") {
    if (!isAuthenticated.value) return true;
    return hasRole("ADMIN") ? "/" : { name: "forbidden" };
  }
  if (!isAuthenticated.value) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "forbidden") return hasRole("ADMIN") ? "/" : true;
  if (to.meta.requiresRole === "ADMIN" && !hasRole("ADMIN")) return { name: "forbidden" };
  return true;
});

return router;
}

export default createAppRouter(typeof window === "undefined" ? createMemoryHistory() : createWebHistory(import.meta.env.BASE_URL));
