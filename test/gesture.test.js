import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { appState, resetState } from "../js/state.js";
import { handleGestureResult } from "../js/gesture.js";
import { clearLogs } from "../js/logger.js";

beforeEach(() => {
  resetState();
  clearLogs();
});

test("Thumb_Up gesture executes the home scene", () => {
  handleGestureResult("fist");
  const result = handleGestureResult("Thumb_Up");

  assert.equal(result, true);
  assert.equal(appState.gesture.latestCode, "Thumb_Up");
  assert.equal(appState.gesture.lastAction, "scene:home");
  assert.equal(appState.devices.light.status, true);
  assert.equal(appState.devices.light.levelValue, 82);
  assert.equal(appState.devices.airConditioner.status, true);
  assert.equal(appState.devices.airConditioner.levelValue, 26);
  assert.equal(appState.devices.fan.status, true);
  assert.equal(appState.devices.fan.levelValue, 3);
  assert.equal(appState.devices.curtain.status, true);
  assert.equal(appState.devices.curtain.levelValue, 70);
});

test("Thumb_Down gesture executes the away scene", () => {
  const result = handleGestureResult("Thumb_Down", { source: "camera", confidence: 0.91, stableMs: 650 });

  assert.equal(result, true);
  assert.equal(appState.gesture.latestCode, "Thumb_Down");
  assert.equal(appState.gesture.confidence, 0.91);
  assert.equal(appState.gesture.stableMs, 650);
  assert.equal(appState.gesture.lastAction, "scene:away");

  for (const device of Object.values(appState.devices)) {
    assert.equal(device.status, false);
  }
});

test("unknown gesture is rejected", () => {
  const result = handleGestureResult("Unknown_Gesture");
  assert.equal(result, false);
  assert.equal(appState.logs.at(-1).type, "error");
});
