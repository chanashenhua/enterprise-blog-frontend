<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  BarChart3,
  BellRing,
  BookOpenCheck,
  ClipboardCheck,
  DatabaseZap,
  FolderKanban,
  Hash,
  Layers3,
  MessageSquareWarning,
  RefreshCw,
  ScrollText,
  Tags,
  Users,
} from "lucide-vue-next";
import {
  api,
  type AdminInteractionOverview,
  type CommentGovernanceOverview,
  type ContentOperationsOverview,
  type NotificationGovernanceOverview,
  type SubscriptionGovernanceOverview,
} from "@/api/client";
import { compactNumber, interactionTotal, percentage } from "@/statsFormat";

const content = ref<ContentOperationsOverview | null>(null);
const interactions = ref<AdminInteractionOverview | null>(null);
const comments = ref<CommentGovernanceOverview | null>(null);
const subscriptions = ref<SubscriptionGovernanceOverview | null>(null);
const notifications = ref<NotificationGovernanceOverview | null>(null);
const failedSections = ref<string[]>([]);
const loading = ref(false);

const metrics = computed(() => [
  { label: "已发布文章", value: content.value?.publishedArticleCount, detail: `${content.value?.pendingReviewArticleCount ?? 0} 篇待审核`, icon: BookOpenCheck },
  { label: "知识专题", value: content.value?.collectionCount, detail: `${content.value?.collectionArticleCount ?? 0} 个文章编排位`, icon: FolderKanban },
  {
    label: "累计互动",
    value: interactions.value ? interactionTotal(interactions.value.viewCount, interactions.value.likeCount, interactions.value.favoriteCount) : undefined,
    detail: `${interactions.value?.engagedUserCount ?? 0} 名员工参与`,
    icon: BarChart3,
  },
  { label: "有效评论", value: comments.value?.activeCount, detail: `${comments.value?.hiddenCount ?? 0} 条已隐藏`, icon: MessageSquareWarning },
  { label: "主题订阅", value: subscriptions.value?.totalSubscriptionCount, detail: `${subscriptions.value?.subscriberCount ?? 0} 名订阅员工`, icon: Users },
  { label: "未读通知", value: notifications.value?.unreadCount, detail: `${notifications.value?.recipientCount ?? 0} 名员工被触达`, icon: BellRing },
]);

const categoryCoverage = computed(() => percentage(
  content.value?.categorizedPublishedCount ?? 0,
  content.value?.publishedArticleCount ?? 0,
));
const tagCoverage = computed(() => percentage(
  content.value?.taggedPublishedCount ?? 0,
  content.value?.publishedArticleCount ?? 0,
));

async function loadDashboard() {
  loading.value = true;
  failedSections.value = [];
  const requests = await Promise.allSettled([
    api.contentOperationsOverview(),
    api.interactionOverview(5),
    api.commentGovernanceOverview(),
    api.subscriptionGovernanceOverview(),
    api.notificationGovernanceOverview(),
  ]);
  const targets = [content, interactions, comments, subscriptions, notifications] as const;
  const labels = ["内容", "互动", "评论", "订阅", "通知"];
  requests.forEach((result, index) => {
    if (result.status === "fulfilled") {
      targets[index].value = result.value as never;
    } else {
      targets[index].value = null;
      failedSections.value.push(labels[index]);
    }
  });
  loading.value = false;
}

onMounted(loadDashboard);
</script>

