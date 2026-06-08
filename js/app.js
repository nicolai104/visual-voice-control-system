import { appState, resetState } from "./state.js";
import { initRenderer, renderApp, renderClock } from "./renderer.js";
import { addLog, clearLogs } from "./logger.js";
import { executeCommand, executeTextCommand, handleManualDeviceCommand, updateDeviceLevel } from "./controller.js";
import { handleGestureResult } from "./gesture.js";
import { startCameraGestureRecognition, stopCameraGestureRecognition } from "./gestureCamera.js";
import { initVoiceRecognition, startVoiceRecognition, stopVoiceRecognition } from "./voice.js";
import { setVoiceprintAuthorized } from "./voiceprint.js";

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function initApp() {
  initRenderer();
  initVoiceRecognition();
  bindEvents();
  appState.voiceprint.latestTime = new Date();
  addLog("系统初始化完成", "system");
  addLog("设备状态初始化：客厅灯、空调、风扇、窗帘 已开启", "info");
  addLog("统一指令执行入口已就绪：GUI / 语音 / 手势共享控制逻辑", "info");
  renderClock();
  renderApp();

  window.setInterval(renderClock, 1000);

  window.__voiceControlDemo = {
    appState,
    executeCommand,
    executeTextCommand,
    handleGestureResult,
    updateDeviceLevel,
    startCameraGestureRecognition,
    stopCameraGestureRecognition,
    setVoiceprintAuthorized,
    runSmokeTest,
  };
}

function bindEvents() {
  document.getElementById("startVoiceButton").addEventListener("click", startVoiceRecognition);
  document.getElementById("stopVoiceButton").addEventListener("click", stopVoiceRecognition);
  document.getElementById("startCameraGestureButton").addEventListener("click", () => startCameraGestureRecognition());
  document.getElementById("stopCameraGestureButton").addEventListener("click", stopCameraGestureRecognition);
  document.getElementById("authorizedButton").addEventListener("click", () => setVoiceprintAuthorized(true));
  document.getElementById("unauthorizedButton").addEventListener("click", () => setVoiceprintAuthorized(false));
  document.getElementById("clearLogsButton").addEventListener("click", () => {
    clearLogs();
    addLog("日志已清空", "system");
    renderApp();
  });
  document.getElementById("resetSystemButton").addEventListener("click", resetSystem);
  document.getElementById("runSmokeTestButton").addEventListener("click", runSmokeTest);

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
    const gestureButton = event.target.closest("[data-gesture]");
    if (gestureButton) {
      handleGestureResult(gestureButton.dataset.gesture);
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
  addLog("系统已重置为演示初始状态", "system");
  addLog("设备状态初始化：客厅灯、空调、风扇、窗帘 已开启", "info");
  renderApp();
}

async function runSmokeTest() {
  addLog("开始交互自检：GUI、手势、声纹、异常指令", "system");
  setVoiceprintAuthorized(true);
  await sleep(180);

  executeCommand({ device: "light", action: "off" }, "test");
  await sleep(180);
  executeCommand({ device: "light", action: "on" }, "test");
  await sleep(180);
  executeCommand({ device: "airConditioner", action: "off" }, "test");
  await sleep(180);
  executeCommand({ device: "airConditioner", action: "on" }, "test");
  await sleep(180);
  executeCommand({ device: "all", action: "off" }, "test");
  await sleep(180);
  executeCommand({ device: "all", action: "on" }, "test");
  await sleep(180);

  updateDeviceLevel("light", 35, { source: "test", render: true, log: true });
  await sleep(180);
  updateDeviceLevel("light", 92, { source: "test", render: true, log: true });
  await sleep(180);
  updateDeviceLevel("airConditioner", 16, { source: "test", render: true, log: true });
  await sleep(180);
  updateDeviceLevel("airConditioner", 30, { source: "test", render: true, log: true });
  await sleep(180);
  updateDeviceLevel("fan", 10, { source: "test", render: true, log: true });
  await sleep(180);
  updateDeviceLevel("curtain", 100, { source: "test", render: true, log: true });
  await sleep(180);
  updateDeviceLevel("curtain", 0, { source: "test", render: true, log: true });
  await sleep(180);

  handleGestureResult("palm");
  await sleep(180);
  handleGestureResult("fist");
  await sleep(180);
  handleGestureResult("Open_Palm", { source: "camera", confidence: 0.92, stableMs: 640 });
  await sleep(180);
  handleGestureResult("Closed_Fist", { source: "camera", confidence: 0.9, stableMs: 680 });
  await sleep(180);
  handleGestureResult("victory");
  await sleep(180);
  handleGestureResult("raise");
  await sleep(180);

  setVoiceprintAuthorized(true);
  await sleep(180);
  executeTextCommand("打开客厅灯", "voice");
  await sleep(180);
  setVoiceprintAuthorized(false);
  await sleep(180);
  executeTextCommand("关闭空调", "voice");
  await sleep(180);
  setVoiceprintAuthorized(true);
  await sleep(180);

  executeTextCommand("播放音乐", "text");
  await sleep(180);
  executeTextCommand("", "text");
  await sleep(180);

  addLog("交互自检完成：状态闭环、异常提示、声纹拒绝路径均已执行", "success");
  renderApp();
}

document.addEventListener("DOMContentLoaded", initApp);
