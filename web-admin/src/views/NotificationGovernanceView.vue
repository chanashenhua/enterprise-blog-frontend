<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { Bell, CheckCheck, Inbox, RefreshCw, Search, Users } from "lucide-vue-next";
import { api, type AdminNotificationRecord, type NotificationGovernanceOverview } from "@/api/client";
import { localDateTime } from "@/auditLabels";
import { notificationTypeLabel, unreadRate } from "@/notificationLabels";

const overview = ref<NotificationGovernanceOverview | null>(null);
const records = ref<AdminNotificationRecord[]>([]);
const filters = reactive({ recipientUserId: "", type: "", state: "ALL" as "ALL" | "READ" | "UNREAD" });
const loading = ref(false);
const message = ref("");

async function load() {
  loading.value = true;
  message.value = "";
  try {
    [overview.value, records.value] = await Promise.all([
      api.notificationGovernanceOverview(),
      api.adminNotifications({
        recipientUserId: filters.recipientUserId.trim() || undefined,
        type: filters.type || undefined,
        state: filters.state,
      }),
    ]);
  } catch (error) {
    message.value = error instanceof Error ? error.message : "通知治理数据加载失败";
  } finally {
    loading.value = false;
  }
}

function reset() {
  Object.assign(filters, { recipientUserId: "", type: "", state: "ALL" });
  void load();
}

onMounted(load);
</script>

<template>
  <section>
    <header class="view-header">
      <div><p class="eyebrow">消息触达</p><h1>站内通知治理</h1><p class="lede">观察通知覆盖与未读分布；管理员只能查看，员工已读状态仍由本人管理。</p></div>
      <button class="button secondary button-with-icon" :disabled="loading" @click="load"><RefreshCw :size="16" /> 刷新</button>
    </header>
    <p v-if="message" class="error">{{ message }}</p>

    <div v-if="overview" class="governance-metrics">
      <article><Inbox :size="19"/><strong>{{ overview.totalCount }}</strong><span>通知总数</span></article>
      <article><Bell :size="19"/><strong>{{ overview.unreadCount }}</strong><span>未读通知 · {{ unreadRate(overview.unreadCount, overview.totalCount) }}</span></article>
      <article><CheckCheck :size="19"/><strong>{{ overview.readCount }}</strong><span>已读通知</span></article>
      <article><Users :size="19"/><strong>{{ overview.recipientCount }}</strong><span>覆盖员工</span></article>
    </div>

    <div v-if="overview" class="type-strip">
      <article v-for="summary in overview.typeSummaries" :key="summary.type">
        <strong>{{ notificationTypeLabel(summary.type) }}</strong><span>{{ summary.totalCount }} 条 · {{ summary.unreadCount }} 条未读</span>
      </article>
    </div>

    <form class="governance-filters" @submit.prevent="load">
      <label><span>接收员工</span><input v-model="filters.recipientUserId" placeholder="例如 u-author" /></label>
      <label><span>通知类型</span><select v-model="filters.type"><option value="">全部类型</option><option value="REVIEW_APPROVED">审核通过</option><option value="REVIEW_REJECTED">审核驳回</option><option value="COMMENT_REPLY">评论回复</option><option value="ARTICLE_PUBLISHED">文章发布</option></select></label>
      <label><span>阅读状态</span><select v-model="filters.state"><option value="ALL">全部状态</option><option value="UNREAD">未读</option><option value="READ">已读</option></select></label>
      <div class="filter-actions"><button class="button primary" type="submit"><Search :size="16"/> 查询</button><button class="button secondary" type="button" @click="reset">重置</button></div>
    </form>

    <div class="notification-admin-table">
      <div class="notification-admin-row notification-admin-head"><span>时间 / 接收人</span><span>类型</span><span>内容</span><span>状态</span></div>
      <div v-for="record in records" :key="record.id" class="notification-admin-row">
        <div><strong>{{ localDateTime(record.createdAt) }}</strong><small>{{ record.recipientUserId }}</small></div>
        <div><span class="audit-action">{{ notificationTypeLabel(record.type) }}</span><small>{{ record.resourceType || "—" }} · {{ record.resourceId || "—" }}</small></div>
        <div><strong>{{ record.title }}</strong><small>{{ record.content }}</small></div>
        <span :class="['read-state', record.read ? 'is-read' : 'is-unread']">{{ record.read ? "已读" : "未读" }}</span>
      </div>
    </div>
    <p v-if="!records.length && !message && !loading" class="empty">当前筛选条件下没有通知。</p>
  </section>
</template>
