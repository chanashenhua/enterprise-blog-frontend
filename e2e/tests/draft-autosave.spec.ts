import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

const markdown = (source: string) => JSON.stringify({ type: "markdown", version: 1, source });
const savedSource = "服务器上已经保存的正文。";
const editorBody = (page: Page) => page.getByLabel("正文内容", { exact: true });
const editorTitle = (page: Page) => page.getByLabel("文章标题", { exact: true });
const saveState = (page: Page) => page.locator(".editor-save-state");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

// 两个标签页共享同一个带 revision 的服务端测试桩，覆盖真实 HTTP 冲突边界。
async function installServer(context: BrowserContext) {
  const state = {
    article: { id: "draft-1", authorId: "u-author", title: "自动保存实践", status: "DRAFT", revision: 1,
      updatedAt: "2026-09-26T04:00:00Z", contentJson: markdown(savedSource), renderedHtml: "<p>服务器上已经保存的正文。</p>",
      plainText: savedSource, categoryId: null as string | null, tagIds: [] as string[],
      visibilityType: "COMPANY", visibilityTargetIds: [] as string[] },
    writes: [] as { path: string; method: string; body: any; userId: string }[],
    created: new Map<string, string>(),
    failNext: false,
    loseNextResponse: false,
    holdNext: false,
    release: undefined as (() => Promise<void>) | undefined,
    active: 0,
    maxActive: 0,
  };
  await context.route(url => url.pathname.startsWith("/api/"), async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === "/api/articles/preview") {
      const source = JSON.parse(request.postDataJSON().contentJson).source ?? "";
      return route.fulfill({ json: { renderedHtml: "<p>正文预览</p>", plainText: source } });
    }
    if (path === "/api/organizations/publish-options") return route.fulfill({ json: { departments: [], teams: [] } });
    if (method === "POST" || method === "PUT") {
      const body = request.postDataJSON();
      state.writes.push({ path, method, body, userId: request.headers()["x-mock-user"] });
      if (state.failNext) {
        state.failNext = false;
        return route.fulfill({ status: 503, json: { message: "草稿服务暂时不可用" } });
      }
      if (method === "PUT" || path.endsWith("/submit-publish")) {
        if (body.expectedRevision !== state.article.revision) {
          return route.fulfill({ status: 409, json: { message: "草稿已在其他窗口更新，请处理版本冲突" } });
        }
        state.article = { ...state.article, ...body, revision: state.article.revision + 1 };
      } else {
        expect(path).toBe("/api/articles/drafts");
        expect(body.clientDraftId).toMatch(/^[0-9a-f-]{36}$/i);
        if (!state.created.has(body.clientDraftId)) {
          state.created.set(body.clientDraftId, state.article.id);
          state.article = { ...state.article, ...body, revision: 1 };
        }
      }
      state.article.updatedAt = new Date(Date.parse(state.article.updatedAt) + 1000).toISOString();
      const response = { ...state.article };
      if (state.loseNextResponse) {
        state.loseNextResponse = false;
        return route.abort("failed");
      }
      state.active++;
      state.maxActive = Math.max(state.maxActive, state.active);
      const respond = async () => {
        await route.fulfill({ json: response });
        state.active--;
      };
      if (state.holdNext) { state.holdNext = false; state.release = respond; return; }
      return respond();
    }
    return route.fulfill({ json: path === "/api/articles/draft-1" ? state.article
      : path.endsWith("/unread-count") ? { count: 0 }
      : path.endsWith("/feed") ? { latest: [], popular: [], subscribed: [] } : [] });
  });
  return state;
}

async function login(page: Page, account = "u-author") {
  await page.goto("/login");
  await button(page, account === "u-author" ? "使用 技术作者 u-author 登录" : "使用 平台管理员 u-admin 登录").click();
  await expect(page).toHaveURL(/\/$/);
}

