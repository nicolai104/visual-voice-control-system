import { appState, DEVICE_ORDER, LEVEL_SETTINGS, getDevice } from "./state.js";
import { parseCommand } from "./commands.js";
import { addLog } from "./logger.js";
import { renderApp, renderDeviceRuntimeState } from "./renderer.js";
import { canExecuteVoiceCommand } from "./voiceprint.js";

const actionLabels = {
  on: "开启",
  off: "关闭",
  toggle: "切换",
  all_on: "补充开启",
  all_minimum_off: "关闭至最低状态",
};

const sourceLabels = {
  gui: "GUI",
  voice: "语音",
  gesture: "手势",
  camera: "摄像头手势",
  text: "文本",
  test: "自检",
  system: "系统",
};

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
    renderApp();
    return false;
  }

  addLog(`${sourceLabel}解析：${parsed.inputText} → ${parsed.command.device} / ${parsed.command.action}`, "info");
  return executeCommand(parsed.command, source);
}

export function executeCommand(command, source = "gui") {
  const sourceLabel = getSourceLabel(source);

  if (!command || !command.device || !command.action) {
    addLog(`${sourceLabel}控制失败：命令结构不完整`, "error");
    renderApp();
    return false;
  }

  if (source === "voice" && !canExecuteVoiceCommand()) {
    addLog("非授权用户，已拒绝控制", "error");
    renderApp();
    return false;
  }

  if (command.device === "all") {
    if (command.action === "on") {
      return applyAllDevicesOn(source);
    }

    if (command.action === "off") {
      return applyAllDevicesMinimumOff(source);
    }

    const changed = DEVICE_ORDER.map((deviceKey) =>
      updateDeviceState(deviceKey, command.action)
    ).filter(Boolean);

    if (changed.length === 0) {
      addLog(`重复操作：全部设备已处于${actionLabels[command.action] || command.action}状态`, "warning");
      renderApp();
      return false;
    }

    addLog(`指令执行成功：all → ${command.action}`, "success");
    addLog(`设备状态更新：${changed.map((item) => item.name).join("、")} 已${actionLabels[command.action]}`, "info");
    renderApp();
    return true;
  }

  const changed = updateDeviceState(command.device, command.action);

  if (!changed) {
    const device = getDevice(command.device);
    const targetAction = resolveTargetAction(device, command.action);
    const deviceName = device?.name || command.device;
    addLog(`重复操作：${deviceName} 已处于${targetAction === "on" ? "开启" : "关闭"}状态`, "warning");
    renderApp();
    return false;
  }

  addLog(`指令执行成功：${command.device} → ${changed.action}`, "success");
  addLog(`设备状态更新：${changed.name} 已${changed.action === "on" ? "开启" : "关闭"}`, "info");
  renderApp();
  return true;
}

export function updateDeviceState(deviceKey, action) {
  const device = getDevice(deviceKey);
  if (!device) {
    addLog(`设备不存在或未注册：${deviceKey}`, "error");
    return null;
  }

  const targetAction = resolveTargetAction(device, action);
  const targetStatus = targetAction === "on";
  const previousStatus = device.status;
  const previousLevel = device.levelValue;

  device.status = targetStatus;

  if (targetStatus) {
    ensureActiveLevel(deviceKey, device);
  } else {
    applyOffLevel(deviceKey, device);
  }

  if (previousStatus === device.status && previousLevel === device.levelValue) {
    return null;
  }

  return {
    key: deviceKey,
    name: device.name,
    action: targetAction,
  };
}

export function handleManualDeviceCommand(deviceKey, action) {
  executeCommand({ device: deviceKey, action }, "gui");
}

