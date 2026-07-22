<script setup lang="ts">
import { ArrowRight, FilePenLine, Search } from "lucide-vue-next";
import { useUserContext } from "@/composables/userContext";

const { userLabel } = useUserContext();
</script>

<template>
  <section class="home-layout">
    <div class="home-intro">
      <p class="eyebrow">内部知识库</p>
      <h1>沉淀每一次技术判断。</h1>
      <p>以 {{ userLabel }} 身份进入，撰写经验、发布可见范围明确的文章，或从团队积累中找到可靠的答案。</p>
      <div class="command-row">
        <RouterLink class="button primary" to="/articles/new"><FilePenLine :size="17" /> 开始写作</RouterLink>
        <RouterLink class="button secondary" to="/search"><Search :size="17" /> 搜索文章</RouterLink>
      </div>
    </div>
    <div class="workflow-list" aria-label="工作流">
      <RouterLink to="/articles/new"><span>01</span><strong>起草并发布</strong><ArrowRight :size="17" /></RouterLink>
      <RouterLink to="/search"><span>02</span><strong>按主题检索</strong><ArrowRight :size="17" /></RouterLink>
      <div><span>03</span><strong>依据组织范围访问</strong></div>
    </div>
  </section>
</template>
