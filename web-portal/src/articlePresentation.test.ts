import { describe, expect, it } from "vitest";
import type { Article } from "@/api/client";
import { articleStatusLabels, canEditArticle, canWithdrawArticle } from "./articlePresentation";

function article(status: Article["status"]): Article {
  return {
    id: "article-1",
    authorId: "u-author",
    title: "测试文章",
    status,
    visibilityType: null,
    visibilityTargetIds: [],
    tagIds: [],
    categoryId: null,
    contentJson: "{}",
    renderedHtml: "",
    plainText: "",
  };
}

describe("article presentation rules", () => {
  it("labels every backend lifecycle status", () => {
    expect(articleStatusLabels).toEqual({
      DRAFT: "草稿",
      PENDING_REVIEW: "审核中",
      PUBLISHED: "已发布",
      WITHDRAWN: "已撤回",
      DELETED: "已删除",
    });
  });

  it("only allows editing drafts or withdrawn articles", () => {
    expect(canEditArticle(article("DRAFT"))).toBe(true);
    expect(canEditArticle(article("WITHDRAWN"))).toBe(true);
    expect(canEditArticle(article("PENDING_REVIEW"))).toBe(false);
    expect(canEditArticle(article("PUBLISHED"))).toBe(false);
  });

  it("only allows withdrawing published articles", () => {
    expect(canWithdrawArticle(article("PUBLISHED"))).toBe(true);
    expect(canWithdrawArticle(article("DRAFT"))).toBe(false);
  });
});
