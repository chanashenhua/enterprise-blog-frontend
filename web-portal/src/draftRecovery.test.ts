import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRecoveries, pruneRecoveries, readRecovery, removeRecovery, writeRecovery, type DraftRecovery } from "./draftRecovery";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
  };
}

function record(overrides: Partial<DraftRecovery> = {}): DraftRecovery {
  return {
    schema: 1, userId: "u-author", slot: "new", articleId: "",
    clientDraftId: "337eab95-b8f6-4e80-a8b8-eed11b889c6c", revision: null, savedAt: Date.now(),
    draft: { title: "草稿", body: "未保存的正文", format: "markdown", tagIds: ["tag-1"], categoryId: "category-1" },
    visibilityType: "TEAM", targetOrgIds: ["t-search"], baseline: "[]", scopeBaseline: "[]", ...overrides,
  };
}

let store: Storage;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-26T00:00:00Z"));
  store = memoryStorage();
  vi.stubGlobal("window", { sessionStorage: store });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("tab-local draft recovery", () => {
  it("isolates accounts and slots and preserves partial fields exactly", () => {
    const partial = record({ draft: { title: "", body: "  ## 标题\n\n", format: "plain", tagIds: [], categoryId: "" } });
    expect(writeRecovery(partial)).toBe(true);
    expect(writeRecovery(record({ userId: "u-admin", draft: { ...partial.draft, title: "另一个账号" } }))).toBe(true);
    expect(writeRecovery(record({ slot: "draft-1", articleId: "draft-1", revision: 2, conflict: true }))).toBe(true);
    expect(readRecovery("u-author", "new")).toEqual(partial);
    expect(readRecovery("u-admin", "new")?.draft.title).toBe("另一个账号");
    expect(readRecovery("u-author", "draft-1")?.conflict).toBe(true);
    expect(readRecovery("u-reader", "new")).toBeNull();
    removeRecovery("u-author", "draft-1");
    expect(readRecovery("u-author", "draft-1")).toBeNull();
    expect(readRecovery("u-author", "new")).toEqual(partial);
  });

  it("expires records at 24 hours and prunes previous accounts on login", () => {
    writeRecovery(record());
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 - 1);
    expect(readRecovery("u-author", "new")).not.toBeNull();
    vi.setSystemTime(Date.now() + 1);
    expect(readRecovery("u-author", "new")).toBeNull();
    expect(store.length).toBe(0);
    writeRecovery(record());
    writeRecovery(record({ userId: "u-admin" }));
    pruneRecoveries("u-author");
    expect(readRecovery("u-author", "new")).not.toBeNull();
    expect(readRecovery("u-admin", "new")).toBeNull();
  });

  it("keeps at most five recent records per account, including equal timestamps", () => {
    for (let index = 0; index < 7; index++) {
      expect(writeRecovery(record({ slot: `draft-${index}`, articleId: `draft-${index}` }))).toBe(true);
    }
    expect(store.length).toBe(5);
    expect(readRecovery("u-author", "draft-6")).not.toBeNull();
    writeRecovery(record({ userId: "u-admin" }));
    expect(store.length).toBe(6);
  });

  it("evicts the oldest saved record while preserving another account's records", () => {
    writeRecovery(record({ userId: "u-admin" }));
    for (let index = 0; index < 6; index++) {
      vi.setSystemTime(Date.now() + 1);
      expect(writeRecovery(record({ slot: `article-${index}`, articleId: `article-${index}` }))).toBe(true);
    }
    expect(readRecovery("u-author", "article-0")).toBeNull();
    for (let index = 1; index < 6; index++) expect(readRecovery("u-author", `article-${index}`)).not.toBeNull();
    expect(readRecovery("u-admin", "new")).not.toBeNull();
  });

  it("preserves an unresolved create conflict with an opaque article ID and no revision", () => {
    const value = record({ slot: "new", articleId: "draft-1", revision: null, conflict: true });
    expect(writeRecovery(value)).toBe(true);
    expect(readRecovery("u-author", "new")).toEqual(value);
  });

  it.each([
    { schema: 2 }, { revision: 0 }, { revision: 1.5 }, { revision: Number.MAX_SAFE_INTEGER + 1 },
    { clientDraftId: "not-a-uuid" }, { slot: "another-article", articleId: "draft-1" },
    { articleId: "article with spaces" }, { userId: "x".repeat(201) }, { visibilityType: "PUBLIC" },
    { visibilityType: "COMPANY", targetOrgIds: ["t-search"] }, { targetOrgIds: Array(101).fill("t-search") },
    { targetOrgIds: ["t-search", "t-search"] }, { baseline: "x".repeat(700_001) }, { scopeBaseline: "x".repeat(30_001) },
    { conflict: "yes" }, { token: "must-not-be-persisted" },
  ])("rejects invalid record fields: %j", changes => {
    expect(writeRecovery({ ...record(), ...changes } as DraftRecovery)).toBe(false);
    expect(store.length).toBe(0);
  });

  it.each([
    { title: "x".repeat(201) }, { body: "x".repeat(100_001) }, { format: "html" },
    { tagIds: ["bad\nidentifier"] }, { categoryId: "x".repeat(201) }, { token: "secret" },
  ])("rejects malformed content: %j", changes => {
    expect(writeRecovery(record({ draft: { ...record().draft, ...changes } as DraftRecovery["draft"] }))).toBe(false);
  });

  it("accepts maximum source length even with JSON-escaped baselines", () => {
    const body = "\u0000".repeat(100_000);
    const value = record({ draft: { ...record().draft, body }, baseline: JSON.stringify([body]) });
    expect(writeRecovery(value)).toBe(true);
    expect(readRecovery(value.userId, value.slot)).toEqual(value);
  });

  it("accepts exact content and baseline size limits", () => {
    const value = record({
      draft: { ...record().draft, title: "标".repeat(200), body: "文".repeat(100_000) },
      baseline: "x".repeat(700_000), scopeBaseline: "x".repeat(30_000),
    });
    expect(writeRecovery(value)).toBe(true);
    expect(readRecovery(value.userId, value.slot)).toEqual(value);
  });

  it.each(["not-json", "null", "[]", "x".repeat(2_000_001)])("removes corrupt storage without throwing", raw => {
    writeRecovery(record());
    store.setItem(store.key(0)!, raw);
    expect(readRecovery("u-author", "new")).toBeNull();
    expect(store.length).toBe(0);
  });

  it("rejects mismatched record identities and future timestamps in storage", () => {
    writeRecovery(record());
    store.setItem(store.key(0)!, JSON.stringify(record({ userId: "u-admin" })));
    expect(readRecovery("u-author", "new")).toBeNull();
    expect(writeRecovery(record({ savedAt: Date.now() + 1 }))).toBe(false);
  });

  it("reports quota failure and tolerates inaccessible storage", () => {
    vi.spyOn(store, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    expect(writeRecovery(record())).toBe(false);
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("SecurityError"); } });
    expect(writeRecovery(record())).toBe(false);
    expect(readRecovery("u-author", "new")).toBeNull();
    expect(() => { removeRecovery("u-author", "new"); pruneRecoveries(); clearRecoveries(); }).not.toThrow();
  });

  it("clears only recovery data", () => {
    store.setItem("unrelated", "keep");
    writeRecovery(record());
    clearRecoveries();
    expect(store.length).toBe(1);
    expect(store.getItem("unrelated")).toBe("keep");
  });
});
