import { randomUUID } from "node:crypto";
import { expect, test as base, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

const gateway = process.env.E2E_API_URL ?? "http://127.0.0.1:8080";
const elasticsearch = process.env.E2E_ELASTICSEARCH_URL ?? "http://127.0.0.1:9200";
const searchService = process.env.E2E_SEARCH_SERVICE_URL ?? "http://127.0.0.1:8088";
const adminUrl = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:5174";
const internalHeaders = { "X-Internal-Token": process.env.E2E_SEARCH_TOKEN ?? "local-search-token" };
type Account = "u-author" | "u-reader" | "u-admin";
type Article = { id: string; title: string; revision: number; status: string };
type Result = { items: { articleId: string; title: string; titleHighlights: { text: string; matched: boolean }[]; summaryHighlights: { text: string; matched: boolean }[] }[]; total: number | null; hasMore: boolean };
function headers(account: Account = "u-author") {
  return { "X-Mock-Token": process.env.E2E_MOCK_TOKEN ?? "local-dev-token", "X-Mock-User": account,
    "X-Mock-Roles": account === "u-admin" ? "ADMIN,REVIEWER,AUTHOR,READER" : account === "u-author" ? "AUTHOR,READER" : "READER",
    "X-Mock-Departments": account === "u-reader" ? "d-pay" : "d-platform", "X-Mock-Teams": account === "u-reader" ? "t-pay" : "t-search" };
}
async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}
async function search(request: APIRequestContext, q: string, account: Account = "u-author", params: Record<string, string | number> = {}) {
  return json<Result>(await request.get(`${gateway}/api/search/articles`, { headers: headers(account), params: { q, ...params } }));
}
async function login(page: Page, account: Account = "u-author", origin = "") {
  await page.goto(`${origin}/login`);
  await page.getByRole("button", { name: new RegExp(`${account} (登录|验证)$`) }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function indexed(request: APIRequestContext, id: string) {
  return json<{ _version: number; _source: Record<string, any> }>(await request.get(`${elasticsearch}/articles-v1/_doc/${id}`));
}
async function waitForIndex(request: APIRequestContext, article: Article, status = "PUBLISHED") {
  await expect.poll(async () => {
    const response = await request.get(`${elasticsearch}/articles-v1/_doc/${article.id}`);
    return response.ok() ? (await response.json())._source : null;
  }, { timeout: 30_000 }).toMatchObject({ revision: article.revision, status });
  expect((await request.post(`${elasticsearch}/articles-v1/_refresh`)).ok()).toBeTruthy();
}
async function publish(request: APIRequestContext, article: Article, team = false) {
  return json<Article>(await request.post(`${gateway}/api/articles/${article.id}/submit-publish`, {
    headers: headers(), data: { visibilityType: team ? "TEAM" : "COMPANY", targetOrgIds: team ? ["t-search"] : [], expectedRevision: article.revision },
  }));
}
type Fixture = { prefix: string; create: (sequence?: number, categoryId?: string, tagId?: string) => Promise<Article> };
const test = base.extend<{ data: Fixture }>({
  data: async ({ request, context }, use, testInfo) => {
    const prefix = `SEARCHLIVE-${randomUUID().replaceAll("-", "")}`;
    await use({ prefix, create: async (sequence = 1, categoryId = "engineering", tagId = "redis") => json<Article>(
      await request.post(`${gateway}/api/articles/drafts`, { headers: headers(), data: {
        title: `${prefix} Redis ${sequence}`, contentJson: JSON.stringify({ type: "markdown", version: 1, source: "Redis 缓存全文检索，边界验证与性能实践。" }),
        tagIds: [tagId], categoryId, clientDraftId: randomUUID(), autosave: true,
      } })) });
    for (const page of context.pages()) await page.close();
    const mine = await json<Article[]>(await request.get(`${gateway}/api/articles/mine`, { headers: headers() }));
    const owned = mine.filter(article => article.title.startsWith(prefix) && article.status !== "DELETED");
    await testInfo.attach("test-articles", { body: JSON.stringify(owned), contentType: "application/json" });
    const tickets = await json<{ id: string; articleId: string }[]>(await request.get(`${gateway}/api/admin/reviews`, { headers: headers("u-admin") }));
    for (const article of owned) {
      for (const ticket of tickets.filter(ticket => ticket.articleId === article.id)) {
        await json(await request.post(`${gateway}/api/admin/reviews/${ticket.id}/reject`, { headers: headers("u-admin"), data: { comment: "搜索联调清理" } }));
      }
      const deleted = await json<Article>(await request.delete(`${gateway}/api/articles/${article.id}`, { headers: headers() }));
      await waitForIndex(request, deleted, "DELETED");
    }
  },
});

test("真实全文检索支持高亮、筛选、排序与浏览器分页恢复", async ({ page, request, data }, testInfo) => {
  test.setTimeout(120_000);
  const published: Article[] = [];
  for (let i = 1; i <= 6; i++) published.push(await publish(request, await data.create(i, i === 6 ? "database" : "engineering", i === 6 ? "postgresql" : "redis")));
  await expect.poll(async () => (await search(request, data.prefix)).total, { timeout: 30_000 }).toBe(6);
  expect((await search(request, `${data.prefix} 性能`, "u-reader")).total).toBe(6);
  const first = await search(request, `${data.prefix} Redis`, "u-reader", { size: 5, sort: "latest" });
  expect(first.items.map(item => item.articleId)).toEqual(published.slice(1).reverse().map(article => article.id));
  expect(first.hasMore).toBe(true);
  expect(first.items[0].titleHighlights.some(part => part.matched && /redis/i.test(part.text))).toBe(true);
  expect(first.items[0].summaryHighlights.some(part => part.matched && /redis/i.test(part.text))).toBe(true);
  expect((await search(request, data.prefix, "u-reader", { size: 5, page: 1, sort: "latest" })).items.map(item => item.articleId)).toEqual([published[0].id]);
  expect((await search(request, data.prefix, "u-reader", { categoryId: "engineering", tagId: "redis" })).total).toBe(5);
  expect((await search(request, data.prefix, "u-reader", { categoryId: "database", tagId: "redis" })).total).toBe(0);
  await login(page, "u-reader");
  await page.goto(`/search?q=${data.prefix}+Redis&sort=latest&size=5&page=0`);
  await expect(page.locator(".search-result")).toHaveCount(5);
  await expect(page.locator(".search-result mark").first()).toBeVisible();
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.goBack();
  await expect(page.locator(".search-result")).toHaveCount(5);
  await page.getByLabel("搜索分类", { exact: true }).selectOption("engineering");
  await page.getByLabel("搜索标签", { exact: true }).selectOption("redis");
  await expect(page.locator(".result-count")).toContainText("共 5 篇可访问文章");
  await expect(page.getByRole("button", { name: "下一页", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("search-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("搜索分类", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("search-mobile.png"), fullPage: true });
});

test("撤回和删除立即隐藏，旧写入不能越过修订标记，重新发布可恢复", async ({ request, data }) => {
  test.setTimeout(90_000);
  const published = await publish(request, await data.create());
  await waitForIndex(request, published);
  const old = (await indexed(request, published.id))._source;
  const oldProjection = { articleId: old.article_id, title: old.title, summary: old.summary, plainText: old.plain_text,
    tags: old.tags, categoryId: old.category_id, authorId: old.author_id, authorName: old.author_name,
    visibilityType: "COMPANY", targetOrgIds: [], status: "PUBLISHED", publishedAt: old.published_at, updatedAt: old.updated_at, revision: old.revision };
  const withdrawn = await json<Article>(await request.post(`${gateway}/api/articles/${published.id}/withdraw`, { headers: headers() }));
  expect((await search(request, data.prefix, "u-reader")).total).toBe(0);
  await waitForIndex(request, withdrawn, "DELETED");
  expect((await request.post(`${searchService}/internal/search/articles/index`, { headers: internalHeaders, data: oldProjection })).ok()).toBeTruthy();
  expect((await indexed(request, published.id))._source).toEqual({ article_id: published.id, revision: withdrawn.revision, status: "DELETED" });
  // Force an old candidate into this test article only, to exercise authoritative DB filtering with stale ES data.
  expect((await request.put(`${elasticsearch}/articles-v1/_doc/${published.id}`, {
    params: { version: withdrawn.revision, version_type: "external_gte", refresh: "true" }, data: old,
  })).ok()).toBeTruthy();
  expect((await search(request, data.prefix, "u-reader"))).toMatchObject({ total: 0, items: [], hasMore: false });
  const edited = await json<Article>(await request.put(`${gateway}/api/articles/${published.id}/draft`, {
    headers: headers(), data: { title: withdrawn.title, contentJson: JSON.stringify({ type: "markdown", version: 1, source: "Redis 撤回后编辑再发布" }),
      tagIds: ["redis"], categoryId: "engineering", expectedRevision: withdrawn.revision, autosave: true },
  }));
  const republished = await publish(request, edited);
  await waitForIndex(request, republished);
  expect((await search(request, data.prefix, "u-reader")).total).toBe(1);
  const deleted = await json<Article>(await request.delete(`${gateway}/api/articles/${published.id}`, { headers: headers() }));
  expect((await search(request, data.prefix, "u-reader")).total).toBe(0);
  await waitForIndex(request, deleted, "DELETED");
  expect((await request.post(`${searchService}/internal/search/articles/index`, { headers: internalHeaders, data: { ...oldProjection, revision: republished.revision } })).ok()).toBeTruthy();
  expect((await indexed(request, published.id))._source).toEqual({ article_id: published.id, revision: deleted.revision, status: "DELETED" });
});

test("团队文章经审核入索引，过期可见范围不能向非成员泄露内容或总数", async ({ request, data }) => {
  const pending = await publish(request, await data.create(), true);
  expect(pending.status).toBe("PENDING_REVIEW");
  expect((await search(request, data.prefix)).total).toBe(0);
  const tickets = await json<{ id: string; articleId: string }[]>(await request.get(`${gateway}/api/admin/reviews`, { headers: headers("u-admin") }));
  const ticket = tickets.find(ticket => ticket.articleId === pending.id)!;
  await json(await request.post(`${gateway}/api/admin/reviews/${ticket.id}/approve`, { headers: headers("u-admin") }));
  const published = await json<Article>(await request.get(`${gateway}/api/articles/${pending.id}`, { headers: headers() }));
  await waitForIndex(request, published);
  expect((await search(request, data.prefix)).total).toBe(1);
  expect((await search(request, data.prefix, "u-reader"))).toMatchObject({ total: 0, items: [] });
  const current = await indexed(request, published.id);
  expect((await request.put(`${elasticsearch}/articles-v1/_doc/${published.id}`, {
    params: { version: published.revision, version_type: "external_gte", refresh: "true" },
    data: { ...current._source, visibility_type: "company", target_org_ids: [] },
  })).ok()).toBeTruthy();
  expect((await search(request, data.prefix, "u-reader"))).toMatchObject({ total: 0, items: [], hasMore: false });
  expect((await request.post(`${gateway}/api/admin/search/tasks/reindex`, { headers: headers("u-reader") })).status()).toBe(403);
  await json(await request.post(`${gateway}/api/admin/search/tasks/reindex`, { headers: headers("u-admin") }));
  await expect.poll(async () => (await indexed(request, published.id))._source.visibility_type, { timeout: 30_000 }).toBe("team");
});

test("管理台可以重新同步全库并查看待处理任务", async ({ page, request }) => {
  await login(page, "u-admin", adminUrl);
  await page.goto(`${adminUrl}/search-tasks`);
  await expect(page.getByRole("heading", { name: "索引同步任务" })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "重新同步全部文章" }).click();
  await expect(page.getByRole("status")).toContainText(/已加入 \d+ 个同步任务/);
  await expect(page.getByLabel("索引任务状态")).toHaveValue("PENDING");
  await expect.poll(async () => (await json<any[]>(await request.get(`${gateway}/api/admin/search/tasks?status=PENDING`, { headers: headers("u-admin") }))).length,
    { timeout: 30_000 }).toBe(0);
  expect(await json(await request.get(`${gateway}/api/admin/search/tasks?status=FAILED`, { headers: headers("u-admin") }))).toEqual([]);
});
