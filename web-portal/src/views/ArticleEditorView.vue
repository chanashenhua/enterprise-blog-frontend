<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from "vue-router";
import { ArrowLeft, BookOpenCheck, Check, Eye, FilePenLine, Save, Send, ShieldCheck, Sparkles, X } from "lucide-vue-next";
import { api, type CatalogItem } from "@/api/client";
import { articleSource, filterCatalog, MAX_ARTICLE_SOURCE_LENGTH, type ArticleFormat } from "@/articleEditor";
import { canEditArticle } from "@/articlePresentation";
import { useAuth } from "@/auth/auth";
import OrgScopeSelector from "@/components/OrgScopeSelector.vue";

const props = defineProps<{ id?: string }>();
const router = useRouter();
const { isAuthenticated } = useAuth();
const currentArticleId = ref("");
const title = ref("");
const body = ref("");
const format = ref<ArticleFormat>("markdown");
const tags = ref<string[]>([]);
const categoryId = ref("");
const visibility = ref("COMPANY");
const targetOrgs = ref<string[]>([]);
const orgScopeValid = ref(false);
const busy = ref(false);
const loading = ref(false);
const loadError = ref("");
const message = ref("");
const baseline = ref("");
const catalogTags = ref<CatalogItem[]>([]);
const catalogCategories = ref<CatalogItem[]>([]);
const catalogLoading = ref(true);
const catalogError = ref("");
const tagQuery = ref("");
const categoryQuery = ref("");
const mode = ref<"edit" | "split" | "preview">("edit");
const previewHtml = ref("");
const previewLoading = ref(false);
const previewError = ref("");
let loadGeneration = 0;
let previewGeneration = 0;
let previewTimer: ReturnType<typeof setTimeout> | undefined;

const isEditing = computed(() => Boolean(currentArticleId.value));
const visibleTags = computed(() => filterCatalog(catalogTags.value, tagQuery.value));
const visibleCategories = computed(() => {
  const filtered = filterCatalog(catalogCategories.value, categoryQuery.value);
  const selected = catalogCategories.value.find(item => item.id === categoryId.value);
  return selected && !filtered.some(item => item.id === selected.id) ? [selected, ...filtered] : filtered;
});
const unavailableTags = computed(() => tags.value.filter(id => !catalogTags.value.some(item => item.id === id && item.active)));
const unavailableCategory = computed(() => !!categoryId.value && !catalogCategories.value.some(item => item.id === categoryId.value && item.active));
const canSave = computed(() => !busy.value && !loading.value && !loadError.value && !catalogLoading.value && !catalogError.value
  && !unavailableTags.value.length && !unavailableCategory.value && !!title.value.trim() && !!body.value.trim()
  && body.value.length <= MAX_ARTICLE_SOURCE_LENGTH);
const canPublish = computed(() => canSave.value && (visibility.value === "COMPANY" || orgScopeValid.value));
const dirty = computed(() => !!baseline.value && !loading.value && !loadError.value && snapshot() !== baseline.value);

