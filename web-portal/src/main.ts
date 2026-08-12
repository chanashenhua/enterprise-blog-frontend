import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { configureUnauthorizedHandler } from "./auth/auth";
import "./styles.css";
import "./library.css";
import "./subscriptions.css";
import "./explore.css";
import "./collections.css";
import "./auth.css";

configureUnauthorizedHandler(async () => {
  const current = router.currentRoute.value;
  const redirect = current.name === "login" ? "/" : current.fullPath;
  await router.replace({ name: "login", query: { redirect } });
});
createApp(App).use(router).mount("#app");
