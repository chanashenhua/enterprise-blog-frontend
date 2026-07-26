<script setup lang="ts">
import {
  ArrowUpRight,
  BookMarked,
  Compass,
  FilePenLine,
  GitBranch,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-vue-next";
import { useUserContext } from "@/composables/userContext";

const { userLabel } = useUserContext();
</script>

<template>
  <section class="home-view">
    <div class="hero-grid">
      <div class="home-intro">
        <p class="eyebrow hero-eyebrow"><Sparkles :size="14" /> 企业内部知识库</p>
        <h1>让每一次<br /><span>技术判断</span>都有迹可循。</h1>
        <p class="hero-copy">
          以 {{ userLabel }} 身份进入，记录问题、方案与边界，让散落在项目里的经验成为团队下一次决策的起点。
        </p>
        <div class="command-row">
          <RouterLink class="button primary hero-command" to="/articles/new">
            <FilePenLine :size="17" /> 开始写作 <ArrowUpRight :size="16" />
          </RouterLink>
          <RouterLink class="button secondary hero-command" to="/search"><Search :size="17" /> 探索知识</RouterLink>
        </div>
        <div class="hero-proof" aria-label="平台能力">
          <div><ShieldCheck :size="18" /><span><strong>权限感知</strong><small>内容按组织范围可见</small></span></div>
          <div><GitBranch :size="18" /><span><strong>过程可追溯</strong><small>版本与审核全程留痕</small></span></div>
          <div><BookMarked :size="18" /><span><strong>知识可复用</strong><small>搜索团队最佳实践</small></span></div>
        </div>
      </div>

      <aside class="knowledge-panel" aria-label="知识脉络">
        <header class="knowledge-panel-header">
          <div>
            <span class="live-dot"></span>
            <p>知识脉络</p>
          </div>
          <span>持续生长</span>
        </header>
        <div class="knowledge-orbit" aria-hidden="true">
          <span class="orbit-ring ring-one"></span>
          <span class="orbit-ring ring-two"></span>
          <span class="orbit-core"><BookMarked :size="24" /></span>
          <span class="orbit-node node-one">架构</span>
          <span class="orbit-node node-two">实践</span>
          <span class="orbit-node node-three">复盘</span>
        </div>
        <div class="topic-stream">
          <div>
            <span class="topic-index">01</span>
            <p><strong>Spring Cloud 服务治理</strong><small>架构 · 8 篇沉淀</small></p>
            <ArrowUpRight :size="16" />
          </div>
          <div>
            <span class="topic-index">02</span>
            <p><strong>PostgreSQL 数据实践</strong><small>数据库 · 5 篇沉淀</small></p>
            <ArrowUpRight :size="16" />
          </div>
          <div>
            <span class="topic-index">03</span>
            <p><strong>搜索与性能优化</strong><small>工程效能 · 3 篇沉淀</small></p>
            <ArrowUpRight :size="16" />
          </div>
        </div>
      </aside>
    </div>

    <section class="home-workflow" aria-labelledby="workflow-title">
      <header>
        <div>
          <p class="eyebrow">知识工作流</p>
          <h2 id="workflow-title">从一个问题，走向可复用的答案</h2>
        </div>
        <p>不只保存结论，也保留判断过程和适用边界。</p>
      </header>
      <div class="workflow-grid">
        <RouterLink to="/articles/new">
          <span>01</span><FilePenLine :size="22" />
          <div><strong>记录与起草</strong><small>把上下文和推导过程写清楚</small></div>
          <ArrowUpRight :size="17" />
        </RouterLink>
        <RouterLink to="/articles">
          <span>02</span><ShieldCheck :size="22" />
          <div><strong>审核与沉淀</strong><small>在合适的范围内安全共享</small></div>
          <ArrowUpRight :size="17" />
        </RouterLink>
        <RouterLink to="/search">
          <span>03</span><Compass :size="22" />
          <div><strong>发现与复用</strong><small>在下一次决策中找到可靠依据</small></div>
          <ArrowUpRight :size="17" />
        </RouterLink>
      </div>
    </section>
  </section>
</template>
