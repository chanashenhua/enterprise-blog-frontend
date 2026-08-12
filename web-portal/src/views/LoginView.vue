<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowRight, BookOpenText, Building2, Check, KeyRound, LockKeyhole, Sparkles, UsersRound } from "lucide-vue-next";
import { DEMO_USERS, type DemoUserId, useAuth } from "@/auth/auth";
import { safeRedirect } from "@/auth/navigation";

const route = useRoute();
const router = useRouter();
const { login, mode, error: authError } = useAuth();
const busyUser = ref<DemoUserId | null>(null);
const message = ref("");
const accounts = [
  { user: DEMO_USERS["u-admin"], tone: "violet", title: "平台管理员", summary: "浏览、创作并体验治理能力", scope: "平台部 · 搜索团队", abilities: ["全局内容", "审核治理", "文章创作"] },
  { user: DEMO_USERS["u-author"], tone: "cyan", title: "技术作者", summary: "撰写文章并沉淀团队知识", scope: "平台部 · 搜索团队", abilities: ["文章创作", "知识专题", "互动评论"] },
  { user: DEMO_USERS["u-reader"], tone: "amber", title: "企业读者", summary: "发现、订阅与收藏优质内容", scope: "支付部 · 支付团队", abilities: ["内容阅读", "订阅收藏", "互动评论"] },
];

async function selectAccount(userId: DemoUserId) {
  busyUser.value = userId; message.value = "";
  try { await login(userId); await router.replace(safeRedirect(route.query.redirect)); }
  catch (reason) { message.value = reason instanceof Error ? reason.message : "登录失败，请检查本地配置"; }
  finally { busyUser.value = null; }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-orb auth-orb-one"></div><div class="auth-orb auth-orb-two"></div>
    <section class="auth-brand-panel">
      <div class="auth-brand"><span><BookOpenText :size="25" /></span><strong>Tech Atlas</strong></div>
      <div class="auth-hero-copy"><p class="auth-kicker"><Sparkles :size="15" /> 企业知识协作空间</p><h1>让团队经验，<br><em>持续产生价值。</em></h1><p>在一个可信、清晰的知识空间里发现洞见、分享实践，让每一次解决问题都成为团队的共同资产。</p></div>
      <div class="auth-trust-row"><span><LockKeyhole :size="16" /> 统一身份边界</span><span><UsersRound :size="16" /> 组织权限隔离</span><span><Building2 :size="16" /> OIDC 就绪</span></div>
    </section>
    <section class="auth-login-panel"><div class="auth-login-content">
      <header><p>欢迎回来</p><h2>{{ mode === "local" ? "选择演示身份进入" : "使用企业账号登录" }}</h2><span>{{ mode === "local" ? "无需密码，仅用于本地开发与功能演示" : "登录后将返回你刚才访问的页面" }}</span></header>
      <p v-if="message || authError" class="auth-error" role="alert">{{ message || authError }}</p>
      <div v-if="mode === 'local'" class="demo-account-list">
        <button v-for="account in accounts" :key="account.user.id" type="button" class="demo-account-card" :data-tone="account.tone" :disabled="busyUser !== null" :aria-label="`使用 ${account.title} ${account.user.id} 登录`" @click="selectAccount(account.user.id)">
          <span class="demo-avatar">{{ account.title.slice(0, 1) }}</span><span class="demo-account-main"><span class="demo-title-line"><strong>{{ account.title }}</strong><code>{{ account.user.id }}</code></span><span class="demo-summary">{{ account.summary }}</span><span class="demo-scope"><Building2 :size="14" />{{ account.scope }}</span><span class="demo-abilities"><span v-for="ability in account.abilities" :key="ability"><Check :size="12" />{{ ability }}</span></span></span><span class="demo-enter">{{ busyUser === account.user.id ? "进入中" : "进入" }}<ArrowRight :size="17" /></span>
        </button>
      </div>
      <button v-else type="button" class="oidc-login-button" @click="selectAccount('u-admin')"><KeyRound :size="18" />使用企业账号继续<ArrowRight :size="17" /></button>
      <footer>本地演示身份不代表生产认证。生产环境必须接入企业 OIDC。</footer>
    </div></section>
  </main>
</template>
