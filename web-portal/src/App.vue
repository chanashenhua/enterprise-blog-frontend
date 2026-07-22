<script setup lang="ts">
import { BookOpenText, FilePenLine, Search } from "lucide-vue-next";
import UserContextSwitcher from "@/components/UserContextSwitcher.vue";
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/" aria-label="技术博客首页">
        <span class="brand-mark"><BookOpenText :size="20" /></span>
        <span>技术博客</span>
      </RouterLink>
      <nav aria-label="主导航">
        <RouterLink to="/search"><Search :size="16" /> 搜索</RouterLink>
        <RouterLink to="/articles/new"><FilePenLine :size="16" /> 写文章</RouterLink>
      </nav>
      <UserContextSwitcher />
    </header>
    <main class="page-content"><RouterView /></main>
  </div>
</template>
