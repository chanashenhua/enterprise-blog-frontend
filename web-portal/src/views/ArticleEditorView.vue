<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Check, Save, Send } from "lucide-vue-next";
import { api } from "@/api/client";
import { useUserContext } from "@/composables/userContext";

const router = useRouter();
const { userId } = useUserContext();
const title = ref("");
const body = ref("");
const tags = ref("engineering");
const visibility = ref("COMPANY");
const targetOrg = ref("");
const busy = ref(false);
const message = ref("");
const canPublish = computed(() => title.value.trim() && body.value.trim() && (visibility.value === "COMPANY" || targetOrg.value.trim()));

function tagIds() {
  return tags.value.split(",").map((value) => value.trim()).filter(Boolean);
}

function targetOrgIds() {
  return targetOrg.value.split(",").map((value) => value.trim()).filter(Boolean);
}

async function saveDraft() {
  if (!title.value.trim() || !body.value.trim()) return;
  busy.value = true;
  message.value = "";
  try {
    const article = await api.createDraft(userId.value, title.value.trim(), body.value.trim(), tagIds());
    message.value = "草稿已保存";
    await router.replace(`/articles/${article.id}`);
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
    const draft = await api.createDraft(userId.value, title.value.trim(), body.value.trim(), tagIds());
    const article = await api.publish(userId.value, draft.id, visibility.value, targetOrgIds(), visibility.value !== "COMPANY");
    await router.push(`/articles/${article.id}`);
  } catch (error) {
    message.value = error instanceof Error ? error.message : "发布失败";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="editor-layout">
    <header class="view-header">
      <div><p class="eyebrow">新建文章</p><h1>把经验写成可复用的知识</h1></div>
      <p class="status-message" role="status">{{ message }}</p>
    </header>
    <form class="editor-form" @submit.prevent="publish">
      <label>标题<input v-model="title" required maxlength="200" placeholder="给这篇文章一个清楚的标题" /></label>
      <label>正文<textarea v-model="body" required rows="16" placeholder="记录问题背景、推导过程、结论和边界条件。" /></label>
      <div class="form-grid">
        <label>标签<input v-model="tags" placeholder="例如：redis, architecture" /></label>
        <label>可见性<select v-model="visibility"><option value="COMPANY">全公司</option><option value="DEPARTMENT">指定部门</option><option value="TEAM">指定团队</option></select></label>
      </div>
      <label v-if="visibility !== 'COMPANY'">目标组织 ID<input v-model="targetOrg" required :placeholder="visibility === 'TEAM' ? '例如：t-search' : '例如：d-platform'" /></label>
      <footer class="form-actions">
        <button class="button secondary" type="button" :disabled="busy" @click="saveDraft"><Save :size="17" /> 保存草稿</button>
        <button class="button primary" type="submit" :disabled="busy || !canPublish"><Send :size="17" /> {{ busy ? "处理中" : "提交发布" }}</button>
      </footer>
    </form>
  </section>
</template>
