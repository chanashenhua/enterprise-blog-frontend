import { ref } from "vue";
import { api } from "@/api/client";

const unreadCount = ref(0);

export function useNotificationState() {
  async function refreshUnreadCount() {
    try {
      unreadCount.value = (await api.notificationUnreadCount()).count;
    } catch {
      unreadCount.value = 0;
    }
  }

  return {
    unreadCount,
    refreshUnreadCount,
  };
}
