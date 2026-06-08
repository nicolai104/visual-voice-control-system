import { appState, DEVICE_ORDER, LEVEL_SETTINGS } from "./state.js";
import { formatTime, logTypeLabel } from "./logger.js";

const icons = {
  user: '<svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
  "user-off": '<svg viewBox="0 0 24 24"><path d="m3 3 18 18"/><path d="M20 21a8 8 0 0 0-11.2-7.3"/><path d="M7.6 7.6A4 4 0 0 0 12 11a4 4 0 0 0 3.7-5.5"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/><path d="M8 22h8"/></svg>',
  "mic-large": '<svg viewBox="0 0 24 24"><path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z"/><path d="M20 10v2a8 8 0 0 1-16 0v-2"/><path d="M12 20v2"/><path d="M8 22h8"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M10 11V5a2 2 0 1 1 4 0v6"/><path d="M14 10V4a2 2 0 1 1 4 0v9"/><path d="M18 11V7a2 2 0 1 1 4 0v6c0 5-3 8-8 8h-1a8 8 0 0 1-7-4L3.2 12a2.2 2.2 0 0 1 3.7-2.4L9 12"/><path d="M6 12V6a2 2 0 1 1 4 0v6"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.7V22a2 2 0 0 1-4 0v-.1a1.8 1.8 0 0 0-1.2-1.7 1.8 1.8 0 0 0-2 .4l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1H2a2 2 0 0 1 0-4h.1a1.8 1.8 0 0 0 1.7-1.2 1.8 1.8 0 0 0-.4-2l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.8 1.8 0 0 0 2 .4H8.3a1.8 1.8 0 0 0 1-1.7V2a2 2 0 0 1 4 0v.1a1.8 1.8 0 0 0 1.2 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.8 1.8 0 0 0-.4 2v.1a1.8 1.8 0 0 0 1.7 1H22a2 2 0 0 1 0 4h-.1a1.8 1.8 0 0 0-1.7 1.2Z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="m8 5 12 7-12 7V5Z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></svg>',
  power: '<svg viewBox="0 0 24 24"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>',
  thermo: '<svg viewBox="0 0 24 24"><path d="M14 14.8V5a4 4 0 0 0-8 0v9.8a6 6 0 1 0 8 0Z"/><path d="M10 8v7"/></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-5-7-13-7-13S5 10 5 15a7 7 0 0 0 7 7Z"/></svg>',
  test: '<svg viewBox="0 0 24 24"><path d="m4 17 5-5 4 4 7-8"/><path d="M4 4v17h17"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M14.5 5 12.8 3H7.2L5.5 5H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-6.5Z"/><circle cx="12" cy="13" r="4"/></svg>',
  light: '<svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.5 14a6 6 0 1 1 7 0c-.8.7-1.5 1.6-1.5 2.5h-5c0-.9-.7-1.8-1.5-2.5Z"/></svg>',
  ac: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="9" rx="2"/><path d="M7 18h.1"/><path d="M12 18h.1"/><path d="M17 18h.1"/><path d="M6 10h12"/></svg>',
  fan: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 9c1-5 7-5 7-1 0 3-4 4-7 4"/><path d="M14.6 13.5c4 3 1 8-2.4 6-2.6-1.5-.9-5 .2-7"/><path d="M9.6 13.3c-5 2-8-3-4.6-5 2.6-1.5 5 1.8 6.8 3.4"/></svg>',
  curtain: '<svg viewBox="0 0 24 24"><path d="M4 4h16"/><path d="M5 4v16"/><path d="M19 4v16"/><path d="M5 20h14"/><path d="M9 4v16"/><path d="M15 4v16"/><path d="M5 12h14"/></svg>',
};

let refs = null;

