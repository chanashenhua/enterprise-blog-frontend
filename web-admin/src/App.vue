<script setup lang="ts">
import { useRoute } from "vue-router";
import { BarChart3, BellRing, ClipboardCheck, DatabaseZap, LayoutDashboard, MessageSquareWarning, ScrollText, ShieldCheck, Tags } from "lucide-vue-next";
import AccountMenu from "@/components/AccountMenu.vue";
import { useAuth } from "@/auth/auth";

const route = useRoute();
const { initialized } = useAuth();
</script>

<template>
  <div v-if="!initialized" class="auth-loading" role="status"><span><ShieldCheck :size="24" /></span><strong>Tech Atlas Control</strong><i></i><small>正在校验管理权限</small></div>
  <RouterView v-else-if="route.meta.publicLayout" />
  <div v-else class="shell">
    <aside><RouterLink class="brand" to="/"><span>TA</span><strong>管理台</strong></RouterLink><nav><RouterLink to="/"><LayoutDashboard :size="17"/> 概览</RouterLink><RouterLink to="/interaction-stats"><BarChart3 :size="17"/> 互动数据</RouterLink><RouterLink to="/notification-governance"><BellRing :size="17"/> 通知治理</RouterLink><RouterLink to="/comment-governance"><MessageSquareWarning :size="17"/> 评论治理</RouterLink><RouterLink to="/reviews"><ClipboardCheck :size="17"/> 审核队列</RouterLink><RouterLink to="/search-tasks"><DatabaseZap :size="17"/> 索引任务</RouterLink><RouterLink to="/tags"><Tags :size="17"/> 标签</RouterLink><RouterLink to="/audits"><ScrollText :size="17"/> 操作审计</RouterLink></nav><AccountMenu /></aside>
    <main><RouterView /></main>
  </div>
</template>
