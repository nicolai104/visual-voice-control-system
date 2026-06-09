import { appState } from "./state.js";
import { addLog } from "./logger.js";
import { markDirty } from "./scheduler.js";
import { handleGestureResult, updateGestureObservation, updateGestureServiceStatus } from "./gesture.js";
import { updateGestureDiagnostics } from "./diagnostics.js";

let gestureSocket = null;
let connectionHadError = false;

export function startCameraGestureRecognition(url = appState.gesture.serviceUrl) {
  const targetUrl = String(url || appState.gesture.serviceUrl).trim() || appState.gesture.serviceUrl;
  if (gestureSocket && gestureSocket.readyState === WebSocket.OPEN) {
    addLog("摄像头识别服务已连接", "warning");
    markDirty("full");
    return false;
  }

  if (!("WebSocket" in window)) {
    updateGestureServiceStatus("error", "当前浏览器不支持 WebSocket");
    addLog("摄像头识别连接失败：浏览器不支持 WebSocket", "error");
    return false;
  }

  appState.gesture.serviceUrl = targetUrl;
  connectionHadError = false;
  updateGestureDiagnostics({ status: "connecting", url: targetUrl, message: "正在连接摄像头识别服务...", render: false });
  updateGestureServiceStatus("connecting", "正在连接摄像头识别服务...");
  addLog(`正在连接摄像头识别服务：${targetUrl}`, "info");

  gestureSocket = new WebSocket(targetUrl);

  gestureSocket.addEventListener("open", () => {
    updateGestureServiceStatus("connected", "摄像头识别服务已连接，等待手势");
    addLog("摄像头识别服务已连接", "success");
  });

  gestureSocket.addEventListener("message", (event) => {
    handleGestureSocketMessage(event.data);
  });

  gestureSocket.addEventListener("close", () => {
    if (connectionHadError) {
      updateGestureServiceStatus("error", getConnectionHelp());
      addLog("摄像头识别服务连接未建立，请按诊断面板步骤排查", "warning");
    } else {
      updateGestureServiceStatus("disconnected", "摄像头识别服务未连接");
      addLog("摄像头识别服务已断开", "warning");
    }
  });

  gestureSocket.addEventListener("error", () => {
    connectionHadError = true;
    updateGestureServiceStatus("error", getConnectionHelp());
    addLog("摄像头识别服务连接失败：请按诊断面板步骤检查 Python 服务、模型文件与摄像头占用", "error");
  });

  return true;
}

export function stopCameraGestureRecognition() {
  if (!gestureSocket) {
    updateGestureServiceStatus("disconnected", "摄像头识别服务未连接");
    addLog("摄像头识别服务未连接", "warning");
    return false;
  }

  gestureSocket.close();
  gestureSocket = null;
  connectionHadError = false;
  updateGestureServiceStatus("disconnected", "摄像头识别服务已停止");
  addLog("已停止前端摄像头识别连接", "info");
  return true;
}

function handleGestureSocketMessage(rawMessage) {
  let payload;

  try {
    payload = JSON.parse(rawMessage);
  } catch (error) {
    addLog(`摄像头识别消息解析失败：${error.message}`, "error");
    return;
  }

  if (payload.type === "status") {
    const status = payload.state === "camera_opened" || payload.state === "connected" ? "connected" : "disconnected";
    updateGestureServiceStatus(status, payload.message || "摄像头识别状态更新");
    addLog(`摄像头识别状态：${payload.message || payload.state}`, "info");
    return;
  }

  if (payload.type === "warning") {
    updateGestureServiceStatus("connected", payload.message || "摄像头识别警告");
    addLog(`摄像头识别警告：${payload.message}`, "warning");
    return;
  }

  if (payload.type === "error") {
    updateGestureServiceStatus("error", payload.message || "摄像头识别错误");
    addLog(`摄像头识别错误：${payload.message}`, "error");
    return;
  }

  if (payload.type === "observation") {
    updateGestureObservation(payload);
    return;
  }

  if (payload.type === "trigger") {
    appState.gesture.serviceMessage = `${payload.label} 已触发：${payload.action}`;
    handleGestureResult(payload.gesture, {
      source: "camera",
      confidence: payload.confidence,
      stableMs: payload.stableMs,
    });
    return;
  }

  addLog(`收到未知摄像头识别消息：${payload.type}`, "warning");
}

function getConnectionHelp() {
  return "连接失败：先运行 python -m pip install -r requirements.txt，再运行 python scripts/download_gesture_model.py 和 python gesture_service.py --self-check";
}
