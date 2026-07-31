import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "./views/DashboardView.vue";
import ReviewQueueView from "./views/ReviewQueueView.vue";
import SearchIndexTasksView from "./views/SearchIndexTasksView.vue";
import TagManagementView from "./views/TagManagementView.vue";
import AuditLogView from "./views/AuditLogView.vue";

export default createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes: [
  { path: "/", component: DashboardView }, { path: "/reviews", component: ReviewQueueView },
  { path: "/search-tasks", component: SearchIndexTasksView }, { path: "/tags", component: TagManagementView },
  { path: "/audits", component: AuditLogView },
] });
