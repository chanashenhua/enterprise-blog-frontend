import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, userId: "u-admin" | "u-author" | "u-reader") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`${userId} 登录$`) }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function publishCompanyArticle(page: Page, title: string) {
  await login(page, "u-author");
  await page.goto("/articles/new");
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("正文").fill("Redis 通过淘汰策略与持久化设计保障缓存可靠性。");
  await page.getByLabel("标签").fill("redis");
  await page.getByLabel("可见性").selectOption("COMPANY");
  await page.getByRole("button", { name: "提交发布" }).click();
  await expect(page).toHaveURL(/\/articles\/[^/]+$/);
}

test("作者发布的公司文章可被搜索", async ({ page }) => {
  const title = `E2E 公司文章 ${Date.now()}`;
  await publishCompanyArticle(page, title);
  await expect(async () => {
    await page.goto(`/search?q=${encodeURIComponent(title)}`);
    const searchInput = page.getByLabel("搜索文章");
    await searchInput.fill(title);
    await page.getByRole("button", { name: "搜索" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
});
