<script setup lang="ts">
import { ShieldX } from "lucide-vue-next";
import { useAuth } from "@/auth/auth";
const { user } = useAuth();
</script>
<template>
  <main class="forbidden-page"><section class="forbidden-card">
    <span class="forbidden-icon"><ShieldX :size="34" /></span>
    <h1>当前账号没有文章创作权限</h1>
    <p>{{ user?.displayName }}可以阅读文章、发表评论、订阅与整理知识专题。发布文章需要作者或管理员角色。</p>
    <div class="forbidden-actions"><RouterLink to="/">返回首页</RouterLink></div>
  </section></main>
</template>
