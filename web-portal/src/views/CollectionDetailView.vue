<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Clock3,
  Eye,
  Heart,
  LibraryBig,
  Pencil,
  RefreshCw,
  UserRound,
} from "lucide-vue-next";
import { api, type KnowledgeCollectionDetail } from "@/api/client";
import { useUserContext } from "@/composables/userContext";

const props = defineProps<{ id: string }>();
const { userId } = useUserContext();
const collection = ref<KnowledgeCollectionDetail>();
const loading = ref(true);
const error = ref("");

async function loadCollection() {
  loading.value = true;
  error.value = "";
  try {
    collection.value = await api.getKnowledgeCollection(userId.value, props.id);
  } catch (reason) {
    collection.value = undefined;
    error.value = reason instanceof Error ? reason.message : "专题详情加载失败";
  } finally {
    loading.value = false;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

onMounted(loadCollection);
watch([userId, () => props.id], loadCollection);
</script>

<template>
  <section class="collection-detail-view">
    <RouterLink class="collection-back" to="/collections"><ArrowLeft :size="15" /> 返回专题目录</RouterLink>
    <div v-if="loading" class="collection-loading"><RefreshCw :size="21" class="spinning" /> 正在展开知识路径...</div>
    <div v-else-if="error" class="collection-empty">
      <LibraryBig :size="28" /><h2>专题暂时无法打开</h2><p>{{ error }}</p>
      <button class="button secondary" type="button" @click="loadCollection"><RefreshCw :size="15" /> 重试</button>
    </div>
    <template v-else-if="collection">
      <header class="collection-detail-hero">
        <div class="collection-detail-mark"><LibraryBig :size="27" /></div>
        <div>
          <p class="eyebrow">有序知识集合</p>
          <h1>{{ collection.title }}</h1>
          <p>{{ collection.description || "创建者暂未填写专题简介。" }}</p>
          <div class="collection-detail-meta">
            <span><UserRound :size="14" /> {{ collection.ownerId }}</span>
            <span><Clock3 :size="14" /> 更新于 {{ formatDate(collection.updatedAt) }}</span>
            <span>{{ collection.articles.length }} 篇当前可见</span>
          </div>
        </div>
        <RouterLink
          v-if="collection.editable"
          class="button secondary"
          :to="`/collections/${collection.id}/edit`"
        ><Pencil :size="15" /> 维护专题</RouterLink>
      </header>

      <div v-if="collection.articles.length" class="collection-path">
        <article v-for="(article, index) in collection.articles" :key="article.articleId" class="collection-path-item">
          <div class="collection-path-axis">
            <span>{{ String(index + 1).padStart(2, "0") }}</span>
            <i v-if="index < collection.articles.length - 1"></i>
          </div>
          <RouterLink :to="`/articles/${article.articleId}`" class="collection-path-card">
            <div>
              <div class="collection-path-kicker">
                <span>{{ article.categoryId || "未分类" }}</span>
                <span>{{ article.authorId }}</span>
              </div>
              <h2>{{ article.title }}</h2>
              <p>{{ article.summary }}</p>
              <div class="collection-path-tags">
                <span v-for="tag in article.tagIds.slice(0, 4)" :key="tag"># {{ tag }}</span>
              </div>
            </div>
            <footer>
              <span><Eye :size="13" /> {{ article.viewCount }}</span>
              <span><Heart :size="13" /> {{ article.likeCount }}</span>
              <span><Bookmark :size="13" /> {{ article.favoriteCount }}</span>
              <ArrowUpRight :size="18" />
            </footer>
          </RouterLink>
        </article>
      </div>
      <div v-else class="collection-empty">
        <LibraryBig :size="28" />
        <h2>专题中的文章目前都不可见</h2>
        <p>文章可能已撤回、删除，或当前身份不在其可见范围内。</p>
        <RouterLink v-if="collection.editable" class="button primary" :to="`/collections/${collection.id}/edit`">重新整理</RouterLink>
      </div>
    </template>
  </section>
</template>