async function freezeClock(page: Page) {
  const time = new Date("2026-09-26T04:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
}

async function openEditor(page: Page, path = "/articles/draft-1/edit") {
  await page.goto(path);
  await expect(editorBody(page)).toBeVisible();
  await expect(page.getByLabel("查找标签")).toBeVisible();
  await freezeClock(page);
}

async function recoveryContents(page: Page) {
  return page.evaluate(() => Object.values(sessionStorage).join("\n"));
}

test("暂停输入两秒才保存，新草稿创建一次并留在编辑页", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page, "/articles/new");
  await editorTitle(page).fill("新草稿");
  await editorBody(page).fill("第一次输入");
  await page.clock.runFor(1900);
  expect(state.writes).toHaveLength(0);
  await editorBody(page).fill("第二次输入重置倒计时");
  await page.clock.runFor(1900);
  expect(state.writes).toHaveLength(0);
  await page.clock.runFor(200);
  await expect(page).toHaveURL(/\/articles\/draft-1\/edit$/);
  await expect(saveState(page)).toContainText("已保存");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toMatchObject({ autosave: true, title: "新草稿", contentJson: markdown("第二次输入重置倒计时") });
  await editorBody(page).fill("在同一个草稿上继续写");
  await page.clock.runFor(2100);
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1]).toMatchObject({ method: "PUT", body: { expectedRevision: 1, autosave: true } });
  expect(state.created.size).toBe(1);
});

test("保存中继续编辑，旧响应不覆盖晚输入且仅串行补存一次", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page);
  state.holdNext = true;
  await editorBody(page).fill("请求发出时的正文");
  await page.clock.runFor(2100);
  await expect.poll(() => !!state.release).toBe(true);
  await expect(saveState(page)).toContainText(/保存中|正在保存/);
  await expect(editorBody(page)).toBeEnabled();
  await editorBody(page).fill("请求等待期间继续写的最终正文");
  await page.clock.runFor(5000);
  expect(state.writes).toHaveLength(1);
  await state.release!();
  await expect(editorBody(page)).toHaveValue("请求等待期间继续写的最终正文");
  await page.clock.runFor(2100);
  await expect.poll(() => state.writes.length).toBe(2);
  await expect(saveState(page)).toContainText("已保存");
  expect(state.maxActive).toBe(1);
  expect(state.writes[1].body).toMatchObject({ expectedRevision: 2, contentJson: markdown("请求等待期间继续写的最终正文") });
  await page.clock.runFor(5000);
  expect(state.writes).toHaveLength(2);
});

test("首次建稿响应期间继续输入，迁移编辑地址不丢正文且补存同一草稿", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page, "/articles/new");
  state.holdNext = true;
  await editorTitle(page).fill("创建过程中继续写作");
  await editorBody(page).fill("首次创建时提交的正文");
  await page.clock.runFor(2100);
  await expect.poll(() => !!state.release).toBe(true);
  await editorBody(page).fill("首次创建响应期间继续补充的正文");
  await state.release!();
  await expect(page).toHaveURL(/\/articles\/draft-1\/edit$/);
  await expect(editorBody(page)).toHaveValue("首次创建响应期间继续补充的正文");
  await expect.poll(() => recoveryContents(page)).toContain("首次创建响应期间继续补充的正文");
  await page.clock.runFor(2100);
  await expect(saveState(page)).toContainText("已保存");
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toMatchObject({ method: "PUT", path: "/api/articles/draft-1/draft",
    body: { expectedRevision: 1, contentJson: markdown("首次创建响应期间继续补充的正文") } });
  expect(state.created.size).toBe(1);
  expect(state.maxActive).toBe(1);
});

