<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpenText,
  Check,
  LibraryBig,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-vue-next";
import { api, type HomeFeedItem } from "@/api/client";
import { useUserContext } from "@/composables/userContext";

const props = defineProps<{ id?: string }>();
const router = useRouter();
const { userId } = useUserContext();
const title = ref("");
const description = ref("");
const candidates = ref<HomeFeedItem[]>([]);
const selectedIds = ref<string[]>([]);
const query = ref("");
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const error = ref("");

const editing = computed(() => Boolean(props.id));
const candidateById = computed(() => new Map(candidates.value.map((article) => [article.articleId, article])));
const selectedArticles = computed(() => selectedIds.value
  .map((articleId) => candidateById.value.get(articleId))
  .filter((article): article is HomeFeedItem => Boolean(article)));
const availableArticles = computed(() => {
  const normalized = query.value.trim().toLowerCase();
  return candidates.value.filter((article) => {
    if (selectedIds.value.includes(article.articleId)) return false;
    if (!normalized) return true;
    return [article.title, article.authorId, article.categoryId, ...article.tagIds]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized));
  });
});

async function loadEditor() {
  loading.value = true;
  error.value = "";
  try {
    const candidateItems = await api.listCollectionCandidates(userId.value, 50);
    candidates.value = candidateItems;
    if (props.id) {
      const collection = await api.getKnowledgeCollection(userId.value, props.id);
      if (!collection.editable) throw new Error("当前身份只能阅读这个专题，不能修改。\n");
      title.value = collection.title;
      description.value = collection.description;
      selectedIds.value = collection.articles.map((article) => article.articleId);
    } else {
      title.value = "";
      description.value = "";
      selectedIds.value = [];
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message.trim() : "专题编辑器加载失败";
  } finally {
    loading.value = false;
  }
}

function addArticle(articleId: string) {
  if (selectedIds.value.includes(articleId) || selectedIds.value.length >= 30) return;
  selectedIds.value = [...selectedIds.value, articleId];
}

function removeArticle(articleId: string) {
  selectedIds.value = selectedIds.value.filter((id) => id !== articleId);
}

function moveArticle(index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= selectedIds.value.length) return;
  const reordered = [...selectedIds.value];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  selectedIds.value = reordered;
}

async function saveCollection() {
  error.value = "";
  if (title.value.trim().length < 2) {
    error.value = "专题标题至少需要 2 个字符。";
    return;
  }
  if (selectedIds.value.length < 2) {
    error.value = "请至少选择 2 篇文章组成专题。";
    return;
  }
  saving.value = true;
  try {
    const payload = {
      title: title.value.trim(),
      description: description.value.trim(),
      articleIds: selectedIds.value,
    };
    const saved = props.id
      ? await api.updateKnowledgeCollection(userId.value, props.id, payload)
      : await api.createKnowledgeCollection(userId.value, payload);
    await router.push(`/collections/${saved.id}`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "专题保存失败";
  } finally {
    saving.value = false;
  }
}

async function deleteCollection() {
  if (!props.id || deleting.value || !window.confirm("确定删除这个专题吗？文章本身不会被删除。")) return;
  deleting.value = true;
  error.value = "";
  try {
    await api.deleteKnowledgeCollection(userId.value, props.id);
    await router.push("/collections");
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "专题删除失败";
  } finally {
    deleting.value = false;
  }
}

onMounted(loadEditor);
watch([userId, () => props.id], loadEditor);
</script>

<template>
  <section class="collection-editor-view">
    <RouterLink class="collection-back" :to="id ? `/collections/${id}` : '/collections'">
      <ArrowLeft :size="15" /> {{ id ? "返回专题详情" : "返回专题目录" }}
    </RouterLink>
    <header class="collection-editor-header">
      <div>
        <p class="eyebrow"><LibraryBig :size="14" /> {{ editing ? "维护专题" : "创建专题" }}</p>
        <h1>{{ editing ? "调整这条知识路径" : "编排一条新的知识路径" }}</h1>
        <p>从当前身份可读的已发布文章中选择 2～30 篇，并按推荐阅读顺序排列。</p>
      </div>
      <div class="collection-editor-actions">
        <button v-if="editing" class="collection-delete" type="button" :disabled="deleting" @click="deleteCollection">
          <Trash2 :size="15" /> 删除专题
        </button>
        <button class="button primary" type="button" :disabled="loading || saving" @click="saveCollection">
          <Save :size="15" /> {{ saving ? "保存中..." : "保存专题" }}
        </button>
      </div>
    </header>

    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <div v-if="loading" class="collection-loading"><RefreshCw :size="21" class="spinning" /> 正在准备可选文章...</div>
    <template v-else>
      <section class="collection-form-card">
        <label>
          <span>专题标题</span>
          <input v-model="title" maxlength="120" placeholder="例如：Spring Cloud 生产实践路径" />
          <small>{{ title.length }}/120</small>
        </label>
        <label>
          <span>专题简介</span>
          <textarea v-model="description" maxlength="500" rows="3" placeholder="说明这组文章适合谁、解决什么问题，以及推荐的阅读方式。"></textarea>
          <small>{{ description.length }}/500</small>
        </label>
      </section>

      <div class="collection-composer">
        <section class="collection-pool">
          <header>
            <div><p class="eyebrow">文章池</p><h2>选择可读文章</h2></div>
            <span>{{ availableArticles.length }} 篇可选</span>
          </header>
          <label class="collection-search">
            <Search :size="15" />
            <input v-model="query" placeholder="按标题、作者、分类或标签筛选" />
          </label>
          <div v-if="availableArticles.length" class="collection-pool-list">
            <button v-for="article in availableArticles" :key="article.articleId" type="button" @click="addArticle(article.articleId)">
              <span><strong>{{ article.title }}</strong><small>{{ article.categoryId || "未分类" }} · {{ article.authorId }}</small></span>
              <Plus :size="16" />
            </button>
          </div>
          <div v-else class="collection-pool-empty"><Check :size="18" /> 没有更多匹配文章</div>
        </section>

        <section class="collection-order">
          <header>
            <div><p class="eyebrow">阅读顺序</p><h2>专题目录</h2></div>
            <span :class="{ ready: selectedIds.length >= 2 }">{{ selectedIds.length }}/30</span>
          </header>
          <div v-if="selectedArticles.length" class="collection-order-list">
            <article v-for="(article, index) in selectedArticles" :key="article.articleId">
              <span class="collection-order-number">{{ String(index + 1).padStart(2, "0") }}</span>
              <div><strong>{{ article.title }}</strong><small><BookOpenText :size="12" /> {{ article.categoryId || "未分类" }}</small></div>
              <div class="collection-order-actions">
                <button type="button" :disabled="index === 0" aria-label="上移" @click="moveArticle(index, -1)"><ArrowUp :size="14" /></button>
                <button type="button" :disabled="index === selectedArticles.length - 1" aria-label="下移" @click="moveArticle(index, 1)"><ArrowDown :size="14" /></button>
                <button type="button" aria-label="移除" @click="removeArticle(article.articleId)"><X :size="14" /></button>
              </div>
            </article>
          </div>
          <div v-else class="collection-order-empty">
            <LibraryBig :size="23" /><strong>专题目录还是空的</strong><p>从左侧文章池加入文章，加入顺序就是初始阅读顺序。</p>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>
