import { appState } from "./state.js";
import { addLog } from "./logger.js";
import { markDirty } from "./scheduler.js";
import { executeTextCommand } from "./controller.js";
import { refreshMicrophonePermission, updateSpeechDiagnostics } from "./diagnostics.js";
import {
  isAudioCaptureSupported,
  isInterimTranscriptionSupported,
  startAudioCapture,
} from "./audioCapture.js";
import { verifyVoiceCommand } from "./voiceApi.js";
import { applyVoiceVerification, applyVoiceVerificationError } from "./voiceprint.js";

let commandSession = null;

export function initVoiceRecognition() {
  appState.voice.isSupported = isAudioCaptureSupported();
  appState.voice.interimSupported = isInterimTranscriptionSupported();
  updateSpeechDiagnostics({
    supported: appState.voice.isSupported,
    interimSupported: appState.voice.interimSupported,
    error: appState.voice.isSupported ? "" : "当前浏览器不支持 MediaRecorder 录音",
    render: false,
  });
  addLog(
    appState.voice.isSupported ? "浏览器录音模块初始化完成" : "当前浏览器不支持 MediaRecorder 录音",
    appState.voice.isSupported ? "info" : "warning",
  );
}

export async function startVoiceRecognition() {
  if (!appState.voiceprint.enrolled) {
    appState.voice.lastError = "请先完成三段声纹录入";
    appState.voice.commandStatus = "rejected";
    addLog(appState.voice.lastError, "warning");
    markDirty("full");
    return false;
  }
  if (!appState.voice.isSupported) {
    appState.voice.lastError = "当前浏览器不支持录音";
    markDirty("full");
    return false;
  }
  if (commandSession) {
    addLog("语音监听已在运行中", "warning");
    return false;
  }

  try {
    await refreshMicrophonePermission();
    appState.voice.isListening = true;
    appState.voice.captureStatus = "recording";
    appState.voice.interimText = "";
    appState.voice.finalText = "";
    appState.voice.commandStatus = "listening";
    appState.voice.lastError = "";
    markDirty("full");

    commandSession = await startAudioCapture({
      onInterim: (text) => {
        appState.voice.interimText = text;
        appState.voice.latestText = text || "正在聆听语音指令";
        markDirty("runtime");
      },
      onAutoStop: () => {
        appState.voice.captureStatus = "processing";
        appState.voice.commandStatus = "verifying";
        markDirty("full");
      },
    });
    const session = commandSession;
    session.done
      .then(processVoiceCommand)
      .catch(handleVoiceError)
      .finally(() => {
        commandSession = null;
        appState.voice.isListening = false;
        if (appState.voice.captureStatus !== "error") appState.voice.captureStatus = "idle";
        markDirty("full");
      });
    addLog("语音监听已启动，本条指令将重新验证声纹", "info");
    return true;
  } catch (error) {
    commandSession = null;
    handleVoiceError(error);
    return false;
  }
}

export function stopVoiceRecognition() {
  if (!commandSession) {
    addLog("语音监听未启动", "warning");
    return false;
  }
  appState.voice.captureStatus = "processing";
  appState.voice.commandStatus = "verifying";
  commandSession.stop();
  markDirty("full");
  return true;
}

async function processVoiceCommand(sample) {
  if (sample.durationMs < 1400) {
    throw Object.assign(new Error("录音过短，请持续说出完整指令"), { code: "poor_audio" });
  }

  appState.voice.captureStatus = "processing";
  appState.voice.commandStatus = "verifying";
  appState.voice.latestText = appState.voice.interimText || "正在等待智谱最终字幕";
  markDirty("full");

  const result = await verifyVoiceCommand(sample);
  appState.voice.finalText = result.transcript || "";
  appState.voice.latestText = result.transcript || "未识别到有效语音";
  appState.voice.latestConfidence = null;
  appState.voice.latestTime = new Date();
  appState.voice.requestId = result.requestId || "";
  applyVoiceVerification(result);

  if (!result.verified) {
    appState.voice.commandStatus = "rejected";
    appState.voice.lastError = result.message || "非授权用户，指令未执行";
    addLog(appState.voice.lastError, "warning");
    return false;
  }

  const executed = executeTextCommand(result.transcript, "voice", {
    voiceVerification: result,
  });
  appState.voice.commandStatus = executed ? "matched" : "unsupported";
  appState.voice.lastError = executed ? "" : "字幕已识别，但没有匹配到可执行指令";
  markDirty("full");
  return executed;
}

function handleVoiceError(error) {
  appState.voice.isListening = false;
  appState.voice.captureStatus = "error";
  appState.voice.commandStatus = "rejected";
  appState.voice.lastError = error?.message || "语音处理失败";
  appState.voice.latestTime = new Date();
  applyVoiceVerificationError(error);
  updateSpeechDiagnostics({
    supported: appState.voice.isSupported,
    error: appState.voice.lastError,
    render: false,
  });
  addLog(`语音处理失败：${appState.voice.lastError}`, "error");
  markDirty("full");
}
