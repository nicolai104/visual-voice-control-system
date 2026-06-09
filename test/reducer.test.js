import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { reduceCommand, clampToSettings } from "../js/reducer.js";
import { appState, resetState, LEVEL_SETTINGS } from "../js/state.js";

let devices;
beforeEach(() => {
  resetState();
  devices = appState.devices;
});

// --- purity ------------------------------------------------------------------

test("reduceCommand does not mutate the input devices map", () => {
  const before = JSON.parse(JSON.stringify(devices));
  reduceCommand(devices, { device: "light", action: "off" });
  assert.deepEqual(devices, before, "input must be untouched (pure reducer)");
});

test("reduceCommand returns a new devices object", () => {
  const { devices: next } = reduceCommand(devices, { device: "light", action: "off" });
  assert.notEqual(next, devices);
  assert.notEqual(next.light, devices.light);
});

// --- on / off / toggle (power devices) --------------------------------------

test("turning a light off drops level to min and reports change", () => {
  const { devices: next, changes } = reduceCommand(devices, { device: "light", action: "off" });
  assert.equal(next.light.status, false);
  assert.equal(next.light.levelValue, LEVEL_SETTINGS.light.min);
  assert.equal(changes[0].changed, true);
  assert.equal(changes[0].action, "off");
});

test("turning an off light on restores defaultOn", () => {
  devices.light.status = false;
  devices.light.levelValue = 0;
  const { devices: next } = reduceCommand(devices, { device: "light", action: "on" });
  assert.equal(next.light.status, true);
  assert.equal(next.light.levelValue, LEVEL_SETTINGS.light.defaultOn);
});

test("toggle flips power", () => {
  const onState = reduceCommand(devices, { device: "fan", action: "toggle" });
  assert.equal(onState.devices.fan.status, false, "fan starts on, toggle -> off");
});

test("no-op command reports changed:false", () => {
  devices.light.status = false;
  devices.light.levelValue = 0;
  const { changes } = reduceCommand(devices, { device: "light", action: "off" });
  assert.equal(changes[0].changed, false);
});

// --- set (level) -------------------------------------------------------------

test("set clamps and snaps to settings", () => {
  const { devices: next } = reduceCommand(devices, { device: "light", action: "set", value: 999 });
  assert.equal(next.light.levelValue, LEVEL_SETTINGS.light.max);
});

test("set on AC keeps power state independent (H2)", () => {
  devices.airConditioner.status = false;
  const { devices: next } = reduceCommand(devices, { device: "airConditioner", action: "set", value: 20 });
  assert.equal(next.airConditioner.levelValue, 20);
  assert.equal(next.airConditioner.status, false, "AC stays off when setpoint changes");
});

// --- all on / off ------------------------------------------------------------

test("all off drives every device to min and off (incl. AC at 16)", () => {
  const { devices: next, changes } = reduceCommand(devices, { device: "all", action: "off" });
  for (const key of Object.keys(next)) {
    assert.equal(next[key].status, false, `${key} should be off`);
    assert.equal(next[key].levelValue, LEVEL_SETTINGS[key].min, `${key} should be at min`);
  }
  assert.equal(changes.length, Object.keys(devices).length);
});

test("M2: all on preserves existing levels (consistent with single-on)", () => {
  // Light already on at a custom brightness; all-on must NOT reset it to defaultOn.
  devices.light.status = true;
  devices.light.levelValue = 30;
  devices.fan.status = false;
  devices.fan.levelValue = 0;
  const { devices: next } = reduceCommand(devices, { device: "all", action: "on" });
  assert.equal(next.light.levelValue, 30, "already-on light keeps its brightness");
  assert.equal(next.fan.status, true, "off fan turns on");
  assert.equal(next.fan.levelValue, LEVEL_SETTINGS.fan.defaultOn);
});

// --- unknown device ----------------------------------------------------------

test("unknown device is flagged as missing", () => {
  const { changes } = reduceCommand(devices, { device: "doesNotExist", action: "on" });
  assert.equal(changes[0].missing, true);
});

// --- clampToSettings ---------------------------------------------------------

test("clampToSettings handles non-finite input", () => {
  const s = LEVEL_SETTINGS.light;
  assert.equal(clampToSettings("abc", s), s.defaultOn);
  assert.equal(clampToSettings(-5, s), s.min);
  assert.equal(clampToSettings(1000, s), s.max);
});
