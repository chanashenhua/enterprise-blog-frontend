<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Building2, Check, RefreshCw, Search, Users, X } from "lucide-vue-next";
import { api } from "@/api/client";
import { filterOrganizations, MAX_ORG_TARGETS, organizationOptions, validOrgSelection, type OrganizationDirectory } from "@/organizationScope";

const props = defineProps<{ visibilityType: string; modelValue: string[]; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: string[]]; validity: [value: boolean] }>();
const directory = ref<OrganizationDirectory | null>(null);
const loading = ref(false);
const error = ref("");
const query = ref("");
let generation = 0;
const scoped = computed(() => props.visibilityType !== "COMPANY");
const kind = computed(() => props.visibilityType === "DEPARTMENT" ? "部门" : "团队");
const options = computed(() => organizationOptions(directory.value, props.visibilityType));
const filtered = computed(() => filterOrganizations(options.value, query.value));
const invalidIds = computed(() => props.modelValue.filter(id => !options.value.some(item => item.id === id)));
const valid = computed(() => !scoped.value ? props.modelValue.length === 0
  : !!directory.value && !loading.value && !error.value && validOrgSelection(props.visibilityType, props.modelValue, options.value));
const summary = computed(() => !scoped.value ? "全公司员工可阅读"
  : props.modelValue.length ? props.modelValue.map(name).join("、") : "尚未选择" + kind.value);

function name(id: string): string {
  const item = options.value.find(option => option.id === id);
  return item ? item.name + (item.departmentName ? " · " + item.departmentName : "")
    : !directory.value ? "待校验（" + id + "）" : "已失效或无权限（" + id + "）";
}

function toggle(id: string) {
  if (props.disabled) return;
  if (props.modelValue.includes(id)) emit("update:modelValue", props.modelValue.filter(value => value !== id));
  else if (props.modelValue.length < MAX_ORG_TARGETS && options.value.some(item => item.id === id)) emit("update:modelValue", [...props.modelValue, id]);
}

async function reload() {
  const started = ++generation;
  loading.value = true;
  error.value = "";
  try {
    const response = await api.listPublishOrganizations();
    if (!Array.isArray(response.departments) || !Array.isArray(response.teams)) throw new Error("组织目录响应格式无效");
    if (started === generation) directory.value = response;
  } catch (reason) {
    if (started === generation) error.value = reason instanceof Error ? reason.message : "组织目录加载失败";
  } finally { if (started === generation) loading.value = false; }
}

watch(() => props.visibilityType, () => { query.value = ""; if (scoped.value && !directory.value && !loading.value) reload(); }, { immediate: true });
watch(valid, value => emit("validity", value), { immediate: true, flush: "sync" });
onBeforeUnmount(() => { ++generation; });
</script>

<template>
  <section class="org-scope" aria-label="组织可见范围">
    <div class="org-scope-summary" aria-live="polite"><Building2 v-if="visibilityType !== 'TEAM'" :size="20" /><Users v-else :size="20" /><div><strong>发布范围{{ scoped ? ' · ' + kind : '' }}</strong><p>{{ summary }}</p></div></div>
    <template v-if="scoped">
      <div class="org-scope-heading"><span>选择{{ kind }} <small>{{ modelValue.length }}/{{ MAX_ORG_TARGETS }}</small></span><button type="button" class="button secondary compact" :disabled="disabled || loading" @click="reload"><RefreshCw :size="14" /> 刷新组织列表</button></div>
      <p v-if="loading" class="editor-help" role="status">正在加载可发布的组织…</p>
      <div v-else-if="error" class="editor-alert" role="alert">组织目录加载失败：{{ error }}。可继续保存草稿，暂不能向指定组织发布。<button type="button" class="button secondary compact" :disabled="disabled" @click="reload">重试组织目录</button></div>
      <template v-else-if="directory">
        <p v-if="invalidIds.length" class="editor-alert" role="alert">已有目标已失效或不在当前权限范围内，请移除并重新选择。</p>
        <div v-if="modelValue.length" class="editor-selected-tags" aria-label="已选组织"><button v-for="id in modelValue" :key="id" type="button" :disabled="disabled" :aria-label="'移除组织 ' + name(id)" @click="toggle(id)">{{ name(id) }}<X :size="13" /></button></div>
        <label class="org-search"><span><Search :size="14" /> 查找{{ kind }}</span><input v-model="query" type="search" :aria-label="'查找' + kind" :disabled="disabled" :placeholder="visibilityType === 'TEAM' ? '搜索团队名称、所属部门或 ID' : '搜索部门名称或 ID'" /></label>
        <div class="org-option-list" :aria-label="'可选' + kind">
          <label v-for="item in filtered" :key="item.id" class="org-option" :class="{ selected: modelValue.includes(item.id) }">
            <input type="checkbox" :checked="modelValue.includes(item.id)" :aria-label="'选择' + kind + ' ' + item.name" :disabled="disabled || (modelValue.length >= MAX_ORG_TARGETS && !modelValue.includes(item.id))" @change="toggle(item.id)" />
            <span><strong>{{ item.name }}</strong><small>{{ item.departmentName ? item.departmentName + ' · ' : '' }}{{ item.id }}</small></span><Check v-if="modelValue.includes(item.id)" :size="17" />
          </label>
          <p v-if="!filtered.length" class="org-empty">{{ options.length ? '没有匹配的' + kind + '，试试其他关键词。' : '当前账号没有可选的' + kind + '。可选择全公司范围，或联系管理员核对组织权限。' }}</p>
        </div>
        <p class="editor-help">仅展示当前账号可发布的组织。最多选择 {{ MAX_ORG_TARGETS }} 个{{ kind }}；提交时后端会再次校验有效性与权限。</p>
      </template>
    </template>
  </section>
</template>
