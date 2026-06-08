import { appState } from "./state.js";

const MAX_LOGS = 80;

export function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function addLog(message, type = "info") {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date(),
    type,
    message,
  };

  appState.logs.push(entry);

  if (appState.logs.length > MAX_LOGS) {
    appState.logs.splice(0, appState.logs.length - MAX_LOGS);
  }

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
