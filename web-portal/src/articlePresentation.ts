import type { Article } from "@/api/client";

export const articleStatusLabels: Record<Article["status"], string> = {
  DRAFT: "草稿",
  PENDING_REVIEW: "审核中",
  PUBLISHED: "已发布",
  WITHDRAWN: "已撤回",
  DELETED: "已删除",
};

export function canEditArticle(article: Article): boolean {
  return article.status === "DRAFT" || article.status === "WITHDRAWN";
}

export function canWithdrawArticle(article: Article): boolean {
  return article.status === "PUBLISHED";
}
