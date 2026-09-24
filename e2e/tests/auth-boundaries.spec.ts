import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route(url => url.pathname.startsWith("/api/"), route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/unread-count") ? { count: 0 }
      : path.endsWith("/feed") ? { latest: [], popular: [], subscribed: [] } : [];
    return route.fulfill({ json: data });
  });
});

for (const account of ["u-admin", "u-author", "u-reader"]) {
  test(`${account} 登录、刷新与退出没有页面异常`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/login");
    await page.getByRole("button", { name: new RegExp(account + " 登录$") }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.reload();
    await page.locator(".account-menu summary").click();
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
  });
}

test("读者看不到文章创作入口，直接访问编辑页也被拦截", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", r => { if (r.url().includes("/api/")) calls.push(r.url()); });
  await page.goto("/login");
  await page.getByRole("button", { name: /u-reader 登录$/ }).click();
  await expect(page.locator('a[href="/articles/new"]')).toHaveCount(0);
  await page.goto("/articles/new");
  await expect(page.getByRole("heading", { name: "当前账号没有文章创作权限" })).toBeVisible();
  expect(calls.filter(url => /\/drafts|\/mine/.test(url))).toEqual([]);
});

for (const account of ["u-author", "u-reader"]) {
  test(`管理端 ${account} 不发起管理请求`, async ({ page }) => {
    const admin = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:5174";
    const calls: string[] = [];
    page.on("request", r => { if (r.url().includes("/api/admin/")) calls.push(r.url()); });
    await page.goto(admin + "/reviews");
    await page.getByRole("button", { name: new RegExp(account + " 登录$") }).click();
    await expect(page).toHaveURL(admin + "/forbidden");
    await page.reload();
    await expect(page.getByRole("heading", { name: /没有管理权限/ })).toBeVisible();
    expect(calls).toEqual([]);
  });
}

test("登录页在桌面和手机宽度不横向溢出", async ({ page }, info) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of ["/login", (process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:5174") + "/login"]) {
      await page.goto(url);
      await expect(page.getByRole("button", { name: /u-reader 登录$/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath((url.startsWith("/") ? "portal" : "admin") + "-" + width + ".png"), fullPage: true });
    }
  }
});
