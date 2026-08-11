<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  ArrowUpRight,
  BookMarked,
  Bookmark,
  Clock3,
  Compass,
  Eye,
  FilePenLine,
  Flame,
  GitBranch,
  Heart,
  Radio,
  RefreshCw,
  Rss,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-vue-next";
import { api, type HomeFeed, type HomeFeedItem } from "@/api/client";
import { useUserContext } from "@/composables/userContext";

type FeedSection = "latest" | "popular" | "subscribed";

const { userId, userLabel } = useUserContext();
const feed = ref<HomeFeed>();
const loading = ref(true);
const error = ref("");
const activeSection = ref<FeedSection>("latest");

const sectionLabels: Record<FeedSection, { label: string; description: string }> = {
  latest: { label: "最新发布", description: "刚刚沉淀进知识库的团队经验" },
  popular: { label: "热门内容", description: "正在被更多同事阅读和收藏" },
  subscribed: { label: "我的订阅", description: "来自你关注的分类与标签" },
};

const currentItems = computed<HomeFeedItem[]>(() => feed.value?.[activeSection.value] ?? []);
const popularPreview = computed(() => feed.value?.popular.slice(0, 3) ?? []);
const orbitLabels = computed(() => {
  const values = popularPreview.value.flatMap((item) => [item.categoryId, ...item.tagIds]).filter(Boolean) as string[];
  return [...new Set(values)].slice(0, 3).concat(["架构", "实践", "复盘"]).slice(0, 3);
});

async function loadFeed() {
  loading.value = true;
  error.value = "";
  try {
    feed.value = await api.homeFeed(userId.value, 6);
  } catch (reason) {
    feed.value = undefined;
    error.value = reason instanceof Error ? reason.message : "知识首页加载失败";
  } finally {
    loading.value = false;
  }
}