test("新稿恢复副本迁移失败保留原地址和旧槽，刷新后仍可恢复未保存正文", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page, "/articles/new");
  state.holdNext = true;
  await editorTitle(page).fill("存储空间不足时的新稿");
  await editorBody(page).fill("已经提交的第一版正文");
  await page.clock.runFor(2100);
  await expect.poll(() => !!state.release).toBe(true);
  const localBody = "空间不足也不能丢失的未保存正文";
  await editorBody(page).fill(localBody);
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "enterprise-blog.portal.draft-recovery.v1:u-author:draft-1") {
        throw new DOMException("模拟新草稿槽写入失败", "QuotaExceededError");
      }
      return setItem.call(this, key, value);
    };
  });
  await state.release!();
  await expect(saveState(page)).toContainText("等待自动保存");
  await expect(page).toHaveURL(/\/articles\/new$/);
  const cached = await page.evaluate(() => JSON.parse(sessionStorage.getItem("enterprise-blog.portal.draft-recovery.v1:u-author:new")!));
  expect(cached).toMatchObject({ slot: "new", articleId: "draft-1", revision: 1, draft: { body: localBody } });
  page.once("dialog", dialog => dialog.accept());
  await page.reload();
  await expect(button(page, "恢复未保存内容")).toBeVisible();
  await button(page, "恢复未保存内容").click();
  await expect(editorBody(page)).toHaveValue(localBody);
  await page.clock.runFor(2100);
  await expect(page).toHaveURL(/\/articles\/draft-1\/edit$/);
  await expect(saveState(page)).toContainText("已保存");
  expect(state.created.size).toBe(1);
  expect(state.writes[1]).toMatchObject({ method: "PUT", body: { expectedRevision: 1, contentJson: markdown(localBody) } });
});

test("创建已落库但响应丢失，重试沿用客户端草稿标识避免重复文章", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page, "/articles/new");
  state.loseNextResponse = true;
  await editorTitle(page).fill("响应丢失的草稿");
  await editorBody(page).fill("仍然保留在浏览器里的正文");
  await page.clock.runFor(2100);
  await expect(button(page, "重试保存")).toBeVisible();
  await button(page, "重试保存").click();
  await expect(page).toHaveURL(/\/articles\/draft-1\/edit$/);
  await expect(saveState(page)).toContainText("已保存");
  expect(state.created.size).toBe(1);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].body.clientDraftId).toBe(state.writes[0].body.clientDraftId);
  await expect(editorBody(page)).toHaveValue("仍然保留在浏览器里的正文");
});

test("刷新后需显式恢复本地正文，确认前不能静默覆盖服务端", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page);
  const localBody = "刷新前尚未提交的本地正文";
  await editorBody(page).fill(localBody);
  await expect.poll(() => recoveryContents(page)).toContain(localBody);
  page.once("dialog", dialog => dialog.accept());
  await page.reload();
  await expect(button(page, "恢复未保存内容")).toBeVisible();
  await expect(editorBody(page)).toHaveValue(savedSource);
  await page.clock.runFor(5000);
  expect(state.writes).toHaveLength(0);
  await button(page, "恢复未保存内容").click();
  await expect(editorBody(page)).toHaveValue(localBody);
  await page.clock.runFor(2100);
  await expect(saveState(page)).toContainText("已保存");
  expect(state.writes[0].body).toMatchObject({ expectedRevision: 1, contentJson: markdown(localBody) });
});

test("保存请求已落库但响应未到时改回原文，刷新恢复后仍须保存并处理修订冲突", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page);
  state.holdNext = true;
  const committedBody = "已经写入服务器但响应尚未返回的第二版正文";
  await editorBody(page).fill(committedBody);
  await page.clock.runFor(2100);
  await expect.poll(() => !!state.release).toBe(true);
  expect(state.article.contentJson).toBe(markdown(committedBody));

  // 用户回退到请求之前的文字，也必须按服务端实际已保存的第二版判断是否脏。
  await editorBody(page).fill(savedSource);
  await expect.poll(() => recoveryContents(page)).toContain(savedSource);
  page.once("dialog", dialog => dialog.accept());
  await page.reload();
  await expect(editorBody(page)).toHaveValue(committedBody);
  await expect(button(page, "恢复未保存内容")).toBeVisible();
  await state.release!();
  await button(page, "恢复未保存内容").click();
  await expect(editorBody(page)).toHaveValue(savedSource);
  await expect(saveState(page)).toContainText("等待自动保存");
  await expect.poll(() => recoveryContents(page)).toContain(savedSource);

  await page.clock.runFor(2100);
  await expect(button(page, "查看服务器版本")).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toMatchObject({ method: "PUT", body: { expectedRevision: 1, contentJson: markdown(savedSource) } });
  expect(state.article.contentJson).toBe(markdown(committedBody));
  await expect.poll(() => recoveryContents(page)).toContain(savedSource);
  await button(page, "查看服务器版本").click();
  await expect(page.getByRole("region", { name: "服务器版本", exact: true })).toContainText(committedBody);
  page.once("dialog", dialog => dialog.accept());
  await button(page, "保留本地内容继续编辑").click();
  await page.clock.runFor(2100);
  await expect(saveState(page)).toContainText("已保存");
  expect(state.writes).toHaveLength(3);
  expect(state.writes[2].body).toMatchObject({ expectedRevision: 2, contentJson: markdown(savedSource) });
  expect(state.article.contentJson).toBe(markdown(savedSource));
});

