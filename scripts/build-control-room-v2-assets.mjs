import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const sourceDir = join(root, "assets-source", "control-room-v2");
const outputDir = join(root, "public", "assets", "control-room-v2");

const SCENE_WIDTH = 1672;
const SCENE_HEIGHT = 941;
const LIGHT_STEPS = [0, 25, 50, 75, 100];
const CURTAIN_STEPS = Array.from({ length: 11 }, (_, index) => index * 10);
const WINDOW = { left: 529, top: 166, width: 578, height: 398 };
if (!outputDir.startsWith(root)) throw new Error("Control-room output must stay inside the project root.");
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

function clamp(value, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

function gaussian(x, y, cx, cy, sx, sy) {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-(dx * dx + dy * dy) * 0.5);
}

async function normalizeScene(path) {
  return sharp(path)
    .resize(SCENE_WIDTH, SCENE_HEIGHT, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function renderLightingFrame(base, level, ambience) {
  const intensity = level / 100;
  const output = Buffer.from(base.data);
  const daylightFactor = ambience === "day" ? 0.48 : 1;
  const exposureGain = 1 + intensity * (ambience === "day" ? 0.08 : 0.4);

  for (let y = 0; y < SCENE_HEIGHT; y += 1) {
    const normalizedY = y / SCENE_HEIGHT;
    for (let x = 0; x < SCENE_WIDTH; x += 1) {
      const normalizedX = x / SCENE_WIDTH;
      const offset = (y * SCENE_WIDTH + x) * 3;

      const ceiling =
        gaussian(normalizedX, normalizedY, 0.48, 0.08, 0.42, 0.11) +
        gaussian(normalizedX, normalizedY, 0.86, 0.09, 0.22, 0.1);
      const televisionWall = gaussian(normalizedX, normalizedY, 0.84, 0.42, 0.18, 0.2);
      const shelving = gaussian(normalizedX, normalizedY, 0.96, 0.38, 0.08, 0.28);
      const dining = gaussian(normalizedX, normalizedY, 0.1, 0.34, 0.12, 0.2);
      const furnitureBounce = gaussian(normalizedX, normalizedY, 0.5, 0.62, 0.42, 0.28);
      const localLight = Math.min(1.6, ceiling * 0.42 + televisionWall * 0.5 + shelving * 0.3 + dining * 0.22);
      const amount = intensity * daylightFactor * (0.055 + localLight * 0.27 + furnitureBounce * 0.055);

      const red = clamp(output[offset] * exposureGain);
      const green = clamp(output[offset + 1] * exposureGain);
      const blue = clamp(output[offset + 2] * exposureGain);

      output[offset] = clamp(red + (255 - red) * amount * 0.9);
      output[offset + 1] = clamp(green + (188 - green) * amount * 0.58);
      output[offset + 2] = clamp(blue + (110 - blue) * amount * 0.18 - amount * 4);
    }
  }

  return sharp(output, {
    raw: { width: SCENE_WIDTH, height: SCENE_HEIGHT, channels: 3 },
  }).png().toBuffer();
}

async function writeResponsiveScene(buffer, baseName) {
  for (const width of [960, 1440]) {
    const pipeline = sharp(buffer).resize({ width, withoutEnlargement: true, fit: "inside" });
    await Promise.all([
      pipeline.clone().webp({ quality: 82, effort: 5 }).toFile(join(outputDir, `${baseName}-${width}.webp`)),
      pipeline.clone().avif({ quality: 61, effort: 5 }).toFile(join(outputDir, `${baseName}-${width}.avif`)),
    ]);
  }
}

async function buildLightingFrames() {
  for (const ambience of ["night", "day"]) {
    const sourcePath = join(sourceDir, `room-${ambience}-clean.png`);
    await stat(sourcePath);
    const base = await normalizeScene(sourcePath);

    for (const step of LIGHT_STEPS) {
      const frame = await renderLightingFrame(base, step, ambience);
      const suffix = String(step).padStart(3, "0");
      await writeResponsiveScene(frame, `room-${ambience}-${suffix}`);
    }
  }
}

async function cropAndTrim(path, extract) {
  const cropped = await sharp(path).extract(extract).png().toBuffer();
  return sharp(cropped).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function buildCurtainFrames() {
  const sourcePath = join(sourceDir, "curtain-pair-alpha.png");
  const sourceMetadata = await sharp(sourcePath).metadata();
  const leftWidth = Math.floor(sourceMetadata.width / 2);
  const rightWidth = sourceMetadata.width - leftWidth;
  const leftPanel = await cropAndTrim(sourcePath, {
    left: 0,
    top: 0,
    width: leftWidth,
    height: sourceMetadata.height,
  });
  const rightPanel = await cropAndTrim(sourcePath, {
    left: leftWidth,
    top: 0,
    width: rightWidth,
    height: sourceMetadata.height,
  });
  const leftMetadata = await sharp(leftPanel).metadata();
  const rightMetadata = await sharp(rightPanel).metadata();

  for (const step of CURTAIN_STEPS) {
    const openRatio = step / 100;
    const targetWidth = Math.round(WINDOW.width * (0.5 - openRatio * 0.385));
    const leftCropWidth = Math.max(1, Math.round(leftMetadata.width * (1 - openRatio * 0.76)));
    const rightCropWidth = Math.max(1, Math.round(rightMetadata.width * (1 - openRatio * 0.76)));

    const leftFrame = await sharp(leftPanel)
      .extract({ left: 0, top: 0, width: leftCropWidth, height: leftMetadata.height })
      .resize(targetWidth, WINDOW.height, { fit: "fill" })
      .png()
      .toBuffer();
    const rightFrame = await sharp(rightPanel)
      .extract({
        left: rightMetadata.width - rightCropWidth,
        top: 0,
        width: rightCropWidth,
        height: rightMetadata.height,
      })
      .resize(targetWidth, WINDOW.height, { fit: "fill" })
      .png()
      .toBuffer();

    const canvas = sharp({
      create: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });
    const composed = await canvas
      .composite([
        { input: leftFrame, left: WINDOW.left, top: WINDOW.top },
        { input: rightFrame, left: WINDOW.left + WINDOW.width - targetWidth, top: WINDOW.top },
      ])
      .png()
      .toBuffer();
    const { data } = await sharp(composed)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const occlusionPoints = [
      [WINDOW.left, 498],
      [582, 481],
      [655, 469],
      [735, 478],
      [812, 516],
      [850, WINDOW.top + WINDOW.height],
    ];
    for (let point = 0; point < occlusionPoints.length - 1; point += 1) {
      const [startX, startY] = occlusionPoints[point];
      const [endX, endY] = occlusionPoints[point + 1];
      for (let x = startX; x <= endX; x += 1) {
        const progress = (x - startX) / Math.max(1, endX - startX);
        const cutoff = Math.round(startY + (endY - startY) * progress);
        for (let y = cutoff; y < WINDOW.top + WINDOW.height; y += 1) {
          data[(y * SCENE_WIDTH + x) * 4 + 3] = 0;
        }
      }
    }

    await sharp(data, {
      raw: { width: SCENE_WIDTH, height: SCENE_HEIGHT, channels: 4 },
    })
      .webp({ quality: 88, alphaQuality: 100, effort: 5 })
      .toFile(join(outputDir, `curtain-${String(step).padStart(3, "0")}.webp`));
  }
}

async function buildAcAssets() {
  const sourcePath = join(sourceDir, "ac-sprite-alpha.png");
  const metadata = await sharp(sourcePath).metadata();
  const halfWidth = Math.floor(metadata.width / 2);
  const states = [
    ["off", { left: 0, top: 0, width: halfWidth, height: metadata.height }],
    ["on", { left: halfWidth, top: 0, width: metadata.width - halfWidth, height: metadata.height }],
  ];

  for (const [name, extract] of states) {
    const state = await cropAndTrim(sourcePath, extract);
    await sharp(state)
      .resize({ width: 620, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 90, alphaQuality: 100, effort: 5 })
      .toFile(join(outputDir, `ac-${name}.webp`));
  }
}

async function makeTransparentSquare(input, contentSize, canvasSize) {
  const padding = Math.floor((canvasSize - contentSize) / 2);
  const content = await sharp(input)
    .ensureAlpha()
    .resize({
      width: contentSize,
      height: contentSize,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: content, left: padding, top: padding }])
    .png()
    .toBuffer();
}

async function assertTransparentEdges(input, label) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];

  for (let x = 0; x < info.width; x += 1) {
    if (alphaAt(x, 0) !== 0 || alphaAt(x, info.height - 1) !== 0) {
      throw new Error(`${label} has opaque pixels on its horizontal edges.`);
    }
  }
  for (let y = 0; y < info.height; y += 1) {
    if (alphaAt(0, y) !== 0 || alphaAt(info.width - 1, y) !== 0) {
      throw new Error(`${label} has opaque pixels on its vertical edges.`);
    }
  }
}