function formatPublishedAt(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function generatedLabel(): string {
  if (!feed.value?.generatedAt) return "等待数据";
  return `更新于 ${new Date(feed.value.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

onMounted(loadFeed);
watch(userId, loadFeed);
</script>

<template>
  <section class="home-view">
    <div class="hero-grid">
      <div class="home-intro">
        <p class="eyebrow hero-eyebrow"><Sparkles :size="14" /> 企业内部知识库</p>
        <h1>让每一次<br /><span>技术判断</span>都有迹可循。</h1>
        <p class="hero-copy">
          以 {{ userLabel }} 身份进入，记录问题、方案与边界，让散落在项目里的经验成为团队下一次决策的起点。
        </p>
        <div class="command-row">
          <RouterLink class="button primary hero-command" to="/articles/new">
            <FilePenLine :size="17" /> 开始写作 <ArrowUpRight :size="16" />
          </RouterLink>
          <RouterLink class="button secondary hero-command" to="/search"><Search :size="17" /> 探索知识</RouterLink>
        </div>
        <div class="hero-proof" aria-label="平台能力">
          <div><ShieldCheck :size="18" /><span><strong>权限感知</strong><small>只展示当前身份可读内容</small></span></div>
          <div><GitBranch :size="18" /><span><strong>过程可追溯</strong><small>版本与审核全程留痕</small></span></div>
          <div><BookMarked :size="18" /><span><strong>知识可复用</strong><small>订阅团队最佳实践</small></span></div>
        </div>
      </div>

      <aside class="knowledge-panel" aria-label="实时热门知识">
        <header class="knowledge-panel-header">
          <div>
            <span class="live-dot"></span>
            <p>实时热门</p>
          </div>
          <span>{{ generatedLabel() }}</span>
        </header>
        <div class="knowledge-orbit" aria-hidden="true">
          <span class="orbit-ring ring-one"></span>
          <span class="orbit-ring ring-two"></span>
          <span class="orbit-core"><BookMarked :size="24" /></span>
          <span class="orbit-node node-one">{{ orbitLabels[0] }}</span>
          <span class="orbit-node node-two">{{ orbitLabels[1] }}</span>
          <span class="orbit-node node-three">{{ orbitLabels[2] }}</span>
        </div>
        <div class="topic-stream">
          <RouterLink v-for="(item, index) in popularPreview" :key="item.articleId" :to="`/articles/${item.articleId}`">
            <span class="topic-index">{{ String(index + 1).padStart(2, "0") }}</span>
            <p>
              <strong>{{ item.title }}</strong>
              <small>{{ item.categoryId || "未分类" }} · {{ item.viewCount }} 次阅读</small>
            </p>
            <ArrowUpRight :size="16" />
          </RouterLink>
          <div v-if="loading" class="topic-stream-state"><Radio :size="15" /> 正在汇集热门知识...</div>
          <div v-else-if="!popularPreview.length" class="topic-stream-state"><Radio :size="15" /> 暂无热门内容</div>
        </div>
      </aside>
    </div>

    <section class="home-feed" aria-labelledby="home-feed-title">
      <header class="home-feed-header">
        <div>
          <p class="eyebrow"><Radio :size="14" /> 知识动态</p>
          <h2 id="home-feed-title">此刻，团队正在沉淀什么</h2>
          <p>{{ sectionLabels[activeSection].description }}</p>
        </div>
        <nav aria-label="知识动态分类">
          <button
            v-for="(section, key) in sectionLabels"
            :key="key"
            type="button"
            :class="{ active: activeSection === key }"
            :aria-pressed="activeSection === key"
            @click="activeSection = key as FeedSection"
          >
            <Clock3 v-if="key === 'latest'" :size="14" />
            <Flame v-else-if="key === 'popular'" :size="14" />
            <Rss v-else :size="14" />
            {{ section.label }}
          </button>
        </nav>
      </header>

      <div v-if="error" class="home-feed-error">
        <p>{{ error }}</p>
        <button class="button secondary compact" type="button" @click="loadFeed"><RefreshCw :size="14" /> 重新加载</button>
      </div>
      <div v-else-if="loading" class="home-feed-grid" aria-label="正在加载知识动态">
        <div v-for="index in 3" :key="index" class="feed-card feed-card-skeleton">
          <span></span><strong></strong><p></p><p></p>
        </div>
      </div>
      <div v-else-if="currentItems.length" class="home-feed-grid">
        <RouterLink v-for="item in currentItems" :key="item.articleId" class="feed-card" :to="`/articles/${item.articleId}`">
          <div class="feed-card-topline">
            <span>{{ item.categoryId || "未分类" }}</span>
            <time :datetime="item.publishedAt">{{ formatPublishedAt(item.publishedAt) }}</time>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.summary }}</p>
          <div class="feed-tags">
            <span v-for="tag in item.tagIds.slice(0, 3)" :key="tag"># {{ tag }}</span>
            <span v-if="!item.tagIds.length"># 团队知识</span>
          </div>
          <footer>
            <span>{{ item.authorId }}</span>
            <span><Eye :size="13" /> {{ item.viewCount }}</span>
            <span><Heart :size="13" /> {{ item.likeCount }}</span>
            <span><Bookmark :size="13" /> {{ item.favoriteCount }}</span>
            <ArrowUpRight :size="16" />
          </footer>
        </RouterLink>
      </div>
      <div v-else class="home-feed-empty">
        <Rss :size="25" />
        <strong>{{ activeSection === "subscribed" ? "订阅内容还没有更新" : "这里还没有已发布文章" }}</strong>
        <p v-if="activeSection === 'subscribed'">关注感兴趣的分类或标签，新文章会在这里出现。</p>
        <p v-else>发布第一篇团队知识，让经验开始流动。</p>
        <RouterLink v-if="activeSection === 'subscribed'" class="text-action" to="/subscriptions">管理我的订阅 <ArrowUpRight :size="14" /></RouterLink>
        <RouterLink v-else class="text-action" to="/articles/new">开始写作 <ArrowUpRight :size="14" /></RouterLink>
      </div>
    </section>

    <section class="home-workflow" aria-labelledby="workflow-title">
      <header>
        <div>
          <p class="eyebrow">知识工作流</p>
          <h2 id="workflow-title">从一个问题，走向可复用的答案</h2>
        </div>
        <p>不只保存结论，也保留判断过程和适用边界。</p>
      </header>
      <div class="workflow-grid">
        <RouterLink to="/articles/new">
          <span>01</span><FilePenLine :size="22" />
          <div><strong>记录与起草</strong><small>把上下文和推导过程写清楚</small></div>
          <ArrowUpRight :size="17" />
        </RouterLink>
        <RouterLink to="/articles">
          <span>02</span><ShieldCheck :size="22" />
          <div><strong>审核与沉淀</strong><small>在合适的范围内安全共享</small></div>
          <ArrowUpRight :size="17" />
        </RouterLink>
        <RouterLink to="/search">
          <span>03</span><Compass :size="22" />
          <div><strong>发现与复用</strong><small>在下一次决策中找到可靠依据</small></div>
          <ArrowUpRight :size="17" />
        </RouterLink>
      </div>
    </section>
  </section>
</template>
