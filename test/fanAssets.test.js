import assert from "node:assert/strict";
import { test } from "node:test";
import { join, resolve } from "node:path";

import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const assetDir = join(root, "public", "assets", "control-room-v2");

async function readRgba(name) {
  return sharp(join(assetDir, name))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function edgeAlphaValues(data, info) {
  const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];
  const values = [];

  for (let x = 0; x < info.width; x += 1) {
    values.push(alphaAt(x, 0), alphaAt(x, info.height - 1));
  }
  for (let y = 0; y < info.height; y += 1) {
    values.push(alphaAt(0, y), alphaAt(info.width - 1, y));
  }

  return values;
}

test("fan rotor and grille are square assets with transparent edges", async () => {
  const definitions = [
    ["fan-rotor.webp", 292],
    ["fan-grille.webp", 316],
  ];

  for (const [name, expectedSize] of definitions) {
    const { data, info } = await readRgba(name);
    assert.equal(info.width, expectedSize, `${name} width`);
    assert.equal(info.height, expectedSize, `${name} height`);
    assert.equal(Math.max(...edgeAlphaValues(data, info)), 0, `${name} edge alpha`);
  }
});
