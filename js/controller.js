import { appState, SOURCE_LABELS, LEVEL_SETTINGS, SCENE_PRESETS, getDevice } from "./state.js";
import { parseCommand } from "./commands.js";
import { reduceCommand, clampToSettings } from "./reducer.js";
import { addLog } from "./logger.js";
import { markDirty } from "./scheduler.js";
import { authorizeCommand } from "./policy.js";
import { persistDeviceState, persistVoiceprintState } from "./persistence.js";
import { updateVoiceprintDiagnostics } from "./diagnostics.js";

function getSourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

// --- Text / voice entry point ------------------------------------------------

export function executeTextCommand(inputText, source = "text") {
  const sourceLabel = getSourceLabel(source);

  if (source === "voice") {
    appState.voice.latestText = inputText || "未识别到有效语音";
    appState.voice.latestConfidence = inputText ? 98 : null;
    appState.voice.latestTime = new Date();
  }

  const parsed = parseCommand(inputText);
  if (!parsed.ok) {
    const type = parsed.errorType === "empty" ? "warning" : "error";
    addLog(`${sourceLabel}输入异常：${parsed.message}`, type);
    markDirty("full");
    return false;
  }

  const decision = authorizeCommand(source);
  syncVoicePolicyDiagnostics(source);
  if (!decision.allowed) {
    addLog(decision.message || "已拒绝控制", "error");
    markDirty("full");
    return false;
  }

  if (parsed.command.action === "set") {
    addLog(
      `${sourceLabel}解析：${parsed.inputText} → ${parsed.command.device} / 设为 ${parsed.command.value}`,
      "info"
    );
    const result = updateDeviceLevel(parsed.command.device, parsed.command.value, {
      source,
      render: true,
      log: true,
    });
    return Boolean(result && result.changed);
  }

  addLog(`${sourceLabel}解析：${parsed.inputText} → ${parsed.command.device} / ${parsed.command.action}`, "info");
  return executeCommand(parsed.command, source);
}

// --- Unified command dispatch (thin shell over the pure reducer) -------------

export function executeCommand(command, source = "gui") {
  const sourceLabel = getSourceLabel(source);

  if (!command || !command.device || !command.action) {
    addLog(`${sourceLabel}控制失败：命令结构不完整`, "error");
    markDirty("full");
    return false;
  }

  const decision = authorizeCommand(source);
  syncVoicePolicyDiagnostics(source);
  if (!decision.allowed) {
    addLog(decision.message || "已拒绝控制", "error");
    markDirty("full");
    return false;
  }

  const { devices, changes } = reduceCommand(appState.devices, command);

  const missing = changes.find((change) => change.missing);
  if (missing) {
    addLog(`设备不存在或未注册：${missing.key}`, "error");
    markDirty("full");
    return false;
  }

  const applied = changes.filter((change) => change.changed);
  appState.devices = devices;
  if (applied.length > 0) persistDeviceState();

  if (command.device === "all") {
    return logAllResult(command, applied, source);
  }
  return logSingleResult(changes[0], applied, source);
}

function logAllResult(command, applied, source) {
  const verb = command.action === "off" ? "关闭至最低状态" : "补充开启";

  if (applied.length === 0) {
    addLog(`${getSourceLabel(source)}动作：所有设备已处于目标状态，状态保持不变`, "warning");
    markDirty("full");
    return false;
  }

  addLog(`指令执行成功：all → ${command.action}`, "success");
  addLog(`设备状态更新：${applied.map((c) => c.name).join("、")} 已${verb}`, "info");
  markDirty("full");
  return true;
}

function logSingleResult(change, applied, source) {
  if (applied.length === 0) {
    const device = getDevice(change.key);
    const statusText = device?.status ? "开启" : "关闭";
    addLog(`重复操作：${device?.name || change.key} 已处于${statusText}状态`, "warning");
    markDirty("full");
    return false;
  }

  const statusText = change.action === "on" ? "开启" : "关闭";
  addLog(`指令执行成功：${change.key} → ${change.action}`, "success");
  addLog(`设备状态更新：${change.name} 已${statusText}`, "info");
  markDirty("full");
  return true;
}