function snapshot() {
  return JSON.stringify([title.value, body.value, format.value, tags.value, categoryId.value, visibility.value, targetOrgs.value]);
}
function targetOrgIds() {
  return visibility.value === "COMPANY" ? [] : [...targetOrgs.value];
}
function changeVisibility() {
  targetOrgs.value = [];
  orgScopeValid.value = false;
}
function tagName(id: string) {
  return catalogTags.value.find(item => item.id === id)?.name ?? id;
}
function toggleTag(id: string) {
  tags.value = tags.value.includes(id) ? tags.value.filter(value => value !== id) : [...tags.value, id];
}
async function loadCatalog() {
  catalogLoading.value = true;
  catalogError.value = "";
  try {
    [catalogTags.value, catalogCategories.value] = await Promise.all([api.listTags(), api.listCategories()]);
  } catch (error) {
    catalogError.value = error instanceof Error ? error.message : "分类与标签加载失败";
  } finally { catalogLoading.value = false; }
}
async function loadArticle() {
  const generation = ++loadGeneration;
  loading.value = true;
  loadError.value = "";
  message.value = "";
  mode.value = "edit";
  try {
    if (props.id) {
      const article = await api.getArticle(props.id);
      if (generation !== loadGeneration) return;
      if (!canEditArticle(article)) throw new Error("该文章当前不可编辑，请先撤回已发布文章或等待审核结束");
      const content = articleSource(article);
      currentArticleId.value = article.id;
      title.value = article.title;
      body.value = content.source;
      format.value = content.format;
      tags.value = [...article.tagIds];
      categoryId.value = article.categoryId ?? "";
      visibility.value = article.visibilityType ?? "COMPANY";
      targetOrgs.value = [...article.visibilityTargetIds];
    } else {
      currentArticleId.value = "";
      title.value = "";
      body.value = "";
      format.value = "markdown";
      tags.value = [];
      categoryId.value = "";
      visibility.value = "COMPANY";
      targetOrgs.value = [];
    }
    baseline.value = snapshot();
  } catch (error) {
    if (generation === loadGeneration) loadError.value = error instanceof Error ? error.message : "文章加载失败";
  } finally { if (generation === loadGeneration) loading.value = false; }
}
async function persistDraft() {
  // 不 trim 正文：Markdown 缩进和末尾换行均属于作者源文本。
  const args = [title.value.trim(), body.value, tags.value, categoryId.value || null, format.value] as const;
  const article = currentArticleId.value ? await api.updateDraft(currentArticleId.value, ...args) : await api.createDraft(...args);
  currentArticleId.value = article.id;
  return article;
}
async function saveDraft() {
  if (!canSave.value) return;
  busy.value = true;
  message.value = "";
  try {
    const article = await persistDraft();
    baseline.value = snapshot();
    busy.value = false;
    await router.push("/articles/" + article.id);
  } catch (error) {
    message.value = error instanceof Error ? error.message : "草稿保存失败";
  } finally { busy.value = false; }
}
async function publish() {
  if (!canPublish.value) return;
  busy.value = true;
  message.value = "";
  let draftSaved = false;
  try {
    const draft = await persistDraft();
    draftSaved = true;
    const article = await api.publish(draft.id, visibility.value, targetOrgIds(), visibility.value !== "COMPANY");
    baseline.value = snapshot();
    busy.value = false;
    await router.push("/articles/" + article.id);
  } catch (error) {
    message.value = (draftSaved ? "草稿已保存，发布未完成：" : "") + (error instanceof Error ? error.message : "发布失败");
  } finally { busy.value = false; }
}
function schedulePreview() {
  const generation = ++previewGeneration;
  clearTimeout(previewTimer);
  previewHtml.value = "";
  previewError.value = "";
  previewLoading.value = false;
  if (mode.value === "edit" || loading.value || loadError.value || !body.value.trim()) return;
  if (body.value.length > MAX_ARTICLE_SOURCE_LENGTH) { previewError.value = "正文超过 100,000 字符，请缩短后预览"; return; }
  previewLoading.value = true;
  previewTimer = setTimeout(async () => {
    try {
      const preview = await api.previewArticle(body.value, format.value);
      if (generation === previewGeneration) previewHtml.value = preview.renderedHtml;
    } catch (error) {
      if (generation === previewGeneration) previewError.value = error instanceof Error ? error.message : "预览失败";
    } finally { if (generation === previewGeneration) previewLoading.value = false; }
  }, 400);
}
function confirmLeave() {
  if (!isAuthenticated.value) return true;
  if (busy.value) return false;
  return !dirty.value || window.confirm("正文或发布设置尚未保存，确定离开吗？");
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (isAuthenticated.value && (dirty.value || busy.value)) { event.preventDefault(); event.returnValue = ""; }
}
watch(() => props.id, loadArticle, { immediate: true });
watch([body, format, mode], schedulePreview);
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate(confirmLeave);
onMounted(() => { loadCatalog(); window.addEventListener("beforeunload", beforeUnload); });
onBeforeUnmount(() => {
  ++loadGeneration;
  ++previewGeneration;
  clearTimeout(previewTimer);
  window.removeEventListener("beforeunload", beforeUnload);
});
</script>

