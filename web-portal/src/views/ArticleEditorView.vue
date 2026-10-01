<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from "vue-router";
import { ArrowLeft, BookOpenCheck, Check, Eye, FilePenLine, Save, Send, ShieldCheck, Sparkles, X } from "lucide-vue-next";
import { api, ApiError, type Article, type CatalogItem } from "@/api/client";
import { articleSource, filterCatalog, MAX_ARTICLE_SOURCE_LENGTH, type ArticleFormat } from "@/articleEditor";
import { canEditArticle } from "@/articlePresentation";
import { useAuth } from "@/auth/auth";
import OrgScopeSelector from "@/components/OrgScopeSelector.vue";
import { readRecovery, writeRecovery, removeRecovery, type DraftRecovery } from "@/draftRecovery";

const props = defineProps<{ id?: string }>();
const router = useRouter();
const { isAuthenticated, user } = useAuth();
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
const scopeBaseline = ref("");
const revision = ref<number | null>(null);
const autoSaving = ref(false);
const online = ref(navigator.onLine);
const saveError = ref("");
const conflict = ref(false);
const serverVersion = ref<Article | null>(null);
const checkingServer = ref(false);
const recovery = ref<DraftRecovery | null>(null);
const recoveryUnavailable = ref(false);
const lastSaved = ref("");
let clientDraftId: string = crypto.randomUUID();
let ownerId = "";
let recoverySlot = "new";
let autoTimer: ReturnType<typeof setTimeout> | undefined;
let internalNavigation = false;
let disposed = false;
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
const validDraft = computed(() => !loading.value && !loadError.value && !catalogLoading.value && !catalogError.value
  && !unavailableTags.value.length && !unavailableCategory.value && !!title.value.trim() && !!body.value.trim()
  && body.value.length <= MAX_ARTICLE_SOURCE_LENGTH);
const canSave = computed(() => validDraft.value && !busy.value && !autoSaving.value && online.value && !conflict.value && !recovery.value);
const canPublish = computed(() => canSave.value && (visibility.value === "COMPANY" || orgScopeValid.value));
const contentDirty = computed(() => !!baseline.value && snapshot() !== baseline.value);
const scopeDirty = computed(() => !!scopeBaseline.value && scopeSnapshot() !== scopeBaseline.value);
const dirty = computed(() => !loading.value && !loadError.value && (contentDirty.value || scopeDirty.value));
const saveStatus = computed(() => {
  if (recovery.value) return "有待恢复的内容";
  if (conflict.value) return "检测到编辑冲突，已暂停自动保存";
  if (busy.value || autoSaving.value) return "正在保存…";
  if (!online.value) return "离线 · 恢复网络后继续保存";
  if (saveError.value) return "保存失败";
  if (contentDirty.value) return validDraft.value ? "等待自动保存…" : "补全标题、正文及有效分类标签后自动保存";
  if (scopeDirty.value) return "正文已保存 · 发布范围尚未提交";
  return lastSaved.value ? `已保存 ${lastSaved.value}` : "准备就绪";
});
const serverSource = computed(() => {
  if (!serverVersion.value) return "";
  try { return articleSource(serverVersion.value).source; } catch { return "服务器正文格式无法在当前编辑器中展示"; }
});

