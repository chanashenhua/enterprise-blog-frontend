<script setup lang="ts">
import { ref } from "vue";
import { Search } from "lucide-vue-next";
import { api, type SearchArticle } from "@/api/client";
import { useUserContext } from "@/composables/userContext";

const { userId } = useUserContext();
const query = ref("");
const results = ref<SearchArticle[]>([]);
const total = ref<number>();
const message = ref("");

async function runSearch() {
  message.value = "";
  try {
    const response = await api.search(userId.value, query.value.trim());
    results.value = response.items;
    total.value = response.total;
  } catch (error) {
    message.value = error instanceof Error ? error.message : "搜索失败";
  }
}
</script>

<template>
  <section class="search-view">
    <header class="view-header"><div><p class="eyebrow">文章搜索</p><h1>在已获授权的知识中查找</h1></div></header>
    <form class="search-form" @submit.prevent="runSearch">
      <label class="sr-only" for="article-search">搜索文章</label>
      <input id="article-search" v-model="query" placeholder="输入主题、技术或关键词" />
      <button class="icon-command" title="搜索" aria-label="搜索" type="submit"><Search :size="19" /></button>
    </form>
    <p v-if="message" class="error-message">{{ message }}</p>
    <p v-else-if="total !== undefined" class="result-count">找到 {{ total }} 篇可访问文章</p>
    <div class="result-list">
      <RouterLink v-for="item in results" :key="item.articleId" :to="`/articles/${item.articleId}`" class="search-result">
        <div><h2>{{ item.title }}</h2><p>{{ item.summary }}</p></div>
        <span>{{ item.tags.join(" · ") }}</span>
      </RouterLink>
    </div>
  </section>
</template>
