import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./styles.css";
import "./governance.css";
import "./comment-governance.css";
import "./dashboard.css";

createApp(App).use(router).mount("#app");
