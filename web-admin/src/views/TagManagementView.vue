<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Tag } from "lucide-vue-next";
import { api, type Tag as BlogTag } from "@/api/client";
const tags = ref<BlogTag[]>([]); const message = ref("");
onMounted(async () => { try { tags.value = await api.tags(); } catch (e) { message.value = e instanceof Error ? e.message : "加载失败"; } });
</script>
<template><section><header class="view-header"><div><p class="eyebrow">内容分类</p><h1>标签目录</h1></div></header><p v-if="message" class="error">{{ message }}</p><div class="tag-grid"><div v-for="tag in tags" :key="tag.id"><Tag :size="17"/><strong>{{ tag.name }}</strong><span>{{ tag.id }}</span></div></div></section></template>
