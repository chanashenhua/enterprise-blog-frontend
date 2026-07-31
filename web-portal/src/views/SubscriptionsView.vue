<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { BellRing, Check, FolderTree, Hash, RefreshCw, Rss, Sparkles } from "lucide-vue-next";
import { api, type CatalogItem, type ContentSubscription } from "@/api/client";
import { subscriptionKey } from "@/subscriptionPresentation";
import { useUserContext } from "@/composables/userContext";

const { userId } = useUserContext();
const tags = ref<CatalogItem[]>([]);
const categories = ref<CatalogItem[]>([]);
const subscriptions = ref<ContentSubscription[]>([]);
const loading = ref(true);
const busyKey = ref("");
const error = ref("");
const notice = ref("");

const subscribedKeys = computed(() => new Set(
  subscriptions.value.map((item) => subscriptionKey(item.targetType, item.targetId)),
));

function isSubscribed(type: ContentSubscription["targetType"], targetId: string) {
  return subscribedKeys.value.has(subscriptionKey(type, targetId));
}

async function load() {
  loading.value = true;
  error.value = "";
  notice.value = "";
  try {
    const [tagItems, categoryItems, subscriptionItems] = await Promise.all([
      api.listTags(userId.value),
      api.listCategories(userId.value),
      api.listSubscriptions(userId.value),
    ]);
    tags.value = tagItems;
    categories.value = categoryItems;
    subscriptions.value = subscriptionItems;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "订阅数据加载失败";
  } finally {
    loading.value = false;
  }
}

async function toggle(type: ContentSubscription["targetType"], item: CatalogItem) {
  const key = subscriptionKey(type, item.id);
  busyKey.value = key;
  error.value = "";
  notice.value = "";
  try {
    if (isSubscribed(type, item.id)) {
      await api.unsubscribe(userId.value, type, item.id);
      subscriptions.value = subscriptions.value.filter(
        (subscription) => subscriptionKey(subscription.targetType, subscription.targetId) !== key,
      );
      notice.value = `已取消订阅“${item.name}”。`;
    } else {
      const created = await api.subscribe(userId.value, type, item.id);
      subscriptions.value = [
        ...subscriptions.value.filter(
          (subscription) => subscriptionKey(subscription.targetType, subscription.targetId) !== key,
        ),
        created,
      ];
      notice.value = `已订阅“${item.name}”。`;
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "订阅操作失败";
  } finally {
    busyKey.value = "";
  }
}

onMounted(load);
watch(userId, load);
</script>

<template>
  <section class="subscriptions-view">
    <header class="subscription-hero">
      <div>
        <p class="eyebrow"><Rss :size="14" /> 关注主题</p>
        <h1>让值得关注的知识，<br /><span>主动找到你。</span></h1>
        <p>选择关心的分类和标签。相关的全公司文章发布后，会进入你的站内通知。</p>
      </div>
      <div class="subscription-total">
        <span><BellRing :size="20" /></span>
        <p><strong>{{ subscriptions.length }}</strong><small>项正在订阅</small></p>
      </div>
    </header>

    <div class="subscription-guidance">
      <Sparkles :size="18" />
      <p><strong>精准、不打扰</strong><span>同一篇文章同时命中多个主题时只通知一次；你发布的文章不会提醒自己。</span></p>
      <button type="button" :disabled="loading" aria-label="刷新订阅" @click="load"><RefreshCw :size="16" :class="{ spinning: loading }" /></button>
    </div>

    <p v-if="notice" class="status-message" role="status">{{ notice }}</p>
    <p v-if="error" class="error-message">{{ error }}</p>
    <div v-if="loading" class="subscription-loading"><RefreshCw :size="22" class="spinning" /> 正在加载可订阅主题...</div>

    <div v-else class="subscription-sections">
      <section aria-labelledby="category-subscription-title">
        <header class="subscription-section-header">
          <span><FolderTree :size="19" /></span>
          <div>
            <p class="eyebrow">分类订阅</p>
            <h2 id="category-subscription-title">跟进一个知识领域</h2>
          </div>
          <small>{{ categories.length }} 个可选分类</small>
        </header>
        <div v-if="categories.length" class="topic-grid category-grid">
          <button
            v-for="item in categories"
            :key="item.id"
            type="button"
            :class="{ subscribed: isSubscribed('CATEGORY', item.id) }"
            :disabled="Boolean(busyKey)"
            @click="toggle('CATEGORY', item)"
          >
            <span class="topic-mark"><FolderTree :size="17" /></span>
            <span class="topic-copy"><strong>{{ item.name }}</strong><small>{{ item.id }}</small></span>
            <span class="topic-action">
              <Check v-if="isSubscribed('CATEGORY', item.id)" :size="15" />
              <Rss v-else :size="15" />
              {{ isSubscribed("CATEGORY", item.id) ? "已订阅" : "订阅" }}
            </span>
          </button>
        </div>
        <p v-else class="subscription-empty">暂时没有可订阅分类。</p>
      </section>

      <section aria-labelledby="tag-subscription-title">
        <header class="subscription-section-header">
          <span><Hash :size="19" /></span>
          <div>
            <p class="eyebrow">标签订阅</p>
            <h2 id="tag-subscription-title">捕捉具体技术话题</h2>
          </div>
          <small>{{ tags.length }} 个可选标签</small>
        </header>
        <div v-if="tags.length" class="topic-grid tag-grid">
          <button
            v-for="item in tags"
            :key="item.id"
            type="button"
            :class="{ subscribed: isSubscribed('TAG', item.id) }"
            :disabled="Boolean(busyKey)"
            @click="toggle('TAG', item)"
          >
            <span class="topic-mark"><Hash :size="17" /></span>
            <span class="topic-copy"><strong>{{ item.name }}</strong><small>{{ item.id }}</small></span>
            <span class="topic-action">
              <Check v-if="isSubscribed('TAG', item.id)" :size="15" />
              <Rss v-else :size="15" />
              {{ isSubscribed("TAG", item.id) ? "已订阅" : "订阅" }}
            </span>
          </button>
        </div>
        <p v-else class="subscription-empty">暂时没有可订阅标签。</p>
      </section>
    </div>
  </section>
</template>
