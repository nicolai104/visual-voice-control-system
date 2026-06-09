import { appState, DEVICE_ORDER, LEVEL_SETTINGS, VOICEPRINT_SAMPLE_PHRASE } from "./state.js";
import { clampToSettings } from "./reducer.js";
import { readStored, writeStored } from "./storage.js";

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
  const saved = readStored(VOICEPRINT_STATE_KEY);
  if (!saved) return false;

  try {
    const parsed = JSON.parse(saved);
    appState.voiceprint.authorized = parsed.authorized !== false;
    appState.voiceprint.enrolled = Boolean(parsed.enrolled);
    appState.voiceprint.mode = isVoiceprintMode(parsed.mode) ? parsed.mode : "not_enrolled";
    appState.voiceprint.verified = Boolean(parsed.verified);
    appState.voiceprint.confidence =
      typeof parsed.confidence === "number" ? Math.round(parsed.confidence) : null;
    appState.voiceprint.samplePhrase = VOICEPRINT_SAMPLE_PHRASE;
    appState.voiceprint.sampleSummary = typeof parsed.sampleSummary === "string" ? parsed.sampleSummary : "";
    appState.voiceprint.lastMessage =
      typeof parsed.lastMessage === "string" ? parsed.lastMessage : "声纹状态已恢复";
    appState.voiceprint.latestTime = parsed.latestTime ? new Date(parsed.latestTime) : null;
    return true;
  } catch {
    return false;
  }
}

export function persistVoiceprintState() {
  const voiceprint = appState.voiceprint;
  writeStored(
    VOICEPRINT_STATE_KEY,
    JSON.stringify({
      authorized: voiceprint.authorized,
      enrolled: voiceprint.enrolled,
      mode: voiceprint.mode,
      verified: voiceprint.verified,
      confidence: voiceprint.confidence,
      sampleSummary: voiceprint.sampleSummary,
      lastMessage: voiceprint.lastMessage,
      latestTime: voiceprint.latestTime ? voiceprint.latestTime.toISOString() : null,
    })
  );
}

function isVoiceprintMode(mode) {
  return mode === "not_enrolled" || mode === "authorized" || mode === "rejected";
}
