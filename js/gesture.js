import { appState } from "./state.js";
import { gestureMap } from "./commands.js";
import { addLog } from "./logger.js";
import { renderApp } from "./renderer.js";
import { applyAllDevicesMinimumOff, applyAllDevicesOn, executeCommand } from "./controller.js";

let clearGestureTimer = null;

export function handleGestureResult(gestureCode, options = {}) {
  const { source = "gesture", confidence = null, stableMs = 0 } = options;
  const gesture = gestureMap[gestureCode];

  if (!gesture) {
    addLog(`手势识别失败：未知手势 ${gestureCode}`, "error");
    renderApp();
    return false;
  }

  appState.gesture.latestGesture = gesture.label;
  appState.gesture.latestCode = gestureCode;
  appState.gesture.latestTime = new Date();
  appState.gesture.confidence = confidence;
  appState.gesture.stableMs = stableMs;
  appState.gesture.lastAction = gesture.actionType || `${gesture.command?.device || ""}:${gesture.command?.action || ""}`;
  appState.activeGesture = gestureCode;

  const sourceText = source === "camera" ? "摄像头" : "模拟";
  const confidenceText = confidence === null ? "" : `，置信度 ${(confidence * 100).toFixed(0)}%`;
  addLog(`手势识别结果：${gesture.label}（${sourceText}${confidenceText}）`, "info");
  addLog(`手势映射：${gesture.description}`, "info");

  const result = executeGestureAction(gesture, source);

  window.clearTimeout(clearGestureTimer);
  clearGestureTimer = window.setTimeout(() => {
    appState.activeGesture = "";
    renderApp();
  }, 1400);

  return result;
}

export function updateGestureObservation(payload) {
  appState.gesture.latestGesture = payload.label || payload.gesture || "未检测到手势";
  appState.gesture.latestCode = payload.gesture || "";
  appState.gesture.latestTime = new Date();
  appState.gesture.confidence = typeof payload.confidence === "number" ? payload.confidence : null;
  appState.gesture.stableMs = payload.stableMs || 0;
  appState.gesture.serviceMessage = getObservationMessage(payload);
  renderApp();
}

export function updateGestureServiceStatus(status, message) {
  appState.gesture.serviceStatus = status;
  appState.gesture.serviceMessage = message;
  renderApp();
}

function executeGestureAction(gesture, source) {
  if (gesture.actionType === "all_on") {
    return applyAllDevicesOn(source);
  }

  if (gesture.actionType === "all_minimum_off") {
    return applyAllDevicesMinimumOff(source);
  }

  return executeCommand(gesture.command, "gesture");
}

function getObservationMessage(payload) {
  if (payload.status === "cooldown") return "冷却中，暂不重复触发";
  if (payload.status === "stabilizing") return `稳定识别中：${payload.stableMs || 0}ms`;
  if (payload.status === "low_confidence") return "置信度不足，未执行控制";
  if (payload.status === "no_hand") return "未检测到有效手势";
  if (payload.status === "triggered") return "手势已触发控制";
  return payload.message || "摄像头识别中";
}
