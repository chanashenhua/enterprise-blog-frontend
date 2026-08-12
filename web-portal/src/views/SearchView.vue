<script setup lang="ts">
import { ref } from "vue";
import { ArrowUpRight, BookOpenText, Search, Sparkles, Tags } from "lucide-vue-next";
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
    const response = await api.search(query.value.trim());
    results.value = response.items;
    total.value = response.total;
  } catch (error) {
    message.value = error instanceof Error ? error.message : "搜索失败";
  }
}
</script>

<template>
  <section class="search-view">
    <header class="search-hero">
      <div class="search-hero-copy">
        <p class="eyebrow"><Sparkles :size="14" /> 探索知识</p>
        <h1>从团队沉淀中<br />找到可靠答案</h1>
        <p>只检索你有权访问的企业内容，用主题、技术名词或实际问题开始。</p>
      </div>
      <form class="search-form" @submit.prevent="runSearch">
        <label class="sr-only" for="article-search">搜索文章</label>
        <Search :size="20" aria-hidden="true" />
        <input id="article-search" v-model="query" placeholder="例如：Redis 缓存失效策略" />
        <button class="button primary" type="submit">搜索知识</button>
      </form>
    </header>
    <p v-if="message" class="error-message">{{ message }}</p>
    <p v-else-if="total !== undefined" class="result-count">找到 {{ total }} 篇可访问文章</p>
    <div v-if="total === undefined && !message" class="search-prompt">
      <BookOpenText :size="24" />
      <div>
        <strong>试着从这些方向开始</strong>
        <p>架构决策、故障复盘、工程规范、性能优化</p>
      </div>
    </div>
    <div v-if="results.length" class="result-list">
      <RouterLink v-for="item in results" :key="item.articleId" :to="`/articles/${item.articleId}`" class="search-result">
        <div class="search-result-main">
          <h2>{{ item.title }}</h2>
          <p>{{ item.summary }}</p>
          <span><Tags :size="14" /> {{ item.tags.join(" · ") || "无标签" }}</span>
        </div>
        <span class="result-arrow"><ArrowUpRight :size="19" /></span>
      </RouterLink>
    </div>
    <div v-else-if="total === 0" class="empty-state compact-empty">
      <Search :size="26" />
      <h2>没有找到相关内容</h2>
      <p>换一个更简短的关键词，或尝试使用技术名称。</p>
    </div>
  </section>
</template>
