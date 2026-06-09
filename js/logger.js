import { appState } from "./state.js";

const MAX_LOGS = 80;

// Subscribers are notified for every appended log entry. Used by the toast
// layer (js/toast.js) to surface ephemeral feedback. Kept dependency-free so
// node --test never auto-subscribes — tests stay unaffected.
const subscribers = new Set();

export function subscribeLog(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function addLog(message, type = "info", options = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date(),
    type,
    message,
    source: options.source || inferLogSource(message, type),
  };

  appState.logs.push(entry);

  if (appState.logs.length > MAX_LOGS) {
    appState.logs.splice(0, appState.logs.length - MAX_LOGS);
  }

  subscribers.forEach((listener) => listener(entry));

  return entry;
}

export function clearLogs() {
  appState.logs.length = 0;
}

export function logTypeLabel(type) {
  const labels = {
    info: "INFO",
    success: "SUCCESS",
    warning: "WARN",
    error: "ERROR",
    system: "SYS",
  };

  return labels[type] || "INFO";
}

export function logSourceLabel(source) {
  const labels = {
    gui: "GUI",
    voice: "语音",
    gesture: "手势",
    camera: "摄像头",
    text: "文本",
    system: "系统",
    test: "自检",
    unknown: "其他",
  };
  return labels[source] || labels.unknown;
}

function inferLogSource(message, type) {
  if (type === "system") return "system";
  if (/自检|测试/.test(message)) return "test";
  if (/摄像头/.test(message)) return "camera";
  if (/语音|声纹|授权用户|未授权用户/.test(message)) return "voice";
  if (/手势|掌|拳/.test(message)) return "gesture";
  if (/文本/.test(message)) return "text";
  if (/GUI|设备状态更新|指令执行成功|场景|调节/.test(message)) return "gui";
  return "unknown";
}
