import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { appState, resetState } from "../js/state.js";
import { executeScene } from "../js/controller.js";

beforeEach(() => resetState());

test("scene mode applies a batch of device commands", () => {
  const result = executeScene("sleep", "test");
  assert.equal(result, true);
  assert.equal(appState.devices.light.levelValue, 18);
  assert.equal(appState.devices.airConditioner.status, true);
  assert.equal(appState.devices.airConditioner.levelValue, 27);
  assert.equal(appState.devices.fan.levelValue, 2);
  assert.equal(appState.devices.curtain.status, false);
});

test("away scene turns every device off", () => {
  executeScene("away", "test");
  for (const device of Object.values(appState.devices)) {
    assert.equal(device.status, false);
  }
});

test("unknown scene is rejected", () => {
  assert.equal(executeScene("missing", "test"), false);
});
