// Single source of truth for every device.
//
// statusModel:
//   "power"    — power is derived from the level (value at `min` == off).
//                Used by light / fan / curtain, where the lowest level means off.
//   "setpoint" — power is an independent switch; the level is a setpoint that
//                never represents "off" (e.g. AC 16°C is the coldest setting,
//                not the off state). Used by the air conditioner.
export const DEVICE_CATALOG = [
  {
    key: "light",
    name: "客厅灯",
    shortName: "灯光",
    icon: "light",
    statusModel: "power",
    defaultStatus: true,
    level: { label: "亮度", unit: "%", min: 0, max: 100, step: 1, defaultOn: 80 },
  },
  {
    key: "airConditioner",
    name: "空调",
    shortName: "空调",
    icon: "ac",
    statusModel: "setpoint",
    defaultStatus: true,
    level: { label: "温度", unit: "°C", min: 16, max: 30, step: 1, defaultOn: 26 },
  },
  {
    key: "fan",
    name: "风扇",
    shortName: "风扇",
    icon: "fan",
    statusModel: "power",
    defaultStatus: true,
    level: { label: "风速", unit: "档", min: 0, max: 10, step: 1, defaultOn: 4 },
  },
  {
    key: "curtain",
    name: "窗帘",
    shortName: "窗帘",
    icon: "curtain",
    statusModel: "power",
    defaultStatus: true,
    level: { label: "开合度", unit: "%", min: 0, max: 100, step: 1, defaultOn: 60 },
  },
];

// Everything below is derived from DEVICE_CATALOG so a new device only needs a
// single catalog entry (plus its room art in index.html and its icon glyph).
export const DEVICE_ORDER = DEVICE_CATALOG.map((device) => device.key);

export const DEVICE_BY_KEY = Object.fromEntries(
  DEVICE_CATALOG.map((device) => [device.key, device])
);

export const LEVEL_SETTINGS = Object.fromEntries(
  DEVICE_CATALOG.map(({ key, level }) => [
    key,
    { min: level.min, max: level.max, step: level.step, defaultOn: level.defaultOn },
  ])
);

export const STATUS_MODELS = Object.fromEntries(
  DEVICE_CATALOG.map((device) => [device.key, device.statusModel])
);

export const GESTURE_SERVICE_DEFAULT_URL = "ws://127.0.0.1:8765/ws/gesture";

export const VOICEPRINT_SAMPLE_PHRASE = "打开客厅灯并关闭风扇";

export const SCENE_PRESETS = {
  home: {
    label: "回家",
    description: "明亮客厅、舒适温度、轻柔通风",
    commands: [
      { device: "light", action: "set", value: 82 },
      { device: "airConditioner", action: "on" },
      { device: "airConditioner", action: "set", value: 26 },
      { device: "fan", action: "set", value: 3 },
      { device: "curtain", action: "set", value: 70 },
    ],
  },
  away: {
    label: "离家",
    description: "全屋关闭至低功耗状态",
    commands: [{ device: "all", action: "off" }],
  },
  sleep: {
    label: "睡眠",
    description: "低亮度、弱风、窗帘关闭",
    commands: [
      { device: "light", action: "set", value: 18 },
      { device: "airConditioner", action: "on" },
      { device: "airConditioner", action: "set", value: 27 },
      { device: "fan", action: "set", value: 2 },
      { device: "curtain", action: "set", value: 0 },
    ],
  },
  ventilate: {
    label: "通风",
    description: "关闭空调、打开窗帘并提升风速",
    commands: [
      { device: "airConditioner", action: "off" },
      { device: "curtain", action: "set", value: 100 },
      { device: "fan", action: "set", value: 6 },
      { device: "light", action: "set", value: 55 },
    ],
  },
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

function createDevice(device) {
  return {
    name: device.name,
    shortName: device.shortName,
    icon: device.icon,
    statusModel: device.statusModel,
    status: device.defaultStatus,
    levelLabel: device.level.label,
    levelValue: device.level.defaultOn,
    levelUnit: device.level.unit,
  };
}

function cloneDevices() {
  return Object.fromEntries(DEVICE_CATALOG.map((device) => [device.key, createDevice(device)]));
}

function createDiagnostics() {
  return {
    frontend: {
      status: "unknown",
      title: "前端环境待检测",
      meta: "等待页面初始化",
      updatedAt: null,
    },
    speech: {
      status: "unknown",
      title: "语音能力待检测",
      meta: "等待浏览器能力检测",
      permission: "unknown",
      supported: false,
      latestError: "",
      updatedAt: null,
    },
    gestureService: {
      status: "disconnected",
      title: "摄像头识别未连接",
      meta: "启动 Python 服务后连接 WebSocket",
      url: GESTURE_SERVICE_DEFAULT_URL,
      repairSteps: [
        "python -m pip install -r requirements.txt",
        "python scripts/download_gesture_model.py",
        "python gesture_service.py --self-check",
        "确认摄像头未被其他程序占用",
      ],
      updatedAt: null,
    },
    voiceprint: {
      status: "not_enrolled",
      title: "声纹样本未录入",
      meta: "请先录入固定演示短句",
      enrolled: false,
      confidence: null,
      updatedAt: null,
    },
    selfCheck: {
      status: "not_run",
      title: "尚未运行自检",
      meta: "点击运行交互自检生成报告",
      passed: 0,
      total: 0,
      failures: [],
      items: [],
      latestTime: null,
    },
  };
}

export const appState = {
  runtimeStatus: "运行中",
  currentRoom: "客厅",
  ambiance: "night",
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
    serviceUrl: GESTURE_SERVICE_DEFAULT_URL,
    lastAction: "",
    stableMs: 0,
  },
  voiceprint: {
    authorized: true,
    enrolled: false,
    mode: "not_enrolled",
    verified: false,
    confidence: null,
    samplePhrase: VOICEPRINT_SAMPLE_PHRASE,
    sampleSummary: "",
    lastMessage: "请先录入声纹样本",
    latestTime: null,
  },
  logs: [],
  logFilter: {
    type: "all",
    source: "all",
  },
  diagnostics: createDiagnostics(),
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
  appState.gesture.serviceUrl = GESTURE_SERVICE_DEFAULT_URL;
  appState.gesture.lastAction = "";
  appState.gesture.stableMs = 0;
  appState.voiceprint.authorized = true;
  appState.voiceprint.enrolled = false;
  appState.voiceprint.mode = "not_enrolled";
  appState.voiceprint.verified = false;
  appState.voiceprint.confidence = null;
  appState.voiceprint.samplePhrase = VOICEPRINT_SAMPLE_PHRASE;
  appState.voiceprint.sampleSummary = "";
  appState.voiceprint.lastMessage = "请先录入声纹样本";
  appState.voiceprint.latestTime = null;
  appState.logFilter = { type: "all", source: "all" };
  appState.diagnostics = createDiagnostics();
  appState.activeGesture = "";
}

export function getDevice(deviceKey) {
  return appState.devices[deviceKey] || null;
}
