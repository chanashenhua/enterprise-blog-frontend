<script setup lang="ts">
import { LogOut, ShieldCheck, UserRound } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuth } from "@/auth/auth";

const router = useRouter();
const { user, logout } = useAuth();

async function signOut() {
  await logout();
  await router.replace({ name: "login" });
}
</script>

<template>
  <details v-if="user" class="account-menu">
    <summary :aria-label="`账号菜单：${user.displayName}`">
      <span class="account-avatar">{{ user.displayName.slice(0, 1) }}</span>
      <span class="account-summary-copy">
        <strong>{{ user.displayName }}</strong>
        <small>{{ user.id }}</small>
      </span>
    </summary>
    <div class="account-popover">
      <div class="account-popover-heading">
        <span class="account-avatar account-avatar-large">{{ user.displayName.slice(0, 1) }}</span>
        <div><strong>{{ user.displayName }}</strong><small>{{ user.id }}</small></div>
      </div>
      <p><ShieldCheck :size="15" /> 当前角色</p>
      <div class="account-role-list"><span v-for="role in user.roles" :key="role">{{ role }}</span></div>
      <p><UserRound :size="15" /> {{ user.departmentIds.join(" · ") }} / {{ user.teamIds.join(" · ") }}</p>
      <button type="button" class="account-logout" @click="signOut"><LogOut :size="16" />退出登录</button>
    </div>
  </details>
</template>
