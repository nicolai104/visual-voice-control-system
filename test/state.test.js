import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEVICE_CATALOG,
  DEVICE_ORDER,
  DEVICE_BY_KEY,
  LEVEL_SETTINGS,
  STATUS_MODELS,
  appState,
  resetState,
  getDevice,
} from "../js/state.js";

test("DEVICE_ORDER is derived from the catalog in order", () => {
  assert.deepEqual(DEVICE_ORDER, DEVICE_CATALOG.map((d) => d.key));
});

test("LEVEL_SETTINGS is derived for every catalog device", () => {
  for (const device of DEVICE_CATALOG) {
    const s = LEVEL_SETTINGS[device.key];
    assert.ok(s, `missing settings for ${device.key}`);
    assert.equal(s.min, device.level.min);
    assert.equal(s.max, device.level.max);
    assert.equal(s.step, device.level.step);
    assert.equal(s.defaultOn, device.level.defaultOn);
  }
});

test("STATUS_MODELS only contains known models", () => {
  for (const key of DEVICE_ORDER) {
    assert.ok(["power", "setpoint"].includes(STATUS_MODELS[key]), `bad statusModel for ${key}`);
  }
});

test("air conditioner uses the setpoint model, others use power", () => {
  assert.equal(STATUS_MODELS.airConditioner, "setpoint");
  assert.equal(STATUS_MODELS.light, "power");
  assert.equal(STATUS_MODELS.fan, "power");
  assert.equal(STATUS_MODELS.curtain, "power");
});

test("DEVICE_BY_KEY indexes the catalog", () => {
  for (const device of DEVICE_CATALOG) {
    assert.equal(DEVICE_BY_KEY[device.key].name, device.name);
  }
});

test("initial devices are built from the catalog with statusModel attached", () => {
  for (const device of DEVICE_CATALOG) {
    const live = getDevice(device.key);
    assert.ok(live, `device ${device.key} missing from appState`);
    assert.equal(live.name, device.name);
    assert.equal(live.statusModel, device.statusModel);
    assert.equal(live.levelValue, device.level.defaultOn);
    assert.equal(live.levelUnit, device.level.unit);
    assert.equal(live.level, undefined, "redundant level sub-object should be gone");
  }
});

test("resetState restores catalog defaults", () => {
  appState.devices.light.levelValue = 5;
  appState.devices.light.status = false;
  resetState();
  assert.equal(appState.devices.light.levelValue, 80);
  assert.equal(appState.devices.light.status, true);
});
