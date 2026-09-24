import { computed } from "vue";
import { useAuth } from "@/auth/auth";

// Display-only compatibility adapter. Authentication is owned by useAuth.
export function useUserContext() {
  const { user } = useAuth();
  return {
    userId: computed(() => user.value?.id ?? ""),
    userLabel: computed(() => user.value?.displayName ?? ""),
  };
}
