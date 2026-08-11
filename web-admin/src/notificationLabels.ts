export const notificationTypeLabels: Record<string, string> = {
  REVIEW_APPROVED: "审核通过",
  REVIEW_REJECTED: "审核驳回",
  COMMENT_REPLY: "评论回复",
  ARTICLE_PUBLISHED: "文章发布",
  SUBSCRIPTION_ARTICLE_PUBLISHED: "订阅文章发布",
};

export function notificationTypeLabel(type: string) {
  return notificationTypeLabels[type] ?? type;
}

export function unreadRate(unread: number, total: number) {
  return total <= 0 ? "0%" : `${Math.round((unread / total) * 100)}%`;
}
