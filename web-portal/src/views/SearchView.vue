<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowUpRight, BookOpenText, Search, Sparkles, Tags } from "lucide-vue-next";
import { api, type CatalogItem, type SearchArticle, type SearchOptions } from "@/api/client";
import SearchSnippet from "@/components/SearchSnippet.vue";

const route = useRoute();
const router = useRouter();
const query = ref("");
const categoryId = ref("");
const tagId = ref("");
const sort = ref<"relevance" | "latest">("relevance");
const size = ref(20);
const page = ref(0);
const results = ref<SearchArticle[]>([]);
const total = ref<number | null>(null);
const hasMore = ref(false);
const limited = ref(false);
const loading = ref(false);
const searched = ref(false);
const message = ref("");
const catalogError = ref("");
const categories = ref<CatalogItem[]>([]);
const tags = ref<CatalogItem[]>([]);
let generation = 0;
let disposed = false;
const routeText = (key: string) => typeof route.query[key] === "string" ? route.query[key] as string : "";

async function loadCatalog() {
  catalogError.value = "";
  try {
    const [loadedCategories, loadedTags] = await Promise.all([api.listCategories(), api.listTags()]);
    if (!disposed) { categories.value = loadedCategories; tags.value = loadedTags; }
  } catch {
    if (!disposed) catalogError.value = "分类标签暂时不可用，可继续按关键词搜索。";
  }
}

async function runSearch() {
  const current = ++generation;
  loading.value = true;
  searched.value = true;
  message.value = "";
  results.value = [];
  total.value = null;
  hasMore.value = false;
  limited.value = false;
  const options: SearchOptions = { categoryId: categoryId.value, tagId: tagId.value, page: page.value, size: size.value, sort: sort.value };
  try {
    const response = await api.search(routeText("q").slice(0, 200).trim(), options);
    if (disposed || current !== generation) return;
    results.value = response.items;
    total.value = response.total;
    hasMore.value = response.hasMore;
    limited.value = response.limited;
  } catch (error) {
    if (!disposed && current === generation) message.value = error instanceof Error ? error.message : "搜索失败";
  } finally { if (!disposed && current === generation) loading.value = false; }
}

async function navigate(targetPage: number, preserveQuery = false) {
  const next = {
    q: preserveQuery ? routeText("q").trim() : query.value.trim(), categoryId: categoryId.value || undefined, tagId: tagId.value || undefined,
    sort: sort.value, page: String(targetPage), size: String(size.value),
  };
  const target = router.resolve({ path: "/search", query: next });
  if (target.fullPath === route.fullPath) await runSearch();
  else await router.push(target.fullPath);
}

watch(() => route.fullPath, () => {
  if (route.path !== "/search") return;
  query.value = routeText("q").slice(0, 200);
  categoryId.value = routeText("categoryId");
  tagId.value = routeText("tagId");
  sort.value = routeText("sort") === "latest" ? "latest" : "relevance";
  const requestedPage = Number(routeText("page") || 0);
  page.value = Number.isInteger(requestedPage) ? Math.min(99, Math.max(0, requestedPage)) : 0;
  const requestedSize = Number(routeText("size") || 20);
  size.value = [5, 10, 20, 50].includes(requestedSize) ? requestedSize : 20;
  if (Object.keys(route.query).length) void runSearch();
  else { ++generation; searched.value = false; results.value = []; loading.value = false; message.value = ""; }
}, { immediate: true });

onMounted(loadCatalog);
onBeforeUnmount(() => { disposed = true; ++generation; });
</script>

