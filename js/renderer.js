import { appState, DEVICE_ORDER, LEVEL_SETTINGS } from "./state.js";
import { formatTime, logSourceLabel, logTypeLabel } from "./logger.js";
import {
  CURTAIN_FRAME_STEPS,
  LIGHT_FRAME_STEPS,
  curtainFramePath,
  getFrameBlend,
  roomFramePath,
} from "./sceneFrames.js";

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
  intro: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1l1.4-1.4"/><path d="M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
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
    liveTranscript: document.getElementById("liveTranscript"),
    voiceTranscriptLabel: document.getElementById("voiceTranscriptLabel"),
    voiceTranscript: document.getElementById("voiceTranscript"),
    voiceCommandMatch: document.getElementById("voiceCommandMatch"),
    startVoiceButton: document.getElementById("startVoiceButton"),
    stopVoiceButton: document.getElementById("stopVoiceButton"),
    verificationCard: document.getElementById("verificationCard"),
    verificationTitle: document.getElementById("verificationTitle"),
    verificationMeta: document.getElementById("verificationMeta"),
    enrollVoiceprintButton: document.getElementById("enrollVoiceprintButton"),
    enrollVoiceprintButtonLabel: document.getElementById("enrollVoiceprintButtonLabel"),
    resetVoiceprintButton: document.getElementById("resetVoiceprintButton"),
    enrollmentProgress: document.getElementById("enrollmentProgress"),
    voiceprintSamplePhrase: document.getElementById("voiceprintSamplePhrase"),
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
    verificationMark: document.getElementById("verificationMark"),
    voiceprintModeHint: document.getElementById("voiceprintModeHint"),
    gestureServiceUrlInput: document.getElementById("gestureServiceUrlInput"),
    diagnosticRows: document.querySelectorAll(".diagnostic-row"),
    diagnosticFrontendTitle: document.getElementById("diagnosticFrontendTitle"),
    diagnosticFrontendMeta: document.getElementById("diagnosticFrontendMeta"),
    diagnosticSpeechTitle: document.getElementById("diagnosticSpeechTitle"),
    diagnosticSpeechMeta: document.getElementById("diagnosticSpeechMeta"),
    diagnosticGestureTitle: document.getElementById("diagnosticGestureTitle"),
    diagnosticGestureMeta: document.getElementById("diagnosticGestureMeta"),
    diagnosticVoiceprintTitle: document.getElementById("diagnosticVoiceprintTitle"),
    diagnosticVoiceprintMeta: document.getElementById("diagnosticVoiceprintMeta"),
    diagnosticSelfCheckTitle: document.getElementById("diagnosticSelfCheckTitle"),
    diagnosticSelfCheckMeta: document.getElementById("diagnosticSelfCheckMeta"),
    gestureRepairList: document.getElementById("gestureRepairList"),
    selfCheckReport: document.getElementById("selfCheckReport"),
    logTypeFilter: document.getElementById("logTypeFilter"),
    logSourceFilter: document.getElementById("logSourceFilter"),
    logOutput: document.getElementById("logOutput"),
    lightLevel: document.getElementById("lightLevel"),
    curtainLevel: document.getElementById("curtainLevel"),
    acTemperature: document.getElementById("acTemperature"),
    fanLevel: document.getElementById("fanLevel"),
    temperatureValue: document.getElementById("temperatureValue"),
    ambianceToggleButton: document.getElementById("ambianceToggleButton"),
    ambianceLabel: document.getElementById("ambianceLabel"),
    sceneLightFrameA: document.getElementById("sceneLightFrameA"),
    sceneLightFrameB: document.getElementById("sceneLightFrameB"),
    curtainFrameA: document.getElementById("curtainFrameA"),
    curtainFrameB: document.getElementById("curtainFrameB"),
    acTemperatureDisplay: document.getElementById("acTemperatureDisplay"),
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
  renderDiagnostics();
  renderDevices();
  renderAmbiance();
  renderResults();
  renderLogs();
  renderIconElements(document);
}

function renderAmbiance() {
  if (!refs.ambianceToggleButton) return;
  const isDay = appState.ambiance === "day";
  if (refs.ambianceLabel) refs.ambianceLabel.textContent = isDay ? "白昼" : "夜间";
  // The icon span is hydrated once (dataset.rendered), so swap its SVG directly.
  const iconSlot = refs.ambianceToggleButton.querySelector(".chip-icon");
  if (iconSlot) iconSlot.innerHTML = icons[isDay ? "sun" : "moon"];
}