export function initRenderer() {
  refs = {
    runtimeStatus: document.getElementById("runtimeStatus"),
    identityStatus: document.getElementById("identityStatus"),
    voiceStatus: document.getElementById("voiceStatus"),
    gestureStatus: document.getElementById("gestureStatus"),
    currentTime: document.getElementById("currentTime"),
    voiceCaption: document.getElementById("voiceCaption"),
    verificationCard: document.getElementById("verificationCard"),
    verificationTitle: document.getElementById("verificationTitle"),
    verificationMeta: document.getElementById("verificationMeta"),
    authorizedButton: document.getElementById("authorizedButton"),
    unauthorizedButton: document.getElementById("unauthorizedButton"),
    manualDeviceList: document.getElementById("manualDeviceList"),
    deviceStatusList: document.getElementById("deviceStatusList"),
    latestVoiceText: document.getElementById("latestVoiceText"),
    latestVoiceMeta: document.getElementById("latestVoiceMeta"),
    latestVoiceTime: document.getElementById("latestVoiceTime"),
    latestGestureText: document.getElementById("latestGestureText"),
    latestGestureMeta: document.getElementById("latestGestureMeta"),
    latestGestureTime: document.getElementById("latestGestureTime"),
    gestureServiceTitle: document.getElementById("gestureServiceTitle"),
    gestureServiceMeta: document.getElementById("gestureServiceMeta"),
    gestureServiceDot: document.getElementById("gestureServiceDot"),
    latestVoiceprintText: document.getElementById("latestVoiceprintText"),
    latestVoiceprintMeta: document.getElementById("latestVoiceprintMeta"),
    latestVoiceprintTime: document.getElementById("latestVoiceprintTime"),
    logOutput: document.getElementById("logOutput"),
    lightLevel: document.getElementById("lightLevel"),
    curtainLevel: document.getElementById("curtainLevel"),
    acTemperature: document.getElementById("acTemperature"),
    fanLevel: document.getElementById("fanLevel"),
    temperatureValue: document.getElementById("temperatureValue"),
  };

  renderIconElements(document);
}

export function renderClock() {
  if (!refs?.currentTime) return;
  refs.currentTime.textContent = formatTime(new Date());
}

export function renderApp() {
  if (!refs) initRenderer();

  renderBodyFlags();
  applyDeviceVisualVariables();
  renderTopStatus();
  renderVoiceprint();
  renderDevices();
  renderResults();
  renderLogs();
  renderIconElements(document);
}

export function renderDeviceRuntimeState() {
  if (!refs) initRenderer();

  renderBodyFlags();
  applyDeviceVisualVariables();
  updateManualSliderDisplays();
  renderDeviceStatusList();
  renderSceneReadouts();
  renderResults();
  renderLogs();
  renderIconElements(document);
}

function renderBodyFlags() {
  document.body.dataset.voiceListening = String(appState.voice.isListening);
  document.body.dataset.light = appState.devices.light.status ? "on" : "off";
  document.body.dataset.airConditioner = appState.devices.airConditioner.status ? "on" : "off";
  document.body.dataset.fan = appState.devices.fan.status ? "on" : "off";
  document.body.dataset.curtain = appState.devices.curtain.status ? "on" : "off";
}

function applyDeviceVisualVariables() {
  const root = document.documentElement;
  const light = appState.devices.light;
  const fan = appState.devices.fan;
  const curtain = appState.devices.curtain;

  const lightIntensity = light.status ? light.levelValue / 100 : 0;
  root.style.setProperty("--light-glow-opacity", (lightIntensity * 0.98).toFixed(2));
  root.style.setProperty("--room-side-light", (0.06 + lightIntensity * 0.28).toFixed(2));
  root.style.setProperty("--room-ceiling-light", (0.06 + lightIntensity * 0.38).toFixed(2));
  root.style.setProperty("--light-panel-brightness", (0.58 + lightIntensity * 0.62).toFixed(2));
  root.style.setProperty("--light-panel-shadow", `${Math.round(10 + lightIntensity * 48)}px`);

  const curtainRatio = curtain.status ? curtain.levelValue / 100 : 0;
  const curtainTravel = Math.round(curtainRatio * 36);
  const curtainScale = (1 - curtainRatio * 0.42).toFixed(2);
  root.style.setProperty("--curtain-left-transform", `translateX(-${curtainTravel}%) scaleX(${curtainScale})`);
  root.style.setProperty("--curtain-right-transform", `translateX(${curtainTravel}%) scaleX(${curtainScale})`);

  const fanLevel = fan.status ? fan.levelValue : 0;
  const fanDuration = Math.max(0.22, 1.35 - fanLevel * 0.105);
  root.style.setProperty("--fan-spin-duration", `${fanDuration.toFixed(2)}s`);
  root.style.setProperty("--fan-ring-opacity", fanLevel > 0 ? Math.min(1, 0.25 + fanLevel / 10).toFixed(2) : "0");
}

