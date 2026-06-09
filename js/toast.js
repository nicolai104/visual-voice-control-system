import { subscribeLog } from "./logger.js";

// Ephemeral toast notifications, driven by the log event stream (subscribeLog).
// Runs entirely outside the state/render pipeline — never calls markDirty.

// Only these log types surface as toasts; info/system are too chatty
// (the controller emits ~2 info lines per command).
const TOAST_TYPES = new Set(["success", "warning", "error"]);

const DISMISS_MS = { success: 3000, warning: 3000, error: 5000 };
const DEDUPE_MS = 800;
const MAX_VISIBLE = 3;

const LABELS = { success: "成功", warning: "提示", error: "错误" };

let stack = null;
const live = []; // { node, timer }
let lastSig = "";
let lastAt = 0;

export function initToasts() {
  stack = document.getElementById("toastStack");
  if (!stack) return;
  subscribeLog(handleLogEntry);
}

function handleLogEntry(entry) {
  if (!stack || !TOAST_TYPES.has(entry.type)) return;

  // De-dupe identical message+type fired in quick succession (e.g. a slider
  // drag that repeatedly logs the same state).
  const sig = `${entry.type}:${entry.message}`;
  const now = Date.now();
  if (sig === lastSig && now - lastAt < DEDUPE_MS) return;
  lastSig = sig;
  lastAt = now;

  showToast(entry.type, entry.message);
}

function showToast(type, message) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");

  const badge = document.createElement("span");
  badge.className = "toast-badge";
  badge.textContent = LABELS[type] || "提示";

  const text = document.createElement("span");
  text.className = "toast-text";
  text.textContent = message; // textContent — no XSS

  toast.append(badge, text);
  stack.appendChild(toast);

  // Trigger the enter transition on the next frame.
  requestAnimationFrame(() => toast.classList.add("toast-in"));

  const record = { node: toast, timer: 0 };
  record.timer = setTimeout(() => dismiss(record), DISMISS_MS[type] || 3000);
  live.push(record);

  // FIFO eviction when the stack overflows.
  while (live.length > MAX_VISIBLE) {
    dismiss(live[0]);
  }
}

function dismiss(record) {
  const index = live.indexOf(record);
  if (index === -1) return;
  live.splice(index, 1);
  clearTimeout(record.timer);

  record.node.classList.remove("toast-in");
  record.node.classList.add("toast-out");
  setTimeout(() => record.node.remove(), 260);
}
