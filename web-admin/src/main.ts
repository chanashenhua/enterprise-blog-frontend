import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { configureUnauthorizedHandler } from "./auth/auth";
import "./styles.css";
import "./governance.css";
import "./comment-governance.css";
import "./dashboard.css";
import "./auth.css";

configureUnauthorizedHandler(async () => {
  const current = router.currentRoute.value;
  const redirect = current.name === "login" ? "/" : current.fullPath;
  await router.replace({ name: "login", query: { redirect } });
});
createApp(App).use(router).mount("#app");
