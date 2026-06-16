import { appState } from "./state.js";
import { markDirty } from "./scheduler.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function buildFrontendDiagnostics({
  locationRef = globalThis.location,
  navigatorRef = globalThis.navigator,
  secureContext = globalThis.isSecureContext,
} = {}) {
  const protocol = locationRef?.protocol || "";
  const hostname = locationRef?.hostname || "";
  const origin = locationRef?.origin || "未知来源";
  const isLocalhost = LOCAL_HOSTS.has(hostname);
  const browser = detectBrowser(navigatorRef?.userAgent || "");

  return {
    status: isLocalhost ? "ok" : "warning",
    title: isLocalhost ? "本地前端服务正常" : "建议通过 localhost 访问",
    meta: `${origin} · ${browser} · ${secureContext ? "安全上下文" : protocol || "未知协议"}`,
    updatedAt: new Date(),
  };
}

export function detectBrowser(userAgent) {
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/Chrome\//.test(userAgent) && !/Edg\//.test(userAgent)) return "Chrome";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari";
  return "未知浏览器";
}

export function initDiagnostics() {
  appState.diagnostics.frontend = buildFrontendDiagnostics();
  updateGestureDiagnostics({
    status: appState.gesture.serviceStatus,
    url: appState.gesture.serviceUrl,
    message: appState.gesture.serviceMessage,
    render: false,
  });
  updateVoiceprintDiagnostics({ render: false });
  refreshMicrophonePermission();
}

export async function refreshMicrophonePermission() {
  const permissions = globalThis.navigator?.permissions;
  if (!permissions?.query) {
    updateSpeechDiagnostics({ permission: "unknown", render: true });
    return "unknown";
  }

  try {
    const status = await permissions.query({ name: "microphone" });
    updateSpeechDiagnostics({ permission: status.state, render: true });
    status.onchange = () => updateSpeechDiagnostics({ permission: status.state, render: true });
    return status.state;
  } catch {
    updateSpeechDiagnostics({ permission: "unknown", render: true });
    return "unknown";
  }
}

export function updateSpeechDiagnostics({
  supported,
  interimSupported,
  permission,
  error,
  render = true,
} = {}) {
  const speech = appState.diagnostics.speech;
  if (typeof supported === "boolean") speech.supported = supported;
  if (typeof interimSupported === "boolean") speech.interimSupported = interimSupported;
  if (permission) speech.permission = permission;
  if (typeof error === "string") speech.latestError = error;

  const permissionText = permissionLabel(speech.permission);
  speech.status = speech.supported ? (speech.latestError ? "warning" : "ok") : "error";
  speech.title = speech.supported ? "浏览器录音能力可用" : "浏览器不支持语音录音";
  speech.meta =
    speech.latestError ||
    `麦克风权限：${permissionText} · 临时字幕：${speech.interimSupported ? "可用" : "不可用"}`;
  speech.updatedAt = new Date();

  if (render) markDirty("full");
}

export function updateGestureDiagnostics({
  status = appState.gesture.serviceStatus,
  url = appState.gesture.serviceUrl,
  message = appState.gesture.serviceMessage,
  render = true,
} = {}) {
  const gesture = appState.diagnostics.gestureService;
  gesture.status = normalizeStatus(status);
  gesture.title = gestureTitle(gesture.status);
  gesture.meta = message || "等待摄像头识别服务状态";
  gesture.url = url || gesture.url;
  gesture.updatedAt = new Date();
  if (render) markDirty("full");
}

export function updateVoiceprintDiagnostics({ render = true } = {}) {
  const voiceprint = appState.voiceprint;
  const target = appState.diagnostics.voiceprint;

  target.enrolled = voiceprint.enrolled;
  target.confidence = voiceprint.confidence;
  target.status = voiceprint.mode;
  target.title = voiceprintTitle(voiceprint);
  target.meta = voiceprint.lastMessage || voiceprintMeta(voiceprint);
  target.updatedAt = voiceprint.latestTime || new Date();

  if (render) markDirty("full");
}

export function updateSelfCheckDiagnostics(report, { render = true } = {}) {
  const selfCheck = appState.diagnostics.selfCheck;
  if (!report) {
    selfCheck.status = "not_run";
    selfCheck.title = "尚未运行自检";
    selfCheck.meta = "点击运行交互自检生成报告";
    selfCheck.passed = 0;
    selfCheck.total = 0;
    selfCheck.failures = [];
    selfCheck.items = [];
    selfCheck.latestTime = null;
  } else {
    const failures = report.items.filter((item) => item.status === "fail");
    selfCheck.status = failures.length ? "fail" : "pass";
    selfCheck.title = failures.length ? "自检发现异常" : "自检全部通过";
    selfCheck.meta = `${report.passed}/${report.total} 通过`;
    selfCheck.passed = report.passed;
    selfCheck.total = report.total;
    selfCheck.failures = failures.map((item) => item.name);
    selfCheck.items = report.items;
    selfCheck.latestTime = report.finishedAt;
  }
  if (render) markDirty("full");
}

export function setSelfCheckRunning({ render = true } = {}) {
  const selfCheck = appState.diagnostics.selfCheck;
  selfCheck.status = "running";
  selfCheck.title = "自检运行中";
  selfCheck.meta = "正在执行核心交互路径";
  selfCheck.items = [];
  selfCheck.failures = [];
  selfCheck.latestTime = new Date();
  if (render) markDirty("full");
}

function permissionLabel(permission) {
  const labels = {
    granted: "已授权",
    denied: "已拒绝",
    prompt: "待询问",
    unknown: "未知",
  };
  return labels[permission] || "未知";
}

function normalizeStatus(status) {
  if (status === "connected") return "ok";
  if (status === "connecting") return "warning";
  if (status === "error") return "error";
  return "warning";
}

function gestureTitle(status) {
  if (status === "ok") return "摄像头识别服务已连接";
  if (status === "error") return "摄像头识别服务异常";
  return "摄像头识别服务未就绪";
}

function voiceprintTitle(voiceprint) {
  if (voiceprint.mode === "error") return "声纹服务异常";
  if (voiceprint.mode === "enrolling") return "声纹录入中";
  if (voiceprint.mode === "pending" && voiceprint.enrolled) return "声纹已录入";
  if (!voiceprint.enrolled) return "声纹样本未录入";
  if (voiceprint.mode === "authorized") return "声纹验证通过";
  if (voiceprint.mode === "rejected") return "声纹验证失败";
  return "声纹等待验证";
}

function voiceprintMeta(voiceprint) {
  if (!voiceprint.enrolled) return "请先录入固定演示短句";
  if (voiceprint.confidence === null) return "已录入，每条语音指令都会重新验证";
  return `相似度 ${voiceprint.confidence}% · 阈值 ${Math.round(voiceprint.threshold * 100)}%`;
}
