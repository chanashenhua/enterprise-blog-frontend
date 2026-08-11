import type { Article, PersonalInteractionItem } from "@/api/client";

export type KnowledgeEntry = {
  interaction: PersonalInteractionItem;
  article: Article;
};

export function formatInteractionTime(value: string, now = new Date()): string {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "时间未知";

  const difference = now.getTime() - time.getTime();
  const minutes = Math.floor(difference / 60_000);
  if (minutes >= 0 && minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return time.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function visibleKnowledgeEntries(
  interactions: PersonalInteractionItem[],
  articles: Map<string, Article>,
): KnowledgeEntry[] {
  return interactions.flatMap((interaction) => {
    const article = articles.get(interaction.articleId);
    return article ? [{ interaction, article }] : [];
  });
}
