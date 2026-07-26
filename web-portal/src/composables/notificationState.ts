import { ref } from "vue";
import { api, type MockUserId } from "@/api/client";

const unreadCount = ref(0);

export function useNotificationState() {
  async function refreshUnreadCount(userId: MockUserId) {
    try {
      unreadCount.value = (await api.notificationUnreadCount(userId)).count;
    } catch {
      unreadCount.value = 0;
    }
  }

  return {
    unreadCount,
    refreshUnreadCount,
  };
}
