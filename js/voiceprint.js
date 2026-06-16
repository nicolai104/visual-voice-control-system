import { appState } from "./state.js";
import { addLog } from "./logger.js";
import { markDirty } from "./scheduler.js";
import { updateVoiceprintDiagnostics } from "./diagnostics.js";
import { startAudioCapture } from "./audioCapture.js";
import {
  deleteVoiceprintEnrollment,
  enrollVoiceprintSamples,
  fetchVoiceServiceStatus,
} from "./voiceApi.js";

export const VOICEPRINT_THRESHOLD = 0.55;

let enrollmentSamples = [];
let enrollmentSession = null;

export async function initVoiceprintService() {
  appState.voiceprint.serviceStatus = "connecting";
  appState.voiceprint.lastMessage = "正在连接声纹服务";
  markDirty("full");

  try {
    const status = await fetchVoiceServiceStatus();
    applyServiceStatus(status);
    addLog(`声纹服务状态：${status.message}`, status.service === "ready" ? "success" : "warning");
    return status;
  } catch (error) {
    appState.voiceprint.serviceStatus = "error";
    appState.voiceprint.enrolled = false;
    appState.voiceprint.mode = "error";
    appState.voiceprint.lastMessage = error.message;
    appState.voiceprint.latestTime = new Date();
    updateVoiceprintDiagnostics({ render: false });
    markDirty("full");
    addLog(`声纹服务连接失败：${error.message}`, "error");
    return null;
  }
}

export async function toggleVoiceprintEnrollment() {
  if (enrollmentSession) {
    enrollmentSession.stop();
    return true;
  }

  if (enrollmentSamples.length >= 3) enrollmentSamples = [];
  if (appState.voiceprint.enrolled && enrollmentSamples.length === 0) {
    appState.voiceprint.enrollmentSampleCount = 0;
  }
  appState.voiceprint.enrollmentSampleCount = enrollmentSamples.length;
  appState.voiceprint.isRecordingSample = true;
  appState.voiceprint.mode = "enrolling";
  appState.voiceprint.lastMessage = `请朗读固定短句，正在录制第 ${enrollmentSamples.length + 1}/3 段`;
  appState.voice.interimText = "";
  markDirty("full");

  try {
    enrollmentSession = await startAudioCapture({
      onInterim: updateInterimCaption,
      onAutoStop: () => {
        appState.voiceprint.lastMessage = "已达到 8 秒上限，正在处理当前样本";
        markDirty("full");
      },
    });
    const session = enrollmentSession;
    session.done
      .then(handleEnrollmentSample)
      .catch(handleEnrollmentError)
      .finally(() => {
        enrollmentSession = null;
        appState.voiceprint.isRecordingSample = false;
        markDirty("full");
      });
    return true;
  } catch (error) {
    enrollmentSession = null;
    appState.voiceprint.isRecordingSample = false;
    handleEnrollmentError(error);
    return false;
  }
}

export async function resetVoiceprint() {
  if (enrollmentSession) enrollmentSession.stop();
  enrollmentSamples = [];
  try {
    const result = await deleteVoiceprintEnrollment();
    applyNotEnrolled(result.message);
    addLog(result.message, "system");
    return true;
  } catch (error) {
    appState.voiceprint.mode = "error";
    appState.voiceprint.lastMessage = error.message;
    appState.voiceprint.latestTime = new Date();
    updateVoiceprintDiagnostics({ render: false });
    markDirty("full");
    addLog(`清除声纹失败：${error.message}`, "error");
    return false;
  }
}

export function applyVoiceVerification(result) {
  appState.voiceprint.verified = Boolean(result?.verified);
  appState.voiceprint.mode = result?.verified ? "authorized" : "rejected";
  appState.voiceprint.similarity =
    typeof result?.similarity === "number" ? result.similarity : null;
  appState.voiceprint.confidence =
    typeof result?.similarity === "number" ? Math.round(result.similarity * 100) : null;
  appState.voiceprint.threshold =
    typeof result?.threshold === "number" ? result.threshold : appState.voiceprint.threshold;
  appState.voiceprint.lastRequestId = result?.requestId || "";
  appState.voiceprint.lastMessage = result?.message || "声纹验证已完成";
  appState.voiceprint.latestTime = new Date();
  updateVoiceprintDiagnostics({ render: false });
  markDirty("full");
}
export function applyVoiceVerificationError(error) {
  appState.voiceprint.verified = false;
  appState.voiceprint.mode = error?.code === "not_enrolled" ? "not_enrolled" : "error";
  if (error?.code === "not_enrolled") appState.voiceprint.enrolled = false;
  appState.voiceprint.similarity = null;
  appState.voiceprint.confidence = null;
  appState.voiceprint.lastMessage = error?.message || "声纹验证失败";
  appState.voiceprint.latestTime = new Date();
  updateVoiceprintDiagnostics({ render: false });
  markDirty("full");
}