function renderTopStatus() {
  const voiceText = appState.voice.isListening ? "语音监听中" : "语音待机";
  const gestureText = appState.gesture.latestCode ? `${appState.gesture.latestGesture}` : "手势待机";
  const identityText = appState.voiceprint.authorized ? "授权用户" : "未授权用户";

  setChip(refs.runtimeStatus, appState.runtimeStatus, "success");
  setChip(refs.identityStatus, identityText, appState.voiceprint.authorized ? "success" : "danger");
  setChip(refs.voiceStatus, voiceText, appState.voice.isListening ? "info" : "neutral");
  setChip(refs.gestureStatus, gestureText, appState.gesture.latestCode ? "info" : "neutral");
  renderGestureServiceStatus();

  refs.voiceCaption.textContent = appState.voice.isListening
    ? "语音监听中..."
    : appState.voice.lastError || "语音待机，等待监听";
}

function setChip(element, text, mood) {
  if (!element) return;
  const label = element.querySelector("span:not(.dot):not(.chip-icon):not(.wave-bars)");
  if (label) label.textContent = text;
  element.classList.remove("success", "info", "neutral", "warning", "danger");
  element.classList.add(mood);
}

function renderVoiceprint() {
  const authorized = appState.voiceprint.authorized;
  const title = authorized ? "声纹验证通过" : "声纹验证失败";
  const meta = authorized ? `置信度 ${appState.voiceprint.confidence}%` : "非授权用户，拒绝语音控制";

  refs.verificationTitle.textContent = title;
  refs.verificationMeta.textContent = meta;
  refs.verificationCard.classList.toggle("danger", !authorized);
  refs.authorizedButton.classList.toggle("active", authorized);
  refs.unauthorizedButton.classList.toggle("active", !authorized);
}

function renderDevices() {
  renderManualDeviceList();
  renderDeviceStatusList();
  renderSceneReadouts();
}

function renderManualDeviceList() {
  refs.manualDeviceList.innerHTML = DEVICE_ORDER.map((deviceKey) => {
    const device = appState.devices[deviceKey];
    return `
      <div class="manual-device-row" data-device-row="${deviceKey}">
        <span class="device-icon">${icons[device.icon]}</span>
        <strong>${device.name}</strong>
        <button class="device-control-button on" data-command-device="${deviceKey}" data-command-action="on" type="button">开</button>
        <button class="device-control-button off" data-command-device="${deviceKey}" data-command-action="off" type="button">关</button>
        ${renderLevelSlider(deviceKey, device)}
      </div>
    `;
  }).join("");
}

function renderDeviceStatusList() {
  refs.deviceStatusList.innerHTML = DEVICE_ORDER.map((deviceKey) => {
    const device = appState.devices[deviceKey];
    const statusText = device.status ? "开" : "关";
    const detail = formatDeviceDetail(deviceKey, device);
    return `
      <div class="device-status-row" data-device-status="${deviceKey}">
        <span class="device-icon">${icons[device.icon]}</span>
        <strong>${device.name}</strong>
        <span class="state-pill ${device.status ? "" : "off"}">${statusText}</span>
        <span>${detail}</span>
      </div>
    `;
  }).join("");
}

function renderSceneReadouts() {
  refs.lightLevel.textContent = `${appState.devices.light.levelValue}%`;
  refs.curtainLevel.textContent = `${appState.devices.curtain.levelValue}%`;
  refs.acTemperature.textContent = `${appState.devices.airConditioner.levelValue}°C`;
  refs.temperatureValue.textContent = `${appState.devices.airConditioner.levelValue}°C`;
  refs.fanLevel.textContent = `${appState.devices.fan.levelValue}档`;
}

function renderLevelSlider(deviceKey, device) {
  const settings = LEVEL_SETTINGS[deviceKey];
  const fillPercent = getSliderFillPercent(deviceKey, device.levelValue);

  return `
    <label class="device-slider" data-slider-wrap="${deviceKey}">
      <span class="slider-value" data-level-text="${deviceKey}">${device.levelValue}${device.levelUnit}</span>
      <input
        type="range"
        min="${settings.min}"
        max="${settings.max}"
        step="${settings.step}"
        value="${device.levelValue}"
        data-level-device="${deviceKey}"
        aria-label="${device.name}${device.levelLabel}"
        style="--slider-fill:${fillPercent}%"
      />
    </label>
  `;
}

