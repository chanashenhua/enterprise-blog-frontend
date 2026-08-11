import { createRouter, createWebHistory } from "vue-router";
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

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/explore", component: ExploreView },
    { path: "/collections", component: CollectionsView },
    { path: "/collections/new", component: CollectionEditorView },
    { path: "/collections/:id/edit", component: CollectionEditorView, props: true },
    { path: "/collections/:id", component: CollectionDetailView, props: true },
    { path: "/articles", component: MyArticlesView },
    { path: "/articles/new", component: ArticleEditorView },
    { path: "/articles/:id/edit", component: ArticleEditorView, props: true },
    { path: "/articles/:id", component: ArticleDetailView, props: true },
    { path: "/library", component: KnowledgeLibraryView },
    { path: "/notifications", component: NotificationsView },
    { path: "/search", component: SearchView },
    { path: "/subscriptions", component: SubscriptionsView },
  ],
});
