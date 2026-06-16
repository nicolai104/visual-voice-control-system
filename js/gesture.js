import { appState } from "./state.js";
import { gestureMap } from "./commands.js";
import { addLog } from "./logger.js";
import { markDirty } from "./scheduler.js";
import { applyAllDevicesMinimumOff, applyAllDevicesOn, executeCommand, executeScene } from "./controller.js";
import { updateGestureDiagnostics } from "./diagnostics.js";

let clearGestureTimer = null;

export function handleGestureResult(gestureCode, options = {}) {
  const { source = "gesture", confidence = null, stableMs = 0 } = options;
  const gesture = gestureMap[gestureCode];

  if (!gesture) {
    addLog(`手势识别失败：未知手势 ${gestureCode}`, "error");
    markDirty("full");
    return false;
  }

  appState.gesture.latestGesture = gesture.label;
  appState.gesture.latestCode = gestureCode;
  appState.gesture.latestTime = new Date();
  appState.gesture.confidence = confidence;
  appState.gesture.stableMs = stableMs;
  appState.gesture.lastAction =
    gesture.actionType || (gesture.scene ? `scene:${gesture.scene}` : `${gesture.command?.device || ""}:${gesture.command?.action || ""}`);
  appState.activeGesture = gestureCode;

  const sourceText = source === "camera" ? "摄像头" : "模拟";
  const confidenceText = confidence === null ? "" : `，置信度 ${(confidence * 100).toFixed(0)}%`;
  addLog(`手势识别结果：${gesture.label}（${sourceText}${confidenceText}）`, "info");
  addLog(`手势映射：${gesture.description}`, "info");

  const result = executeGestureAction(gesture, source);

  const timerApi = globalThis.window || globalThis;
  timerApi.clearTimeout(clearGestureTimer);
  clearGestureTimer = timerApi.setTimeout(() => {
    appState.activeGesture = "";
    markDirty("full");
  }, 1400);
  if (typeof clearGestureTimer?.unref === "function") clearGestureTimer.unref();

  return result;
}

export function updateGestureObservation(payload) {
  appState.gesture.latestGesture = payload.label || payload.gesture || "未检测到手势";
  appState.gesture.latestCode = payload.gesture || "";
  appState.gesture.latestTime = new Date();
  appState.gesture.confidence = typeof payload.confidence === "number" ? payload.confidence : null;
  appState.gesture.stableMs = payload.stableMs || 0;
  appState.gesture.serviceMessage = getObservationMessage(payload);
  markDirty("full");
}

export function updateGestureServiceStatus(status, message) {
  appState.gesture.serviceStatus = status;
  appState.gesture.serviceMessage = message;
  updateGestureDiagnostics({ status, message, render: false });
  markDirty("full");
}

function executeGestureAction(gesture, source) {
  if (gesture.scene) {
    return executeScene(gesture.scene, source);
  }

  if (gesture.actionType === "all_on") {
    return applyAllDevicesOn(source);
  }

  if (gesture.actionType === "all_minimum_off") {
    return applyAllDevicesMinimumOff(source);
  }

  if (!gesture.command) {
    addLog("手势映射失败：缺少可执行动作", "error");
    markDirty("full");
    return false;
  }

  return executeCommand(gesture.command, source);
}

function getObservationMessage(payload) {
  if (payload.status === "cooldown") return "冷却中，暂不重复触发";
  if (payload.status === "stabilizing") return `稳定识别中：${payload.stableMs || 0}ms`;
  if (payload.status === "low_confidence") return "置信度不足，未执行控制";
  if (payload.status === "no_hand") return "未检测到有效手势";
  if (payload.status === "triggered") return "手势已触发控制";
  return payload.message || "摄像头识别中";
}