type DraftContent = DraftRecovery["draft"];
function draftContent(): DraftContent {
  return { title: title.value, body: body.value, format: format.value, tagIds: [...tags.value], categoryId: categoryId.value };
}
function snapshot(content = draftContent()) {
  return JSON.stringify({ ...content, tagIds: [...content.tagIds].sort() });
}
function scopeSnapshot() {
  return JSON.stringify([visibility.value, [...targetOrgs.value].sort()]);
}
function applyContent(content: DraftContent) {
  title.value = content.title;
  body.value = content.body;
  format.value = content.format;
  tags.value = [...content.tagIds];
  categoryId.value = content.categoryId;
}
function fromArticle(article: Article): DraftContent {
  const content = articleSource(article);
  return { title: article.title, body: content.source, format: content.format, tagIds: [...article.tagIds], categoryId: article.categoryId ?? "" };
}
function assertEditable(article: Article) {
  if (!canEditArticle(article)) throw new Error("该文章当前不可编辑，请先撤回已发布文章或等待审核结束");
  if (!Number.isSafeInteger(article.revision) || article.revision < 1) throw new Error("文章缺少有效修订号，请更新文章服务后重新加载");
}
function active(generation = loadGeneration) {
  return !disposed && generation === loadGeneration && isAuthenticated.value && user.value?.id === ownerId;
}
function cacheRecovery(): boolean {
  if (!active() || loading.value || loadError.value || recovery.value || !baseline.value) return false;
  if (!dirty.value && !autoSaving.value && !conflict.value) { removeRecovery(ownerId, recoverySlot); return true; }
  recoveryUnavailable.value = !writeRecovery({
    schema: 1, userId: ownerId, slot: recoverySlot, articleId: currentArticleId.value,
    clientDraftId, revision: revision.value, savedAt: Date.now(), draft: draftContent(),
    visibilityType: visibility.value, targetOrgIds: targetOrgIds(), baseline: baseline.value, scopeBaseline: scopeBaseline.value, conflict: conflict.value,
  });
  return !recoveryUnavailable.value;
}
function scheduleAutosave() {
  clearTimeout(autoTimer);
  if (!active() || !canSave.value || !contentDirty.value || saveError.value) return;
  autoTimer = setTimeout(() => { void autosave(); }, 2000);
}
function recordSaveError(error: unknown) {
  if (!active()) return;
  if (error instanceof ApiError && error.status === 409) {
    conflict.value = true;
    serverVersion.value = null;
    saveError.value = "";
    message.value = "这篇文章已在其他窗口更新或提交。你的内容仍保留在编辑器中，请查看服务器版本后处理冲突。";
  } else saveError.value = error instanceof Error ? error.message : "草稿保存失败";
  cacheRecovery();
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
  clearTimeout(autoTimer);
  const generation = ++loadGeneration;
  autoSaving.value = false;
  checkingServer.value = false;
  ownerId = user.value?.id ?? "";
  recoverySlot = props.id || "new";
  recovery.value = readRecovery(ownerId, recoverySlot);
  clientDraftId = crypto.randomUUID();
  conflict.value = false;
  serverVersion.value = null;
  saveError.value = "";
  lastSaved.value = "";
  revision.value = null;
  loading.value = true;
  loadError.value = "";
  message.value = "";
  mode.value = "edit";
  try {
    if (props.id) {
      const article = await api.getArticle(props.id);
      if (generation !== loadGeneration) return;
      assertEditable(article);
      currentArticleId.value = article.id;
      revision.value = article.revision;
      applyContent(fromArticle(article));
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
    scopeBaseline.value = scopeSnapshot();
    if (recovery.value && !recovery.value.conflict && snapshot(recovery.value.draft) === baseline.value
      && JSON.stringify([recovery.value.visibilityType, [...recovery.value.targetOrgIds].sort()]) === scopeBaseline.value) {
      removeRecovery(ownerId, recoverySlot);
      recovery.value = null;
    }
  } catch (error) {
    if (generation === loadGeneration) loadError.value = error instanceof Error ? error.message : "文章加载失败";
  } finally { if (generation === loadGeneration) loading.value = false; }
}
async function persistDraft(automatic = false) {
  const generation = loadGeneration;
  const sent = draftContent();
  // 不 trim 正文：Markdown 缩进和末尾换行均属于作者源文本。
  const args = [sent.title.trim(), sent.body, sent.tagIds, sent.categoryId || null, sent.format] as const;
  const article = currentArticleId.value
    ? await api.updateDraft(currentArticleId.value, ...args, { expectedRevision: revision.value!, autosave: automatic })
    : await api.createDraft(...args, { clientDraftId, autosave: automatic });
  if (!active(generation)) throw new Error("编辑会话已结束");
  currentArticleId.value = article.id;
  // 幂等创建重试可能返回另一窗口已更新的稿件，不能把它误报为本次内容已保存。
  if (!canEditArticle(article) || snapshot(fromArticle(article)) !== snapshot({ ...sent, title: sent.title.trim() })) {
    throw new ApiError(409, "服务器草稿已发生变化");
  }
  assertEditable(article);
  revision.value = article.revision;
  baseline.value = snapshot(sent);
  lastSaved.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  saveError.value = "";
  return article;
}
async function moveToDraft(articleId: string) {
  if (props.id === articleId) return;
  const oldSlot = recoverySlot;
  recoverySlot = articleId;
  // 若迁移恢复副本失败，留在原地址并保留原槽，避免删除最后一份未保存内容。
  if ((dirty.value || conflict.value) && !cacheRecovery()) {
    recoverySlot = oldSlot;
    cacheRecovery();
    return;
  }
  // 更新地址但不重新加载表单，保留请求期间作者继续输入的内容。
  internalNavigation = true;
  try {
    const failure = await router.replace("/articles/" + articleId + "/edit");
    if (failure) { recoverySlot = oldSlot; cacheRecovery(); return; }
    removeRecovery(ownerId, oldSlot);
  } catch (error) {
    recoverySlot = oldSlot;
    cacheRecovery();
    throw error;
  } finally { internalNavigation = false; }
}
async function autosave() {
  if (!canSave.value || !contentDirty.value || !active()) return;
  const generation = loadGeneration;
  autoSaving.value = true;
  try {
    const article = await persistDraft(true);
    await moveToDraft(article.id);
  } catch (error) { if (active(generation)) recordSaveError(error); }
  finally {
    if (active(generation)) {
      autoSaving.value = false;
      cacheRecovery();
      scheduleAutosave();
    }
  }
}
function retrySave() {
  saveError.value = "";
  if (contentDirty.value) void autosave();
  else void saveDraft();
}
async function saveDraft() {
  if (!canSave.value) return;
  clearTimeout(autoTimer);
  busy.value = true;
  message.value = "";
  try {
    const article = await persistDraft();
    scopeBaseline.value = scopeSnapshot();
    removeRecovery(ownerId, recoverySlot);
    busy.value = false;
    await router.push("/articles/" + article.id);
  } catch (error) {
    recordSaveError(error);
  } finally { busy.value = false; }
}
async function publish() {
  if (!canPublish.value) return;
  clearTimeout(autoTimer);
  busy.value = true;
  message.value = "";
  let draftSaved = false;
  try {
    const draft = await persistDraft();
    draftSaved = true;
    const article = await api.publish(draft.id, visibility.value, targetOrgIds(), visibility.value !== "COMPANY", draft.revision);
    scopeBaseline.value = scopeSnapshot();
    removeRecovery(ownerId, recoverySlot);
    busy.value = false;
    await router.push("/articles/" + article.id);
  } catch (error) {
    message.value = (draftSaved ? "草稿已保存，发布未完成：" : "") + (error instanceof Error ? error.message : "发布失败");
    if (error instanceof ApiError && error.status === 409) recordSaveError(error);
    else if (!draftSaved) recordSaveError(error);
    cacheRecovery();
    if (draftSaved && active()) {
      try { await moveToDraft(currentArticleId.value); } catch { /* 草稿已保存，原地址仍可重试。 */ }
    }
  } finally { busy.value = false; }
}
function restoreRecovery() {
  const record = recovery.value;
  if (!record || record.userId !== ownerId || !active()) return;
  // 恢复副本的旧 baseline 可能对应尚未收到响应的写入。以这次读取的服务器内容为准，
  // 否则“保存 B 期间撤销回 A，再刷新恢复 A”会被误判为已保存并删除最后一份 A。
  const knownBaseline = loadError.value ? "null" : baseline.value;
  const knownScopeBaseline = loadError.value ? "null" : scopeBaseline.value;
  loading.value = true;
  applyContent(record.draft);
  currentArticleId.value = record.articleId;
  clientDraftId = record.clientDraftId;
  revision.value = record.revision;
  conflict.value = record.conflict ?? false;
  visibility.value = record.visibilityType;
  targetOrgs.value = [...record.targetOrgIds];
  baseline.value = knownBaseline;
  scopeBaseline.value = knownScopeBaseline;
  recovery.value = null;
  loadError.value = "";
  loading.value = false;
  cacheRecovery();
  scheduleAutosave();
}
function discardRecovery() {
  removeRecovery(ownerId, recoverySlot);
  recovery.value = null;
  if (loadError.value) void loadArticle();
}
async function checkServer() {
  checkingServer.value = true;
  const generation = loadGeneration;
  try {
    const latest = await api.getArticle(currentArticleId.value);
    if (active(generation)) serverVersion.value = latest;
  } catch (error) { if (active(generation)) message.value = error instanceof Error ? error.message : "服务器版本加载失败"; }
  finally { if (active(generation)) checkingServer.value = false; }
}
function resolveConflict(keepLocal: boolean) {
  const latest = serverVersion.value;
  if (!latest || !active()) return;
  if (!window.confirm(keepLocal ? "将以你当前的内容替换刚查看的服务器版本，继续吗？" : "确定放弃当前编辑内容，使用刚查看的服务器版本吗？")) return;
  let latestContent: DraftContent;
  try { assertEditable(latest); latestContent = fromArticle(latest); }
  catch (error) { message.value = (error as Error).message; return; }
  loading.value = true;
  if (!keepLocal) applyContent(latestContent);
  revision.value = latest.revision;
  baseline.value = snapshot(latestContent);
  conflict.value = false;
  serverVersion.value = null;
  saveError.value = "";
  message.value = "";
  loading.value = false;
  cacheRecovery();
  scheduleAutosave();
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
  if (internalNavigation) return true;
  if (!isAuthenticated.value) return true;
  if (busy.value) return false;
  return !dirty.value || window.confirm("正文或发布设置尚未保存，确定离开吗？");
}
function beforeUnload(event: BeforeUnloadEvent) {
  cacheRecovery();
  if (isAuthenticated.value && (dirty.value || busy.value || autoSaving.value)) { event.preventDefault(); event.returnValue = ""; }
}
function updateNetwork() {
  online.value = navigator.onLine;
  if (online.value) { saveError.value = ""; scheduleAutosave(); }
  else { clearTimeout(autoTimer); cacheRecovery(); }
}
watch(() => props.id, id => {
  if (internalNavigation && id === currentArticleId.value) return;
  void loadArticle();
}, { immediate: true });
watch([title, body, format, tags, categoryId, visibility, targetOrgs], () => {
  if (!active() || loading.value || loadError.value || recovery.value) return;
  cacheRecovery();
  scheduleAutosave();
}, { deep: true, flush: "sync" });
watch(validDraft, scheduleAutosave);
watch(() => user.value?.id, () => {
  clearTimeout(autoTimer);
  ++loadGeneration;
  loading.value = true;
  recovery.value = null;
  // 旧会话的正文不能在下一账号下被重新缓存或发送。
  title.value = "";
  body.value = "";
}, { flush: "sync" });
watch([body, format, mode], schedulePreview);
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate(confirmLeave);
onMounted(() => {
  loadCatalog();
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("online", updateNetwork);
  window.addEventListener("offline", updateNetwork);
});
onBeforeUnmount(() => {
  cacheRecovery();
  disposed = true;
  ++loadGeneration;
  ++previewGeneration;
  clearTimeout(autoTimer);
  clearTimeout(previewTimer);
  window.removeEventListener("beforeunload", beforeUnload);
  window.removeEventListener("online", updateNetwork);
  window.removeEventListener("offline", updateNetwork);
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
      <span class="editor-save-state" role="status" aria-live="polite"><i :class="{ unsaved: dirty || conflict || !!saveError }"></i>{{ saveStatus }}</span>
    </header>
    <p v-if="message" class="editor-alert" role="alert">{{ message }}</p>
    <div v-if="recovery" class="editor-alert" role="alert">
      此标签页有尚未保存的内容（{{ new Date(recovery.savedAt).toLocaleString('zh-CN') }}）。请选择是否恢复。
      <button class="button secondary compact" :disabled="loading" @click="restoreRecovery">恢复未保存内容</button>
      <button class="button secondary compact" :disabled="loading" @click="discardRecovery">丢弃本地恢复</button>
    </div>
    <p v-if="recoveryUnavailable" class="editor-alert" role="alert">浏览器暂时无法保存恢复副本，刷新或关闭前请确认草稿已保存到服务器。</p>
    <div v-if="saveError" class="editor-alert" role="alert">保存失败：{{ saveError }}。内容仍保留在编辑器中。
      <button class="button secondary compact" :disabled="!canSave" @click="retrySave">重试保存</button>
    </div>
    <section v-if="conflict" class="editor-alert editor-conflict" aria-label="编辑冲突">
      <p>自动保存已暂停。查看服务器内容后，再决定保留哪一份；处理前可以继续整理本地正文。</p>
      <button class="button secondary compact" :disabled="checkingServer || !online" @click="checkServer">{{ checkingServer ? '正在读取…' : '查看服务器版本' }}</button>
      <section v-if="serverVersion" class="server-draft" aria-label="服务器版本">
        <h2>{{ serverVersion.title }}</h2><p class="editor-help">修订 {{ serverVersion.revision }} · {{ canEditArticle(serverVersion) ? '可编辑' : '已提交或不可编辑，请返回文章详情查看状态' }}</p>
        <pre>{{ serverSource }}</pre>
        <div class="form-actions">
          <button class="button secondary compact" :disabled="!canEditArticle(serverVersion)" @click="resolveConflict(false)">使用服务器版本</button>
          <button class="button primary compact" :disabled="!canEditArticle(serverVersion)" @click="resolveConflict(true)">保留本地内容继续编辑</button>
        </div>
      </section>
    </section>
    <p v-if="loading" class="muted" role="status">正在加载文章…</p>
    <div v-else-if="loadError" class="editor-alert" role="alert">{{ loadError }} <button class="button secondary compact" @click="loadArticle">重新加载</button></div>
    <div v-else class="editor-workspace">
      <form class="editor-form editor-surface" @submit.prevent="publish">
        <fieldset class="editor-fields" :disabled="busy || !!recovery">
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
        <p class="guidance-note">停止输入 2 秒后自动保存完整草稿。手动保存或提交发布时保留历史版本。未保存内容的恢复副本仅在当前标签页保留，最长 24 小时，退出登录时清理。</p>
      </aside>
    </div>
  </section>
</template>