function updateManualSliderDisplays() {
  DEVICE_ORDER.forEach((deviceKey) => {
    const device = appState.devices[deviceKey];
    const input = document.querySelector(`[data-level-device="${deviceKey}"]`);
    const valueText = document.querySelector(`[data-level-text="${deviceKey}"]`);

    if (input && document.activeElement !== input) {
      input.value = String(device.levelValue);
    }

    if (input) {
      input.style.setProperty("--slider-fill", `${getSliderFillPercent(deviceKey, device.levelValue)}%`);
      input.setAttribute("aria-valuetext", `${device.levelValue}${device.levelUnit}`);
    }

    if (valueText) {
      valueText.textContent = `${device.levelValue}${device.levelUnit}`;
    }
  });
}

function getSliderFillPercent(deviceKey, value) {
  const settings = LEVEL_SETTINGS[deviceKey];
  if (!settings) return 0;
  return Math.round(((value - settings.min) / (settings.max - settings.min)) * 100);
}

function formatDeviceDetail(deviceKey, device) {
  if (deviceKey === "airConditioner" && !device.status) {
    return `待机 ${device.levelValue}${device.levelUnit}`;
  }

  return `${device.levelLabel} ${device.levelValue}${device.levelUnit}`;
}

function renderResults() {
  refs.latestVoiceText.textContent = appState.voice.latestText;
  refs.latestVoiceMeta.textContent = appState.voice.latestConfidence
    ? `置信度：${appState.voice.latestConfidence}%`
    : appState.voice.lastError || "置信度：--";
  refs.latestVoiceTime.textContent = appState.voice.latestTime ? formatTime(appState.voice.latestTime) : "--:--:--";

  refs.latestGestureText.textContent = appState.gesture.latestGesture;
  refs.latestGestureMeta.textContent = getGestureMetaText();
  refs.latestGestureTime.textContent = appState.gesture.latestTime ? formatTime(appState.gesture.latestTime) : "--:--:--";

  refs.latestVoiceprintText.textContent = appState.voiceprint.authorized ? "声纹验证通过" : "声纹验证失败";
  refs.latestVoiceprintMeta.textContent = appState.voiceprint.authorized
    ? `用户：授权用户　置信度：${appState.voiceprint.confidence}%`
    : "用户：未授权用户　控制已拒绝";
  refs.latestVoiceprintTime.textContent = appState.voiceprint.latestTime
    ? formatTime(appState.voiceprint.latestTime)
    : "--:--:--";

  document.querySelectorAll(".gesture-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.gesture === appState.activeGesture);
  });
}

function renderGestureServiceStatus() {
  if (!refs.gestureServiceTitle || !refs.gestureServiceMeta || !refs.gestureServiceDot) return;

  const statusMap = {
    connected: "摄像头识别中",
    connecting: "正在连接摄像头",
    disconnected: "摄像头识别未连接",
    error: "摄像头识别异常",
  };

  refs.gestureServiceTitle.textContent = statusMap[appState.gesture.serviceStatus] || "摄像头识别状态未知";
  refs.gestureServiceMeta.textContent = appState.gesture.serviceMessage;
  refs.gestureServiceDot.dataset.status = appState.gesture.serviceStatus;
}

function getGestureMetaText() {
  if (!appState.gesture.latestCode) {
    return appState.gesture.serviceMessage || "识别结果：--";
  }

  const confidenceText = appState.gesture.confidence === null
    ? ""
    : `，置信度：${Math.round(appState.gesture.confidence * 100)}%`;
  const stableText = appState.gesture.stableMs ? `，稳定：${appState.gesture.stableMs}ms` : "";
  return `识别结果：${appState.gesture.latestGesture}${confidenceText}${stableText}`;
}

function renderLogs() {
  refs.logOutput.innerHTML = "";

  appState.logs.forEach((entry) => {
    const row = document.createElement("div");
    row.className = `log-row ${entry.type}`;

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = `[${formatTime(entry.time)}]`;

    const type = document.createElement("span");
    type.className = "log-type";
    type.textContent = logTypeLabel(entry.type);

    const message = document.createElement("span");
    message.className = "log-message";
    message.textContent = entry.message;

    row.append(time, type, message);
    refs.logOutput.appendChild(row);
  });

  refs.logOutput.scrollTop = refs.logOutput.scrollHeight;
}

export function renderIconElements(root = document) {
  root.querySelectorAll(".chip-icon[data-icon]").forEach((element) => {
    const iconName = element.dataset.icon;
    if (!icons[iconName] || element.dataset.rendered === "true") return;
    element.innerHTML = icons[iconName];
    element.dataset.rendered = "true";
  });
}
