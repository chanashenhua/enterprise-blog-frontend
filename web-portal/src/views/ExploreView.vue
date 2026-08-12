<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Compass,
  Eye,
  FolderTree,
  Hash,
  Heart,
  RefreshCw,
  Rss,
  Search,
} from "lucide-vue-next";
import {
  api,
  type ArticleDiscovery,
  type CatalogItem,
  type ContentSubscription,
  type HomeFeedItem,
} from "@/api/client";
import { useUserContext } from "@/composables/userContext";
import { subscriptionKey } from "@/subscriptionPresentation";

type DiscoveryType = ArticleDiscovery["targetType"];

const route = useRoute();
const router = useRouter();
const { userId } = useUserContext();
const categories = ref<CatalogItem[]>([]);
const tags = ref<CatalogItem[]>([]);
const subscriptions = ref<ContentSubscription[]>([]);
const catalogType = ref<DiscoveryType>("CATEGORY");
const selectedType = ref<DiscoveryType>("CATEGORY");
const selectedId = ref("");
const items = ref<HomeFeedItem[]>([]);
const loadingCatalogs = ref(true);
const loadingArticles = ref(false);
const subscriptionBusy = ref(false);
const error = ref("");
const notice = ref("");

const selectedCatalog = computed(() => {
  const source = selectedType.value === "CATEGORY" ? categories.value : tags.value;
  return source.find((item) => item.id === selectedId.value);
});
const currentCatalogs = computed(() => catalogType.value === "CATEGORY" ? categories.value : tags.value);
const subscribedKeys = computed(() => new Set(
  subscriptions.value.map((item) => subscriptionKey(item.targetType, item.targetId)),
));
const selectedSubscribed = computed(() => subscribedKeys.value.has(
  subscriptionKey(selectedType.value, selectedId.value),
));
const selectedName = computed(() => selectedCatalog.value?.name ?? selectedId.value);

function routeValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return typeof value === "string" ? value : "";
}

function routeTarget(): { type: DiscoveryType; id: string } | null {
  const type = routeValue(route.query.type).toUpperCase();
  const id = routeValue(route.query.id);
  if ((type !== "CATEGORY" && type !== "TAG") || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) return null;
  return { type, id } as { type: DiscoveryType; id: string };
}

async function loadArticles() {
  if (!selectedId.value) return;
  loadingArticles.value = true;
  error.value = "";
  try {
    const response = await api.discoverArticles(selectedType.value, selectedId.value);
    items.value = response.items;
  } catch (reason) {
    items.value = [];
    error.value = reason instanceof Error ? reason.message : "文章发现结果加载失败";
  } finally {
    loadingArticles.value = false;
  }
}

async function selectTarget(type: DiscoveryType, item: Pick<CatalogItem, "id">, replace = false) {
  selectedType.value = type;
  selectedId.value = item.id;
  catalogType.value = type;
  notice.value = "";
  const location = { path: "/explore", query: { type, id: item.id } };
  if (replace) await router.replace(location);
  else await router.push(location);
  await loadArticles();
}

