import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { appState, resetState } from "../js/state.js";
import { updateDeviceLevel } from "../js/controller.js";

beforeEach(() => resetState());

// --- A5 / H2: air conditioner is a setpoint device ---------------------------

test("H2: adjusting AC slider does NOT force it back on when it is off", () => {
  // AC is off but keeps its setpoint.
  appState.devices.airConditioner.status = false;

  const result = updateDeviceLevel("airConditioner", 22, { render: false, log: false });

  assert.equal(result.value, 22, "setpoint should update");
  assert.equal(result.status, false, "AC must stay OFF after a slider adjustment (was the bug)");
  assert.equal(appState.devices.airConditioner.status, false);
});

test("AC slider preserves ON state when it is on", () => {
  appState.devices.airConditioner.status = true;
  const result = updateDeviceLevel("airConditioner", 18, { render: false, log: false });
  assert.equal(result.value, 18);
  assert.equal(result.status, true, "AC stays ON when adjusted while on");
});

test("AC at its minimum setpoint (16) is still controllable as off", () => {
  appState.devices.airConditioner.status = false;
  const result = updateDeviceLevel("airConditioner", 16, { render: false, log: false });
  assert.equal(result.value, 16);
  assert.equal(result.status, false, "16°C does not mean 'on' for a setpoint device");
});

// --- power devices keep deriving status from level ---------------------------

test("light slider to 0 turns it off (power model)", () => {
  appState.devices.light.status = true;
  const result = updateDeviceLevel("light", 0, { render: false, log: false });
  assert.equal(result.value, 0);
  assert.equal(result.status, false, "light at min is off");
});

test("light slider above min turns it on (power model)", () => {
  appState.devices.light.status = false;
  const result = updateDeviceLevel("light", 40, { render: false, log: false });
  assert.equal(result.value, 40);
  assert.equal(result.status, true, "light above min is on");
});

test("fan slider to 0 turns it off (power model)", () => {
  appState.devices.fan.status = true;
  const result = updateDeviceLevel("fan", 0, { render: false, log: false });
  assert.equal(result.status, false);
});
