import { expect, test, type Page } from "@playwright/test";

const source = "## 问题背景\n\n**缓存一致性**需要明确边界。\n\n```java\n  int ttl = 60;\n```\n\n";
const renderedHtml = '<h2>问题背景</h2><p><strong>缓存一致性</strong>需要明确边界。</p><pre><code class="language-java">  int ttl = 60;\n</code></pre>';
const markdown = (text: string) => JSON.stringify({ type: "markdown", version: 1, source: text });

async function setup(page: Page, overrides: Record<string, unknown> = {}) {
  const state = {
    article: { id: "draft-1", authorId: "u-author", title: "缓存实践", status: "DRAFT", contentJson: markdown(source),
      renderedHtml, plainText: "这里不是原始 Markdown", categoryId: "backend", tagIds: ["redis"],
      visibilityType: null, visibilityTargetIds: [], ...overrides },
    catalogFails: false, previewFails: false, publishFails: false,
    writes: [] as { path: string; method: string; body: any }[],
  };
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === "/api/organizations/publish-options") return route.fulfill({ json: {
      departments: [{ id: "d-platform", name: "Platform Engineering" }],
      teams: [{ id: "t-search", name: "Search Team", departmentId: "d-platform", departmentName: "Platform Engineering" }],
    } });
    if (path === "/api/articles/preview") {
      if (state.previewFails) return route.fulfill({ status: 503, json: { message: "预览服务暂时不可用" } });
      return route.fulfill({ json: { renderedHtml, plainText: "缓存一致性" } });
    }
    if (path === "/api/tags" || path === "/api/categories") {
      if (state.catalogFails) return route.fulfill({ status: 503, json: { message: "目录服务暂时不可用" } });
      return route.fulfill({ json: path.endsWith("tags")
        ? [{ id: "redis", name: "Redis 缓存", active: true }, { id: "java", name: "Java 开发", active: true }, { id: "old", name: "旧标签", active: false }]
        : [{ id: "backend", name: "后端工程", active: true }, { id: "ops", name: "运维实践", active: true }] });
    }
    if (method === "POST" || method === "PUT") {
      const body = request.postDataJSON();
      state.writes.push({ path, method, body });
      if (path.endsWith("/submit-publish")) {
        if (state.publishFails) return route.fulfill({ status: 503, json: { message: "发布服务暂时不可用" } });
        state.article = { ...state.article, status: "PUBLISHED" };
      } else state.article = { ...state.article, ...body };
      return route.fulfill({ json: state.article });
    }
    const data = path.endsWith("/unread-count") ? { count: 0 }
      : path.endsWith("/feed") ? { latest: [], popular: [], subscribed: [] }
      : path === "/api/articles/draft-1" ? state.article : [];
    return route.fulfill({ json: data });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: /u-author 登录$/ }).click();
  await expect(page).toHaveURL(/\/$/);
  return state;
}

test("Markdown 预览不保存，保存后再次编辑完整恢复源文", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/articles/new");
  await page.getByLabel("文章标题", { exact: true }).fill("缓存实践");
  await page.getByLabel("正文内容", { exact: true }).fill(source);
  await page.getByLabel("查找分类").fill("后端");
  await page.getByLabel("文章分类", { exact: true }).selectOption("backend");
  await page.getByLabel("查找标签").fill("redis");
  await page.getByRole("button", { name: "标签 Redis 缓存", exact: true }).click();
  const request = page.waitForRequest(r => r.url().endsWith("/articles/preview"));
  await page.getByRole("button", { name: "对照", exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ contentJson: markdown(source) });
  await expect(page.getByRole("region", { name: "正文预览" }).getByRole("heading", { name: "问题背景" })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/articles\/draft-1$/);
  expect(state.writes[0]).toMatchObject({ method: "POST", body: { title: "缓存实践", contentJson: markdown(source), tagIds: ["redis"], categoryId: "backend" } });
  await page.getByRole("link", { name: "编辑", exact: true }).click();
  await expect(page.getByLabel("正文内容", { exact: true })).toHaveValue(source);
  await expect(page.getByLabel("正文格式", { exact: true })).toHaveValue("markdown");
  await page.getByLabel("正文内容", { exact: true }).fill(source + "补充结论");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/articles\/draft-1$/);
  expect(state.writes[1]).toMatchObject({ method: "PUT", path: "/api/articles/draft-1/draft" });
});

test("旧文章保持纯文本，已停用标签可移除而不会静默丢失", async ({ page }) => {
  const legacy = "  # 纯文本\n\n**原文**\n";
  const contentJson = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: legacy }] }] });
  const state = await setup(page, { contentJson, tagIds: ["old"] });
  await page.goto("/articles/draft-1/edit");
  await expect(page.getByLabel("正文内容", { exact: true })).toHaveValue(legacy);
  await expect(page.getByLabel("正文格式", { exact: true })).toHaveValue("plain");
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "移除标签 旧标签", exact: true }).click();
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/articles\/draft-1$/);
  expect(state.writes[0].body.contentJson).toBe(contentJson);
  expect(state.writes[0].body.tagIds).toEqual([]);
});

