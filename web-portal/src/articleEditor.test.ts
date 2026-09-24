import { describe, expect, it } from "vitest";
import { articleContentJson, articleSource, filterCatalog } from "./articleEditor";

describe("article editor document", () => {
  it("roundtrips Markdown exactly including indentation and trailing newlines", () => {
    const source = "# 标题\n\n```java\n  int n = 1;\n```\n\n";
    expect(articleSource({ contentJson: articleContentJson(source), plainText: "lossy" }))
      .toEqual({ source, format: "markdown" });
  });
  it("keeps legacy articles as plain text", () => {
    const source = "  # 这曾经是纯文本\n\n**不是加粗**\n";
    expect(articleSource({ contentJson: articleContentJson(source, "plain"), plainText: source.trim() }))
      .toEqual({ source, format: "plain" });
    expect(JSON.parse(articleContentJson(source, "plain")).type).toBe("doc");
  });
  it("refuses malformed or future content instead of replacing it with lossy text", () => {
    for (const contentJson of ["broken", "null", "{}", '{"type":"markdown","version":2,"source":"future"}']) {
      expect(() => articleSource({ contentJson, plainText: "do not use" })).toThrow();
    }
  });
  it("filters active catalog entries by case-insensitive name or ID", () => {
    const items = [{ id: "java", name: "Java 开发", active: true }, { id: "old", name: "Java 旧分类", active: false }];
    expect(filterCatalog(items, " JAVA ")).toEqual([items[0]]);
    expect(filterCatalog(items, "开发")).toEqual([items[0]]);
    expect(filterCatalog(items, "missing")).toEqual([]);
  });
});
