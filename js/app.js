import { appState, resetState } from "./state.js";
import { initRenderer, renderApp, renderDeviceRuntimeState, renderClock } from "./renderer.js";
import { configureRenderer, markDirty, renderNow } from "./scheduler.js";
import { addLog, clearLogs } from "./logger.js";
import {
  executeCommand,
  executeScene,
  executeTextCommand,
  handleManualDeviceCommand,
  updateDeviceLevel,
} from "./controller.js";
import { handleGestureResult } from "./gesture.js";
import { startCameraGestureRecognition, stopCameraGestureRecognition } from "./gestureCamera.js";
import { initVoiceRecognition, startVoiceRecognition, stopVoiceRecognition } from "./voice.js";
import {
  enrollVoiceprint,
  resetVoiceprint,
  setVoiceprintAuthorized,
  verifyVoiceprint,
} from "./voiceprint.js";
import { initHero } from "./hero.js";
import { initToasts } from "./toast.js";
import { readStored, writeStored } from "./storage.js";
import { initDiagnostics, updateGestureDiagnostics, updateSelfCheckDiagnostics } from "./diagnostics.js";
import {
  persistDeviceState,
  persistVoiceprintState,
  restoreDeviceState,
  restoreVoiceprintState,
} from "./persistence.js";
import { runSmokeTest } from "./smokeTest.js";

const AMBIANCE_KEY = "vvcs-ambiance";

function initApp() {
  initRenderer();
  // Wire the renderer into the scheduler so business modules can request a
  // repaint via markDirty() without importing the renderer directly.
  configureRenderer({ full: renderApp, runtime: renderDeviceRuntimeState });
  // Restore the saved day/night ambiance before the first paint.
  const savedAmbiance = readStored(AMBIANCE_KEY);
  if (savedAmbiance === "day" || savedAmbiance === "night") {
    appState.ambiance = savedAmbiance;
  }
  restoreDeviceState();
  restoreVoiceprintState();
  initDiagnostics();
  initVoiceRecognition();
  bindEvents();
  initHero();
  initToasts();
  addLog("系统初始化完成", "system");
  addLog("能力诊断已就绪：前端、语音、声纹、摄像头手势、自检统一展示", "info");
  addLog("统一指令执行入口已就绪：GUI / 文本 / 语音 / 手势 / 场景共享控制逻辑", "info");
  renderClock();
  renderNow("full");

  window.setInterval(renderClock, 1000);

  window.__voiceControlDemo = {
    appState,
    executeCommand,
    executeScene,
    executeTextCommand,
    enrollVoiceprint,
    handleGestureResult,
    resetVoiceprint,
    updateDeviceLevel,
    verifyVoiceprint,
    startCameraGestureRecognition,
    stopCameraGestureRecognition,
    setVoiceprintAuthorized,
    runSmokeTest,
  };
}

function bindEvents() {
  document.getElementById("startVoiceButton").addEventListener("click", startVoiceRecognition);
  document.getElementById("stopVoiceButton").addEventListener("click", stopVoiceRecognition);
  document.getElementById("startCameraGestureButton").addEventListener("click", () => {
    const input = document.getElementById("gestureServiceUrlInput");
    startCameraGestureRecognition(input?.value);
  });
  document.getElementById("stopCameraGestureButton").addEventListener("click", stopCameraGestureRecognition);
  document.getElementById("authorizedButton").addEventListener("click", () => setVoiceprintAuthorized(true));
  document.getElementById("unauthorizedButton").addEventListener("click", () => setVoiceprintAuthorized(false));
  document.getElementById("enrollVoiceprintButton").addEventListener("click", () => {
    enrollVoiceprint(getVoiceprintSampleInput());
  });
  document.getElementById("verifyVoiceprintButton").addEventListener("click", () => {
    verifyVoiceprint(getVoiceprintSampleInput());
  });
  document.getElementById("resetVoiceprintButton").addEventListener("click", resetVoiceprint);
  document.getElementById("gestureServiceUrlInput").addEventListener("change", (event) => {
    appState.gesture.serviceUrl = event.target.value.trim() || appState.gesture.serviceUrl;
    updateGestureDiagnostics({
      status: appState.gesture.serviceStatus,
      url: appState.gesture.serviceUrl,
      message: appState.gesture.serviceMessage,
    });
  });
  document.getElementById("logTypeFilter").addEventListener("change", (event) => {
    appState.logFilter.type = event.target.value;
    markDirty("runtime");
  });
  document.getElementById("logSourceFilter").addEventListener("change", (event) => {
    appState.logFilter.source = event.target.value;
    markDirty("runtime");
  });
  document.getElementById("clearLogsButton").addEventListener("click", () => {
    clearLogs();
    addLog("日志已清空", "system");
    markDirty();
  });
  document.getElementById("resetSystemButton").addEventListener("click", resetSystem);
  document.getElementById("runSmokeTestButton").addEventListener("click", runSmokeTest);
  document.getElementById("ambianceToggleButton").addEventListener("click", toggleAmbiance);

  document.getElementById("manualCommandForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("manualCommandInput");
    executeTextCommand(input.value, "text");
    input.value = "";
  });

  document.body.addEventListener("input", (event) => {
    const slider = event.target.closest("[data-level-device]");
    if (!slider) return;

    updateDeviceLevel(slider.dataset.levelDevice, slider.value, {
      source: "gui",
      render: true,
      log: false,
    });
  });

  document.body.addEventListener("change", (event) => {
    const slider = event.target.closest("[data-level-device]");
    if (!slider) return;

    updateDeviceLevel(slider.dataset.levelDevice, slider.value, {
      source: "gui",
      render: true,
      log: true,
    });
  });

  document.body.addEventListener("click", (event) => {
    const exampleChip = event.target.closest("[data-example-command]");
    if (exampleChip) {
      executeTextCommand(exampleChip.dataset.exampleCommand, "text");
      return;
    }

    const gestureButton = event.target.closest("[data-gesture]");
    if (gestureButton) {
      handleGestureResult(gestureButton.dataset.gesture);
      return;
    }

    const sceneButton = event.target.closest("[data-scene]");
    if (sceneButton) {
      executeScene(sceneButton.dataset.scene, "gui");
      return;
    }

    const commandButton = event.target.closest("[data-command-device][data-command-action]");
    if (commandButton) {
      handleManualDeviceCommand(commandButton.dataset.commandDevice, commandButton.dataset.commandAction);
    }
  });
}

function resetSystem() {
  resetState();
  clearLogs();
  initDiagnostics();
  persistDeviceState();
  persistVoiceprintState();
  updateSelfCheckDiagnostics(null, { render: false });
  addLog("系统已重置为演示初始状态", "system");
  addLog("设备与声纹状态已恢复为首次演示状态", "info");
  markDirty();
}

function toggleAmbiance() {
  appState.ambiance = appState.ambiance === "day" ? "night" : "day";
  writeStored(AMBIANCE_KEY, appState.ambiance);
  addLog(`房间氛围已切换为${appState.ambiance === "day" ? "白昼" : "夜间"}模式`, "info");
  markDirty();
}

function getVoiceprintSampleInput() {
  const input = document.getElementById("voiceprintSampleInput");
  return input?.value || appState.voiceprint.samplePhrase;
}

document.addEventListener("DOMContentLoaded", initApp);
