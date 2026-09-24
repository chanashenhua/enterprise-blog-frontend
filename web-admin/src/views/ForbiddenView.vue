<script setup lang="ts">
import { ArrowRight, BookOpenText, LockKeyhole, LogOut, ShieldX } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuth } from "@/auth/auth";

const router = useRouter();
const { user, logout } = useAuth();
const portalUrl = import.meta.env.VITE_PORTAL_URL ?? "http://localhost:5173";
async function signOut() { await logout(); await router.replace({ name: "login" }); }
</script>

<template>
  <main class="forbidden-page">
    <section class="forbidden-card">
      <span class="forbidden-icon"><ShieldX :size="34" /></span><p class="auth-kicker"><LockKeyhole :size="14" /> 权限边界已生效</p>
      <h1>身份验证成功，<br>但没有管理权限</h1>
      <p><strong>{{ user?.displayName }}</strong>（{{ user?.id }}）可以使用员工前台，但当前角色不包含 <code>ADMIN</code>。管理页面没有加载，也不会发起管理接口请求。</p>
      <div class="forbidden-actions"><a :href="portalUrl"><BookOpenText :size="17" />前往员工前台<ArrowRight :size="16" /></a><button type="button" @click="signOut"><LogOut :size="17" />退出登录</button></div>
    </section>
  </main>
</template>
