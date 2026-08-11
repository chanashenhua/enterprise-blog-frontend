<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { ArrowUpRight, Bell, BookHeart, Clock3, Eye, Library, LibraryBig, RefreshCw, Rss, Tags, X } from "lucide-vue-next";
import { api, type Article, type PersonalInteractionItem } from "@/api/client";
import { formatInteractionTime, visibleKnowledgeEntries } from "@/libraryPresentation";
import { useUserContext } from "@/composables/userContext";

type LibraryTab = "favorites" | "recent";

const { userId } = useUserContext();
const activeTab = ref<LibraryTab>("favorites");
const favorites = ref<PersonalInteractionItem[]>([]);
const recentViews = ref<PersonalInteractionItem[]>([]);
const articles = ref(new Map<string, Article>());
const loading = ref(true);
const removingArticleId = ref("");
const error = ref("");
const notice = ref("");

const favoriteEntries = computed(() => visibleKnowledgeEntries(favorites.value, articles.value));
const recentEntries = computed(() => visibleKnowledgeEntries(recentViews.value, articles.value));
const activeEntries = computed(() => activeTab.value === "favorites" ? favoriteEntries.value : recentEntries.value);

async function loadKnowledge() {
  loading.value = true;
  error.value = "";
  notice.value = "";
  try {
    const [favoriteItems, recentItems] = await Promise.all([
      api.listFavoriteArticles(userId.value),
      api.listRecentViews(userId.value),
    ]);
    favorites.value = favoriteItems;
    recentViews.value = recentItems;

    const articleIds = [...new Set([...favoriteItems, ...recentItems].map((item) => item.articleId))];
    const results = await Promise.allSettled(articleIds.map((articleId) => api.getArticle(userId.value, articleId)));
    const visibleArticles = new Map<string, Article>();
    results.forEach((result) => {
      if (result.status === "fulfilled") visibleArticles.set(result.value.id, result.value);
    });
    articles.value = visibleArticles;

    const unavailableCount = results.filter((result) => result.status === "rejected").length;
    if (unavailableCount) notice.value = `${unavailableCount} 篇历史文章因权限变化或已下线，已自动隐藏。`;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "个人知识库加载失败";
  } finally {
    loading.value = false;
  }
}

async function removeFavorite(articleId: string) {
  removingArticleId.value = articleId;
  error.value = "";
  try {
    await api.setArticleFavorite(userId.value, articleId, false);
    favorites.value = favorites.value.filter((item) => item.articleId !== articleId);
    notice.value = "已取消收藏。";
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "取消收藏失败";
  } finally {
    removingArticleId.value = "";
  }
}

onMounted(loadKnowledge);
watch(userId, loadKnowledge);
</script>

<template>
  <section class="knowledge-library-view">
    <header class="library-hero">
      <div>
        <p class="eyebrow"><Library :size="14" /> 个人知识库</p>
        <h1>把读过的好内容，<br /><span>留在手边。</span></h1>
        <p>收藏用于长期沉淀，最近浏览帮你快速回到刚才的思路。列表会始终遵循文章当前的可见权限。</p>
      </div>
      <button class="button secondary" type="button" :disabled="loading" @click="loadKnowledge">
        <RefreshCw :size="16" :class="{ spinning: loading }" /> 刷新
      </button>
    </header>

    <div class="library-summary" aria-label="个人知识库概览">
      <div>
        <span class="summary-icon favorite"><BookHeart :size="20" /></span>
        <p><strong>{{ favoriteEntries.length }}</strong><small>篇已收藏</small></p>
      </div>
      <div>
        <span class="summary-icon recent"><Clock3 :size="20" /></span>
        <p><strong>{{ recentEntries.length }}</strong><small>篇最近浏览</small></p>
      </div>
      <p class="library-summary-note">历史记录只展示你此刻仍有权限阅读的文章</p>
    </div>

    <nav class="library-journey" aria-label="个人知识工作台入口">
      <div><strong>继续整理你的知识流</strong><span>收藏沉淀已有内容，订阅跟进新内容，通知承接最新动态。</span></div>
      <RouterLink to="/subscriptions"><Rss :size="16"/><span><strong>管理订阅</strong><small>选择分类与标签</small></span><ArrowUpRight :size="15"/></RouterLink>
      <RouterLink to="/collections"><LibraryBig :size="16"/><span><strong>专题路径</strong><small>整理连续阅读</small></span><ArrowUpRight :size="15"/></RouterLink>
      <RouterLink to="/notifications"><Bell :size="16"/><span><strong>查看通知</strong><small>接收订阅更新</small></span><ArrowUpRight :size="15"/></RouterLink>
    </nav>

    <div class="library-toolbar">
      <div class="library-tabs" role="tablist" aria-label="知识库分类">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'favorites'"
          :class="{ active: activeTab === 'favorites' }"
          @click="activeTab = 'favorites'"
        >
          <BookHeart :size="16" /> 我的收藏 <span>{{ favoriteEntries.length }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'recent'"
          :class="{ active: activeTab === 'recent' }"
          @click="activeTab = 'recent'"
        >
          <Clock3 :size="16" /> 最近浏览 <span>{{ recentEntries.length }}</span>
        </button>
      </div>
      <p v-if="notice" class="library-notice" role="status">{{ notice }}</p>
    </div>

    <p v-if="error" class="error-message">{{ error }}</p>
    <div v-if="loading" class="library-loading">
      <RefreshCw :size="22" class="spinning" /> 正在整理你的知识足迹...
    </div>

    <div v-else-if="activeEntries.length" class="library-list">
      <article v-for="(entry, index) in activeEntries" :key="entry.article.id" class="library-card">
        <span class="library-index">{{ String(index + 1).padStart(2, "0") }}</span>
        <div class="library-card-body">
          <div class="library-card-kicker">
            <span v-if="entry.article.categoryId">{{ entry.article.categoryId }}</span>
            <time :datetime="entry.interaction.interactedAt">{{ formatInteractionTime(entry.interaction.interactedAt) }}</time>
          </div>
          <h2>
            <RouterLink :to="`/articles/${entry.article.id}`">
              {{ entry.article.title }} <ArrowUpRight :size="17" />
            </RouterLink>
          </h2>
          <p>{{ entry.article.plainText || "这篇文章暂时没有摘要。" }}</p>
          <div class="library-card-meta">
            <span><Tags :size="14" /> {{ entry.article.tagIds.join(" · ") || "未设置标签" }}</span>
            <span><Eye :size="14" /> {{ activeTab === "favorites" ? "收藏于" : "浏览于" }} {{ formatInteractionTime(entry.interaction.interactedAt) }}</span>
          </div>
        </div>
        <div class="library-card-actions">
          <RouterLink class="button secondary compact" :to="`/articles/${entry.article.id}`">继续阅读</RouterLink>
          <button
            v-if="activeTab === 'favorites'"
            class="library-remove"
            type="button"
            :disabled="removingArticleId === entry.article.id"
            aria-label="取消收藏"
            @click="removeFavorite(entry.article.id)"
          >
            <X :size="15" />
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state library-empty">
      <BookHeart v-if="activeTab === 'favorites'" :size="30" />
      <Clock3 v-else :size="30" />
      <h2>{{ activeTab === "favorites" ? "还没有收藏文章" : "还没有浏览记录" }}</h2>
      <p>{{ activeTab === "favorites" ? "遇到值得反复阅读的内容时，点一下收藏即可收入这里。" : "打开一篇文章后，最近浏览会自动记录。" }}</p>
      <RouterLink class="button primary" to="/search">去探索知识</RouterLink>
    </div>
  </section>
</template>