export function renderDeviceRuntimeState() {
  if (!refs) initRenderer();
  const activeSlider =
    document.activeElement?.matches?.("[data-level-device]") ? document.activeElement : null;

  renderBodyFlags();
  applyDeviceVisualVariables();
  updateManualSliderDisplays();
  renderDeviceStatusList();
  renderSceneReadouts();
  renderDiagnostics();
  renderResults();
  renderLogs();
  renderIconElements(document);
  if (activeSlider && document.contains(activeSlider) && document.activeElement !== activeSlider) {
    activeSlider.focus({ preventScroll: true });
  }
}

function renderBodyFlags() {
  document.body.dataset.voiceListening = String(appState.voice.isListening);
  document.body.dataset.ambiance = appState.ambiance;
  document.body.dataset.light = appState.devices.light.status ? "on" : "off";
  document.body.dataset.airConditioner = appState.devices.airConditioner.status ? "on" : "off";
  document.body.dataset.fan = appState.devices.fan.status ? "on" : "off";
  document.body.dataset.curtain = appState.devices.curtain.status ? "on" : "off";
}

function applyDeviceVisualVariables() {
  const root = document.documentElement;
  const light = appState.devices.light;
  const airConditioner = appState.devices.airConditioner;
  const fan = appState.devices.fan;
  const curtain = appState.devices.curtain;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const lightLevel = light.status ? light.levelValue : 0;
  const lightBlend = getFrameBlend(lightLevel, LIGHT_FRAME_STEPS, reducedMotion);
  applyFramePair(
    refs.sceneLightFrameA,
    refs.sceneLightFrameB,
    roomFramePath(appState.ambiance, lightBlend.current),
    roomFramePath(appState.ambiance, lightBlend.next),
    lightBlend.mix,
  );
  root.style.setProperty("--light-frame-mix", lightBlend.mix.toFixed(3));

  const curtainLevel = curtain.status ? curtain.levelValue : 0;
  const curtainBlend = getFrameBlend(curtainLevel, CURTAIN_FRAME_STEPS, reducedMotion);
  applyFramePair(
    refs.curtainFrameA,
    refs.curtainFrameB,
    curtainFramePath(curtainBlend.current),
    curtainFramePath(curtainBlend.next),
    curtainBlend.mix,
  );
  root.style.setProperty("--curtain-frame-mix", curtainBlend.mix.toFixed(3));

  const coolingStrength = airConditioner.status
    ? Math.max(0, Math.min(1, (30 - airConditioner.levelValue) / 14))
    : 0;
  root.style.setProperty("--ac-airflow-opacity", airConditioner.status ? (0.26 + coolingStrength * 0.66).toFixed(2) : "0");
  root.style.setProperty("--ac-airflow-duration", `${(2.4 - coolingStrength * 1.3).toFixed(2)}s`);
  root.style.setProperty("--ac-airflow-hue", `${Math.round(188 + coolingStrength * 18)}`);
  root.style.setProperty("--ac-airflow-spread", `${Math.round(8 + coolingStrength * 12)}deg`);
  if (refs.acTemperatureDisplay) refs.acTemperatureDisplay.textContent = String(airConditioner.levelValue);

  const fanLevel = fan.status ? fan.levelValue : 0;
  const fanDuration = Math.max(0.22, 1.35 - fanLevel * 0.105);
  root.style.setProperty("--fan-spin-duration", `${fanDuration.toFixed(2)}s`);
  root.style.setProperty("--fan-rotor-opacity", fanLevel > 0 ? (0.72 + fanLevel * 0.025).toFixed(2) : "1");
  root.style.setProperty("--fan-motion-blur", fanLevel >= 7 ? "1.4px" : fanLevel >= 4 ? "0.7px" : "0px");

  scheduleScenePrefetch(appState.ambiance);
}

function applyFramePair(frameA, frameB, sourceA, sourceB, mix) {
  if (!frameA || !frameB) return;
  updateFrameSource(frameA, sourceA);
  updateFrameSource(frameB, sourceB);
  frameA.style.opacity = "1";
  frameB.style.opacity = sourceA === sourceB ? "0" : mix.toFixed(3);
  frameA.dataset.frameStep = sourceA;
  frameB.dataset.frameStep = sourceB;
}

