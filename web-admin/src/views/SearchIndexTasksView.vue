<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RotateCw } from "lucide-vue-next";
import { api, type SearchTask } from "@/api/client";
const tasks = ref<SearchTask[]>([]); const message = ref("");
async function load() { try { tasks.value = await api.searchTasks(); } catch (e) { message.value = e instanceof Error ? e.message : "加载失败"; } }
async function retry(id: string) { await api.retryTask(id); await load(); }
onMounted(load);
</script>
<template><section><header class="view-header"><div><p class="eyebrow">搜索索引</p><h1>异常任务</h1></div><button class="button secondary" @click="load">刷新</button></header><p v-if="message" class="error">{{ message }}</p><div class="table"><div class="table-head"><span>文章</span><span>状态</span><span>重试次数</span><span>操作</span></div><div v-for="task in tasks" :key="task.id" class="table-row"><strong>{{ task.articleId }}</strong><span class="status">{{ task.status }}</span><span>{{ task.retryCount }}</span><button class="icon" title="重试索引" :disabled="task.status !== 'FAILED'" @click="retry(task.id)"><RotateCw :size="17"/></button></div></div><p v-if="!tasks.length && !message" class="empty">没有等待处理的索引任务。</p></section></template>
