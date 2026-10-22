<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RotateCw } from "lucide-vue-next";
import { api, type SearchTask } from "@/api/client";
const tasks = ref<SearchTask[]>([]);
const status = ref("FAILED");
const message = ref("");
const success = ref("");
const loading = ref(false);
const busy = ref("");
let generation = 0;
const eventLabels: Record<string, string> = { ArticlePublished: "发布索引", ArticleWithdrawn: "撤回清理", ArticleDeleted: "删除清理", ArticleSearchSync: "全量同步" };
async function load() {
  const current = ++generation;
  loading.value = true; message.value = "";
  try { const result = await api.searchTasks(status.value); if (current === generation) tasks.value = result; }
  catch (error) { if (current === generation) { tasks.value = []; message.value = error instanceof Error ? error.message : "加载失败"; } }
  finally { if (current === generation) loading.value = false; }
}
async function retry(id: string) {
  busy.value = id; success.value = ""; message.value = "";
  try { await api.retryTask(id); await load(); success.value = "已重新加入索引同步队列。"; }
  catch (error) { message.value = error instanceof Error ? error.message : "重试失败"; }
  finally { busy.value = ""; }
}
async function reindex() {
  if (!window.confirm("将按数据库当前文章状态重新同步搜索索引，继续吗？")) return;
  busy.value = "reindex"; success.value = ""; message.value = "";
  try { const result = await api.reindexArticles(); status.value = "PENDING"; await load(); success.value = `已加入 ${result.queued} 个同步任务。`; }
  catch (error) { message.value = error instanceof Error ? error.message : "同步失败"; }
  finally { busy.value = ""; }
}
onMounted(load);
</script>

<template>
  <section>
    <header class="view-header"><div><p class="eyebrow">搜索索引</p><h1>索引同步任务</h1></div><div class="index-actions"><button class="button secondary" :disabled="loading || !!busy" @click="load">刷新</button><button class="button primary" :disabled="!!busy" @click="reindex">重新同步全部文章</button></div></header>
    <label class="task-filter">任务状态 <select v-model="status" aria-label="索引任务状态" @change="load"><option value="FAILED">失败任务</option><option value="PENDING">待处理任务</option></select></label>
    <p class="muted">发布、撤回、删除和全量同步统一按文章当前状态处理，每次最多展示 200 条。</p>
    <p v-if="message" class="error" role="alert">{{ message }}</p><p v-if="success" role="status">{{ success }}</p>
    <p v-if="loading" role="status">正在加载…</p>
    <div v-else class="table"><div class="table-head"><span>文章／操作</span><span>状态</span><span>重试次数</span><span>操作</span></div><div v-for="task in tasks" :key="task.id" class="table-row"><div><strong>{{ task.articleId }}</strong><small>{{ eventLabels[task.eventType] ?? task.eventType }}</small></div><span class="status">{{ task.status === 'FAILED' ? '失败' : '待处理' }}</span><span>{{ task.retryCount }}</span><button class="icon" title="重试索引" :disabled="task.status !== 'FAILED' || !!busy" @click="retry(task.id)"><RotateCw :size="17" /></button></div></div>
    <p v-if="!loading && !tasks.length && !message" class="empty">当前没有{{ status === 'FAILED' ? '失败' : '待处理' }}任务。</p>
  </section>
</template>
<style scoped>
.index-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.task-filter { display: flex; gap: 12px; align-items: center; margin: 16px 0; }
.task-filter select { padding: 8px; border-radius: 8px; }
@media (max-width: 600px) { .view-header { flex-wrap: wrap; gap: 16px; } }
</style>