function updateFrameSource(image, source) {
  if (!image || image.dataset.frameSource === source) return;

  const previous = image.dataset.frameSource || image.getAttribute("src") || "";
  image.dataset.previousFrameSource = previous;
  image.dataset.frameSource = source;
  image.removeAttribute("data-frame-error");
  image.onerror = () => {
    const fallback = image.dataset.previousFrameSource;
    image.dataset.frameError = source;
    if (fallback && fallback !== source) {
      image.dataset.frameSource = fallback;
      image.src = fallback;
    }
  };
  image.onload = () => {
    image.removeAttribute("data-frame-error");
  };
  image.src = source;
}

const prefetchedSceneSets = new Set();

function scheduleScenePrefetch(ambience) {
  if (prefetchedSceneSets.has(ambience)) return;
  prefetchedSceneSets.add(ambience);

  const load = () => {
    const paths = [
      ...LIGHT_FRAME_STEPS.flatMap((step) => [
        roomFramePath(ambience, step),
      ]),
      ...CURTAIN_FRAME_STEPS.map(curtainFramePath),
    ];
    paths.forEach((source) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(load, { timeout: 1800 });
  } else {
    window.setTimeout(load, 500);
  }
}

function renderTopStatus() {
  const voiceText =
    appState.voice.captureStatus === "processing"
      ? "语音处理中"
      : appState.voice.isListening
        ? "语音监听中"
        : "语音待机";
  const gestureText = appState.gesture.latestCode ? `${appState.gesture.latestGesture}` : "手势待机";
  const identityText = getIdentityStatusText();

  setChip(refs.runtimeStatus, appState.runtimeStatus, "success");
  setChip(
    refs.identityStatus,
    identityText,
    appState.voiceprint.mode === "authorized"
      ? "success"
      : appState.voiceprint.mode === "rejected" || appState.voiceprint.mode === "error"
        ? "danger"
        : "warning"
  );
  setChip(refs.voiceStatus, voiceText, appState.voice.isListening ? "info" : "neutral");
  setChip(refs.gestureStatus, gestureText, appState.gesture.latestCode ? "info" : "neutral");
  renderGestureServiceStatus();

  refs.voiceCaption.textContent =
    appState.voice.captureStatus === "processing"
      ? "正在完成声纹验证与智谱转写..."
      : appState.voice.isListening
        ? "语音监听中，本条指令将独立验证声纹..."
        : appState.voice.lastError || "语音待机，等待监听";
  renderVoiceTranscript();
}

function setChip(element, text, mood) {
  if (!element) return;
  const label = element.querySelector("span:not(.dot):not(.chip-icon):not(.wave-bars)");
  if (label) label.textContent = text;
  element.classList.remove("success", "info", "neutral", "warning", "danger");
  element.classList.add(mood);
}

function renderVoiceprint() {
  const mode = appState.voiceprint.mode;
  const enrolled = appState.voiceprint.enrolled;
  const title = getVoiceprintResultTitle();
  const meta = appState.voiceprint.lastMessage || (!enrolled ? "请先录入固定短句" : "等待声纹验证");

  refs.verificationTitle.textContent = title;
  refs.verificationMeta.textContent = meta;
  refs.verificationCard.classList.toggle("danger", mode === "rejected" || mode === "error");
  refs.verificationCard.classList.toggle("warning", !enrolled || mode === "enrolling" || mode === "pending");
  if (refs.verificationMark) refs.verificationMark.textContent = mode === "authorized" ? "✓" : "!";
  if (refs.voiceprintModeHint) {
    refs.voiceprintModeHint.textContent = enrolled
      ? "已保存单一授权用户声纹；每条语音指令都会重新验证。"
      : `${appState.voiceprint.lastMessage}（${appState.voiceprint.enrollmentSampleCount}/3）`;
  }
  if (refs.voiceprintSamplePhrase) {
    refs.voiceprintSamplePhrase.textContent = appState.voiceprint.samplePhrase;
  }
  const sampleNumber = Math.min(appState.voiceprint.enrollmentSampleCount + 1, 3);
  if (refs.enrollVoiceprintButtonLabel) {
    refs.enrollVoiceprintButtonLabel.textContent =
      appState.voiceprint.isRecordingSample
        ? `停止第 ${sampleNumber} 段`
        : enrolled
          ? "重新录入声纹"
          : `录入第 ${sampleNumber} 段`;
  }
  refs.enrollmentProgress?.querySelectorAll("i").forEach((step, index) => {
    step.classList.toggle("complete", index < appState.voiceprint.enrollmentSampleCount);
  });

  const serviceReady =
    appState.voiceprint.modelReady &&
    appState.voiceprint.asrConfigured &&
    appState.voiceprint.ffmpegReady;
  if (refs.enrollVoiceprintButton) {
    refs.enrollVoiceprintButton.disabled =
      (!serviceReady && mode !== "enrolling") ||
      appState.voice.isListening ||
      appState.voice.captureStatus === "processing";
  }
  if (refs.resetVoiceprintButton) {
    refs.resetVoiceprintButton.disabled =
      !enrolled && appState.voiceprint.enrollmentSampleCount === 0;
  }
  if (refs.startVoiceButton) {
    refs.startVoiceButton.disabled =
      !enrolled ||
      !serviceReady ||
      appState.voice.isListening ||
      appState.voice.captureStatus === "processing";
  }
  if (refs.stopVoiceButton) refs.stopVoiceButton.disabled = !appState.voice.isListening;
}

function renderVoiceTranscript() {
  if (!refs.liveTranscript) return;
  const status = appState.voice.commandStatus || "idle";
  refs.liveTranscript.dataset.status = status;
  refs.voiceTranscriptLabel.textContent =
    appState.voice.captureStatus === "processing" || appState.voice.finalText
      ? "智谱最终字幕"
      : appState.voice.isListening
        ? "浏览器临时字幕"
        : "实时字幕";
  refs.voiceTranscript.textContent =
    appState.voice.finalText ||
    appState.voice.interimText ||
    (appState.voice.isListening ? "正在聆听..." : "等待开始监听");
  const messages = {
    idle: "声纹通过后才会匹配并执行本条指令",
    listening: "临时字幕仅用于即时显示，不会直接执行",
    verifying: "正在并行完成声纹验证与智谱转写",
    matched: "声纹与指令均已通过，设备状态已更新",
    rejected: appState.voice.lastError || "声纹验证失败，设备状态保持不变",
    unsupported: appState.voice.lastError || "字幕未匹配到支持的设备指令",
  };
  refs.voiceCommandMatch.textContent = messages[status] || messages.idle;
}

function getIdentityStatusText() {
  if (appState.voiceprint.mode === "error") return "声纹服务异常";
  if (appState.voiceprint.mode === "enrolling") return "声纹录入中";
  if (!appState.voiceprint.enrolled) return "声纹未录入";
  if (appState.voiceprint.mode === "authorized") return "本条声纹通过";
  if (appState.voiceprint.mode === "rejected") return "本条声纹拒绝";
  return "声纹已录入";
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

  document.querySelectorAll(".device-callout[data-command-device]").forEach((button) => {
    const device = appState.devices[button.dataset.commandDevice];
    if (device) button.setAttribute("aria-pressed", String(device.status));
  });
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
    : appState.voiceprint.similarity !== null
      ? `声纹相似度：${Math.round(appState.voiceprint.similarity * 100)}%`
      : appState.voice.lastError || "最终字幕：--";
  refs.latestVoiceTime.textContent = appState.voice.latestTime ? formatTime(appState.voice.latestTime) : "--:--:--";

  refs.latestGestureText.textContent = appState.gesture.latestGesture;
  refs.latestGestureMeta.textContent = getGestureMetaText();
  refs.latestGestureTime.textContent = appState.gesture.latestTime ? formatTime(appState.gesture.latestTime) : "--:--:--";

  refs.latestVoiceprintText.textContent = getVoiceprintResultTitle();
  refs.latestVoiceprintMeta.textContent = getVoiceprintResultMeta();
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
  if (refs.gestureServiceUrlInput && document.activeElement !== refs.gestureServiceUrlInput) {
    refs.gestureServiceUrlInput.value = appState.gesture.serviceUrl;
  }
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

  if (refs.logTypeFilter) refs.logTypeFilter.value = appState.logFilter.type;
  if (refs.logSourceFilter) refs.logSourceFilter.value = appState.logFilter.source;

  getFilteredLogs().forEach((entry) => {
    const row = document.createElement("div");
    row.className = `log-row ${entry.type}`;

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = `[${formatTime(entry.time)}]`;

    const type = document.createElement("span");
    type.className = "log-type";
    type.textContent = `${logTypeLabel(entry.type)}/${logSourceLabel(entry.source)}`;

    const message = document.createElement("span");
    message.className = "log-message";
    message.textContent = entry.message;

    row.append(time, type, message);
    refs.logOutput.appendChild(row);
  });

  refs.logOutput.scrollTop = refs.logOutput.scrollHeight;
}

function renderDiagnostics() {
  const diagnostics = appState.diagnostics;
  setDiagnosticRow(0, diagnostics.frontend, refs.diagnosticFrontendTitle, refs.diagnosticFrontendMeta);
  setDiagnosticRow(1, diagnostics.speech, refs.diagnosticSpeechTitle, refs.diagnosticSpeechMeta);
  setDiagnosticRow(2, diagnostics.gestureService, refs.diagnosticGestureTitle, refs.diagnosticGestureMeta);
  setDiagnosticRow(3, diagnostics.voiceprint, refs.diagnosticVoiceprintTitle, refs.diagnosticVoiceprintMeta);
  setDiagnosticRow(4, diagnostics.selfCheck, refs.diagnosticSelfCheckTitle, refs.diagnosticSelfCheckMeta);
  renderGestureRepairList();
  renderSelfCheckReport();
}

function setDiagnosticRow(index, item, titleRef, metaRef) {
  const row = refs.diagnosticRows?.[index];
  if (row) row.dataset.status = item.status;
  if (titleRef) titleRef.textContent = item.title;
  if (metaRef) metaRef.textContent = item.meta;
}

function renderGestureRepairList() {
  if (!refs.gestureRepairList) return;
  const gesture = appState.diagnostics.gestureService;
  refs.gestureRepairList.innerHTML = "";
  if (gesture.status === "ok") return;
  gesture.repairSteps.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    refs.gestureRepairList.appendChild(item);
  });
}

