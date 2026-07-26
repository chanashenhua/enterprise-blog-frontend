<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { ArrowLeft, Clock3, FilePenLine, FolderOpen, History, RotateCcw, Tag, Trash2, UserRound } from "lucide-vue-next";
import { api, type Article, type ArticleContentVersion } from "@/api/client";
import { articleStatusLabels, canEditArticle, canWithdrawArticle } from "@/articlePresentation";
import { useUserContext } from "@/composables/userContext";

const props = defineProps<{ id: string }>();
const router = useRouter();
const { userId } = useUserContext();
const article = ref<Article>();
const versions = ref<ArticleContentVersion[]>([]);
const versionsVisible = ref(false);
const busy = ref(false);
const error = ref("");
const message = ref("");
const canManage = computed(() => article.value?.authorId === userId.value || userId.value === "u-admin");

async function loadArticle() {
  error.value = "";
  article.value = undefined;
  versions.value = [];
  versionsVisible.value = false;
  try {
    article.value = await api.getArticle(userId.value, props.id);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "文章加载失败";
  }
}

async function toggleVersions() {
  if (versionsVisible.value) {
    versionsVisible.value = false;
    return;
  }
  busy.value = true;
  message.value = "";
  try {
    versions.value = await api.listArticleVersions(userId.value, props.id);
    versionsVisible.value = true;
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : "历史版本加载失败";
  } finally {
    busy.value = false;
  }
}

async function withdraw() {
  if (!article.value) return;
  busy.value = true;
  message.value = "";
  try {
    article.value = await api.withdrawArticle(userId.value, article.value.id);
    message.value = "文章已撤回，现在可以重新编辑";
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : "文章撤回失败";
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!article.value || !window.confirm(`确定删除《${article.value.title}》吗？该操作会保留审计记录。`)) return;
  busy.value = true;
  try {
    await api.deleteArticle(userId.value, article.value.id);
    await router.push("/articles");
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : "文章删除失败";
    busy.value = false;
  }
}

onMounted(loadArticle);
watch(userId, loadArticle);
</script>

<template>
  <section class="article-view">
    <RouterLink class="back-link" to="/articles"><ArrowLeft :size="16" /> 返回我的文章</RouterLink>
    <p v-if="error" class="error-message">{{ error }}</p>
    <template v-else-if="article">
      <div class="reading-surface">
        <header class="article-header">
          <span class="status-badge" :data-status="article.status">{{ articleStatusLabels[article.status] }}</span>
          <h1>{{ article.title }}</h1>
          <div class="article-meta">
            <span><UserRound :size="15" /> {{ article.authorId }}</span>
            <span><Tag :size="15" /> {{ article.tagIds.join(" · ") || "无标签" }}</span>
            <span><FolderOpen :size="15" /> {{ article.categoryId || "未分类" }}</span>
            <span><Clock3 :size="15" /> 企业知识库</span>
          </div>
          <div v-if="canManage" class="article-detail-actions">
            <RouterLink v-if="canEditArticle(article)" class="button secondary compact" :to="`/articles/${article.id}/edit`">
              <FilePenLine :size="15" /> 编辑
            </RouterLink>
            <button
              v-if="canWithdrawArticle(article)"
              class="button secondary compact"
              type="button"
              :disabled="busy"
              @click="withdraw"
            >
              <RotateCcw :size="15" /> 撤回
            </button>
            <button class="button secondary compact" type="button" :disabled="busy" @click="toggleVersions">
              <History :size="15" /> {{ versionsVisible ? "收起版本" : "历史版本" }}
            </button>
            <button class="button danger compact" type="button" :disabled="busy" @click="remove">
              <Trash2 :size="15" /> 删除
            </button>
          </div>
        </header>
        <p class="status-message" role="status">{{ message }}</p>
        <article class="article-body" v-html="article.renderedHtml"></article>
      </div>
      <section v-if="versionsVisible" class="version-history" aria-labelledby="version-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">变更记录</p>
            <h2 id="version-title">内容版本</h2>
          </div>
          <span>{{ versions.length }} 个版本</span>
        </div>
        <ol>
          <li v-for="version in versions" :key="version.versionNo">
            <div>
              <strong>版本 {{ version.versionNo }} · {{ version.title }}</strong>
              <span>{{ new Date(version.createdAt).toLocaleString("zh-CN") }} · {{ version.createdBy }}</span>
            </div>
            <p>{{ version.plainText }}</p>
          </li>
        </ol>
        <p v-if="!versions.length" class="muted">暂无历史版本。</p>
      </section>
    </template>
    <p v-else class="muted">正在加载文章...</p>
  </section>
</template>
