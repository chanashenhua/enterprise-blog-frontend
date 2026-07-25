<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { Eye, FilePenLine, Plus, RotateCcw, Trash2 } from "lucide-vue-next";
import { api, type Article } from "@/api/client";
import { articleStatusLabels, canEditArticle, canWithdrawArticle } from "@/articlePresentation";
import { useUserContext } from "@/composables/userContext";

const { userId } = useUserContext();
const articles = ref<Article[]>([]);
const loading = ref(true);
const actionArticleId = ref("");
const message = ref("");
const error = ref("");

async function loadArticles() {
  loading.value = true;
  error.value = "";
  try {
    articles.value = await api.listMyArticles(userId.value);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "文章列表加载失败";
  } finally {
    loading.value = false;
  }
}

async function withdraw(article: Article) {
  actionArticleId.value = article.id;
  message.value = "";
  try {
    const updated = await api.withdrawArticle(userId.value, article.id);
    articles.value = articles.value.map((item) => item.id === updated.id ? updated : item);
    message.value = `《${article.title}》已撤回`;
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : "文章撤回失败";
  } finally {
    actionArticleId.value = "";
  }
}

async function remove(article: Article) {
  if (!window.confirm(`确定删除《${article.title}》吗？该操作会保留审计记录。`)) return;
  actionArticleId.value = article.id;
  message.value = "";
  try {
    await api.deleteArticle(userId.value, article.id);
    articles.value = articles.value.filter((item) => item.id !== article.id);
    message.value = `《${article.title}》已删除`;
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : "文章删除失败";
  } finally {
    actionArticleId.value = "";
  }
}

onMounted(loadArticles);
watch(userId, loadArticles);
</script>

<template>
  <section class="my-articles-view">
    <header class="view-header">
      <div>
        <p class="eyebrow">创作中心</p>
        <h1>我的文章</h1>
      </div>
      <RouterLink class="button primary" to="/articles/new"><Plus :size="17" /> 新建文章</RouterLink>
    </header>

    <p class="status-message" role="status">{{ message }}</p>
    <p v-if="error" class="error-message">{{ error }}</p>
    <p v-else-if="loading" class="muted">正在加载文章...</p>

    <div v-else-if="articles.length" class="article-management-list">
      <article v-for="article in articles" :key="article.id" class="article-management-card">
        <div class="article-card-main">
          <span class="status-badge" :data-status="article.status">{{ articleStatusLabels[article.status] }}</span>
          <h2><RouterLink :to="`/articles/${article.id}`">{{ article.title }}</RouterLink></h2>
          <p>{{ article.plainText || "尚未填写正文" }}</p>
          <div class="article-card-meta">
            <span>{{ article.visibilityType || "尚未设置可见范围" }}</span>
            <span>{{ article.tagIds.join(" · ") || "无标签" }}</span>
          </div>
        </div>
        <div class="article-card-actions">
          <RouterLink class="button secondary compact" :to="`/articles/${article.id}`"><Eye :size="15" /> 查看</RouterLink>
          <RouterLink v-if="canEditArticle(article)" class="button secondary compact" :to="`/articles/${article.id}/edit`">
            <FilePenLine :size="15" /> 编辑
          </RouterLink>
          <button
            v-if="canWithdrawArticle(article)"
            class="button secondary compact"
            type="button"
            :disabled="actionArticleId === article.id"
            @click="withdraw(article)"
          >
            <RotateCcw :size="15" /> 撤回
          </button>
          <button
            class="button danger compact"
            type="button"
            :disabled="actionArticleId === article.id"
            @click="remove(article)"
          >
            <Trash2 :size="15" /> 删除
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      <FilePenLine :size="28" />
      <h2>还没有文章</h2>
      <p>从一个明确的问题开始，写下可复用的判断过程。</p>
      <RouterLink class="button primary" to="/articles/new">开始写作</RouterLink>
    </div>
  </section>
</template>
