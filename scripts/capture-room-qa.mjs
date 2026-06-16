import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const outputDir = process.env.QA_OUTPUT_DIR || resolve(tmpdir(), "visual-voice-control-system-qa");
const baseURL = process.env.QA_BASE_URL || "http://127.0.0.1:5173";

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.goto(`${baseURL}/app/`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      localStorage.setItem("vvcs-hero-collapsed", "true");
      localStorage.setItem(
        "vvcs-device-state",
        JSON.stringify({
          light: { status: true, levelValue: 80 },
          airConditioner: { status: true, levelValue: 26 },
          fan: { status: false, levelValue: 0 },
          curtain: { status: false, levelValue: 0 },
        }),
      );
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: resolve(outputDir, `control-room-${viewport.width}x${viewport.height}.png`),
      fullPage: false,
    });

    if (viewport.width === 1440) {
      await page.locator(".room-scene").screenshot({
        path: resolve(outputDir, "control-room-scene-1440.png"),
      });
      await page.evaluate(() => {
        localStorage.setItem(
          "vvcs-device-state",
          JSON.stringify({
            light: { status: true, levelValue: 100 },
            airConditioner: { status: false, levelValue: 26 },
            fan: { status: false, levelValue: 0 },
            curtain: { status: true, levelValue: 100 },
          }),
        );
      });
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      await page.locator(".room-scene").screenshot({
        path: resolve(outputDir, "control-room-scene-target-state-1440.png"),
      });
    } else {
      await page.locator(".simulation-wrap").scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: resolve(outputDir, `control-room-${viewport.width}x${viewport.height}-room.png`),
        fullPage: false,
      });
    }
    await page.close();
  }
} finally {
  await browser.close();
}

const comparisonSources = [
  "C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-dcb2f169-341e-43c3-819e-3e09d86e475c.png",
  "C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-77399060-322d-46d3-bd5e-af8d26254e61.png",
  resolve(outputDir, "control-room-1440x900.png"),
];
const comparisonPanels = await Promise.all(
  comparisonSources.map((source) =>
    sharp(source)
      .resize({ width: 440, height: 280, fit: "contain", background: "#0d0d0d" })
      .png()
      .toBuffer(),
  ),
);

await sharp({
  create: {
    width: 1400,
    height: 320,
    channels: 3,
    background: "#0d0d0d",
  },
})
  .composite(comparisonPanels.map((input, index) => ({ input, left: 20 + index * 460, top: 20 })))
  .png()
  .toFile(resolve(outputDir, "control-room-comparison.png"));

const targetVsRoom = await Promise.all(
  [
    comparisonSources[0],
    resolve(outputDir, "control-room-scene-target-state-1440.png"),
  ].map((source) =>
    sharp(source)
      .resize({ width: 680, height: 382, fit: "cover", position: "center" })
      .png()
      .toBuffer(),
  ),
);

await sharp({
  create: {
    width: 1400,
    height: 422,
    channels: 3,
    background: "#0d0d0d",
  },
})
  .composite(targetVsRoom.map((input, index) => ({ input, left: 20 + index * 700, top: 20 })))
  .png()
  .toFile(resolve(outputDir, "target-vs-control-room.png"));

console.log(`Control room QA screenshots saved in ${outputDir}`);