export function handleManualDeviceCommand(deviceKey, action) {
  executeCommand({ device: deviceKey, action }, "gui");
}

// Convenience wrappers kept for the gesture layer's existing call sites.
export function applyAllDevicesOn(source = "gesture") {
  return executeCommand({ device: "all", action: "on" }, source);
}

export function applyAllDevicesMinimumOff(source = "gesture") {
  return executeCommand({ device: "all", action: "off" }, source);
}

export function executeScene(sceneKey, source = "gui") {
  const sourceLabel = getSourceLabel(source);
  const scene = SCENE_PRESETS[sceneKey];

  if (!scene) {
    addLog(`${sourceLabel}场景失败：未知场景 ${sceneKey}`, "error");
    markDirty("full");
    return false;
  }

  const decision = authorizeCommand(source);
  syncVoicePolicyDiagnostics(source);
  if (!decision.allowed) {
    addLog(decision.message || "已拒绝控制", "error");
    markDirty("full");
    return false;
  }

  let nextDevices = appState.devices;
  const allChanges = [];
  for (const command of scene.commands) {
    const result = reduceCommand(nextDevices, command);
    nextDevices = result.devices;
    allChanges.push(...result.changes);
  }

  const missing = allChanges.find((change) => change.missing);
  if (missing) {
    addLog(`场景执行失败：设备不存在或未注册 ${missing.key}`, "error");
    markDirty("full");
    return false;
  }

  const applied = allChanges.filter((change) => change.changed);
  appState.devices = nextDevices;

  if (applied.length === 0) {
    addLog(`${sourceLabel}场景：${scene.label} 已处于目标状态`, "warning");
    markDirty("full");
    return false;
  }

  persistDeviceState();
  addLog(`${sourceLabel}场景执行成功：${scene.label}`, "success");
  addLog(`场景说明：${scene.description}`, "info");
  addLog(`设备状态更新：${[...new Set(applied.map((change) => change.name))].join("、")}`, "info");
  markDirty("full");
  return true;
}

// --- Level / setpoint dispatch ----------------------------------------------

export function updateDeviceLevel(deviceKey, rawValue, options = {}) {
  const { render = true, log = false, source = "gui" } = options;
  const settings = LEVEL_SETTINGS[deviceKey];
  const device = getDevice(deviceKey);

  if (!device || !settings) {
    addLog(`设备不存在或未注册：${deviceKey}`, "error");
    if (render) markDirty("full");
    return null;
  }

  const value = clampToSettings(rawValue, settings);
  const { devices, changes } = reduceCommand(appState.devices, {
    device: deviceKey,
    action: "set",
    value,
  });

  appState.devices = devices;
  const change = changes[0];
  const next = devices[deviceKey];
  const powerFlipped = device.status !== next.status;
  if (change.changed) persistDeviceState();

  if (log && change.changed) {
    const statusText = next.status ? "开启" : "关闭";
    addLog(
      `${getSourceLabel(source)}调节：${next.name} ${next.levelLabel} ${next.levelValue}${next.levelUnit}，状态${statusText}`,
      "info"
    );
  }

  if (render) {
    // M1: on slider RELEASE (log) that flips power (e.g. light dragged to 0%),
    // do a full render so the rest of the UI syncs. During an active drag
    // (no log) keep a lightweight runtime render so the dragged slider — which
    // may still hold focus — is not torn down and rebuilt.
    markDirty(log && powerFlipped ? "full" : "runtime");
  }

  return {
    key: deviceKey,
    name: next.name,
    value: next.levelValue,
    status: next.status,
    changed: change.changed,
  };
}

function syncVoicePolicyDiagnostics(source) {
  if (source !== "voice") return;
  persistVoiceprintState();
  updateVoiceprintDiagnostics({ render: false });
}
