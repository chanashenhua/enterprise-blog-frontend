<script setup lang="ts">
import { ClipboardCheck, DatabaseZap, LayoutDashboard, Tags } from "lucide-vue-next";
</script>
<template><div class="shell"><aside><RouterLink class="brand" to="/"><span>TB</span><strong>管理台</strong></RouterLink><nav><RouterLink to="/"><LayoutDashboard :size="17"/> 概览</RouterLink><RouterLink to="/reviews"><ClipboardCheck :size="17"/> 审核队列</RouterLink><RouterLink to="/search-tasks"><DatabaseZap :size="17"/> 索引任务</RouterLink><RouterLink to="/tags"><Tags :size="17"/> 标签</RouterLink></nav><p class="identity">u-admin<br/><small>平台管理员</small></p></aside><main><RouterView /></main></div></template>
