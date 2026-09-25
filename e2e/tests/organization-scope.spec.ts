import { expect, test, type Page } from "@playwright/test";

const departments = [{ id: "d-platform", name: "平台工程部" }, { id: "d-pay", name: "支付工程部" }];
const teams = [
  { id: "t-search", name: "搜索团队", departmentId: "d-platform", departmentName: "平台工程部" },
  { id: "t-pay", name: "支付团队", departmentId: "d-pay", departmentName: "支付工程部" },
];

// 浏览器交互使用 API 测试桩；真实授权及组织存在性由后端测试覆盖。
async function setup(page: Page, account = "u-author", existingTargets: string[] = []) {
  const state = {
    directory: { departments: account === "u-admin" ? [...departments] : departments.slice(0, 1),
      teams: account === "u-admin" ? [...teams] : teams.slice(0, 1) },
    unavailable: false,
    directoryRequests: 0,
    writes: [] as { path: string; body: any }[],
    article: { id: "scope-draft", title: "组织知识共享", authorId: account, status: "DRAFT",
      contentJson: JSON.stringify({ type: "markdown", version: 1, source: "## 共享边界\n\n保存组织知识。" }),
      renderedHtml: "<p>保存组织知识。</p>", plainText: "保存组织知识。", tagIds: [], categoryId: null,
      visibilityType: existingTargets.length ? "TEAM" : "COMPANY", visibilityTargetIds: existingTargets },
  };
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/organizations/publish-options") {
      state.directoryRequests++;
      expect(request.headers()["x-mock-user"]).toBe(account);
      return state.unavailable ? route.fulfill({ status: 503, json: { message: "组织服务暂不可用" } })
        : route.fulfill({ json: state.directory });
    }
    if (request.method() === "POST" || request.method() === "PUT") {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      state.article = path.endsWith("/submit-publish")
        ? { ...state.article, status: body.visibilityType === "COMPANY" ? "PUBLISHED" : "PENDING_REVIEW",
          visibilityType: body.visibilityType, visibilityTargetIds: body.targetOrgIds }
        : { ...state.article, ...body };
      return route.fulfill({ json: state.article });
    }
    return route.fulfill({ json: path.endsWith("/unread-count") ? { count: 0 }
      : path.endsWith("/feed") ? { latest: [], popular: [], subscribed: [] }
      : path === "/api/articles/scope-draft" ? state.article : [] });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(account + " 登录$") }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/articles/scope-draft/edit");
  await expect(page.getByLabel("正文内容", { exact: true })).toHaveValue("## 共享边界\n\n保存组织知识。");
  return state;
}

const submit = (page: Page) => page.getByRole("button", { name: "提交发布", exact: true });
const checkbox = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true });

test("管理员按部门名称搜索多选，提交准确 ID 并进入审核", async ({ page }) => {
  const state = await setup(page, "u-admin");
  expect(state.directoryRequests).toBe(0);
  await page.getByLabel("可见性", { exact: true }).selectOption("DEPARTMENT");
  await expect(submit(page)).toBeDisabled();
  await page.getByLabel("查找部门").fill("平台");
  await checkbox(page, "选择部门 平台工程部").check();
  await expect(checkbox(page, "选择部门 支付工程部")).toHaveCount(0);
  await page.getByLabel("查找部门").fill("支付");
  await checkbox(page, "选择部门 支付工程部").check();
  await expect(page.locator(".org-scope-summary")).toContainText("平台工程部、支付工程部");
  await submit(page).click();
  await expect(page).toHaveURL(/\/articles\/scope-draft$/);
  expect(state.writes.at(-1)?.body).toEqual({ visibilityType: "DEPARTMENT", targetOrgIds: ["d-platform", "d-pay"], reviewRequired: true });
  expect(state.article.status).toBe("PENDING_REVIEW");
});

test("作者按所属部门搜索团队，仅使用服务端返回的选项", async ({ page }) => {
  const state = await setup(page);
  await page.getByLabel("可见性", { exact: true }).selectOption("TEAM");
  await page.getByLabel("查找团队").fill("平台工程");
  await expect(checkbox(page, "选择团队 搜索团队")).toBeVisible();
  await expect(checkbox(page, "选择团队 支付团队")).toHaveCount(0);
  await page.getByLabel("查找团队").fill("不存在的团队");
  await expect(page.getByText("没有匹配的团队，试试其他关键词。")).toBeVisible();
  await page.getByLabel("查找团队").fill("t-search");
  await checkbox(page, "选择团队 搜索团队").check();
  await expect(page.locator(".org-scope-summary")).toContainText("搜索团队 · 平台工程部");
  await submit(page).click();
  await expect(page).toHaveURL(/\/articles\/scope-draft$/);
  expect(state.writes.at(-1)?.body).toEqual({ visibilityType: "TEAM", targetOrgIds: ["t-search"], reviewRequired: true });
});

