<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowRight, BarChart3, Building2, Check, KeyRound, LockKeyhole, ShieldCheck, Sparkles } from "lucide-vue-next";
import { DEMO_USERS, type DemoUserId, useAuth } from "@/auth/auth";
import { safeRedirect } from "@/auth/navigation";

const route = useRoute();
const router = useRouter();
const { login, mode, error: authError } = useAuth();
const busyUser = ref<DemoUserId | null>(null);
const message = ref("");
const accounts = [
  { user: DEMO_USERS["u-admin"], tone: "violet", title: "平台管理员", summary: "可进入管理台并使用全部治理功能", scope: "平台部 · 搜索团队", abilities: ["内容治理", "审核管理", "审计分析"] },
  { user: DEMO_USERS["u-author"], tone: "cyan", title: "技术作者", summary: "可验证身份，但没有管理台权限", scope: "平台部 · 搜索团队", abilities: ["身份验证", "前台创作"] },
  { user: DEMO_USERS["u-reader"], tone: "amber", title: "企业读者", summary: "可验证身份，但没有管理台权限", scope: "支付部 · 支付团队", abilities: ["身份验证", "前台阅读"] },
];

async function selectAccount(userId: DemoUserId) {
  busyUser.value = userId; message.value = "";
  try {
    const session = await login(userId);
    await router.replace(session.user.roles.includes("ADMIN") ? safeRedirect(route.query.redirect) : "/forbidden");
  } catch (reason) { message.value = reason instanceof Error ? reason.message : "登录失败，请检查本地配置"; }
  finally { busyUser.value = null; }
}
</script>

<template>
  <main class="auth-page admin-auth-page">
    <div class="auth-orb auth-orb-one"></div><div class="auth-orb auth-orb-two"></div>
    <section class="auth-brand-panel">
      <div class="auth-brand"><span><ShieldCheck :size="25" /></span><strong>Tech Atlas</strong><small>CONTROL</small></div>
      <div class="auth-hero-copy"><p class="auth-kicker"><Sparkles :size="15" /> 企业内容治理中心</p><h1>看见全局，<br><em>守护知识质量。</em></h1><p>集中处理审核、内容治理和运营数据，让知识流动保持安全、可信与高效。</p></div>
      <div class="auth-trust-row"><span><LockKeyhole :size="16" /> 管理权限校验</span><span><BarChart3 :size="16" /> 全局运营视图</span><span><Building2 :size="16" /> OIDC 就绪</span></div>
    </section>
    <section class="auth-login-panel"><div class="auth-login-content">
      <header><p>管理台登录</p><h2>{{ mode === "local" ? "选择演示身份" : "使用企业账号登录" }}</h2><span>{{ mode === "local" ? "非管理员登录后将进入无权限提示页" : "系统将根据企业角色判断管理权限" }}</span></header>
      <p v-if="message || authError" class="auth-error" role="alert">{{ message || authError }}</p>
      <div v-if="mode === 'local'" class="demo-account-list">
        <button v-for="account in accounts" :key="account.user.id" type="button" class="demo-account-card" :data-tone="account.tone" :disabled="busyUser !== null" :aria-label="`使用 ${account.title} ${account.user.id} 登录`" @click="selectAccount(account.user.id)">
          <span class="demo-avatar">{{ account.title.slice(0, 1) }}</span><span class="demo-account-main"><span class="demo-title-line"><strong>{{ account.title }}</strong><code>{{ account.user.id }}</code></span><span class="demo-summary">{{ account.summary }}</span><span class="demo-scope"><Building2 :size="14" />{{ account.scope }}</span><span class="demo-abilities"><span v-for="ability in account.abilities" :key="ability"><Check :size="12" />{{ ability }}</span></span></span><span class="demo-enter">{{ busyUser === account.user.id ? "验证中" : "验证" }}<ArrowRight :size="17" /></span>
        </button>
      </div>
      <button v-else type="button" class="oidc-login-button" @click="selectAccount('u-admin')"><KeyRound :size="18" />使用企业账号继续<ArrowRight :size="17" /></button>
      <footer>本地演示身份仅用于开发。生产管理台必须接入企业 OIDC。</footer>
    </div></section>
  </main>
</template>