<template>
  <section class="editor-layout writing-studio">
    <header class="view-header">
      <div>
        <RouterLink class="back-link" to="/articles"><ArrowLeft :size="16" /> 返回我的文章</RouterLink>
        <p class="eyebrow">TECH ATLAS / {{ isEditing ? "编辑草稿" : "知识创作" }}</p>
        <h1>{{ isEditing ? "让这篇经验更进一步" : "把经验写成可复用的知识" }}</h1>
        <p class="view-description">从一个真实问题开始，留下你的思路、实践与边界。</p>
      </div>
      <span class="editor-save-state"><i :class="{ unsaved: dirty }"></i>{{ busy ? "正在保存…" : dirty ? "有未保存的修改" : "准备就绪" }}</span>
    </header>
    <p v-if="message" class="editor-alert" role="alert">{{ message }}</p>
    <p v-if="loading" class="muted" role="status">正在加载文章…</p>
    <div v-else-if="loadError" class="editor-alert" role="alert">{{ loadError }} <button class="button secondary compact" @click="loadArticle">重新加载</button></div>
    <div v-else class="editor-workspace">
      <form class="editor-form editor-surface" @submit.prevent="publish">
        <fieldset class="editor-fields" :disabled="busy">
          <label>
            <span class="field-label">文章标题 <small>{{ title.length }}/200</small></span>
            <input v-model="title" aria-label="文章标题" required maxlength="200" placeholder="一个清楚的标题，是知识的第一张名片" />
          </label>
          <div class="editor-toolbar">
            <label class="editor-format-label">正文格式<select v-model="format" aria-label="正文格式"><option value="markdown">Markdown</option><option value="plain">纯文本（兼容旧文章）</option></select></label>
            <div class="editor-mode-switch" role="group" aria-label="编辑视图">
              <button type="button" :aria-pressed="mode === 'edit'" @click="mode = 'edit'"><FilePenLine :size="15" /> 编辑</button>
              <button type="button" :aria-pressed="mode === 'split'" @click="mode = 'split'">对照</button>
              <button type="button" :aria-pressed="mode === 'preview'" @click="mode = 'preview'"><Eye :size="15" /> 预览</button>
            </div>
          </div>
          <p v-if="format === 'plain'" class="editor-help">当前保持纯文本展示。切换为 Markdown 后，请先预览再保存。</p>
          <div class="editor-content-panels" :class="{ split: mode === 'split' }">
            <label v-show="mode !== 'preview'" class="editor-source">
              <span class="field-label">正文内容 <small>{{ body.length.toLocaleString() }} / 100,000</small></span>
              <textarea v-model="body" aria-label="正文内容" :maxlength="MAX_ARTICLE_SOURCE_LENGTH" rows="18" placeholder="## 问题背景&#10;&#10;描述你遇到的问题…&#10;&#10;## 实践与结论&#10;&#10;记录关键判断、示例和适用边界。" />
            </label>
            <section v-if="mode !== 'edit'" class="editor-preview" aria-label="正文预览" :aria-busy="previewLoading">
              <div class="field-label">发布效果 <small>与文章详情使用同一渲染器</small></div>
              <p v-if="previewLoading" class="muted" role="status">正在生成预览…</p>
              <div v-else-if="previewError" class="editor-alert" role="alert">{{ previewError }} <button type="button" class="button secondary compact" @click="schedulePreview">重试预览</button></div>
              <article v-else-if="previewHtml" class="article-body" v-html="previewHtml"></article>
              <p v-else class="editor-preview-empty"><BookOpenCheck :size="28" /> 写下一些内容，看看它发布后的样子。</p>
            </section>
          </div>
          <details class="editor-syntax"><summary>Markdown 写作速查</summary><p><code>## 标题</code> · <code>**重点**</code> · <code>- 列表</code> · <code>&gt; 引用</code> · <code>[文字](https://…)</code></p><p>用三个反引号包围代码块，可在第一行指定语言。原始 HTML 只作为文本展示；暂不支持表格等扩展语法。</p></details>
          <section class="editor-taxonomy" aria-label="文章归档">
            <div class="field-label"><strong>让知识更容易被发现</strong><small>分类和标签均可选</small></div>
            <p v-if="catalogLoading" class="muted" role="status">正在加载分类与标签…</p>
            <div v-else-if="catalogError" class="editor-alert" role="alert">分类与标签加载失败：{{ catalogError }}。可继续编辑，重试成功后保存。<button type="button" class="button secondary compact" @click="loadCatalog">重试分类与标签</button></div>
            <template v-else>
              <p v-if="unavailableTags.length || unavailableCategory" class="editor-alert" role="alert">文章引用了已停用或不可用的分类、标签，请移除或重新选择后保存。</p>
              <div class="form-grid">
                <label>查找分类<input v-model="categoryQuery" type="search" aria-label="查找分类" placeholder="按名称或 ID 搜索" /></label>
                <label>文章分类<select v-model="categoryId" aria-label="文章分类"><option value="">未分类</option><option v-if="unavailableCategory && !visibleCategories.some(item => item.id === categoryId)" :value="categoryId" disabled>{{ categoryId }}（不可用）</option><option v-for="item in visibleCategories" :key="item.id" :value="item.id" :disabled="!item.active">{{ item.name }}{{ item.active ? '' : '（已停用）' }}</option></select></label>
              </div>
              <label>查找标签<input v-model="tagQuery" type="search" aria-label="查找标签" placeholder="例如：Java、缓存、架构" /></label>
              <div class="editor-selected-tags" aria-label="已选标签"><span v-if="!tags.length" class="editor-help">还未选择标签</span><button v-for="id in tags" :key="id" type="button" :aria-label="'移除标签 ' + tagName(id)" @click="toggleTag(id)">{{ tagName(id) }}<X :size="13" /></button></div>
              <div class="editor-tag-options" aria-label="可选标签"><button v-for="item in visibleTags" :key="item.id" type="button" :aria-label="'标签 ' + item.name" :aria-pressed="tags.includes(item.id)" @click="toggleTag(item.id)"><Check v-if="tags.includes(item.id)" :size="14" />{{ item.name }}</button><p v-if="!visibleTags.length" class="editor-help">没有匹配的可用标签</p></div>
            </template>
          </section>
          <div class="form-grid">
            <label>可见性<select v-model="visibility" aria-label="可见性" @change="changeVisibility"><option value="COMPANY">全公司</option><option value="DEPARTMENT">指定部门</option><option value="TEAM">指定团队</option></select></label>
          </div>
          <OrgScopeSelector v-model="targetOrgs" :visibility-type="visibility" :disabled="busy" @validity="orgScopeValid = $event" />
          <p class="editor-help">{{ visibility === 'COMPANY' ? '全公司员工可阅读。' : '范围发布将按现有审核策略处理。' }}可见范围在提交发布时生效，保存草稿只保存正文与分类标签。</p>
          <footer class="form-actions"><button class="button secondary" type="button" :disabled="!canSave" @click="saveDraft"><Save :size="17" /> 保存草稿</button><button class="button primary" type="submit" :disabled="!canPublish"><Send :size="17" /> {{ busy ? "处理中" : "提交发布" }}</button></footer>
        </fieldset>
      </form>
      <aside class="editor-guidance" aria-label="写作建议">
        <div class="guidance-heading"><span class="guidance-icon"><Sparkles :size="18" /></span><div><p class="eyebrow">写作提示</p><h2>让知识经得起复用</h2></div></div>
        <ul><li><BookOpenCheck :size="18" /><span><strong>先给背景</strong>问题发生在什么场景？</span></li><li><FilePenLine :size="18" /><span><strong>再写判断</strong>保留取舍过程和关键依据。</span></li><li><ShieldCheck :size="18" /><span><strong>补充边界</strong>指出方案不适用的条件。</span></li></ul>
        <p class="guidance-note">预览不会保存文章。离开前记得保存草稿，让每一个好想法都有落点。</p>
      </aside>
    </div>
  </section>
</template>
