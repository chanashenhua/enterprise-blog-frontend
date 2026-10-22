import { expect, test, type Page, type Route } from "@playwright/test";

const adminUrl = process.env.E2E_ADMIN_URL ?? "http://localhost:5174";
const hit = (title: string) => ({ articleId: "a-1", title, summary: "正文摘要", tags: ["redis"], titleHighlights: [{ text: title, matched: true }] });
async function setup(page: Page, search: (route: Route) => Promise<void>) {
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/search/articles") return search(route);
    if (path === "/api/categories") return route.fulfill({ json: [{ id: "engineering", name: "工程实践", active: true }] });
    if (path === "/api/tags") return route.fulfill({ json: [{ id: "redis", name: "Redis", active: true }] });
    return route.fulfill({ json: path.endsWith("/unread-count") ? { count: 0 } : path.endsWith("/feed") ? { latest: [], popular: [], subscribed: [] } : [] });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: /u-author 登录$/ }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("搜索失败可重试，高亮 HTML 始终作为文字显示", async ({ page }) => {
  let attempts = 0;
  const unsafe = '<img src=x onerror="window.searchXss=true"> Redis';
  await setup(page, async route => {
    if (++attempts === 1) return route.fulfill({ status: 503, json: { message: "搜索暂时不可用" } });
    return route.fulfill({ json: { items: [hit(unsafe)], total: 1, hasMore: false, limited: false } });
  });
  await page.goto("/search?q=Redis");
  await expect(page.getByRole("alert")).toContainText("搜索暂时不可用");
  await page.getByRole("button", { name: "重试搜索" }).click();
  await expect(page.locator(".search-result mark")).toHaveText(unsafe);
  await expect(page.locator(".search-result img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).searchXss)).toBeUndefined();
  expect(attempts).toBe(2);
});

test("切换筛选时迟到的旧搜索结果不会覆盖新页面", async ({ page }) => {
  let oldRoute: Route | undefined;
  await setup(page, async route => {
    const params = new URL(route.request().url()).searchParams;
    if (!params.has("categoryId")) { oldRoute = route; return; }
    return route.fulfill({ json: { items: [hit("当前筛选结果")], total: null, hasMore: true, limited: false } });
  });
  await page.goto("/search?q=Redis");
  await expect.poll(() => !!oldRoute).toBe(true);
  await page.getByLabel("搜索分类", { exact: true }).selectOption("engineering");
  await expect(page.locator(".search-result h2")).toHaveText("当前筛选结果");
  await oldRoute!.fulfill({ json: { items: [hit("过期的搜索结果")], total: 1, hasMore: false, limited: false } });
  await expect(page.locator(".search-result h2")).toHaveText("当前筛选结果");
  await expect(page.locator(".result-count")).not.toContainText("共");
  await expect(page.getByRole("button", { name: "下一页", exact: true })).toBeEnabled();
});

test("管理台区分撤回删除失败任务，并可从重试失败中恢复", async ({ page }) => {
  let attempts = 0;
  let tasks = [
    { id: "withdraw", articleId: "撤回文章", eventType: "ArticleWithdrawn", status: "FAILED", retryCount: 5 },
    { id: "delete", articleId: "删除文章", eventType: "ArticleDeleted", status: "FAILED", retryCount: 5 },
  ];
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/withdraw/retry")) {
      if (++attempts === 1) return route.fulfill({ status: 503, json: { message: "重试服务暂时不可用" } });
      tasks = tasks.filter(task => task.id !== "withdraw");
      return route.fulfill({ status: 204 });
    }
    if (path === "/api/admin/search/tasks") return route.fulfill({ json: tasks });
    return route.fulfill({ json: path.endsWith("/unread-count") ? { count: 0 } : [] });
  });
  await page.goto(`${adminUrl}/login`);
  await page.getByRole("button", { name: /u-admin 登录$/ }).click();
  await page.goto(`${adminUrl}/search-tasks`);
  const row = page.locator(".table-row").filter({ hasText: "撤回文章" });
  await expect(row).toContainText("撤回清理");
  await expect(page.locator(".table-row").filter({ hasText: "删除文章" })).toContainText("删除清理");
  await row.getByTitle("重试索引").click();
  await expect(page.getByRole("alert")).toContainText("重试服务暂时不可用");
  await row.getByTitle("重试索引").click();
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("已重新加入索引同步队列");
});

test("翻页使用已提交关键词，不把未提交输入带入第二页", async ({ page }) => {
  await setup(page, async route => {
    const params = new URL(route.request().url()).searchParams;
    const pageNumber = Number(params.get("page") ?? 0);
    return route.fulfill({ json: { items: [hit(`${params.get("q")} 第${pageNumber + 1}页`)], total: null, hasMore: pageNumber === 0, limited: false } });
  });
  await page.goto("/search?q=Redis");
  await expect(page.locator(".search-result h2")).toHaveText("Redis 第1页");
  await page.getByLabel("搜索文章", { exact: true }).fill("新的关键词");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.locator(".search-result h2")).toHaveText("Redis 第2页");
  expect(new URL(page.url()).searchParams.get("q")).toBe("Redis");
  await page.getByLabel("搜索文章", { exact: true }).fill("新的关键词");
  await page.getByRole("button", { name: "搜索知识", exact: true }).click();
  await expect(page.locator(".search-result h2")).toHaveText("新的关键词 第1页");
});
