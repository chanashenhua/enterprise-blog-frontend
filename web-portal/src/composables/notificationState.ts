import { ref } from "vue";
import { api } from "@/api/client";
import { useAuth } from "@/auth/auth";

const unreadCount = ref(0);

export function useNotificationState() {
  async function refreshUnreadCount() {
    const { user } = useAuth();
    const startedUser = user.value;
    if (!startedUser) return;
    try {
      const count = (await api.notificationUnreadCount()).count;
      if (user.value === startedUser) unreadCount.value = count;
    } catch {
      if (user.value === startedUser) unreadCount.value = 0;
    }
  }

  return {
    unreadCount,
    refreshUnreadCount,
  };
}
