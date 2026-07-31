export const auditActionLabels: Record<string, string> = {
  REVIEW_APPROVE: "审核通过",
  REVIEW_REJECT: "审核驳回",
  TAG_CREATE: "新增标签",
  TAG_UPDATE: "修改标签",
  TAG_DEACTIVATE: "停用标签",
  CATEGORY_CREATE: "新增分类",
  CATEGORY_UPDATE: "修改分类",
  CATEGORY_DEACTIVATE: "停用分类",
};

export function auditActionLabel(action: string) {
  return auditActionLabels[action] ?? action;
}

export function localDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
