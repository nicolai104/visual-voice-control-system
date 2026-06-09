import { appState } from "./state.js";
import { addLog } from "./logger.js";
import {
  executeCommand,
  executeScene,
  executeTextCommand,
  updateDeviceLevel,
} from "./controller.js";
import { handleGestureResult, updateGestureServiceStatus } from "./gesture.js";
import {
  enrollVoiceprint,
  resetVoiceprint,
  setVoiceprintAuthorized,
  verifyVoiceprint,
} from "./voiceprint.js";
import { setSelfCheckRunning, updateSelfCheckDiagnostics } from "./diagnostics.js";
import { markDirty } from "./scheduler.js";

const DEFAULT_DELAY_MS = 160;

export async function runSmokeTest({ delayMs = DEFAULT_DELAY_MS } = {}) {
  addLog("开始交互自检：GUI、文本、手势、声纹、摄像头降级提示", "system");
  setSelfCheckRunning();

  const items = [];
  const run = async (name, check) => {
    const started = performanceNow();
    try {
      const result = await check();
      if (result === false) throw new Error("检查返回 false");
      items.push(createCheckItem(name, "pass", started));
      addLog(`自检通过：${name}`, "success");
    } catch (error) {
      const message = error?.message || "未知错误";
      items.push(createCheckItem(name, "fail", started, message));
      addLog(`自检失败：${name} - ${message}`, "error");
    }
    if (delayMs > 0) await sleep(delayMs);
  };

  await run("手动开关单设备", () => {
    executeCommand({ device: "light", action: "off" }, "test");
    return executeCommand({ device: "light", action: "on" }, "test");
  });

  await run("滑块调节设备数值", () => {
    const checks = [
      updateDeviceLevel("light", 35, { source: "test", render: true, log: true }),
      updateDeviceLevel("airConditioner", 27, { source: "test", render: true, log: true }),
      updateDeviceLevel("fan", 5, { source: "test", render: true, log: true }),
      updateDeviceLevel("curtain", 80, { source: "test", render: true, log: true }),
    ];
    return checks.every((item) => item && item.changed);
  });

  await run("场景模式批量控制", () => executeScene("sleep", "test"));
  await run("文本指令解析成功", () => executeTextCommand("风扇调到5档", "text"));
  await run("未知指令被拒绝", () => executeTextCommand("播放音乐", "text") === false);
  await run("否定指令不被误执行", () => executeTextCommand("不要关灯", "text") === false);

  await run("声纹未录入时拒绝语音控制", () => {
    resetVoiceprint();
    return executeTextCommand("打开客厅灯", "voice") === false;
  });

  await run("声纹验证失败时拒绝语音控制", () => {
    enrollVoiceprint(appState.voiceprint.samplePhrase);
    setVoiceprintAuthorized(false);
    verifyVoiceprint(appState.voiceprint.samplePhrase);
    return executeTextCommand("关闭空调", "voice") === false;
  });

  await run("声纹验证通过后允许语音控制", () => {
    setVoiceprintAuthorized(true);
    verifyVoiceprint(appState.voiceprint.samplePhrase);
    executeCommand({ device: "light", action: "off" }, "test");
    return executeTextCommand("打开客厅灯", "voice");
  });

  await run("模拟手势 palm / fist 正常触发", () => {
    const palm = handleGestureResult("palm");
    const fist = handleGestureResult("fist");
    return palm && fist;
  });

  await run("摄像头服务未连接时有修复提示", () => {
    if (appState.gesture.serviceStatus === "connected") return true;
    updateGestureServiceStatus("disconnected", "摄像头识别服务未连接：请先启动 gesture_service.py");
    return appState.diagnostics.gestureService.repairSteps.length >= 3;
  });

  const report = createSmokeTestReport(items);
  updateSelfCheckDiagnostics(report);
  addLog(`交互自检完成：${report.passed}/${report.total} 通过`, report.passed === report.total ? "success" : "warning");
  markDirty("full");
  return report;
}

export function createSmokeTestReport(items) {
  const passed = items.filter((item) => item.status === "pass").length;
  return {
    status: passed === items.length ? "pass" : "fail",
    passed,
    total: items.length,
    items,
    finishedAt: new Date(),
  };
}

function createCheckItem(name, status, started, error = "") {
  return {
    name,
    status,
    durationMs: Math.max(0, Math.round(performanceNow() - started)),
    error,
  };
}

function performanceNow() {
  return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
