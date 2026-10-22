<script setup lang="ts">
import type { SearchHighlightPart } from "@/api/client";
defineProps<{ parts?: SearchHighlightPart[]; fallback: string }>();
</script>

<template>
  <template v-if="parts?.length">
    <template v-for="(part, index) in parts" :key="index"><mark v-if="part.matched">{{ part.text }}</mark><span v-else>{{ part.text }}</span></template>
  </template>
  <template v-else>{{ fallback }}</template>
</template>
