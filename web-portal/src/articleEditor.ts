import type { Article, CatalogItem } from "./api/client";

export type ArticleFormat = "markdown" | "plain";
export const MAX_ARTICLE_SOURCE_LENGTH = 100_000;

export function articleContentJson(source: string, format: ArticleFormat = "markdown"): string {
  return JSON.stringify(format === "markdown"
    ? { type: "markdown", version: 1, source }
    : { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: source }] }] });
}

export function articleSource(article: Pick<Article, "contentJson" | "plainText">): { source: string; format: ArticleFormat } {
  const document: unknown = JSON.parse(article.contentJson);
  if (!document || typeof document !== "object") throw new Error("文章正文格式无效，已停止编辑以防覆盖原文");
  const data = document as Record<string, unknown>;
  if (data.type === "markdown" && data.version === 1 && typeof data.source === "string") {
    return { source: data.source, format: "markdown" };
  }
  // 旧文章维持纯文本，不能默默把原文中的 Markdown 符号解释成格式。
  if (data.type === "doc" && Array.isArray(data.content)) {
    return { source: data.content.map(legacyText).join("\n"), format: "plain" };
  }
  throw new Error("当前编辑器不支持该正文版本，已停止编辑以防覆盖原文");
}

function legacyText(node: unknown): string {
  if (!node || typeof node !== "object") throw new Error("旧版文章正文格式无效");
  const data = node as Record<string, unknown>;
  if (data.type === "text" && typeof data.text === "string") return data.text;
  if (data.type === "paragraph" && Array.isArray(data.content)) return data.content.map(legacyText).join("");
  if (data.type === "paragraph" && data.content === undefined) return "";
  throw new Error("当前编辑器不支持该旧版节点，已停止编辑以防丢失内容");
}

export function filterCatalog(items: CatalogItem[], query: string): CatalogItem[] {
  const term = query.trim().toLocaleLowerCase();
  return items.filter(item => item.active && `${item.name} ${item.id}`.toLocaleLowerCase().includes(term));
}
