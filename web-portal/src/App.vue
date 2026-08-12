<script setup lang="ts">
import { watch } from "vue";
import { useRoute } from "vue-router";
import { Bell, BookMarked, BookOpenText, Compass, Files, FilePenLine, LibraryBig, Rss, Sparkles } from "lucide-vue-next";
import AccountMenu from "@/components/AccountMenu.vue";
import { useAuth } from "@/auth/auth";
import { useNotificationState } from "@/composables/notificationState";

const route = useRoute();
const { initialized, isAuthenticated } = useAuth();
const { unreadCount, refreshUnreadCount } = useNotificationState();
watch(isAuthenticated, (active) => { if (active) refreshUnreadCount(); }, { immediate: true });
</script>

<template>
  <div v-if="!initialized" class="auth-loading" role="status"><span class="brand-mark"><BookOpenText :size="24" /></span><strong>Tech Atlas</strong><i></i><small>正在恢复安全会话</small></div>
  <RouterView v-else-if="route.meta.publicLayout" />
  <div v-else class="app-shell">
    <div class="ambient ambient-one" aria-hidden="true"></div><div class="ambient ambient-two" aria-hidden="true"></div>
    <header class="topbar">
      <RouterLink class="brand" to="/" aria-label="Tech Atlas 首页"><span class="brand-mark"><BookOpenText :size="21" /></span><span class="brand-copy"><strong>Tech Atlas</strong><small>工程知识中枢</small></span></RouterLink>
      <nav aria-label="主导航"><RouterLink to="/"><Sparkles :size="16" /> 首页</RouterLink><RouterLink to="/explore"><Compass :size="16" /> 发现</RouterLink><RouterLink to="/collections"><LibraryBig :size="16" /> 专题</RouterLink><RouterLink to="/library"><BookMarked :size="16" /> 知识库</RouterLink><RouterLink to="/subscriptions"><Rss :size="16" /> 订阅</RouterLink><RouterLink to="/articles"><Files :size="16" /> 创作中心</RouterLink></nav>
      <div class="topbar-actions"><AccountMenu /><RouterLink class="notification-shortcut" to="/notifications" aria-label="通知中心"><Bell :size="17" /><span v-if="unreadCount" class="notification-badge">{{ unreadCount > 99 ? "99+" : unreadCount }}</span></RouterLink><RouterLink class="write-shortcut" to="/articles/new"><FilePenLine :size="16" /><span>写文章</span></RouterLink></div>
    </header>
    <main class="page-content"><RouterView v-slot="{ Component }"><Transition name="page" mode="out-in"><component :is="Component" /></Transition></RouterView></main>
    <footer class="site-footer"><span>Tech Atlas · 让工程经验持续产生价值</span><span>企业内部知识空间</span></footer>
  </div>
</template>
