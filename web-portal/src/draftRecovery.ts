import { MAX_ARTICLE_SOURCE_LENGTH, type ArticleFormat } from "./articleEditor";

export type DraftRecovery = {
  schema: 1;
  userId: string;
  slot: string;
  articleId: string;
  clientDraftId: string;
  revision: number | null;
  savedAt: number;
  draft: { title: string; body: string; format: ArticleFormat; tagIds: string[]; categoryId: string };
  visibilityType: string;
  targetOrgIds: string[];
  baseline: string;
  scopeBaseline: string;
  conflict?: boolean;
};

const PREFIX = "enterprise-blog.portal.draft-recovery.v1:";
const TTL = 24 * 60 * 60 * 1000;
const MAX_PER_USER = 5;
// JSON escaping can make both the source and its baseline longer than their character counts.
const MAX_STORED_LENGTH = 2_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; }
  catch { return null; }
}

function boundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

function identifier(value: unknown): value is string {
  return boundedString(value, 200) && !!value.length && !/[\s\x00-\x1f\x7f]/.test(value);
}

function identifiers(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 100 && value.every(identifier) && new Set(value).size === value.length;
}

function objectWithKeys(value: unknown, keys: string[], optionalKeys: string[] = []): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).every(key => keys.includes(key) || optionalKeys.includes(key)) && keys.every(key => Object.hasOwn(value, key));
}

function valid(value: unknown): value is DraftRecovery {
  if (!objectWithKeys(value, ["schema", "userId", "slot", "articleId", "clientDraftId", "revision", "savedAt", "draft", "visibilityType", "targetOrgIds", "baseline", "scopeBaseline"], ["conflict"])) return false;
  const draft = value.draft;
  return value.schema === 1 && identifier(value.userId) && identifier(value.slot)
    && (value.articleId === "" || identifier(value.articleId))
    && (value.slot === "new" || value.slot === value.articleId)
    && typeof value.clientDraftId === "string" && UUID.test(value.clientDraftId)
    && (value.revision === null || (Number.isSafeInteger(value.revision) && (value.revision as number) >= 1))
    && Number.isSafeInteger(value.savedAt) && (value.savedAt as number) > Date.now() - TTL && (value.savedAt as number) <= Date.now()
    && objectWithKeys(draft, ["title", "body", "format", "tagIds", "categoryId"])
    && boundedString(draft.title, 200) && boundedString(draft.body, MAX_ARTICLE_SOURCE_LENGTH)
    && (draft.format === "markdown" || draft.format === "plain")
    && identifiers(draft.tagIds) && (draft.categoryId === "" || identifier(draft.categoryId))
    && typeof value.visibilityType === "string" && ["COMPANY", "DEPARTMENT", "TEAM"].includes(value.visibilityType)
    && identifiers(value.targetOrgIds) && (value.visibilityType !== "COMPANY" || value.targetOrgIds.length === 0)
    && boundedString(value.baseline, 700_000) && boundedString(value.scopeBaseline, 30_000)
    && (!Object.hasOwn(value, "conflict") || typeof value.conflict === "boolean");
}

function recordKey(userId: string, slot: string) { return `${PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(slot)}`; }

function recoveryKeys(store: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

function parse(raw: string | null): DraftRecovery | null {
  if (!raw || raw.length > MAX_STORED_LENGTH) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : null;
  } catch { return null; }
}

function prune(store: Storage, userId?: string, protectedKey?: string) {
  const accounts = new Map<string, { key: string; savedAt: number }[]>();
  for (const key of recoveryKeys(store)) {
    const value = parse(store.getItem(key));
    if (!value || key !== recordKey(value.userId, value.slot) || (userId !== undefined && value.userId !== userId)) {
      store.removeItem(key);
      continue;
    }
    const entries = accounts.get(value.userId) ?? [];
    entries.push({ key, savedAt: value.savedAt });
    accounts.set(value.userId, entries);
  }
  for (const entries of accounts.values()) {
    entries.sort((a, b) => b.savedAt - a.savedAt || Number(b.key === protectedKey) - Number(a.key === protectedKey));
    for (const entry of entries.slice(MAX_PER_USER)) store.removeItem(entry.key);
  }
}

export function readRecovery(userId: string, slot: string): DraftRecovery | null {
  try {
    const store = storage();
    if (!store || !identifier(userId) || !identifier(slot)) return null;
    prune(store);
    const key = recordKey(userId, slot);
    const value = parse(store.getItem(key));
    if (value?.userId === userId && value.slot === slot) return value;
    store.removeItem(key);
    return null;
  } catch { return null; }
}

export function writeRecovery(record: DraftRecovery): boolean {
  try {
    const store = storage();
    if (!store || !valid(record)) return false;
    const encoded = JSON.stringify(record);
    if (encoded.length > MAX_STORED_LENGTH) return false;
    prune(store);
    const key = recordKey(record.userId, record.slot);
    store.setItem(key, encoded);
    prune(store, undefined, key);
    return store.getItem(key) === encoded;
  } catch { return false; }
}

export function removeRecovery(userId: string, slot: string): void {
  try { storage()?.removeItem(recordKey(userId, slot)); } catch { /* Storage may be unavailable or full. */ }
}

export function clearRecoveries(): void {
  try {
    const store = storage();
    if (store) for (const key of recoveryKeys(store)) store.removeItem(key);
  } catch { /* Authentication can still end when browser storage is unavailable. */ }
}

// With a userId, also remove drafts belonging to previous accounts in this tab.
export function pruneRecoveries(userId?: string): void {
  try {
    const store = storage();
    if (store) prune(store, userId);
  } catch { /* Recovery is best effort; storage errors must not prevent login. */ }
}