test("丢弃本地恢复保持服务器正文，刷新后不再提示恢复", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page);
  await editorBody(page).fill("明确不要恢复的本地内容");
  await expect.poll(() => recoveryContents(page)).toContain("明确不要恢复");
  page.once("dialog", dialog => dialog.accept());
  await page.reload();
  await expect(button(page, "丢弃本地恢复")).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await button(page, "丢弃本地恢复").click();
  await expect(editorBody(page)).toHaveValue(savedSource);
  await page.reload();
  await expect(editorBody(page)).toHaveValue(savedSource);
  await expect(button(page, "恢复未保存内容")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test("离线编辑保存在本地，联网后自动补存", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page);
  await context.setOffline(true);
  await editorBody(page).fill("离线期间的正文");
  await expect(saveState(page)).toContainText("离线");
  await page.clock.runFor(5000);
  expect(state.writes).toHaveLength(0);
  await expect.poll(() => recoveryContents(page)).toContain("离线期间的正文");
  await context.setOffline(false);
  await page.clock.runFor(2100);
  await expect(saveState(page)).toContainText("已保存");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body.contentJson).toBe(markdown("离线期间的正文"));
});

test("服务故障不会误报保存成功，重试提交最新正文", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page);
  state.failNext = true;
  await editorBody(page).fill("第一次保存失败");
  await page.clock.runFor(2100);
  await expect(button(page, "重试保存")).toBeVisible();
  await expect(saveState(page)).not.toContainText("已保存");
  await editorBody(page).fill("失败后继续完善的正文");
  await button(page, "重试保存").click();
  await expect(saveState(page)).toContainText("已保存");
  expect(state.writes[1].body).toMatchObject({ expectedRevision: 1, contentJson: markdown("失败后继续完善的正文") });
});

async function createConflict(page: Page, context: BrowserContext) {
  const state = await installServer(context);
  await login(page);
  await openEditor(page);
  const second = await context.newPage();
  await openEditor(second);
  await editorBody(page).fill("第一个标签页写入的服务端正文");
  await page.clock.runFor(2100);
  await expect(saveState(page)).toContainText("已保存");
  await editorBody(second).fill("第二个标签页需要保留的本地正文");
  await second.clock.runFor(2100);
  await expect(button(second, "查看服务器版本")).toBeVisible();
  await second.clock.runFor(5000);
  expect(state.writes).toHaveLength(2);
  await expect(editorBody(second)).toHaveValue("第二个标签页需要保留的本地正文");
  return { state, second };
}

test("两标签页冲突后暂停保存，查看服务器版本再显式保留本地继续", async ({ page, context }) => {
  const { state, second } = await createConflict(page, context);
  second.once("dialog", dialog => dialog.accept());
  await second.reload();
  await expect(button(second, "恢复未保存内容")).toBeVisible();
  await button(second, "恢复未保存内容").click();
  await expect(second.getByRole("region", { name: "编辑冲突", exact: true })).toBeVisible();
  await second.clock.runFor(5000);
  expect(state.writes).toHaveLength(2);
  await button(second, "查看服务器版本").click();
  const serverVersion = second.getByRole("region", { name: "服务器版本", exact: true });
  await expect(serverVersion).toContainText("第一个标签页写入的服务端正文");
  await expect(editorBody(second)).toHaveValue("第二个标签页需要保留的本地正文");
  second.once("dialog", dialog => dialog.dismiss());
  await button(second, "保留本地内容继续编辑").click();
  expect(state.writes).toHaveLength(2);
  second.once("dialog", dialog => dialog.accept());
  await button(second, "保留本地内容继续编辑").click();
  await second.clock.runFor(2100);
  await expect(saveState(second)).toContainText("已保存");
  expect(state.writes[2].body).toMatchObject({ expectedRevision: 2, contentJson: markdown("第二个标签页需要保留的本地正文") });
  await second.close();
});