export function applyAllDevicesOn(source = "gesture", options = {}) {
  const { render = true } = options;
  const changed = [];

  DEVICE_ORDER.forEach((deviceKey) => {
    const device = getDevice(deviceKey);
    const settings = LEVEL_SETTINGS[deviceKey];
    if (!device || !settings || device.status) return;

    device.status = true;
    device.levelValue = settings.defaultOn;
    changed.push(device.name);
  });

  if (changed.length === 0) {
    addLog(`${getSourceLabel(source)}动作：所有设备已开启，状态保持不变`, "warning");
    if (render) renderApp();
    return false;
  }

  addLog(`${getSourceLabel(source)}动作：全部设备补充开启`, "success");
  addLog(`设备状态更新：${changed.join("、")} 已恢复默认开启值`, "info");
  if (render) renderApp();
  return true;
}

export function applyAllDevicesMinimumOff(source = "gesture", options = {}) {
  const { render = true } = options;
  const changed = [];

  DEVICE_ORDER.forEach((deviceKey) => {
    const device = getDevice(deviceKey);
    const settings = LEVEL_SETTINGS[deviceKey];
    if (!device || !settings) return;

    const targetLevel = settings.min;
    const needsChange = device.status || device.levelValue !== targetLevel;

    device.status = false;
    device.levelValue = targetLevel;

    if (needsChange) {
      changed.push(device.name);
    }
  });

  if (changed.length === 0) {
    addLog(`${getSourceLabel(source)}动作：所有设备已关闭或处于最低状态，状态保持不变`, "warning");
    if (render) renderApp();
    return false;
  }

  addLog(`${getSourceLabel(source)}动作：全部设备关闭至最低状态`, "success");
  addLog(`设备状态更新：${changed.join("、")} 已关闭或降至最低值`, "info");
  if (render) renderApp();
  return true;
}

export function updateDeviceLevel(deviceKey, rawValue, options = {}) {
  const { render = true, log = false, source = "gui" } = options;
  const device = getDevice(deviceKey);
  const settings = LEVEL_SETTINGS[deviceKey];

  if (!device || !settings) {
    addLog(`设备不存在或未注册：${deviceKey}`, "error");
    if (render) renderApp();
    return null;
  }

  const value = clampToSettings(rawValue, settings);
  const previousValue = device.levelValue;
  const previousStatus = device.status;

  device.levelValue = value;
  device.status = resolveStatusFromLevel(deviceKey, value);

  const changed = previousValue !== device.levelValue || previousStatus !== device.status;

  if (log && changed) {
    const statusText = device.status ? "开启" : "关闭";
    addLog(
      `${getSourceLabel(source)}调节：${device.name} ${device.levelLabel} ${device.levelValue}${device.levelUnit}，状态${statusText}`,
      "info"
    );
  }

  if (render) {
    renderDeviceRuntimeState();
  }

  return {
    key: deviceKey,
    name: device.name,
    value: device.levelValue,
    status: device.status,
    changed,
  };
}

function resolveTargetAction(device, action) {
  if (action === "toggle") {
    return device?.status ? "off" : "on";
  }

  return action;
}

function ensureActiveLevel(deviceKey, device) {
  const settings = LEVEL_SETTINGS[deviceKey];
  if (!settings) return;

  if (deviceKey === "airConditioner") {
    device.levelValue = clampToSettings(device.levelValue || settings.defaultOn, settings);
    return;
  }

  if (device.levelValue <= settings.min) {
    device.levelValue = settings.defaultOn;
  }
}

function applyOffLevel(deviceKey, device) {
  const settings = LEVEL_SETTINGS[deviceKey];
  if (!settings) return;

  if (deviceKey === "airConditioner") {
    device.levelValue = clampToSettings(device.levelValue || settings.defaultOn, settings);
    return;
  }

  device.levelValue = settings.min;
}

function resolveStatusFromLevel(deviceKey, value) {
  const settings = LEVEL_SETTINGS[deviceKey];

  if (deviceKey === "airConditioner") {
    return true;
  }

  return value > settings.min;
}

function clampToSettings(rawValue, settings) {
  const numericValue = Number(rawValue);
  const safeValue = Number.isFinite(numericValue) ? numericValue : settings.defaultOn;
  const clampedValue = Math.min(settings.max, Math.max(settings.min, safeValue));
  return Math.round(clampedValue / settings.step) * settings.step;
}

function getSourceLabel(source) {
  return sourceLabels[source] || source;
}