export function getEnrollmentButtonLabel() {
  const sampleNumber = Math.min(enrollmentSamples.length + 1, 3);
  return enrollmentSession ? `停止第 ${sampleNumber} 段` : `录入第 ${sampleNumber} 段`;
}

function applyServiceStatus(status) {
  appState.voiceprint.serviceStatus = status.service;
  appState.voiceprint.modelReady = Boolean(status.modelReady);
  appState.voiceprint.asrConfigured = Boolean(status.asrConfigured);
  appState.voiceprint.ffmpegReady = Boolean(status.ffmpegReady);
  appState.voiceprint.enrolled = Boolean(status.enrolled);
  appState.voiceprint.mode = status.enrolled ? "pending" : "not_enrolled";
  appState.voiceprint.verified = false;
  appState.voiceprint.threshold =
    typeof status.threshold === "number" ? status.threshold : VOICEPRINT_THRESHOLD;
  appState.voiceprint.samplePhrase = status.samplePhrase || appState.voiceprint.samplePhrase;
  appState.voiceprint.lastMessage = status.message || "声纹服务状态已更新";
  appState.voiceprint.latestTime = new Date();
  updateVoiceprintDiagnostics({ render: false });
  markDirty("full");
}

async function handleEnrollmentSample(sample) {
  if (sample.durationMs < 1400) {
    throw Object.assign(new Error("录音过短，请持续朗读至少 1.5 秒"), { code: "poor_audio" });
  }
  enrollmentSamples.push(sample);
  appState.voiceprint.enrollmentSampleCount = enrollmentSamples.length;
  appState.voiceprint.lastMessage =
    enrollmentSamples.length < 3
      ? `第 ${enrollmentSamples.length}/3 段已保存，请继续录入`
      : "三段录音完成，正在提取声纹并核对短句";
  markDirty("full");

  if (enrollmentSamples.length !== 3) return;

  try {
    const result = await enrollVoiceprintSamples(enrollmentSamples);
    appState.voiceprint.enrolled = true;
    appState.voiceprint.mode = "pending";
    appState.voiceprint.verified = false;
    appState.voiceprint.enrollmentSampleCount = 3;
    appState.voiceprint.lastMessage = result.message;
    appState.voiceprint.latestTime = new Date();
    addLog(result.message, "success");
    enrollmentSamples = [];
    updateVoiceprintDiagnostics({ render: false });
    markDirty("full");
  } catch (error) {
    enrollmentSamples = [];
    appState.voiceprint.enrollmentSampleCount = 0;
    handleEnrollmentError(error);
  }
}

function handleEnrollmentError(error) {
  appState.voiceprint.mode = appState.voiceprint.enrolled ? "pending" : "not_enrolled";
  appState.voiceprint.lastMessage = error?.message || "声纹录入失败";
  appState.voiceprint.latestTime = new Date();
  updateVoiceprintDiagnostics({ render: false });
  markDirty("full");
  addLog(`声纹录入失败：${appState.voiceprint.lastMessage}`, "error");
}

function updateInterimCaption(text) {
  appState.voice.interimText = text;
  appState.voice.latestText = text || "正在聆听固定短句";
  markDirty("runtime");
}

function applyNotEnrolled(message) {
  appState.voiceprint.enrolled = false;
  appState.voiceprint.mode = "not_enrolled";
  appState.voiceprint.verified = false;
  appState.voiceprint.similarity = null;
  appState.voiceprint.confidence = null;
  appState.voiceprint.enrollmentSampleCount = 0;
  appState.voiceprint.lastRequestId = "";
  appState.voiceprint.isRecordingSample = false;
  appState.voiceprint.lastMessage = message;
  appState.voiceprint.latestTime = new Date();
  updateVoiceprintDiagnostics({ render: false });
  markDirty("full");
}