test("分类服务故障可重试，编辑中的正文不丢失", async ({ page }) => {
  const state = await setup(page);
  state.catalogFails = true;
  await page.goto("/articles/new");
  await page.getByLabel("文章标题", { exact: true }).fill("继续写作");
  await page.getByLabel("正文内容", { exact: true }).fill(source);
  await expect(page.getByRole("button", { name: "重试分类与标签" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  state.catalogFails = false;
  await page.getByRole("button", { name: "重试分类与标签" }).click();
  await expect(page.getByLabel("查找标签")).toBeVisible();
  await expect(page.getByLabel("正文内容", { exact: true })).toHaveValue(source);
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
});

test("预览失败可重试且不会误报已保存", async ({ page }) => {
  const state = await setup(page);
  state.previewFails = true;
  await page.goto("/articles/draft-1/edit");
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.getByRole("button", { name: "重试预览" })).toBeVisible();
  state.previewFails = false;
  await page.getByRole("button", { name: "重试预览" }).click();
  await expect(page.getByRole("heading", { name: "问题背景", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test("过期预览响应不能覆盖新的正文预览", async ({ page }) => {
  await setup(page);
  let oldRoute: import("@playwright/test").Route | undefined;
  await page.route("**/api/articles/preview", async route => {
    const document = JSON.parse(route.request().postDataJSON().contentJson);
    if (document.source === "旧版本") { oldRoute = route; return; }
    return route.fulfill({ json: { renderedHtml: "<p>新版本预览</p>", plainText: "新版本预览" } });
  });
  await page.goto("/articles/new");
  await page.getByLabel("正文内容", { exact: true }).fill("旧版本");
  await page.getByRole("button", { name: "对照", exact: true }).click();
  await expect.poll(() => !!oldRoute).toBe(true);
  await page.getByLabel("正文内容", { exact: true }).fill("新版本");
  await expect(page.getByText("新版本预览", { exact: true })).toBeVisible();
  await oldRoute!.fulfill({ json: { renderedHtml: "<p>过期预览</p>", plainText: "过期预览" } });
  await expect(page.getByText("过期预览", { exact: true })).toHaveCount(0);
  await expect(page.getByText("新版本预览", { exact: true })).toBeVisible();
});

test("未保存离开可取消，再次确认后正常离开", async ({ page }) => {
  await setup(page);
  await page.goto("/articles/new");
  await page.getByLabel("正文内容", { exact: true }).fill(source);
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("link", { name: "返回我的文章" }).click();
  await expect(page).toHaveURL(/\/articles\/new$/);
  await expect(page.getByLabel("正文内容", { exact: true })).toHaveValue(source);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("link", { name: "返回我的文章" }).click();
  await expect(page).toHaveURL(/\/articles$/);
});

test("发布失败后重试更新同一草稿，全公司请求不携带旧组织 ID", async ({ page }) => {
  const state = await setup(page);
  state.publishFails = true;
  await page.goto("/articles/new");
  await page.getByLabel("文章标题", { exact: true }).fill("缓存实践");
  await page.getByLabel("正文内容", { exact: true }).fill(source);
  await page.getByLabel("可见性", { exact: true }).selectOption("TEAM");
  await page.getByRole("checkbox", { name: "选择团队 Search Team", exact: true }).check();
  await page.getByLabel("可见性", { exact: true }).selectOption("COMPANY");
  await page.getByRole("button", { name: "提交发布", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("草稿已保存，发布未完成");
  state.publishFails = false;
  await page.getByRole("button", { name: "提交发布", exact: true }).click();
  await expect(page).toHaveURL(/\/articles\/draft-1$/);
  expect(state.writes.filter(write => write.path === "/api/articles/drafts")).toHaveLength(1);
  expect(state.writes.filter(write => write.path === "/api/articles/draft-1/draft")).toHaveLength(1);
  expect(state.writes.filter(write => write.path.endsWith("/submit-publish")).map(write => write.body.targetOrgIds)).toEqual([[], []]);
});

test("未来格式正文拒绝编辑，避免被纯文本覆盖", async ({ page }) => {
  const state = await setup(page, { contentJson: '{"type":"markdown","version":2,"source":"future"}' });
  await page.goto("/articles/draft-1/edit");
  await expect(page.getByRole("alert")).toContainText("不支持该正文版本");
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test("编辑器桌面与手机对照布局无横向溢出", async ({ page }, info) => {
  await setup(page);
  await page.goto("/articles/draft-1/edit");
  await page.getByRole("button", { name: "对照", exact: true }).click();
  await expect(page.getByRole("heading", { name: "问题背景", exact: true })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) {
      const links = page.getByRole("navigation", { name: "主导航" }).getByRole("link");
      for (const link of await links.all()) {
        expect(await link.evaluate(element => getComputedStyle(element).whiteSpace)).toBe("nowrap");
      }
    }
    await page.screenshot({ path: info.outputPath("editor-" + width + ".png"), fullPage: true });
  }
});
