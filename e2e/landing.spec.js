import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads the product story without horizontal overflow", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "可视化智能 语音交互控制系统" }),
    ).toBeVisible();
    const hero = page.getByRole("region", {
      name: "可视化智能 语音交互控制系统",
      exact: true,
    });
    await expect(hero.getByRole("link", { name: "体验智能空间" })).toHaveAttribute(
      "href",
      "/app/",
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("switches scenes and updates the device state", async ({ page }) => {
    await page.goto("/");

    const sleepButton = page.getByRole("button", { name: /睡眠/ });
    await sleepButton.click();

    await expect(sleepButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".scene-stage__status")).toContainText("客厅灯18%");
    await expect(page.locator(".scene-stage__status")).toContainText("空调27°C");
  });

  test("keeps the original console available under /app/", async ({ page }) => {
    await page.route("**/api/voice/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          service: "degraded",
          modelReady: false,
          asrConfigured: false,
          ffmpegReady: false,
          enrolled: false,
          threshold: 0.55,
          samplePhrase: "打开客厅灯并关闭风扇",
          message: "测试环境未启动真实语音模型",
        }),
      });
    });
    await page.goto("/app/");

    await expect(
      page.getByRole("heading", { name: "可视化智能语音交互控制系统", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "智能房间仿真区域" })).toBeVisible();
  });
});
