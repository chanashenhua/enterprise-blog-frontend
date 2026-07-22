<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowLeft, Clock3, Tag } from "lucide-vue-next";
import { api, type Article } from "@/api/client";
import { useUserContext } from "@/composables/userContext";

const props = defineProps<{ id: string }>();
const { userId } = useUserContext();
const article = ref<Article>();
const error = ref("");

onMounted(async () => {
  try { article.value = await api.getArticle(userId.value, props.id); }
  catch (reason) { error.value = reason instanceof Error ? reason.message : "文章加载失败"; }
});
</script>

<template>
  <section class="article-view">
    <RouterLink class="back-link" to="/search"><ArrowLeft :size="16" /> 返回搜索</RouterLink>
    <p v-if="error" class="error-message">{{ error }}</p>
    <template v-else-if="article">
      <header class="article-header">
        <p class="eyebrow">{{ article.status === "PUBLISHED" ? "已发布" : article.status === "PENDING_REVIEW" ? "审核中" : "草稿" }}</p>
        <h1>{{ article.title }}</h1>
        <div class="article-meta"><span><Clock3 :size="15" /> {{ article.authorId }}</span><span><Tag :size="15" /> {{ article.tagIds.join(" · ") || "未分类" }}</span></div>
      </header>
      <article class="article-body" v-html="article.renderedHtml"></article>
    </template>
    <p v-else class="muted">正在加载文章...</p>
  </section>
</template>
