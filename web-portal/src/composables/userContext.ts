import { computed } from "vue";
import { AuthenticationRequiredError, DEMO_USERS, useAuth } from "@/auth/auth";

export function useUserContext() {
  const { user } = useAuth();
  return {
    userId: computed(() => {
      if (!user.value) throw new AuthenticationRequiredError();
      return user.value.id;
    }),
    userLabel: computed(() => user.value?.displayName ?? ""),
    labels: Object.fromEntries(Object.values(DEMO_USERS).map((item) => [item.id, item.displayName])),
  };
}
