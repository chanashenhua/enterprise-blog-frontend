<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { Eye, EyeOff, MessageSquare, RefreshCw, RotateCcw, Search, ShieldAlert, Trash2, X } from "lucide-vue-next";
import { api, type AdminCommentRecord, type CommentGovernanceOverview, type CommentStatus } from "@/api/client";
import { commentStatusLabels, commentSummary } from "@/commentLabels";
import { localDateTime } from "@/auditLabels";

type GovernanceAction = "hide" | "restore";

const records = ref<AdminCommentRecord[]>([]);
const overview = ref<CommentGovernanceOverview | null>(null);
const filters = reactive({ articleId: "", authorId: "", status: "ALL" as "ALL" | CommentStatus });
const loading = ref(false);
const busyId = ref("");
const message = ref("");
const actionTarget = ref<AdminCommentRecord | null>(null);
const action = ref<GovernanceAction>("hide");
const reason = ref("");

async function load() {
  loading.value = true;
  message.value = "";
  try {
    [overview.value, records.value] = await Promise.all([
      api.commentGovernanceOverview(),
      api.adminComments({
        articleId: filters.articleId.trim() || undefined,
        authorId: filters.authorId.trim() || undefined,
        status: filters.status,
      }),
    ]);
  } catch (error) {
    message.value = error instanceof Error ? error.message : "评论治理数据加载失败";
  } finally {
    loading.value = false;
  }
}

function reset() {
  Object.assign(filters, { articleId: "", authorId: "", status: "ALL" });
  void load();
}

function openAction(record: AdminCommentRecord, nextAction: GovernanceAction) {
  actionTarget.value = record;
  action.value = nextAction;
  reason.value = "";
}

function closeAction() {
  if (busyId.value) return;
  actionTarget.value = null;
  reason.value = "";
}

async function confirmAction() {
  if (!actionTarget.value || !reason.value.trim()) return;
  const target = actionTarget.value;
  busyId.value = target.id;
  message.value = "";
  try {
    const updated = action.value === "hide"
      ? await api.hideComment(target.id, reason.value.trim())
      : await api.restoreComment(target.id, reason.value.trim());
    records.value = records.value.map((record) => record.id === updated.id ? updated : record);
    overview.value = await api.commentGovernanceOverview();
    message.value = action.value === "hide" ? "评论已隐藏，审计事件已记录。" : "评论已恢复，审计事件已记录。";
    actionTarget.value = null;
  } catch (error) {
    message.value = error instanceof Error ? error.message : "评论治理操作失败";
  } finally {
    busyId.value = "";
  }
}

onMounted(load);
</script>

<template>
  <section>
    <header class="view-header">
      <div>
        <p class="eyebrow">社区秩序</p>
        <h1>评论治理</h1>
        <p class="lede">按文章、作者和状态定位评论；隐藏与恢复都会形成不可抵赖的操作审计。</p>
      </div>
      <button class="button secondary button-with-icon" :disabled="loading" @click="load"><RefreshCw :size="16" /> 刷新</button>
    </header>

    <p v-if="message" :class="message.includes('失败') ? 'error' : 'comment-success'" role="status">{{ message }}</p>

    <div v-if="overview" class="comment-metrics">
      <article><MessageSquare :size="19"/><strong>{{ overview.totalCount }}</strong><span>评论总数 · {{ overview.articleCount }} 篇文章</span></article>
      <article><Eye :size="19"/><strong>{{ overview.activeCount }}</strong><span>正常展示</span></article>
      <article><EyeOff :size="19"/><strong>{{ overview.hiddenCount }}</strong><span>治理隐藏</span></article>
      <article><Trash2 :size="19"/><strong>{{ overview.deletedCount }}</strong><span>用户删除 · {{ overview.authorCount }} 名作者</span></article>
    </div>

    <form class="governance-filters comment-filters" @submit.prevent="load">
      <label><span>文章 ID</span><input v-model="filters.articleId" placeholder="例如 a-demo-company-published" /></label>
      <label><span>评论作者</span><input v-model="filters.authorId" placeholder="例如 u-reader" /></label>
      <label><span>评论状态</span><select v-model="filters.status"><option value="ALL">全部状态</option><option value="ACTIVE">正常展示</option><option value="HIDDEN">已隐藏</option><option value="DELETED">用户删除</option></select></label>
      <div class="filter-actions"><button class="button primary" type="submit"><Search :size="16"/> 查询</button><button class="button secondary" type="button" @click="reset">重置</button></div>
    </form>

    <div class="comment-governance-table">
      <div class="comment-governance-row comment-governance-head">
        <span>时间 / 作者</span><span>评论内容</span><span>关联资源</span><span>状态 / 操作</span>
      </div>
      <article v-for="record in records" :key="record.id" class="comment-governance-row">
        <div class="comment-origin"><strong>{{ localDateTime(record.createdAt) }}</strong><small>{{ record.authorId }}</small><small>{{ record.id }}</small></div>
        <div class="comment-content"><p>{{ record.status === "DELETED" ? "评论内容已由用户删除" : commentSummary(record.content || "") }}</p><small v-if="record.parentId">回复评论：{{ record.parentId }}</small></div>
        <div class="comment-resource"><strong>{{ record.articleId }}</strong><small>{{ record.parentId ? "回复" : "根评论" }}</small></div>
        <div class="comment-state-actions">
          <span class="comment-state" :data-status="record.status">{{ commentStatusLabels[record.status] }}</span>
          <button v-if="record.status === 'ACTIVE'" class="text-action danger-text" type="button" @click="openAction(record, 'hide')"><EyeOff :size="14"/> 隐藏</button>
          <button v-else-if="record.status === 'HIDDEN'" class="text-action" type="button" @click="openAction(record, 'restore')"><RotateCcw :size="14"/> 恢复</button>
        </div>
      </article>
    </div>
    <p v-if="!records.length && !message && !loading" class="empty">当前筛选条件下没有评论。</p>

    <div v-if="actionTarget" class="governance-dialog-backdrop" @click.self="closeAction">
      <form class="governance-dialog" @submit.prevent="confirmAction">
        <button class="dialog-close" type="button" aria-label="关闭" @click="closeAction"><X :size="18"/></button>
        <span class="dialog-icon"><ShieldAlert :size="22"/></span>
        <p class="eyebrow">治理确认</p>
        <h2>{{ action === "hide" ? "隐藏这条评论？" : "恢复这条评论？" }}</h2>
        <p class="dialog-comment">{{ commentSummary(actionTarget.content || "评论内容已删除", 160) }}</p>
        <label><span>操作原因</span><textarea v-model="reason" required maxlength="300" rows="3" :placeholder="action === 'hide' ? '说明违规类型或处理依据' : '说明复核结论或恢复依据'"/></label>
        <div class="dialog-actions"><button class="button secondary" type="button" :disabled="Boolean(busyId)" @click="closeAction">取消</button><button class="button primary" type="submit" :disabled="!reason.trim() || Boolean(busyId)">{{ busyId ? "处理中..." : "确认并记录审计" }}</button></div>
      </form>
    </div>
  </section>
</template>
