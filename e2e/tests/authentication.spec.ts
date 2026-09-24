import { expect, test } from "@playwright/test";

test("员工端首次访问、刷新保持与退出登录", async ({ page }) => {
  await page.goto("/articles");
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByRole("heading", { name: "选择演示身份进入" })).toBeVisible();
  await page.getByRole("button", { name: /u-author 登录$/ }).click();
  await expect(page).toHaveURL(/\/articles$/);
  await page.reload();
  await expect(page.getByLabel(/账号菜单：技术作者/)).toBeVisible();
  await page.getByLabel(/账号菜单：技术作者/).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("非法 redirect 不会离开当前应用", async ({ page }) => {
  await page.goto("/login?redirect=https://evil.example");
  await page.getByRole("button", { name: /u-reader 登录$/ }).click();
  await expect(page).toHaveURL(/http:\/\/localhost:5173\/$/);
});

test("非管理员不会加载管理接口", async ({ browser }) => {
  const adminUrl = process.env.E2E_ADMIN_URL ?? "http://localhost:5174";
  const page = await browser.newPage();
  const adminRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/admin/")) adminRequests.push(request.url()); });
  await page.goto(`${adminUrl}/login`);
  await page.getByRole("button", { name: /u-author 登录$/ }).click();
  await expect(page).toHaveURL(`${adminUrl}/forbidden`);
  await expect(page.getByRole("heading", { name: /没有管理权限/ })).toBeVisible();
  expect(adminRequests).toEqual([]);
  await page.close();
});

test("管理员可进入管理台", async ({ browser }) => {
  const adminUrl = process.env.E2E_ADMIN_URL ?? "http://localhost:5174";
  const page = await browser.newPage();
  await page.goto(`${adminUrl}/login`);
  await page.getByRole("button", { name: /u-admin 登录$/ }).click();
  await expect(page).toHaveURL(`${adminUrl}/`);
  await expect(page.getByText("平台管理员")).toBeVisible();
  await page.close();
});