<template>
  <section class="operations-dashboard">
    <header class="view-header operations-header">
      <div>
        <p class="eyebrow">运营全景</p>
        <h1>内容协作工作台</h1>
        <p class="lede">聚合内容建设、员工参与和社区治理数据，快速发现下一项需要跟进的工作。</p>
      </div>
      <button class="button secondary button-with-icon" :disabled="loading" @click="loadDashboard">
        <RefreshCw :size="16" :class="{ spinning: loading }" /> {{ loading ? "更新中" : "刷新数据" }}
      </button>
    </header>

    <div v-if="failedSections.length" class="dashboard-warning">
      {{ failedSections.join("、") }}数据暂时不可用，其他模块仍可正常查看。
    </div>

    <div class="operations-metrics">
      <article v-for="metric in metrics" :key="metric.label">
        <span class="metric-icon"><component :is="metric.icon" :size="19" /></span>
        <strong>{{ metric.value === undefined ? "—" : compactNumber(metric.value) }}</strong>
        <span>{{ metric.label }}</span>
        <small>{{ metric.detail }}</small>
      </article>
    </div>

    <div class="operations-columns">
      <section class="operations-panel coverage-panel">
        <header><div><p class="eyebrow">内容健康度</p><h2>知识结构覆盖</h2></div><Layers3 :size="21" /></header>
        <template v-if="content">
          <div class="coverage-item">
            <div><span>已发布文章配置分类</span><strong>{{ categoryCoverage }}%</strong></div>
            <div class="progress-track"><i :style="{ width: `${categoryCoverage}%` }" /></div>
            <small>{{ content.categorizedPublishedCount }} / {{ content.publishedArticleCount }} 篇</small>
          </div>
          <div class="coverage-item">
            <div><span>已发布文章配置标签</span><strong>{{ tagCoverage }}%</strong></div>
            <div class="progress-track"><i :style="{ width: `${tagCoverage}%` }" /></div>
            <small>{{ content.taggedPublishedCount }} / {{ content.publishedArticleCount }} 篇</small>
          </div>
          <div class="content-state-strip">
            <span><strong>{{ content.draftArticleCount }}</strong> 草稿</span>
            <span><strong>{{ content.pendingReviewArticleCount }}</strong> 审核中</span>
            <span><strong>{{ content.withdrawnArticleCount }}</strong> 已撤回</span>
            <span><strong>{{ content.collectionOwnerCount }}</strong> 专题负责人</span>
          </div>
        </template>
        <p v-else class="empty">内容健康度暂时不可用。</p>
      </section>

      <section class="operations-panel collaboration-panel">
        <header><div><p class="eyebrow">协作基线</p><h2>关注与参与</h2></div><Users :size="21" /></header>
        <div class="collaboration-list">
          <RouterLink to="/interaction-stats">
            <span>活跃文章</span><strong>{{ interactions?.activeArticleCount ?? "—" }}</strong><small>查看热门内容 →</small>
          </RouterLink>
          <RouterLink to="/comment-governance">
            <span>参与评论的员工</span><strong>{{ comments?.authorCount ?? "—" }}</strong><small>进入评论治理 →</small>
          </RouterLink>
          <RouterLink to="/notification-governance">
            <span>通知阅读率</span><strong>{{ notifications ? `${percentage(notifications.readCount, notifications.totalCount)}%` : "—" }}</strong><small>查看触达情况 →</small>
          </RouterLink>
        </div>
        <div v-if="subscriptions?.topTargets.length" class="topic-row">
          <span v-for="target in subscriptions.topTargets.slice(0, 4)" :key="`${target.targetType}:${target.targetId}`">
            <Hash v-if="target.targetType === 'TAG'" :size="13" />{{ target.targetId }} <b>{{ target.subscriberCount }}</b>
          </span>
        </div>
        <p v-else class="empty compact-empty">暂无主题订阅排行。</p>
      </section>
    </div>

    <section class="quick-entry-panel">
      <header><p class="eyebrow">快捷入口</p><h2>治理工具</h2></header>
      <div class="dashboard-grid">
        <RouterLink to="/interaction-stats"><BarChart3 :size="19" /><strong>互动数据</strong><span>查看浏览、点赞、收藏和热门文章</span></RouterLink>
        <RouterLink to="/notification-governance"><BellRing :size="19" /><strong>通知治理</strong><span>观察通知覆盖、类型与未读情况</span></RouterLink>
        <RouterLink to="/comment-governance"><MessageSquareWarning :size="19" /><strong>评论治理</strong><span>筛选、隐藏并恢复社区评论</span></RouterLink>
        <RouterLink to="/reviews"><ClipboardCheck :size="19" /><strong>审核队列</strong><span>处理等待发布的知识文章</span></RouterLink>
        <RouterLink to="/search-tasks"><DatabaseZap :size="19" /><strong>索引任务</strong><span>重试失败的文章搜索索引</span></RouterLink>
        <RouterLink to="/tags"><Tags :size="19" /><strong>标签目录</strong><span>查看文章可用的技术标签</span></RouterLink>
        <RouterLink to="/audits"><ScrollText :size="19" /><strong>操作审计</strong><span>追踪关键操作的人员、事件与时间</span></RouterLink>
      </div>
    </section>
  </section>
</template>