test("部门、团队、全公司切换清除之前范围，草稿不携带发布设置", async ({ page }) => {
  const state = await setup(page, "u-admin");
  await page.getByLabel("可见性", { exact: true }).selectOption("DEPARTMENT");
  await checkbox(page, "选择部门 支付工程部").check();
  await page.getByLabel("可见性", { exact: true }).selectOption("TEAM");
  await expect(page.getByRole("region", { name: "组织可见范围" })).toContainText("尚未选择团队");
  await expect(submit(page)).toBeDisabled();
  await checkbox(page, "选择团队 搜索团队").check();
  await page.getByLabel("可见性", { exact: true }).selectOption("COMPANY");
  await submit(page).click();
  await expect(page).toHaveURL(/\/articles\/scope-draft$/);
  expect(state.writes[0].body).not.toHaveProperty("targetOrgIds");
  expect(state.writes.at(-1)?.body).toEqual({ visibilityType: "COMPANY", targetOrgIds: [], reviewRequired: false });
});

test("恢复文章保留失效组织并阻止发布，显式移除后可重新选择", async ({ page }) => {
  await setup(page, "u-author", ["deleted-team"]);
  await expect(page.getByRole("alert")).toContainText("已有目标已失效或不在当前权限范围内");
  await expect(submit(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
  await checkbox(page, "选择团队 搜索团队").check();
  await expect(submit(page)).toBeDisabled();
  await page.getByRole("button", { name: "移除组织 已失效或无权限（deleted-team）", exact: true }).click();
  await expect(submit(page)).toBeEnabled();
});

test("刷新目录后消失的已选组织不被静默移除，也不能继续发布", async ({ page }) => {
  const state = await setup(page, "u-author", ["t-search"]);
  await expect(submit(page)).toBeEnabled();
  state.directory.teams = [];
  await page.getByRole("button", { name: "刷新组织列表" }).click();
  await expect(page.getByRole("alert")).toContainText("已有目标已失效");
  await expect(page.getByRole("button", { name: "移除组织 已失效或无权限（t-search）", exact: true })).toBeVisible();
  await expect(submit(page)).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});

test("组织服务失败保留正文、允许草稿保存和全公司范围，并可重试", async ({ page }) => {
  const state = await setup(page);
  state.unavailable = true;
  await page.getByLabel("可见性", { exact: true }).selectOption("TEAM");
  await expect(page.getByRole("button", { name: "重试组织目录" })).toBeVisible();
  await expect(submit(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
  await expect(page.getByLabel("正文内容", { exact: true })).toHaveValue("## 共享边界\n\n保存组织知识。");
  await page.getByLabel("可见性", { exact: true }).selectOption("COMPANY");
  await expect(submit(page)).toBeEnabled();
  state.unavailable = false;
  await page.getByLabel("可见性", { exact: true }).selectOption("TEAM");
  await checkbox(page, "选择团队 搜索团队").check();
  state.unavailable = true;
  await page.getByRole("button", { name: "刷新组织列表" }).click();
  await expect(page.getByRole("button", { name: "重试组织目录" })).toBeVisible();
  await expect(submit(page)).toBeDisabled();
  state.unavailable = false;
  await page.getByRole("button", { name: "重试组织目录" }).click();
  await expect(checkbox(page, "选择团队 搜索团队")).toBeChecked();
  await expect(submit(page)).toBeEnabled();
});

test("没有可选组织时提示核对权限，不允许空范围发布", async ({ page }) => {
  const state = await setup(page);
  state.directory = { departments: [], teams: [] };
  await page.getByLabel("可见性", { exact: true }).selectOption("DEPARTMENT");
  await expect(page.getByText(/当前账号没有可选的部门/)).toBeVisible();
  await expect(submit(page)).toBeDisabled();
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/articles\/scope-draft$/);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toBe("/api/articles/scope-draft/draft");
});

test("组织选择器在桌面和手机宽度可用且不横向溢出", async ({ page }, info) => {
  await setup(page, "u-admin");
  await page.getByLabel("可见性", { exact: true }).selectOption("TEAM");
  await checkbox(page, "选择团队 搜索团队").check();
  await checkbox(page, "选择团队 支付团队").check();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(submit(page)).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("region", { name: "组织可见范围" }).screenshot({ path: info.outputPath("org-scope-" + width + ".png") });
  }
});
