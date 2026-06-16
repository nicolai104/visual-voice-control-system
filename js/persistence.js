import { appState, DEVICE_ORDER, LEVEL_SETTINGS } from "./state.js";
import { clampToSettings } from "./reducer.js";
import { readStored, removeStored, writeStored } from "./storage.js";

const DEVICE_STATE_KEY = "vvcs-device-state";
const VOICEPRINT_STATE_KEY = "vvcs-voiceprint-state";

export function restoreDeviceState() {
  const saved = readStored(DEVICE_STATE_KEY);
  if (!saved) return false;

  try {
    const parsed = JSON.parse(saved);
    for (const key of DEVICE_ORDER) {
      const savedDevice = parsed[key];
      const device = appState.devices[key];
      const settings = LEVEL_SETTINGS[key];
      if (!savedDevice || !device || !settings) continue;
      if (typeof savedDevice.status === "boolean") device.status = savedDevice.status;
      if ("levelValue" in savedDevice) {
        device.levelValue = clampToSettings(savedDevice.levelValue, settings);
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function persistDeviceState() {
  const snapshot = {};
  for (const key of DEVICE_ORDER) {
    const device = appState.devices[key];
    snapshot[key] = {
      status: device.status,
      levelValue: device.levelValue,
    };
  }
  writeStored(DEVICE_STATE_KEY, JSON.stringify(snapshot));
}

export function restoreVoiceprintState() {
  removeStored(VOICEPRINT_STATE_KEY);
  return false;
}

export function persistVoiceprintState() {
  removeStored(VOICEPRINT_STATE_KEY);
}