function renderSelfCheckReport() {
  if (!refs.selfCheckReport) return;
  refs.selfCheckReport.innerHTML = "";
  const items = appState.diagnostics.selfCheck.items;
  if (!items.length) return;

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "self-check-item";
    row.dataset.status = item.status;

    const name = document.createElement("strong");
    name.textContent = item.name;
    const duration = document.createElement("span");
    duration.textContent = `${item.durationMs}ms`;
    const detail = document.createElement("span");
    detail.textContent = item.error || (item.status === "pass" ? "通过" : "失败");
    const result = document.createElement("span");
    result.textContent = item.status === "pass" ? "PASS" : "FAIL";

    row.append(name, result, duration, detail);
    refs.selfCheckReport.appendChild(row);
  });
}

function getFilteredLogs() {
  return appState.logs.filter((entry) => {
    const typeOk = appState.logFilter.type === "all" || entry.type === appState.logFilter.type;
    const sourceOk = appState.logFilter.source === "all" || entry.source === appState.logFilter.source;
    return typeOk && sourceOk;
  });
}

function getVoiceprintResultTitle() {
  if (appState.voiceprint.mode === "error") return "声纹服务异常";
  if (appState.voiceprint.mode === "enrolling") return "声纹录入中";
  if (!appState.voiceprint.enrolled) return "声纹样本未录入";
  if (appState.voiceprint.mode === "authorized") return "声纹验证通过";
  if (appState.voiceprint.mode === "rejected") return "声纹验证失败";
  return "声纹已录入，等待指令";
}

function getVoiceprintResultMeta() {
  if (!appState.voiceprint.enrolled) {
    return `录入进度：${appState.voiceprint.enrollmentSampleCount}/3`;
  }
  const similarity =
    appState.voiceprint.confidence === null ? "--" : `${appState.voiceprint.confidence}%`;
  return `单一授权用户　相似度：${similarity}　阈值：${Math.round(appState.voiceprint.threshold * 100)}%`;
}

export function renderIconElements(root = document) {
  root.querySelectorAll(".chip-icon[data-icon]").forEach((element) => {
    const iconName = element.dataset.icon;
    if (!icons[iconName] || element.dataset.rendered === "true") return;
    element.innerHTML = icons[iconName];
    element.dataset.rendered = "true";
  });
}
