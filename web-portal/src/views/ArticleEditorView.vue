<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, BookOpenCheck, CircleCheck, Save, Send, ShieldCheck, Sparkles } from "lucide-vue-next";
import { api, type Article } from "@/api/client";
import { useUserContext } from "@/composables/userContext";

const props = defineProps<{ id?: string }>();
const router = useRouter();
const { userId } = useUserContext();
const currentArticleId = ref(props.id ?? "");
const title = ref("");
const body = ref("");
const tags = ref("engineering");
const categoryId = ref("");
const visibility = ref("COMPANY");
const targetOrg = ref("");
const busy = ref(false);
const loading = ref(Boolean(props.id));
const message = ref("");
const isEditing = computed(() => Boolean(currentArticleId.value));
const canPublish = computed(() => title.value.trim() && body.value.trim() && (visibility.value === "COMPANY" || targetOrg.value.trim()));

function tagIds() {
  return tags.value.split(",").map((value) => value.trim()).filter(Boolean);
}

function targetOrgIds() {
  return targetOrg.value.split(",").map((value) => value.trim()).filter(Boolean);
}

async function loadArticle() {
  if (!props.id) return;
  loading.value = true;
  try {
    const article = await api.getArticle(userId.value, props.id);
    currentArticleId.value = article.id;
    title.value = article.title;
    body.value = article.plainText;
    tags.value = article.tagIds.join(", ");
    categoryId.value = article.categoryId ?? "";
    visibility.value = article.visibilityType ?? "COMPANY";
    targetOrg.value = article.visibilityTargetIds.join(", ");
  } catch (error) {
    message.value = error instanceof Error ? error.message : "文章加载失败";
  } finally {
    loading.value = false;
  }
}

function persistDraft(): Promise<Article> {
  const normalizedCategoryId = categoryId.value.trim() || null;
  if (currentArticleId.value) {
    return api.updateDraft(
      userId.value,
      currentArticleId.value,
      title.value.trim(),
      body.value.trim(),
      tagIds(),
      normalizedCategoryId,
    );
  }
  return api.createDraft(
    userId.value,
    title.value.trim(),
    body.value.trim(),
    tagIds(),
    normalizedCategoryId,
  );
}

async function saveDraft() {
  if (!title.value.trim() || !body.value.trim()) return;
  busy.value = true;
  message.value = "";
  try {
    const article = await persistDraft();
    currentArticleId.value = article.id;
    message.value = "草稿已保存";
    await router.push(`/articles/${article.id}`);
  } catch (error) {
    message.value = error instanceof Error ? error.message : "草稿保存失败";
  } finally {
    busy.value = false;
  }
}

async function publish() {
  if (!canPublish.value) return;
  busy.value = true;
  message.value = "";
  try {
    const draft = await persistDraft();
    currentArticleId.value = draft.id;
    const article = await api.publish(userId.value, draft.id, visibility.value, targetOrgIds(), visibility.value !== "COMPANY");
    await router.push(`/articles/${article.id}`);
  } catch (error) {
    message.value = error instanceof Error ? error.message : "发布失败";
  } finally {
    busy.value = false;
  }
}

onMounted(loadArticle);
</script>

<template>
  <section class="editor-layout">
    <header class="view-header">
      <div>
        <RouterLink class="back-link" to="/articles"><ArrowLeft :size="16" /> 返回我的文章</RouterLink>
        <p class="eyebrow">{{ isEditing ? "编辑草稿" : "新建文章" }}</p>
        <h1>{{ isEditing ? "继续完善这篇文章" : "把经验写成可复用的知识" }}</h1>
        <p class="view-description">清晰地记录背景、判断过程和适用边界，让经验真正能够被复用。</p>
      </div>
      <p class="status-message" role="status">{{ message }}</p>
    </header>
    <p v-if="loading" class="muted">正在加载文章...</p>
    <div v-else class="editor-workspace">
      <form class="editor-form editor-surface" @submit.prevent="publish">
        <label>
          <span class="field-label">文章标题 <small>{{ title.length }}/200</small></span>
          <input v-model="title" required maxlength="200" placeholder="给这篇文章一个清楚的标题" />
        </label>
        <label>
          <span class="field-label">正文内容 <small>支持 Markdown</small></span>
          <textarea v-model="body" required rows="16" placeholder="记录问题背景、推导过程、结论和边界条件。" />
        </label>
        <div class="form-grid">
          <label>
            <span class="field-label">标签</span>
            <input v-model="tags" placeholder="例如：redis, architecture" />
          </label>
          <label>
            <span class="field-label">分类 ID <small>可选</small></span>
            <input v-model="categoryId" placeholder="例如：backend" />
          </label>
        </div>
        <label>
          <span class="field-label">可见性</span>
          <select v-model="visibility">
            <option value="COMPANY">全公司</option>
            <option value="DEPARTMENT">指定部门</option>
            <option value="TEAM">指定团队</option>
          </select>
        </label>
        <label v-if="visibility !== 'COMPANY'">
          <span class="field-label">目标组织 ID</span>
          <input v-model="targetOrg" required :placeholder="visibility === 'TEAM' ? '例如：t-search' : '例如：d-platform'" />
        </label>
        <footer class="form-actions">
          <button class="button secondary" type="button" :disabled="busy" @click="saveDraft"><Save :size="17" /> 保存草稿</button>
          <button class="button primary" type="submit" :disabled="busy || !canPublish"><Send :size="17" /> {{ busy ? "处理中" : "提交发布" }}</button>
        </footer>
      </form>

      <aside class="editor-guidance" aria-label="写作建议">
        <div class="guidance-heading">
          <span class="guidance-icon"><Sparkles :size="18" /></span>
          <div>
            <p class="eyebrow">写作提示</p>
            <h2>让知识经得起复用</h2>
          </div>
        </div>
        <ul>
          <li><BookOpenCheck :size="18" /><span><strong>先给背景</strong>说明问题发生在什么场景。</span></li>
          <li><CircleCheck :size="18" /><span><strong>再写判断</strong>保留取舍过程和关键依据。</span></li>
          <li><ShieldCheck :size="18" /><span><strong>补充边界</strong>指出方案不适用的条件。</span></li>
        </ul>
        <p class="guidance-note">一篇好文章不只告诉读者“怎么做”，也解释“为什么”。</p>
      </aside>
    </div>
  </section>
</template>
