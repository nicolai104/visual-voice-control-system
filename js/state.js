export const DEVICE_ORDER = ["light", "airConditioner", "fan", "curtain"];

export const LEVEL_SETTINGS = {
  light: { min: 0, max: 100, step: 1, defaultOn: 80 },
  airConditioner: { min: 16, max: 30, step: 1, defaultOn: 26 },
  fan: { min: 0, max: 10, step: 1, defaultOn: 4 },
  curtain: { min: 0, max: 100, step: 1, defaultOn: 60 },
};

export const SOURCE_LABELS = {
  gui: "GUI",
  voice: "语音",
  gesture: "手势",
  camera: "摄像头手势",
  text: "文本",
  system: "系统",
  test: "自检",
};

const initialDevices = {
  light: {
    name: "客厅灯",
    shortName: "灯光",
    icon: "light",
    status: true,
    levelLabel: "亮度",
    levelValue: 80,
    levelUnit: "%",
  },
  airConditioner: {
    name: "空调",
    shortName: "空调",
    icon: "ac",
    status: true,
    levelLabel: "温度",
    levelValue: 26,
    levelUnit: "°C",
  },
  fan: {
    name: "风扇",
    shortName: "风扇",
    icon: "fan",
    status: true,
    levelLabel: "风速",
    levelValue: 4,
    levelUnit: "档",
  },
  curtain: {
    name: "窗帘",
    shortName: "窗帘",
    icon: "curtain",
    status: true,
    levelLabel: "开合度",
    levelValue: 60,
    levelUnit: "%",
  },
};

function cloneDevices() {
  return Object.fromEntries(
    Object.entries(initialDevices).map(([key, value]) => [
      key,
      { ...value, level: { ...LEVEL_SETTINGS[key] } },
    ])
  );
}

export const appState = {
  runtimeStatus: "运行中",
  currentRoom: "客厅",
  devices: cloneDevices(),
  voice: {
    isListening: false,
    isSupported: false,
    recognition: null,
    latestText: "暂无语音输入",
    latestConfidence: null,
    latestTime: null,
    lastError: "",
  },
  gesture: {
    latestGesture: "暂无手势",
    latestCode: "",
    latestTime: null,
    confidence: null,
    serviceStatus: "disconnected",
    serviceMessage: "摄像头识别服务未连接",
    lastAction: "",
    stableMs: 0,
  },
  voiceprint: {
    authorized: true,
    verified: true,
    confidence: 96,
    latestTime: null,
  },
  logs: [],
  activeGesture: "",
};

export function resetState() {
  appState.devices = cloneDevices();
  appState.runtimeStatus = "运行中";
  appState.voice.isListening = false;
  appState.voice.latestText = "暂无语音输入";
  appState.voice.latestConfidence = null;
  appState.voice.latestTime = null;
  appState.voice.lastError = "";
  appState.gesture.latestGesture = "暂无手势";
  appState.gesture.latestCode = "";
  appState.gesture.latestTime = null;
  appState.gesture.confidence = null;
  appState.gesture.serviceStatus = "disconnected";
  appState.gesture.serviceMessage = "摄像头识别服务未连接";
  appState.gesture.lastAction = "";
  appState.gesture.stableMs = 0;
  appState.voiceprint.authorized = true;
  appState.voiceprint.verified = true;
  appState.voiceprint.confidence = 96;
  appState.voiceprint.latestTime = new Date();
  appState.activeGesture = "";
}

export function getDevice(deviceKey) {
  return appState.devices[deviceKey] || null;
}
