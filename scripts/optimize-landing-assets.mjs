import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const groups = [
  {
    sourceDir: join(root, "assets-source", "landing"),
    outputDir: join(root, "public", "assets", "landing"),
    assets: [
      { source: "living-room-master.png", output: "living-room", widths: [960, 1440, 1920] },
      { source: "gesture-hand.png", output: "gesture-hand", widths: [960, 1440] },
      { source: "architecture-night.png", output: "architecture-night", widths: [960, 1440, 1920] },
    ],
  },
  {
    sourceDir: join(root, "assets-source", "control-room"),
    outputDir: join(root, "public", "assets", "control-room"),
    assets: [
      { source: "control-room-night.png", output: "control-room-night", widths: [960, 1440, 1920] },
      { source: "control-room-day.png", output: "control-room-day", widths: [960, 1440, 1920] },
      { source: "fan.png", output: "fan", heights: [640], transparent: true },
      { source: "curtain.png", output: "curtain", heights: [900], transparent: true },
    ],
  },
];

for (const group of groups) {
  await mkdir(group.outputDir, { recursive: true });

  for (const asset of group.assets) {
    const sourcePath = join(group.sourceDir, asset.source);
    await stat(sourcePath);

    if (asset.transparent) {
      const height = asset.heights[0];
      await sharp(sourcePath)
        .trim()
        .resize({ height, withoutEnlargement: true, fit: "inside" })
        .webp({ quality: 88, alphaQuality: 95, effort: 5 })
        .toFile(join(group.outputDir, `${asset.output}-${height}.webp`));
      continue;
    }

    for (const width of asset.widths) {
      const pipeline = sharp(sourcePath).resize({ width, withoutEnlargement: true, fit: "inside" });
      await Promise.all([
        pipeline.clone().avif({ quality: 60, effort: 5 }).toFile(join(group.outputDir, `${asset.output}-${width}.avif`)),
        pipeline.clone().webp({ quality: 80, effort: 5 }).toFile(join(group.outputDir, `${asset.output}-${width}.webp`)),
      ]);
    }
  }

  console.log(`Assets optimized in ${group.outputDir}`);
}
