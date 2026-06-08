import { appState } from "./state.js";
import { addLog } from "./logger.js";
import { renderApp } from "./renderer.js";
import { executeTextCommand } from "./controller.js";

let recognition = null;
let stopRequested = false;

export function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  appState.voice.isSupported = Boolean(SpeechRecognition);

  if (!SpeechRecognition) {
    appState.voice.lastError = "当前浏览器不支持 Web Speech API，请使用 Chrome / Edge";
    addLog("语音识别模块：当前浏览器不支持 Web Speech API", "warning");
    renderApp();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  appState.voice.recognition = recognition;

  recognition.onstart = () => {
    appState.voice.isListening = true;
    appState.voice.lastError = "";
    addLog("语音监听已启动，请说出中文控制指令", "info");
    renderApp();
  };

  recognition.onresult = (event) => {
    const result = event.results?.[0]?.[0];
    const transcript = result?.transcript?.trim() || "";
    const confidence = result?.confidence ? Math.round(result.confidence * 100) : 98;

    appState.voice.latestText = transcript || "未识别到有效语音";
    appState.voice.latestConfidence = transcript ? confidence : null;
    appState.voice.latestTime = new Date();

    if (!transcript) {
      addLog("语音识别结果为空，请重试", "warning");
      renderApp();
      return;
    }

    addLog(`语音识别结果：${transcript}（置信度 ${confidence}%）`, "info");
    executeTextCommand(transcript, "voice");
  };

  recognition.onerror = (event) => {
    const message = getVoiceErrorMessage(event.error);
    appState.voice.lastError = message;
    appState.voice.isListening = false;
    addLog(`语音识别异常：${message}`, "error");
    renderApp();
  };

  recognition.onend = () => {
    appState.voice.isListening = false;
    if (!stopRequested) {
      addLog("语音监听已自动结束", "info");
    }
    stopRequested = false;
    renderApp();
  };

  addLog("语音识别模块初始化完成", "info");
}

export function startVoiceRecognition() {
  if (!recognition) {
    initVoiceRecognition();
  }

  if (!recognition) {
    renderApp();
    return false;
  }

  if (appState.voice.isListening) {
    addLog("语音监听已在运行中", "warning");
    renderApp();
    return false;
  }

  try {
    stopRequested = false;
    recognition.start();
    return true;
  } catch (error) {
    appState.voice.isListening = false;
    appState.voice.lastError = "语音监听启动失败，请稍后重试";
    addLog(`语音监听启动失败：${error.message}`, "error");
    renderApp();
    return false;
  }
}

export function stopVoiceRecognition() {
  if (!recognition || !appState.voice.isListening) {
    addLog("语音监听未启动", "warning");
    renderApp();
    return false;
  }

  stopRequested = true;
  recognition.stop();
  appState.voice.isListening = false;
  addLog("语音监听已停止", "info");
  renderApp();
  return true;
}

function getVoiceErrorMessage(errorCode) {
  const messages = {
    "not-allowed": "麦克风权限被拒绝，请在浏览器中允许麦克风访问",
    "service-not-allowed": "语音识别服务不可用，请检查浏览器设置",
    "no-speech": "长时间未检测到语音输入",
    "audio-capture": "未检测到可用麦克风",
    network: "语音识别服务异常，请检查网络",
    aborted: "语音识别已中止",
  };

  return messages[errorCode] || `未知错误：${errorCode || "unknown"}`;
}
