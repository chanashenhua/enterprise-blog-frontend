import { describe, expect, it } from "vitest";
import type { Article, PersonalInteractionItem } from "@/api/client";
import { formatInteractionTime, visibleKnowledgeEntries } from "@/libraryPresentation";

const article: Article = {
  id: "article-1",
  authorId: "u-author",
  title: "可见文章",
  status: "PUBLISHED",
  visibilityType: "ALL",
  visibilityTargetIds: [],
  tagIds: ["java"],
  categoryId: "backend",
  contentJson: "{}",
  renderedHtml: "<p>内容</p>",
  plainText: "内容",
};

describe("个人知识库展示", () => {
  it("使用相对时间展示近期互动", () => {
    const now = new Date("2026-08-01T12:00:00+08:00");
    expect(formatInteractionTime("2026-08-01T11:40:00+08:00", now)).toBe("20 分钟前");
    expect(formatInteractionTime("2026-07-30T12:00:00+08:00", now)).toBe("2 天前");
  });

  it("过滤当前用户已经不可见的历史文章", () => {
    const interactions: PersonalInteractionItem[] = [
      { articleId: "article-1", interactionType: "FAVORITE", interactedAt: "2026-08-01T10:00:00+08:00" },
      { articleId: "article-hidden", interactionType: "FAVORITE", interactedAt: "2026-08-01T09:00:00+08:00" },
    ];

    const entries = visibleKnowledgeEntries(interactions, new Map([[article.id, article]]));

    expect(entries.map((entry) => entry.article.id)).toEqual(["article-1"]);
  });
});
