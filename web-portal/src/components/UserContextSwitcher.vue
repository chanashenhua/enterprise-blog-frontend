<script setup lang="ts">
import { UserRound } from "lucide-vue-next";
import { useUserContext } from "@/composables/userContext";

const { userId, labels } = useUserContext();
</script>

<template>
  <label class="user-switcher">
    <UserRound :size="16" aria-hidden="true" />
    <span class="sr-only">用户</span>
    <select v-model="userId" aria-label="用户">
      <option v-for="(label, id) in labels" :key="id" :value="id">{{ label }}</option>
    </select>
  </label>
</template>
