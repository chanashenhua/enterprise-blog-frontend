<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Bookmark, Eye, FileText, Heart, RefreshCw, Users } from "lucide-vue-next";
import { api, type AdminInteractionOverview } from "@/api/client";
import { compactNumber, engagementRate } from "@/statsFormat";

const overview = ref<AdminInteractionOverview | null>(null);
const loading = ref(false);
const message = ref("");

const metrics = computed(() => overview.value ? [
  { label: "去重浏览", value: overview.value.viewCount, icon: Eye },
  { label: "当前点赞", value: overview.value.likeCount, icon: Heart },
  { label: "当前收藏", value: overview.value.favoriteCount, icon: Bookmark },
  { label: "活跃文章", value: overview.value.activeArticleCount, icon: FileText },
  { label: "参与员工", value: overview.value.engagedUserCount, icon: Users },
] : []);

async function load() {
  loading.value = true;
  message.value = "";
  try {
    overview.value = await api.interactionOverview();
  } catch (error) {
    message.value = error instanceof Error ? error.message : "互动概览加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section>
    <header class="view-header">
      <div>
        <p class="eyebrow">知识使用情况</p>
        <h1>文章互动概览</h1>
        <p class="lede">数据直接聚合自去重互动记录，反映当前浏览、点赞和收藏情况。</p>
      </div>
      <button class="button secondary button-with-icon" :disabled="loading" @click="load"><RefreshCw :size="16" /> 刷新</button>
    </header>

    <p v-if="message" class="error">{{ message }}</p>
    <div v-if="overview" class="metric-grid">
      <article v-for="metric in metrics" :key="metric.label" class="metric-card">
        <component :is="metric.icon" :size="19" />
        <strong>{{ compactNumber(metric.value) }}</strong>
        <span>{{ metric.label }}</span>
      </article>
    </div>

    <div v-if="overview" class="ranking-panel">
      <div class="panel-heading"><div><p class="eyebrow">Top {{ overview.topArticles.length }}</p><h2>热门文章</h2></div><span>按浏览量优先排序</span></div>
      <div class="ranking-table">
        <div class="ranking-row ranking-head"><span>排名 / 文章</span><span>浏览</span><span>点赞</span><span>收藏</span><span>互动率</span></div>
        <div v-for="(article, index) in overview.topArticles" :key="article.articleId" class="ranking-row">
          <div><b>{{ index + 1 }}</b><strong>{{ article.articleId }}</strong></div>
          <span>{{ article.viewCount }}</span><span>{{ article.likeCount }}</span><span>{{ article.favoriteCount }}</span>
          <span class="status">{{ engagementRate(article.likeCount, article.favoriteCount, article.viewCount) }}</span>
        </div>
      </div>
      <p v-if="!overview.topArticles.length" class="empty">当前还没有互动数据。</p>
    </div>
  </section>
</template>