async function load() {
  loadingCatalogs.value = true;
  error.value = "";
  notice.value = "";
  try {
    const [categoryItems, tagItems, subscriptionItems] = await Promise.all([
      api.listCategories(),
      api.listTags(),
      api.listSubscriptions(),
    ]);
    categories.value = categoryItems;
    tags.value = tagItems;
    subscriptions.value = subscriptionItems;
    const requested = routeTarget();
    if (requested) {
      selectedType.value = requested.type;
      selectedId.value = requested.id;
      catalogType.value = requested.type;
      await loadArticles();
    } else {
      const firstCategory = categories.value[0];
      const firstTag = tags.value[0];
      if (firstCategory) await selectTarget("CATEGORY", firstCategory, true);
      else if (firstTag) await selectTarget("TAG", firstTag, true);
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "发现目录加载失败";
  } finally {
    loadingCatalogs.value = false;
  }
}

async function toggleSubscription() {
  if (!selectedCatalog.value || subscriptionBusy.value) return;
  subscriptionBusy.value = true;
  error.value = "";
  notice.value = "";
  const key = subscriptionKey(selectedType.value, selectedId.value);
  try {
    if (selectedSubscribed.value) {
      await api.unsubscribe(selectedType.value, selectedId.value);
      subscriptions.value = subscriptions.value.filter(
        (item) => subscriptionKey(item.targetType, item.targetId) !== key,
      );
      notice.value = `已取消订阅“${selectedName.value}”。`;
    } else {
      const created = await api.subscribe(selectedType.value, selectedId.value);
      subscriptions.value = [
        ...subscriptions.value.filter((item) => subscriptionKey(item.targetType, item.targetId) !== key),
        created,
      ];
      notice.value = `已订阅“${selectedName.value}”。`;
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "订阅操作失败";
  } finally {
    subscriptionBusy.value = false;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

onMounted(load);
watch(userId, load);
watch(
  () => `${routeValue(route.query.type)}:${routeValue(route.query.id)}`,
  async () => {
    if (loadingCatalogs.value) return;
    const requested = routeTarget();
    if (!requested || (requested.type === selectedType.value && requested.id === selectedId.value)) return;
    selectedType.value = requested.type;
    selectedId.value = requested.id;
    catalogType.value = requested.type;
    notice.value = "";
    await loadArticles();
  },
);
</script>

<template>
  <section class="explore-view">
    <header class="explore-hero">
      <div>
        <p class="eyebrow"><Compass :size="14" /> 知识发现</p>
        <h1>沿着分类与标签，<br /><span>找到同一条知识脉络。</span></h1>
        <p>目录用于理解知识版图，标签用于捕捉具体技术话题；结果始终遵循当前身份的文章可见范围。</p>
      </div>
      <RouterLink class="button secondary" to="/search"><Search :size="16" /> 全文搜索</RouterLink>
    </header>

    <p v-if="notice" class="status-message" role="status">{{ notice }}</p>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>

    <div class="explore-layout">
      <aside class="discovery-catalog" aria-label="知识目录">
        <div class="catalog-tabs">
          <button type="button" :class="{ active: catalogType === 'CATEGORY' }" @click="catalogType = 'CATEGORY'">
            <FolderTree :size="15" /> 分类
          </button>
          <button type="button" :class="{ active: catalogType === 'TAG' }" @click="catalogType = 'TAG'">
            <Hash :size="15" /> 标签
          </button>
        </div>
        <div v-if="loadingCatalogs" class="catalog-loading"><RefreshCw :size="17" class="spinning" /> 加载目录...</div>
        <div v-else-if="currentCatalogs.length" class="catalog-list">
          <button
            v-for="item in currentCatalogs"
            :key="item.id"
            type="button"
            :class="{ active: selectedType === catalogType && selectedId === item.id }"
            @click="selectTarget(catalogType, item)"
          >
            <span><FolderTree v-if="catalogType === 'CATEGORY'" :size="15" /><Hash v-else :size="15" /></span>
            <span><strong>{{ item.name }}</strong><small>{{ item.id }}</small></span>
            <ArrowUpRight :size="14" />
          </button>
        </div>
        <p v-else class="catalog-empty">暂无可用{{ catalogType === "CATEGORY" ? "分类" : "标签" }}。</p>
        <RouterLink class="catalog-subscription-link" to="/subscriptions"><Rss :size="14" /> 管理全部订阅</RouterLink>
      </aside>

      <section class="discovery-results">
        <header v-if="selectedId" class="discovery-heading">
          <div class="discovery-title-mark">
            <FolderTree v-if="selectedType === 'CATEGORY'" :size="20" />
            <Hash v-else :size="20" />
          </div>
          <div>
            <p class="eyebrow">{{ selectedType === "CATEGORY" ? "知识分类" : "技术标签" }}</p>
            <h2>{{ selectedName }}</h2>
            <span>{{ selectedId }} · {{ items.length }} 篇可见文章</span>
          </div>
          <button
            v-if="selectedCatalog"
            class="button compact"
            :class="selectedSubscribed ? 'primary' : 'secondary'"
            type="button"
            :disabled="subscriptionBusy"
            @click="toggleSubscription"
          >
            <Check v-if="selectedSubscribed" :size="14" />
            <Rss v-else :size="14" />
            {{ selectedSubscribed ? "已订阅" : "订阅主题" }}
          </button>
          <span v-else class="historical-target">历史目录项</span>
        </header>

        <div v-if="loadingArticles" class="discovery-loading">
          <RefreshCw :size="20" class="spinning" /> 正在筛选你有权阅读的文章...
        </div>
        <div v-else-if="items.length" class="discovery-article-list">
          <RouterLink v-for="item in items" :key="item.articleId" :to="`/articles/${item.articleId}`" class="discovery-article">
            <div class="discovery-article-main">
              <div class="discovery-article-meta">
                <span>{{ item.authorId }}</span>
                <time :datetime="item.publishedAt">{{ formatDate(item.publishedAt) }}</time>
              </div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.summary }}</p>
              <div class="discovery-tags">
                <span v-for="tag in item.tagIds" :key="tag"># {{ tag }}</span>
                <span v-if="!item.tagIds.length"># 团队知识</span>
              </div>
            </div>
            <footer>
              <span><Eye :size="14" /> {{ item.viewCount }}</span>
              <span><Heart :size="14" /> {{ item.likeCount }}</span>
              <span><Bookmark :size="14" /> {{ item.favoriteCount }}</span>
              <ArrowUpRight :size="18" />
            </footer>
          </RouterLink>
        </div>
        <div v-else-if="selectedId && !error" class="discovery-empty">
          <Compass :size="26" />
          <strong>这个主题下还没有可见文章</strong>
          <p>可能尚未发布内容，也可能当前身份不在文章的可见范围内。</p>
          <RouterLink class="text-action" to="/articles/new">写下第一篇知识 <ArrowUpRight :size="14" /></RouterLink>
        </div>
      </section>
    </div>
  </section>
</template>
