<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Check, X } from "lucide-vue-next";
import { api, type ReviewTicket } from "@/api/client";
import { reviewStatusLabel } from "@/reviewLabels";
const tickets = ref<ReviewTicket[]>([]); const message = ref(""); const comments = ref<Record<string, string>>({});
async function load() { try { tickets.value = await api.reviews(); } catch (e) { message.value = e instanceof Error ? e.message : "加载失败"; } }
async function approve(id: string) { await api.approve(id); await load(); }
async function reject(id: string) { if (!comments.value[id]?.trim()) { message.value = "请填写驳回意见"; return; } await api.reject(id, comments.value[id]); await load(); }
onMounted(load);
</script>
<template><section><header class="view-header"><div><p class="eyebrow">审核队列</p><h1>待审核范围文章</h1></div><button class="button secondary" @click="load">刷新</button></header><p v-if="message" class="error">{{ message }}</p><div class="table"><div class="table-head"><span>文章</span><span>状态</span><span>处理</span></div><div v-for="ticket in tickets" :key="ticket.id" class="table-row"><div><strong>{{ ticket.articleId }}</strong><small>{{ ticket.id }}</small></div><span class="status">{{ reviewStatusLabel(ticket.status) }}</span><div class="decision"><input v-model="comments[ticket.id]" placeholder="驳回意见" aria-label="驳回意见"/><button class="icon success" title="通过审核" @click="approve(ticket.id)"><Check :size="17"/></button><button class="icon danger" title="驳回审核" @click="reject(ticket.id)"><X :size="17"/></button></div></div></div><p v-if="!tickets.length && !message" class="empty">当前没有待处理审核。</p></section></template>
