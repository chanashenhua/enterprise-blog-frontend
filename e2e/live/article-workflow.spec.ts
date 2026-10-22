import { randomUUID } from "node:crypto";
import { expect, test as base, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

const gateway = process.env.E2E_API_URL ?? "http://127.0.0.1:8080";
const adminUrl = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:5174";
type Account = "u-author" | "u-admin" | "u-reader";
type Article = { id: string; title: string; contentJson: string; plainText: string; renderedHtml: string; revision: number; status: string };
type Version = { versionNo: number; contentJson: string };
type Ticket = { id: string; articleId: string };
const markdown = (source: string) => JSON.stringify({ type: "markdown", version: 1, source });
const editorBody = (page: Page) => page.getByLabel("正文内容", { exact: true });
const editorTitle = (page: Page) => page.getByLabel("文章标题", { exact: true });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

function headers(account: Account = "u-author") {
  return {
    "X-Mock-Token": process.env.E2E_MOCK_TOKEN ?? "local-dev-token",
    "X-Mock-User": account,
    "X-Mock-Roles": account === "u-admin" ? "ADMIN,REVIEWER,AUTHOR,READER" : account === "u-author" ? "AUTHOR,READER" : "READER",
    "X-Mock-Departments": account === "u-reader" ? "d-pay" : "d-platform",
    "X-Mock-Teams": account === "u-reader" ? "t-pay" : "t-search",
  };
}

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function getArticle(request: APIRequestContext, id: string): Promise<Article> {
  return json(await request.get(`${gateway}/api/articles/${id}`, { headers: headers() }));
}

async function versions(request: APIRequestContext, id: string): Promise<Version[]> {
  return json(await request.get(`${gateway}/api/articles/${id}/versions`, { headers: headers() }));
}

async function login(page: Page, account: Account = "u-author", origin = "") {
  await page.goto(`${origin}/login`);
  await page.getByRole("button", { name: new RegExp(`${account} (登录|验证)$`) }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function openEditor(page: Page, id: string) {
  await page.goto(`/articles/${id}/edit`);
  await expect(editorBody(page)).toBeVisible();
  await expect(button(page, "保存草稿")).toBeEnabled();
}

type Drafts = { prefix: string; create: (source?: string) => Promise<Article> };
const test = base.extend<{ drafts: Drafts }>({
  drafts: async ({ request, context }, use, testInfo) => {
    // Only records with this per-test random prefix are ever cleaned up.
    const prefix = `LIVE-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await use({
      prefix,
      create: async (source = "联调初始正文") => json<Article>(await request.post(`${gateway}/api/articles/drafts`, {
        headers: headers(),
        data: { title: prefix, contentJson: markdown(source), tagIds: [], clientDraftId: randomUUID(), autosave: true },
      })),
    });
    for (const page of context.pages()) await page.close();
    const mine = await json<Article[]>(await request.get(`${gateway}/api/articles/mine`, { headers: headers() }));
    const owned = mine.filter(article => article.title.startsWith(prefix));
    await testInfo.attach("created-articles", { body: JSON.stringify(owned.map(({ id, title }) => ({ id, title }))), contentType: "application/json" });
    const pending = await json<Ticket[]>(await request.get(`${gateway}/api/admin/reviews`, { headers: headers("u-admin") }));
    for (const article of owned) {
      for (const ticket of pending.filter(ticket => ticket.articleId === article.id)) {
        await json(await request.post(`${gateway}/api/admin/reviews/${ticket.id}/reject`, {
          headers: headers("u-admin"), data: { comment: "真实联调测试清理" },
        }));
      }
      await json(await request.delete(`${gateway}/api/articles/${article.id}`, { headers: headers() }));
    }
  },
});

test.beforeAll(async ({ request }) => {
  const health = await json<{ status: string }>(await request.get(`${gateway}/actuator/health`));
  expect(health.status).toBe("UP");
  await json(await request.get(`${gateway}/api/tags`, { headers: headers() }));
});

test("PostgreSQL 并发创建幂等，旧修订不能覆盖正文或提交审核", async ({ request, drafts }) => {
  const data = { title: drafts.prefix, contentJson: markdown("并发创建正文"), tagIds: [], clientDraftId: randomUUID(), autosave: true };
  const responses = await Promise.all(Array.from({ length: 8 }, () => request.post(`${gateway}/api/articles/drafts`, { headers: headers(), data })));
  const created = await Promise.all(responses.map(response => json<Article>(response)));
  expect(new Set(created.map(article => article.id)).size).toBe(1);
  expect(created.every(article => article.revision === 1)).toBeTruthy();
  const id = created[0].id;
  const updates = await Promise.all(["窗口 A 正文", "窗口 B 正文"].map(source => request.put(`${gateway}/api/articles/${id}/draft`, {
    headers: headers(), data: { title: drafts.prefix, contentJson: markdown(source), tagIds: [], expectedRevision: 1, autosave: true },
  })));
  expect(updates.map(response => response.status()).sort()).toEqual([200, 409]);
  const winner = await json<Article>(updates.find(response => response.status() === 200)!);
  expect(winner.revision).toBe(2);
  // PostgreSQL stores timestamps to microsecond precision; revision is the concurrency token.
  expect(await getArticle(request, id)).toMatchObject({
    id, title: winner.title, contentJson: winner.contentJson, plainText: winner.plainText, revision: 2, status: "DRAFT",
  });
  expect(await versions(request, id)).toEqual([]);

  const stalePublish = await request.post(`${gateway}/api/articles/${id}/submit-publish`, {
    headers: headers(), data: { visibilityType: "TEAM", targetOrgIds: ["t-search"], expectedRevision: 1 },
  });
  expect(stalePublish.status()).toBe(409);
  expect(await getArticle(request, id)).toMatchObject({ status: "DRAFT", revision: 2 });
  expect(await versions(request, id)).toEqual([]);
  const tickets = await json<Ticket[]>(await request.get(`${gateway}/api/admin/reviews`, { headers: headers("u-admin") }));
  expect(tickets.filter(ticket => ticket.articleId === id)).toEqual([]);

  // Retrying a response-lost write with the same content is safe, including a manual checkpoint.
  const retry = await json<Article>(await request.put(`${gateway}/api/articles/${id}/draft`, {
    headers: headers(), data: { title: winner.title, contentJson: winner.contentJson, tagIds: [], expectedRevision: 1, autosave: false },
  }));
  expect(retry.revision).toBe(2);
  expect(await versions(request, id)).toHaveLength(1);
});

test("浏览器自动保存不堆积历史，手动保存与公司发布保留快照", async ({ page, request, drafts }) => {
  await login(page);
  await page.goto("/articles/new");
  await editorTitle(page).fill(drafts.prefix);
  await editorBody(page).fill("## 第一版\n\n真实数据库自动保存。");
  await expect(page).toHaveURL(/\/articles\/[^/]+\/edit$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  expect(await versions(request, id)).toEqual([]);
  await editorBody(page).fill("## 第二版\n\n**自动保存**后的内容。");
  await expect.poll(async () => (await getArticle(request, id)).plainText).toContain("自动保存后的内容");
  expect(await versions(request, id)).toEqual([]);
  await button(page, "保存草稿").click();
  await expect(page).toHaveURL(new RegExp(`/articles/${id}$`));
  expect(await versions(request, id)).toHaveLength(1);
  await openEditor(page, id);
  await editorBody(page).fill("## 发布版\n\n公司内可见的 **联调结果**。");
  await button(page, "提交发布").click();
  await expect(page).toHaveURL(new RegExp(`/articles/${id}$`));
  const published = await getArticle(request, id);
  expect(published.status).toBe("PUBLISHED");
  expect(published.renderedHtml).toContain("<strong>联调结果</strong>");
  expect(await versions(request, id)).toHaveLength(2);
  expect((await request.get(`${gateway}/api/articles/${id}`, { headers: headers("u-reader") })).status()).toBe(200);
  await expect(page.getByRole("heading", { name: drafts.prefix, exact: true })).toBeVisible();
});

test("PostgreSQL 自动保存与发布竞态只允许一个修订成功", async ({ request, drafts }) => {
  const article = await drafts.create("竞态开始前的正文");
  const [save, publish] = await Promise.all([
    request.put(`${gateway}/api/articles/${article.id}/draft`, {
      headers: headers(),
      data: { title: article.title, contentJson: markdown("竞态中的新正文"), tagIds: [], expectedRevision: 1, autosave: true },
    }),
    request.post(`${gateway}/api/articles/${article.id}/submit-publish`, {
      headers: headers(), data: { visibilityType: "COMPANY", targetOrgIds: [], expectedRevision: 1 },
    }),
  ]);
  expect([save.status(), publish.status()].sort()).toEqual([200, 409]);
  const current = await getArticle(request, article.id);
  expect(current.revision).toBe(2);
  const history = await versions(request, article.id);
  if (publish.ok()) {
    expect(current).toMatchObject({ status: "PUBLISHED", plainText: "竞态开始前的正文" });
    expect(history).toHaveLength(1);
    expect(history[0].contentJson).toBe(current.contentJson);
  } else {
    expect(current).toMatchObject({ status: "DRAFT", plainText: "竞态中的新正文" });
    expect(history).toEqual([]);
  }
});

test("离线编辑在刷新后恢复，并写入真实服务器", async ({ page, context, request, drafts }) => {
  const article = await drafts.create();
  await login(page);
  await openEditor(page, article.id);
  // Pause only browser timers so reload cannot race the two-second debounce; HTTP remains real.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await context.setOffline(true);
  await editorBody(page).fill("断网时保留的正文，刷新后继续保存。");
  await expect(page.locator(".editor-save-state")).toContainText("离线");
  await expect.poll(() => page.evaluate(() => Object.values(sessionStorage).join("\n"))).toContain("断网时保留");
  await context.setOffline(false);
  await page.reload();
  await expect(button(page, "恢复未保存内容")).toBeVisible();
  await button(page, "恢复未保存内容").click();
  await expect(editorBody(page)).toHaveValue("断网时保留的正文，刷新后继续保存。");
  await page.clock.runFor(2_100);
  await expect.poll(async () => (await getArticle(request, article.id)).plainText).toContain("断网时保留");
  expect((await getArticle(request, article.id)).revision).toBe(2);
  expect(await versions(request, article.id)).toEqual([]);
});

test("两个真实标签页发生冲突后可选择服务器或本地内容", async ({ page, context, request, drafts }) => {
  const article = await drafts.create();
  await login(page);
  await openEditor(page, article.id);
  const other = await context.newPage();
  await openEditor(other, article.id);
  await editorBody(page).fill("窗口 A 先保存的正文");
  await expect.poll(async () => (await getArticle(request, article.id)).plainText).toBe("窗口 A 先保存的正文");
  await editorBody(other).fill("窗口 B 未经确认不能覆盖");
  await expect(other.getByRole("region", { name: "编辑冲突", exact: true })).toBeVisible();
  expect((await getArticle(request, article.id)).plainText).toBe("窗口 A 先保存的正文");
  await button(other, "查看服务器版本").click();
  await expect(other.getByRole("region", { name: "服务器版本", exact: true })).toContainText("窗口 A 先保存");
  other.once("dialog", dialog => dialog.accept());
  await button(other, "使用服务器版本").click();
  await expect(editorBody(other)).toHaveValue("窗口 A 先保存的正文");
  await editorBody(other).fill("窗口 B 同步后保存的正文");
  await expect.poll(async () => (await getArticle(request, article.id)).plainText).toBe("窗口 B 同步后保存的正文");
  await editorBody(page).fill("窗口 A 确认保留的最终正文");
  await expect(page.getByRole("region", { name: "编辑冲突", exact: true })).toBeVisible();
  await button(page, "查看服务器版本").click();
  page.once("dialog", dialog => dialog.accept());
  await button(page, "保留本地内容继续编辑").click();
  await expect.poll(async () => (await getArticle(request, article.id)).plainText).toBe("窗口 A 确认保留的最终正文");
  expect((await getArticle(request, article.id)).revision).toBe(4);
});

for (const decision of ["approve", "reject"] as const) {
  test(`团队文章经管理端${decision === "approve" ? "通过" : "退回"}后状态和权限正确`, async ({ page, browser, request, drafts }) => {
    const article = await drafts.create();
    await login(page);
    await openEditor(page, article.id);
    await page.getByLabel("可见性", { exact: true }).selectOption("TEAM");
    await page.getByRole("checkbox", { name: "选择团队 Search Team", exact: true }).check();
    await button(page, "提交发布").click();
    await expect(page).toHaveURL(new RegExp(`/articles/${article.id}$`));
    expect(await getArticle(request, article.id)).toMatchObject({ status: "PENDING_REVIEW", revision: 2 });
    const admin = await browser.newPage();
    try {
      await login(admin, "u-admin", adminUrl);
      await admin.goto(`${adminUrl}/reviews`);
      const row = admin.locator(".table-row").filter({ hasText: article.id });
      await expect(row).toBeVisible();
      if (decision === "reject") await row.getByLabel("驳回意见").fill("请补充联调验证步骤");
      await row.getByTitle(decision === "approve" ? "通过审核" : "驳回审核", { exact: true }).click();
      await expect(row).toHaveCount(0);
    } finally { await admin.close(); }
    expect(await getArticle(request, article.id)).toMatchObject({ status: decision === "approve" ? "PUBLISHED" : "DRAFT", revision: 3 });
    expect((await request.get(`${gateway}/api/articles/${article.id}`, { headers: headers("u-reader") })).status()).toBe(403);
    if (decision === "reject") {
      await openEditor(page, article.id);
      await editorBody(page).fill("按审核意见补充后的正文");
      await expect.poll(async () => (await getArticle(request, article.id)).plainText).toContain("按审核意见补充");
    }
  });
}