<template>
  <section class="search-view">
    <header class="search-hero">
      <div class="search-hero-copy">
        <p class="eyebrow"><Sparkles :size="14" /> 探索知识</p>
        <h1>从团队沉淀中<br />找到可靠答案</h1>
        <p>只检索你有权访问的企业内容，用主题、技术名词或实际问题开始。</p>
      </div>
      <form class="search-form" @submit.prevent="navigate(0)">
        <label class="sr-only" for="article-search">搜索文章</label>
        <Search :size="20" aria-hidden="true" />
        <input id="article-search" v-model="query" maxlength="200" placeholder="例如：Redis 缓存失效策略" />
        <button class="button primary" type="submit" :disabled="loading">搜索知识</button>
      </form>
    </header>
    <form class="search-filters" aria-label="搜索筛选" @submit.prevent="navigate(0)">
      <label>分类<select v-model="categoryId" aria-label="搜索分类" @change="navigate(0)"><option value="">全部分类</option><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
      <label>标签<select v-model="tagId" aria-label="搜索标签" @change="navigate(0)"><option value="">全部标签</option><option v-for="item in tags" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
      <label>排序<select v-model="sort" aria-label="搜索排序" @change="navigate(0)"><option value="relevance">相关程度</option><option value="latest">最新发布</option></select></label>
      <label>每页<select v-model.number="size" aria-label="每页结果数" @change="navigate(0)"><option v-for="count in [5, 10, 20, 50]" :key="count" :value="count">{{ count }} 条</option></select></label>
    </form>
    <p v-if="catalogError" class="error-message">{{ catalogError }} <button class="button secondary compact" @click="loadCatalog">重试筛选选项</button></p>
    <p v-if="loading" role="status" aria-live="polite" class="result-count">正在搜索…</p>
    <p v-else-if="message" role="alert" class="error-message">{{ message }} <button class="button secondary compact" @click="runSearch">重试搜索</button></p>
    <p v-else-if="searched" class="result-count" role="status">第 {{ page + 1 }} 页 · 本页 {{ results.length }} 篇<span v-if="total !== null"> · 共 {{ total }} 篇可访问文章</span></p>
    <p v-if="limited" class="error-message">匹配范围较大，请增加关键词或筛选条件以继续查找。</p>
    <div v-if="!searched" class="search-prompt"><BookOpenText :size="24" /><div><strong>试着从这些方向开始</strong><p>架构决策、故障复盘、工程规范、性能优化</p></div></div>
    <div v-if="results.length" class="result-list">
      <RouterLink v-for="item in results" :key="item.articleId" :to="`/articles/${item.articleId}`" class="search-result">
        <div class="search-result-main">
          <h2><SearchSnippet :parts="item.titleHighlights" :fallback="item.title" /></h2>
          <p><SearchSnippet :parts="item.summaryHighlights" :fallback="item.summary" /></p>
          <span><Tags :size="14" /> {{ item.tags.join(" · ") || "无标签" }}</span>
        </div>
        <span class="result-arrow"><ArrowUpRight :size="19" /></span>
      </RouterLink>
    </div>
    <div v-else-if="searched && !loading && !message" class="empty-state compact-empty"><Search :size="26" /><h2>没有找到相关内容</h2><p>换一个更简短的关键词，或调整分类和标签。</p></div>
    <nav v-if="searched && !message" class="search-pagination" aria-label="搜索分页">
      <button class="button secondary" :disabled="loading || page === 0" @click="navigate(page - 1, true)">上一页</button>
      <span>第 {{ page + 1 }} 页</span>
      <button class="button secondary" :disabled="loading || !hasMore || page >= 99" @click="navigate(page + 1, true)">下一页</button>
    </nav>
  </section>
</template>

<style scoped>
.search-filters { display: flex; flex-wrap: wrap; gap: 16px; margin: 24px 0; }
.search-filters label { display: grid; gap: 8px; min-width: 140px; flex: 1; font-size: 13px; }
.search-filters select { width: 100%; min-width: 0; padding: 10px; border: 1px solid #d7dfda; border-radius: 8px; background: #fff; color: #243d34; }
.search-pagination { display: flex; align-items: center; justify-content: center; gap: 20px; margin: 28px 0; }
:deep(mark) { background: #fff0ae; color: inherit; border-radius: 2px; }
.search-result-main { min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 520px) { .search-filters { gap: 12px; } .search-filters label { min-width: 40%; } .search-pagination { gap: 12px; } }
</style>
