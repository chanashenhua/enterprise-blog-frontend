import type { CommentStatus } from "@/api/client";

export const commentStatusLabels: Record<CommentStatus, string> = {
  ACTIVE: "正常展示",
  HIDDEN: "已隐藏",
  DELETED: "用户删除",
};

export function commentSummary(content: string, maximum = 100): string {
  const normalized = content.trim().replace(/\s+/g, " ");
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum)}…`;
}
