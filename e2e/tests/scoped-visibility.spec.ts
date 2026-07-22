import { expect, test, type Browser, type Page } from "@playwright/test";

async function publishTeamArticle(page: Page, title: string): Promise<string> {
  await page.goto("/");
  await page.getByLabel("用户").selectOption("u-author");
  await page.getByRole("link", { name: "写文章" }).click();
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("正文").fill("仅 Search Team 成员可阅读的索引方案。");
  await page.getByLabel("标签").fill("elasticsearch");
  await page.getByLabel("可见性").selectOption("TEAM");
  await page.getByLabel("目标组织 ID").fill("t-search");
  await page.getByRole("button", { name: "提交发布" }).click();
  await expect(page).toHaveURL(/\/articles\/[^/]+$/);
  return page.url().split("/").at(-1)!;
}

async function approveArticle(browser: Browser, articleId: string) {
  const admin = await browser.newPage();
  const adminUrl = process.env.E2E_ADMIN_URL ?? "http://localhost:5174/admin/";
  await admin.goto(adminUrl);
  await admin.getByRole("link", { name: "审核队列" }).click();
  const ticket = admin.locator(".table-row").filter({ hasText: articleId });
  await expect(ticket).toBeVisible({ timeout: 60_000 });
  await ticket.getByTitle("通过审核").click();
  await expect(ticket).toHaveCount(0);
  await admin.close();
}

async function search(page: Page, userId: string, title: string) {
  await page.goto("/search");
  await page.getByLabel("用户").selectOption(userId);
  await page.getByLabel("搜索文章").fill(title);
  await page.getByRole("button", { name: "搜索" }).click();
}

test("非目标团队成员搜索不到审核通过的团队文章", async ({ browser }) => {
  const title = `E2E 团队文章 ${Date.now()}`;
  const author = await browser.newPage();
  const articleId = await publishTeamArticle(author, title);
  await approveArticle(browser, articleId);

  await expect(async () => {
    await search(author, "u-author", title);
    await expect(author.getByRole("heading", { name: title })).toBeVisible();
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  const reader = await browser.newPage();
  await search(reader, "u-reader", title);
  await expect(reader.getByRole("heading", { name: title })).toHaveCount(0);
  await expect(reader.getByText("找到 0 篇可访问文章")).toBeVisible();
  await author.close();
  await reader.close();
});