test("冲突时采用服务器版本必须确认，取消会保留本地正文", async ({ page, context }) => {
  const { state, second } = await createConflict(page, context);
  await button(second, "查看服务器版本").click();
  second.once("dialog", dialog => dialog.dismiss());
  await button(second, "使用服务器版本").click();
  await expect(editorBody(second)).toHaveValue("第二个标签页需要保留的本地正文");
  second.once("dialog", dialog => dialog.accept());
  await button(second, "使用服务器版本").click();
  await expect(editorBody(second)).toHaveValue("第一个标签页写入的服务端正文");
  await second.clock.runFor(5000);
  expect(state.writes).toHaveLength(2);
  await second.reload();
  await expect(editorBody(second)).toHaveValue("第一个标签页写入的服务端正文");
  await expect(button(second, "恢复未保存内容")).toHaveCount(0);
  await second.close();
});

test("退出清理恢复内容，换账号和重新登录原账号都不能恢复旧正文", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page, "/articles/new");
  await editorTitle(page).fill("仅属于原作者的标题");
  await editorBody(page).fill("仅属于原作者的未保存正文");
  await expect.poll(() => recoveryContents(page)).toContain("仅属于原作者");
  await page.getByLabel(/账号菜单：技术作者/).click();
  await button(page, "退出登录").click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await recoveryContents(page)).not.toContain("仅属于原作者");
  await login(page, "u-admin");
  await page.goto("/articles/new");
  await expect(editorBody(page)).toHaveValue("");
  await expect(button(page, "恢复未保存内容")).toHaveCount(0);
  await page.getByLabel(/账号菜单：平台管理员/).click();
  await button(page, "退出登录").click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page);
  await page.goto("/articles/new");
  await expect(editorBody(page)).toHaveValue("");
  await expect(button(page, "恢复未保存内容")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test("其他标签页换账号清理旧会话，迟到保存响应不能恢复正文或导航", async ({ page, context }) => {
  const state = await installServer(context);
  await login(page);
  await openEditor(page, "/articles/new");
  state.holdNext = true;
  await editorTitle(page).fill("跨标签页隔离的草稿");
  await editorBody(page).fill("旧账号保存请求中的正文");
  await page.clock.runFor(2100);
  await expect.poll(() => !!state.release).toBe(true);
  await editorBody(page).fill("旧账号保存途中继续编辑的私有正文");
  await expect.poll(() => recoveryContents(page)).toContain("旧账号保存途中");

  const second = await context.newPage();
  await second.goto("/");
  await second.getByLabel(/账号菜单：技术作者/).click();
  await button(second, "退出登录").click();
  await expect(page).toHaveURL(/\/login(?:\?redirect=.*)?$/);
  await login(second, "u-admin");
  expect(await recoveryContents(page)).not.toContain("旧账号");

  await state.release!();
  await expect(page).toHaveURL(/\/login(?:\?redirect=.*)?$/);
  // 整页加载读取另一标签页已保存的管理员会话，不能重新登录来掩盖共享会话损坏。
  await page.goto("/articles/new");
  await expect(page.getByLabel(/账号菜单：平台管理员/)).toBeVisible();
  await expect(editorBody(page)).toHaveValue("");
  await expect(button(page, "恢复未保存内容")).toHaveCount(0);
  await page.clock.runFor(5000);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].userId).toBe("u-author");
  await second.close();
});

test("自动保存状态和冲突处理在 390 与 1440 宽度不横向溢出", async ({ page, context }, info) => {
  const { second } = await createConflict(page, context);
  await button(second, "查看服务器版本").click();
  for (const width of [1440, 390]) {
    await second.setViewportSize({ width, height: 1000 });
    await expect(button(second, "保留本地内容继续编辑")).toBeVisible();
    await expect(button(second, "使用服务器版本")).toBeVisible();
    expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await second.screenshot({ path: info.outputPath("autosave-conflict-" + width + ".png"), fullPage: true });
  }
  await second.close();
});
