import type { ArticleComment } from "@/api/client";
import type { DemoUserId } from "@/auth/auth";

export type CommentThread = {
  root: ArticleComment;
  replies: ArticleComment[];
};

export function groupCommentThreads(comments: ArticleComment[]): CommentThread[] {
  const repliesByParent = new Map<string, ArticleComment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const replies = repliesByParent.get(comment.parentId) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId, replies);
  }

  return comments
    .filter((comment) => comment.parentId === null)
    .map((root) => ({ root, replies: repliesByParent.get(root.id) ?? [] }));
}

export function visibleCommentCount(comments: ArticleComment[]): number {
  return comments.filter((comment) => !comment.deleted && !comment.hidden).length;
}

export function canManageComment(comment: ArticleComment, userId: DemoUserId): boolean {
  return !comment.deleted && !comment.hidden && (comment.authorId === userId || userId === "u-admin");
}

export function commentPlaceholder(comment: ArticleComment): string | null {
  if (comment.deleted) return "该评论已由作者删除";
  if (comment.hidden) return "该评论因内容治理暂不可见";
  return null;
}
