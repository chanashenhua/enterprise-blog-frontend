<script setup lang="ts">
import { LogOut, ShieldCheck } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuth } from "@/auth/auth";

const router = useRouter();
const { user, logout } = useAuth();
async function signOut() { await logout(); await router.replace({ name: "login" }); }
</script>

<template>
  <div v-if="user" class="admin-account">
    <span class="admin-avatar">{{ user.displayName.slice(0, 1) }}</span>
    <div class="admin-account-copy"><strong>{{ user.displayName }}</strong><small>{{ user.id }}</small></div>
    <div class="admin-account-roles"><ShieldCheck :size="14" />{{ user.roles.join(" · ") }}</div>
    <button type="button" @click="signOut"><LogOut :size="15" />退出登录</button>
  </div>
</template>
