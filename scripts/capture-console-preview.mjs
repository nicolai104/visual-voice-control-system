import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const baseUrl = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const outputDir = resolve("public/assets/landing");
const sourcePath = resolve(outputDir, "console-preview.png");

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

try {
  await page.goto(`${baseUrl}/app/`, { waitUntil: "load" });
  await page.locator("main").waitFor({ state: "visible" });
  await page.screenshot({
    path: sourcePath,
    animations: "disabled",
  });
} finally {
  await browser.close();
}

await Promise.all([
  sharp(sourcePath)
    .webp({ quality: 82, smartSubsample: true })
    .toFile(resolve(outputDir, "console-preview.webp")),
  sharp(sourcePath)
    .avif({ quality: 52, effort: 6 })
    .toFile(resolve(outputDir, "console-preview.avif")),
]);

await rm(sourcePath);

console.log(`Console preview generated in ${outputDir}`);
