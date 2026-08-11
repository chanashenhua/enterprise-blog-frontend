import { describe, expect, it } from "vitest";
import type { ArticleComment } from "@/api/client";
import { canManageComment, commentPlaceholder, groupCommentThreads, visibleCommentCount } from "./commentPresentation";

function comment(overrides: Partial<ArticleComment> = {}): ArticleComment {
  return {
    id: "comment-1",
    articleId: "article-1",
    parentId: null,
    authorId: "u-author",
    content: "一条评论",
    deleted: false,
    hidden: false,
    createdAt: "2026-08-11T10:00:00Z",
    updatedAt: "2026-08-11T10:00:00Z",
    ...overrides,
  };
}

describe("comment presentation", () => {
  it("groups one-level replies under their root comments", () => {
    const first = comment();
    const reply = comment({ id: "reply-1", parentId: first.id, authorId: "u-reader" });
    const second = comment({ id: "comment-2" });

    expect(groupCommentThreads([first, reply, second])).toEqual([
      { root: first, replies: [reply] },
      { root: second, replies: [] },
    ]);
  });

  it("does not count hidden or deleted comments as visible discussion", () => {
    expect(visibleCommentCount([
      comment(),
      comment({ id: "hidden", hidden: true, content: null }),
      comment({ id: "deleted", deleted: true, content: null }),
    ])).toBe(1);
  });

  it("allows the author or an admin to manage active comments", () => {
    const active = comment();
    const hidden = comment({ hidden: true, content: null });

    expect(canManageComment(active, "u-author")).toBe(true);
    expect(canManageComment(active, "u-admin")).toBe(true);
    expect(canManageComment(active, "u-reader")).toBe(false);
    expect(canManageComment(hidden, "u-admin")).toBe(false);
  });

  it("uses safe placeholders for governed comments", () => {
    expect(commentPlaceholder(comment({ deleted: true, content: null }))).toBe("该评论已由作者删除");
    expect(commentPlaceholder(comment({ hidden: true, content: null }))).toBe("该评论因内容治理暂不可见");
    expect(commentPlaceholder(comment())).toBeNull();
  });
});
