import { createRouter, createWebHistory } from "vue-router";
import ArticleDetailView from "./views/ArticleDetailView.vue";
import ArticleEditorView from "./views/ArticleEditorView.vue";
import HomeView from "./views/HomeView.vue";
import SearchView from "./views/SearchView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/articles/new", component: ArticleEditorView },
    { path: "/articles/:id", component: ArticleDetailView, props: true },
    { path: "/search", component: SearchView },
  ],
});
