import { createRouter, createWebHistory, createMemoryHistory } from "vue-router";
import { initializeAuth, useAuth } from "./auth/auth";
import ArticleDetailView from "./views/ArticleDetailView.vue";
import ArticleEditorView from "./views/ArticleEditorView.vue";
import HomeView from "./views/HomeView.vue";
import ExploreView from "./views/ExploreView.vue";
import CollectionsView from "./views/CollectionsView.vue";
import CollectionDetailView from "./views/CollectionDetailView.vue";
import CollectionEditorView from "./views/CollectionEditorView.vue";
import KnowledgeLibraryView from "./views/KnowledgeLibraryView.vue";
import MyArticlesView from "./views/MyArticlesView.vue";
import NotificationsView from "./views/NotificationsView.vue";
import SearchView from "./views/SearchView.vue";
import SubscriptionsView from "./views/SubscriptionsView.vue";
import LoginView from "./views/LoginView.vue";
import ForbiddenView from "./views/ForbiddenView.vue";

export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
const router = createRouter({
  history,
  routes: [
    { path: "/forbidden", name: "forbidden", component: ForbiddenView, meta: { publicLayout: true } },
    { path: "/login", name: "login", component: LoginView, meta: { publicLayout: true } },
    { path: "/", component: HomeView, meta: { requiresAuth: true } },
    { path: "/explore", component: ExploreView, meta: { requiresAuth: true } },
    { path: "/collections", component: CollectionsView, meta: { requiresAuth: true } },
    { path: "/collections/new", component: CollectionEditorView, meta: { requiresAuth: true } },
    { path: "/collections/:id/edit", component: CollectionEditorView, props: true, meta: { requiresAuth: true } },
    { path: "/collections/:id", component: CollectionDetailView, props: true, meta: { requiresAuth: true } },
    { path: "/articles", component: MyArticlesView, meta: { requiresAuth: true, requiresWrite: true } },
    { path: "/articles/new", component: ArticleEditorView, meta: { requiresAuth: true, requiresWrite: true } },
    { path: "/articles/:id/edit", component: ArticleEditorView, props: true, meta: { requiresAuth: true, requiresWrite: true } },
    { path: "/articles/:id", component: ArticleDetailView, props: true, meta: { requiresAuth: true } },
    { path: "/library", component: KnowledgeLibraryView, meta: { requiresAuth: true } },
    { path: "/notifications", component: NotificationsView, meta: { requiresAuth: true } },
    { path: "/search", component: SearchView, meta: { requiresAuth: true } },
    { path: "/subscriptions", component: SubscriptionsView, meta: { requiresAuth: true } },
  ],
});

router.beforeEach(async (to) => {
  await initializeAuth();
  const { isAuthenticated, canWrite } = useAuth();
  if (to.name === "login") {
    return isAuthenticated.value ? "/" : true;
  }
  if (!isAuthenticated.value) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresWrite && !canWrite.value) return { name: "forbidden" };
  return true;
});

return router;
}

export default createAppRouter(typeof window === "undefined" ? createMemoryHistory() : createWebHistory(import.meta.env.BASE_URL));
