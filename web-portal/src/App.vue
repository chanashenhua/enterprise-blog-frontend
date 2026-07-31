<script setup lang="ts">
import { onMounted, watch } from "vue";
import { Bell, BookMarked, BookOpenText, Files, FilePenLine, Rss, Search, Sparkles } from "lucide-vue-next";
import UserContextSwitcher from "@/components/UserContextSwitcher.vue";
import { useNotificationState } from "@/composables/notificationState";
import { useUserContext } from "@/composables/userContext";

const { userId } = useUserContext();
const { unreadCount, refreshUnreadCount } = useNotificationState();

onMounted(() => refreshUnreadCount(userId.value));
watch(userId, (current) => refreshUnreadCount(current));
</script>

<template>
  <div class="app-shell">
    <div class="ambient ambient-one" aria-hidden="true"></div>
    <div class="ambient ambient-two" aria-hidden="true"></div>
    <header class="topbar">
      <RouterLink class="brand" to="/" aria-label="技术博客首页">
        <span class="brand-mark"><BookOpenText :size="21" /></span>
        <span class="brand-copy">
          <strong>Tech Atlas</strong>
          <small>工程知识中枢</small>
        </span>
      </RouterLink>
      <nav aria-label="主导航">
        <RouterLink to="/"><Sparkles :size="16" /> 首页</RouterLink>
        <RouterLink to="/search"><Search :size="16" /> 探索</RouterLink>
        <RouterLink to="/library"><BookMarked :size="16" /> 知识库</RouterLink>
        <RouterLink to="/subscriptions"><Rss :size="16" /> 订阅</RouterLink>
        <RouterLink to="/articles"><Files :size="16" /> 创作中心</RouterLink>
      </nav>
      <div class="topbar-actions">
        <UserContextSwitcher />
        <RouterLink class="notification-shortcut" to="/notifications" aria-label="通知中心">
          <Bell :size="17" />
          <span v-if="unreadCount" class="notification-badge">{{ unreadCount > 99 ? "99+" : unreadCount }}</span>
        </RouterLink>
        <RouterLink class="write-shortcut" to="/articles/new">
          <FilePenLine :size="16" />
          <span>写文章</span>
        </RouterLink>
      </div>
    </header>
    <main class="page-content">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <footer class="site-footer">
      <span>Tech Atlas · 让工程经验持续产生价值</span>
      <span>企业内部知识空间</span>
    </footer>
  </div>
</template>
