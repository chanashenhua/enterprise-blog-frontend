import { computed, ref } from "vue";
import type { MockUserId } from "@/api/client";

const userId = ref<MockUserId>("u-author");

const labels: Record<MockUserId, string> = {
  "u-admin": "平台管理员",
  "u-author": "技术作者",
  "u-reader": "普通读者",
};

export function useUserContext() {
  return {
    userId,
    userLabel: computed(() => labels[userId.value]),
    labels,
  };
}
