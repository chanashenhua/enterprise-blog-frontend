<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { Filter, RotateCcw, Search } from "lucide-vue-next";
import { api, type AuditFilters, type AuditRecord } from "@/api/client";
import { auditActionLabel, localDateTime } from "@/auditLabels";

const records = ref<AuditRecord[]>([]);
const loading = ref(false);
const message = ref("");
const filters = reactive({ actorId: "", action: "", resourceType: "", resourceId: "", from: "", to: "" });

function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

async function load() {
  loading.value = true;
  message.value = "";
  try {
    const query: AuditFilters = {
      actorId: filters.actorId.trim() || undefined,
      action: filters.action || undefined,
      resourceType: filters.resourceType || undefined,
      resourceId: filters.resourceId.trim() || undefined,
      from: toIso(filters.from),
      to: toIso(filters.to),
    };
    records.value = await api.audits(query);
  } catch (error) {
    message.value = error instanceof Error ? error.message : "审计记录加载失败";
  } finally {
    loading.value = false;
  }
}

function reset() {
  Object.assign(filters, { actorId: "", action: "", resourceType: "", resourceId: "", from: "", to: "" });
  void load();
}

onMounted(load);
</script>

<template>
  <section>
    <header class="view-header">
      <div>
        <p class="eyebrow">安全与治理</p>
        <h1>关键操作审计</h1>
        <p class="lede">记录审核决策和分类标签维护，便于追溯操作人、资源与发生时间。</p>
      </div>
      <button class="button secondary" :disabled="loading" @click="load">刷新</button>
    </header>

    <form class="audit-filters" @submit.prevent="load">
      <label><span>操作人</span><input v-model="filters.actorId" placeholder="例如 u-admin" /></label>
      <label><span>动作</span><select v-model="filters.action"><option value="">全部动作</option><option value="REVIEW_APPROVE">审核通过</option><option value="REVIEW_REJECT">审核驳回</option><option value="TAG_CREATE">新增标签</option><option value="TAG_UPDATE">修改标签</option><option value="TAG_DEACTIVATE">停用标签</option><option value="CATEGORY_CREATE">新增分类</option><option value="CATEGORY_UPDATE">修改分类</option><option value="CATEGORY_DEACTIVATE">停用分类</option></select></label>
      <label><span>资源类型</span><select v-model="filters.resourceType"><option value="">全部类型</option><option value="ARTICLE">文章</option><option value="TAG">标签</option><option value="CATEGORY">分类</option></select></label>
      <label><span>资源 ID</span><input v-model="filters.resourceId" placeholder="精确匹配" /></label>
      <label><span>开始时间</span><input v-model="filters.from" type="datetime-local" /></label>
      <label><span>结束时间</span><input v-model="filters.to" type="datetime-local" /></label>
      <div class="filter-actions">
        <button class="button primary" type="submit"><Search :size="16" /> 查询</button>
        <button class="button secondary" type="button" @click="reset"><RotateCcw :size="16" /> 重置</button>
      </div>
    </form>

    <p v-if="message" class="error">{{ message }}</p>
    <div class="audit-summary"><Filter :size="15" /><span>共 {{ records.length }} 条记录</span></div>
    <div class="audit-table-wrap">
      <div class="audit-table">
        <div class="audit-row audit-head"><span>时间 / 操作人</span><span>动作</span><span>资源</span><span>详情</span></div>
        <div v-for="record in records" :key="record.id" class="audit-row">
          <div><strong>{{ localDateTime(record.occurredAt) }}</strong><small>{{ record.actorId }} · {{ record.sourceService }}</small></div>
          <div><span class="audit-action">{{ auditActionLabel(record.action) }}</span><small>{{ record.outcome }}</small></div>
          <div><strong>{{ record.resourceType }}</strong><small>{{ record.resourceId }}</small></div>
          <div><span class="audit-detail">{{ record.details || "—" }}</span><small v-if="record.traceId">Trace: {{ record.traceId }}</small></div>
        </div>
      </div>
    </div>
    <p v-if="!records.length && !message && !loading" class="empty">当前筛选条件下没有审计记录。</p>
  </section>
</template>
