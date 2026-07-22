import { expect, test, type Page } from "@playwright/test";

async function publishCompanyArticle(page: Page, title: string) {
  await page.goto("/");
  await page.getByLabel("用户").selectOption("u-author");
  await page.getByRole("link", { name: "写文章" }).click();
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("正文").fill("Redis 用于权限摘要缓存和计数缓冲。");
  await page.getByLabel("标签").fill("redis");
  await page.getByLabel("可见性").selectOption("COMPANY");
  await page.getByRole("button", { name: "提交发布" }).click();
  await expect(page).toHaveURL(/\/articles\/[^/]+$/);
}

async function expectSearchResult(page: Page, userId: string, title: string) {
  await expect(async () => {
    await page.goto("/search");
    await page.getByLabel("用户").selectOption(userId);
    await page.getByLabel("搜索文章").fill(title);
    await page.getByRole("button", { name: "搜索" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

test("作者发布公司文章后能在搜索中找到", async ({ page }) => {
  const title = `E2E 公司文章 ${Date.now()}`;

  await publishCompanyArticle(page, title);
  await expectSearchResult(page, "u-author", title);
});
