import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./styles.css";
import "./library.css";
import "./subscriptions.css";
import "./explore.css";
import "./collections.css";

createApp(App).use(router).mount("#app");
