import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CURTAIN_FRAME_STEPS,
  LIGHT_FRAME_STEPS,
  curtainFramePath,
  formatFrameStep,
  getFrameBlend,
  roomFramePath,
} from "../js/sceneFrames.js";

test("getFrameBlend interpolates between adjacent light frames", () => {
  assert.deepEqual(getFrameBlend(37, LIGHT_FRAME_STEPS), {
    current: 25,
    next: 50,
    mix: 0.48,
  });
});

test("getFrameBlend clamps values to the available range", () => {
  assert.deepEqual(getFrameBlend(-10, LIGHT_FRAME_STEPS), {
    current: 0,
    next: 0,
    mix: 0,
  });
  assert.deepEqual(getFrameBlend(140, LIGHT_FRAME_STEPS), {
    current: 100,
    next: 100,
    mix: 0,
  });
});

test("getFrameBlend chooses the nearest frame for reduced motion", () => {
  assert.deepEqual(getFrameBlend(62, LIGHT_FRAME_STEPS, true), {
    current: 50,
    next: 50,
    mix: 0,
  });
});

test("curtain frames use eleven stable keyframe steps", () => {
  assert.equal(CURTAIN_FRAME_STEPS.length, 11);
  assert.deepEqual(getFrameBlend(55, CURTAIN_FRAME_STEPS), {
    current: 50,
    next: 60,
    mix: 0.5,
  });
});

test("frame path helpers produce versioned control-room asset URLs", () => {
  assert.equal(formatFrameStep(5), "005");
  assert.equal(roomFramePath("night", 50), "/assets/control-room-v2/room-night-050-1440.webp");
  assert.equal(curtainFramePath(100), "/assets/control-room-v2/curtain-100.webp");
});
