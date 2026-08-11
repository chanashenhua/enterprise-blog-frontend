<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  ArrowUpRight,
  BookOpenText,
  Clock3,
  Layers3,
  LibraryBig,
  Plus,
  RefreshCw,
  UserRound,
} from "lucide-vue-next";
import { api, type KnowledgeCollectionSummary } from "@/api/client";
import { useUserContext } from "@/composables/userContext";

const { userId } = useUserContext();
const collections = ref<KnowledgeCollectionSummary[]>([]);
const mineOnly = ref(false);
const loading = ref(true);
const error = ref("");

async function loadCollections() {
  loading.value = true;
  error.value = "";
  try {
    collections.value = await api.listKnowledgeCollections(userId.value, mineOnly.value, 30);
  } catch (reason) {
    collections.value = [];
    error.value = reason instanceof Error ? reason.message : "专题列表加载失败";
  } finally {
    loading.value = false;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

onMounted(loadCollections);
watch([userId, mineOnly], loadCollections);
</script>

<template>
  <section class="collections-view">
    <header class="collections-hero">
      <div>
        <p class="eyebrow"><LibraryBig :size="14" /> 专题知识路径</p>
        <h1>把零散文章，整理成<br /><span>可以循序阅读的知识路径。</span></h1>
        <p>专题不会复制文章内容，而是保存经过编排的阅读顺序；每一次打开都会按当前身份重新校验可见权限。</p>
      </div>
      <RouterLink class="button primary" to="/collections/new"><Plus :size="16" /> 创建专题</RouterLink>
    </header>

    <div class="collections-toolbar">
      <div class="collection-filter" role="group" aria-label="专题范围">
        <button type="button" :class="{ active: !mineOnly }" @click="mineOnly = false"><Layers3 :size="15" /> 全部专题</button>
        <button type="button" :class="{ active: mineOnly }" @click="mineOnly = true"><UserRound :size="15" /> 我创建的</button>
      </div>
      <button class="collection-refresh" type="button" :disabled="loading" @click="loadCollections">
        <RefreshCw :size="15" :class="{ spinning: loading }" /> 刷新
      </button>
    </div>

    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <div v-if="loading" class="collection-loading"><RefreshCw :size="21" class="spinning" /> 正在整理专题目录...</div>
    <div v-else-if="collections.length" class="collection-grid">
      <RouterLink
        v-for="(collection, index) in collections"
        :key="collection.id"
        class="collection-card"
        :to="`/collections/${collection.id}`"
      >
        <div class="collection-card-number">{{ String(index + 1).padStart(2, "0") }}</div>
        <div class="collection-card-main">
          <div class="collection-card-kicker">
            <span><UserRound :size="12" /> {{ collection.ownerId }}</span>
            <time :datetime="collection.updatedAt"><Clock3 :size="12" /> {{ formatDate(collection.updatedAt) }}</time>
          </div>
          <h2>{{ collection.title }}</h2>
          <p>{{ collection.description || "创建者暂未填写专题简介。" }}</p>
          <footer>
            <span><BookOpenText :size="14" /> {{ collection.articleCount }} 篇可见文章</span>
            <span v-if="collection.editable" class="collection-editable">可维护</span>
            <ArrowUpRight :size="17" />
          </footer>
        </div>
      </RouterLink>
    </div>
    <div v-else class="collection-empty">
      <LibraryBig :size="30" />
      <h2>{{ mineOnly ? "你还没有创建专题" : "这里还没有可阅读的专题" }}</h2>
      <p>选择至少两篇已发布文章，为同事整理一条清晰的阅读路径。</p>
      <RouterLink class="button primary" to="/collections/new"><Plus :size="15" /> 创建第一个专题</RouterLink>
    </div>
  </section>
</template>
