import { createRouter, createWebHistory } from "vue-router";
import ArticleDetailView from "./views/ArticleDetailView.vue";
import ArticleEditorView from "./views/ArticleEditorView.vue";
import HomeView from "./views/HomeView.vue";
import MyArticlesView from "./views/MyArticlesView.vue";
import SearchView from "./views/SearchView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/articles", component: MyArticlesView },
    { path: "/articles/new", component: ArticleEditorView },
    { path: "/articles/:id/edit", component: ArticleEditorView, props: true },
    { path: "/articles/:id", component: ArticleDetailView, props: true },
    { path: "/search", component: SearchView },
  ],
});
