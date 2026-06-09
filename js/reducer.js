import { LEVEL_SETTINGS, STATUS_MODELS } from "./state.js";

// Pure device-state reducer.
//
// reduceCommand(devices, command) takes the current devices map and a command,
// and returns { devices: nextDevices, changes: [...] } WITHOUT mutating the
// input and WITHOUT any logging/rendering side effects. This is the single
// place where "what a command does to device state" is defined, so it can be
// unit-tested in isolation (see test/reducer.test.js).
//
// Supported commands:
//   { device: "<key>",  action: "on" | "off" | "toggle" }
//   { device: "<key>",  action: "set", value: <number> }
//   { device: "all",    action: "on" }   -> supplement-on each device
//   { device: "all",    action: "off" }  -> drive every device to its minimum + off

export function clampToSettings(rawValue, settings) {
  const numericValue = Number(rawValue);
  const safeValue = Number.isFinite(numericValue) ? numericValue : settings.defaultOn;
  const clampedValue = Math.min(settings.max, Math.max(settings.min, safeValue));
  return Math.round(clampedValue / settings.step) * settings.step;
}

function isSetpoint(statusModel) {
  return statusModel === "setpoint";
}

function resolveTargetAction(status, action) {
  if (action === "toggle") return status ? "off" : "on";
  return action;
}

function levelForPowerOn(device, settings, statusModel) {
  // Setpoint devices keep their setpoint when powered on; power devices that sit
  // at their minimum jump to the default-on level, otherwise keep their level.
  if (isSetpoint(statusModel)) {
    return clampToSettings(device.levelValue || settings.defaultOn, settings);
  }
  return device.levelValue <= settings.min ? settings.defaultOn : device.levelValue;
}

function levelForPowerOff(device, settings, statusModel) {
  // Setpoint devices keep their setpoint when powered off; power devices fall to
  // their minimum (which, for them, IS the off state).
  if (isSetpoint(statusModel)) {
    return clampToSettings(device.levelValue || settings.defaultOn, settings);
  }
  return settings.min;
}

function finalize(prev, next, action) {
  const changed = prev.status !== next.status || prev.levelValue !== next.levelValue;
  return { device: next, changed, action };
}

function reducePower(device, settings, statusModel, action) {
  const target = resolveTargetAction(device.status, action); // "on" | "off"
  const status = target === "on";
  const levelValue = status
    ? levelForPowerOn(device, settings, statusModel)
    : levelForPowerOff(device, settings, statusModel);
  return finalize(device, { ...device, status, levelValue }, target);
}

function reduceSet(device, settings, statusModel, value) {
  const levelValue = clampToSettings(value, settings);
  // A setpoint device's power is independent of the level (bug H2 fix): dragging
  // the AC temperature must not switch it on. Power devices derive on/off here.
  const status = isSetpoint(statusModel) ? device.status : levelValue > settings.min;
  return finalize(device, { ...device, status, levelValue }, "set");
}

function reduceMinimumOff(device, settings) {
  // Scene/panic off ("全部关闭" / fist gesture): force every device to its
  // minimum AND off. For the AC this means 16°C + off, matching the demo spec.
  return finalize(device, { ...device, status: false, levelValue: settings.min }, "off");
}

function reduceOne(key, device, command) {
  const settings = LEVEL_SETTINGS[key];
  const statusModel = STATUS_MODELS[key];

  if (command.action === "set") {
    return reduceSet(device, settings, statusModel, command.value);
  }
  if (command.device === "all" && command.action === "off") {
    return reduceMinimumOff(device, settings);
  }
  return reducePower(device, settings, statusModel, command.action);
}

export function reduceCommand(devices, command) {
  const next = { ...devices };
  const changes = [];
  const keys = command.device === "all" ? Object.keys(devices) : [command.device];

  for (const key of keys) {
    const device = devices[key];
    if (!device || !LEVEL_SETTINGS[key]) {
      changes.push({ key, missing: true, changed: false });
      continue;
    }
    const result = reduceOne(key, device, command);
    next[key] = result.device;
    changes.push({
      key,
      name: device.name,
      action: result.action,
      changed: result.changed,
      status: result.device.status,
      levelValue: result.device.levelValue,
    });
  }

  return { devices: next, changes };
}