async function writeTransparentFanPart(input, name) {
  const encoded = await sharp(input)
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toBuffer();
  await assertTransparentEdges(encoded, name);
  await writeFile(join(outputDir, `fan-${name}.webp`), encoded);
}

async function buildFanAssets() {
  const sourcePath = join(sourceDir, "fan-parts-alpha.png");
  const metadata = await sharp(sourcePath).metadata();
  const third = Math.floor(metadata.width / 3);
  const body = await cropAndTrim(sourcePath, { left: 0, top: 0, width: third, height: metadata.height });
  const rotor = await cropAndTrim(sourcePath, { left: third, top: 0, width: third, height: metadata.height });
  const grille = await cropAndTrim(sourcePath, {
    left: third * 2,
    top: 0,
    width: metadata.width - third * 2,
    height: metadata.height,
  });

  const canvas = { width: 500, height: 900 };
  const bodyImage = await sharp(body).resize({ height: 860, fit: "inside" }).png().toBuffer();
  const bodyMetadata = await sharp(bodyImage).metadata();
  const rotorImage = await makeTransparentSquare(rotor, 288, 292);
  const grilleImage = await makeTransparentSquare(grille, 312, 316);

  await sharp({
    create: {
      ...canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: bodyImage,
        left: Math.round((canvas.width - bodyMetadata.width) / 2),
        top: 20,
      },
    ])
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toFile(join(outputDir, "fan-body.webp"));

  await Promise.all([
    writeTransparentFanPart(rotorImage, "rotor"),
    writeTransparentFanPart(grilleImage, "grille"),
  ]);

  const shadow = Buffer.alloc(500 * 150 * 4);
  for (let y = 0; y < 150; y += 1) {
    for (let x = 0; x < 500; x += 1) {
      const normalizedX = (x - 250) / 205;
      const normalizedY = (y - 75) / 42;
      const alpha = Math.round(112 * Math.exp(-(normalizedX * normalizedX + normalizedY * normalizedY) * 2.2));
      const offset = (y * 500 + x) * 4;
      shadow[offset] = 8;
      shadow[offset + 1] = 6;
      shadow[offset + 2] = 5;
      shadow[offset + 3] = alpha;
    }
  }
  await sharp(shadow, { raw: { width: 500, height: 150, channels: 4 } })
    .webp({ quality: 80, alphaQuality: 100, effort: 5 })
    .toFile(join(outputDir, "fan-shadow.webp"));
}

await buildLightingFrames();
await buildCurtainFrames();
await buildAcAssets();
await buildFanAssets();

console.log(`Control-room v2 assets built in ${outputDir}`);
