import { appState } from "./state.js";
import { addLog } from "./logger.js";
import { markDirty } from "./scheduler.js";
import { evaluateCommandPolicy, recordVerification } from "./policy.js";
import { updateVoiceprintDiagnostics } from "./diagnostics.js";
import { persistVoiceprintState } from "./persistence.js";

// Owns the voiceprint authorization STATE (the user-facing 授权/未授权 switch).
// The access-control DECISION lives in policy.js so it has a single home.

export const VOICEPRINT_THRESHOLD = 80;

export function setVoiceprintAuthorized(authorized) {
  appState.voiceprint.authorized = Boolean(authorized);
  appState.voiceprint.latestTime = new Date();

  if (!appState.voiceprint.enrolled) {
    appState.voiceprint.mode = "not_enrolled";
    appState.voiceprint.verified = false;
    appState.voiceprint.confidence = null;
    appState.voiceprint.lastMessage = authorized
      ? "已切换为授权测试身份，请先录入声纹样本"
      : "已切换为未授权测试身份，请先录入声纹样本";
  } else {
    applyVerificationResult(authorized ? 96 : 42, authorized, authorized ? "授权测试身份已通过" : "未授权测试身份将被拒绝");
  }

  addLog(
    authorized ? "声纹演示身份：授权用户" : "声纹演示身份：未授权用户",
    authorized ? "info" : "warning"
  );

  persistVoiceprintState();
  updateVoiceprintDiagnostics({ render: false });
  markDirty("full");
}

export function enrollVoiceprint(sampleText) {
  const normalized = normalizeSample(sampleText);
  if (!normalized) {
    appState.voiceprint.lastMessage = "录入失败：请输入或朗读固定短句";
    appState.voiceprint.latestTime = new Date();
    addLog(appState.voiceprint.lastMessage, "warning");
    updateVoiceprintDiagnostics({ render: false });
    markDirty("full");
    return { ok: false, reason: "empty", message: appState.voiceprint.lastMessage };
  }

  const expected = normalizeSample(appState.voiceprint.samplePhrase);
  const phraseMatched = normalized === expected;
  appState.voiceprint.enrolled = true;
  appState.voiceprint.sampleSummary = summarizeSample(normalized);
  appState.voiceprint.latestTime = new Date();

  if (!phraseMatched) {
    applyVerificationResult(62, false, "声纹样本已录入，但短句与演示短句不一致");
    addLog(appState.voiceprint.lastMessage, "warning");
  } else {
    applyVerificationResult(
      appState.voiceprint.authorized ? 92 : 48,
      appState.voiceprint.authorized,
      appState.voiceprint.authorized
        ? "声纹样本录入完成，授权用户验证通过"
        : "声纹样本录入完成，当前为未授权测试身份"
    );
    addLog(
      appState.voiceprint.authorized
        ? "声纹录入完成：授权用户可使用语音控制"
        : "声纹录入完成：未授权测试身份会被拒绝",
      appState.voiceprint.authorized ? "success" : "warning"
    );
  }

  persistVoiceprintState();
  updateVoiceprintDiagnostics({ render: false });
  markDirty("full");
  return {
    ok: phraseMatched,
    enrolled: true,
    mode: appState.voiceprint.mode,
    confidence: appState.voiceprint.confidence,
    message: appState.voiceprint.lastMessage,
  };
}

export function verifyVoiceprint(sampleText) {
  if (!appState.voiceprint.enrolled) {
    appState.voiceprint.mode = "not_enrolled";
    appState.voiceprint.verified = false;
    appState.voiceprint.confidence = null;
    appState.voiceprint.latestTime = new Date();
    appState.voiceprint.lastMessage = "请先录入声纹样本，再执行验证";
    addLog(appState.voiceprint.lastMessage, "warning");
    persistVoiceprintState();
    updateVoiceprintDiagnostics({ render: false });
    markDirty("full");
    return { ok: false, reason: "not_enrolled", message: appState.voiceprint.lastMessage };
  }

  const normalized = normalizeSample(sampleText);
  const phraseMatched = normalized === normalizeSample(appState.voiceprint.samplePhrase);
  const confidence = calculateDemoConfidence(normalized, phraseMatched && appState.voiceprint.authorized);
  const passed = confidence >= VOICEPRINT_THRESHOLD && phraseMatched && appState.voiceprint.authorized;
  const message = passed
    ? `声纹验证通过（置信度 ${confidence}%）`
    : `声纹验证失败（置信度 ${confidence}%），语音控制将被拒绝`;

  applyVerificationResult(confidence, passed, message);
  addLog(message, passed ? "success" : "warning");
  persistVoiceprintState();
  updateVoiceprintDiagnostics({ render: false });
  markDirty("full");

  return {
    ok: passed,
    reason: passed ? "authorized" : "rejected",
    confidence,
    message,
  };
}

export function resetVoiceprint() {
  appState.voiceprint.authorized = true;
  appState.voiceprint.enrolled = false;
  appState.voiceprint.mode = "not_enrolled";
  appState.voiceprint.verified = false;
  appState.voiceprint.confidence = null;
  appState.voiceprint.sampleSummary = "";
  appState.voiceprint.lastMessage = "声纹样本已清除，请重新录入";
  appState.voiceprint.latestTime = new Date();
  addLog("声纹样本已清除", "system");
  persistVoiceprintState();
  updateVoiceprintDiagnostics({ render: false });
  markDirty("full");
}

// Back-compat shim: evaluate the voice policy and record the verification
// side-effects. Prefer authorizeCommand(source) from policy.js for new code.
export function canExecuteVoiceCommand() {
  const decision = evaluateCommandPolicy("voice");
  recordVerification(decision);
  return decision.allowed;
}

function applyVerificationResult(confidence, passed, message) {
  appState.voiceprint.mode = passed ? "authorized" : "rejected";
  appState.voiceprint.verified = passed;
  appState.voiceprint.confidence = confidence;
  appState.voiceprint.lastMessage = message;
  appState.voiceprint.latestTime = new Date();
}

function calculateDemoConfidence(sample, canPass) {
  const wobble = hashSample(sample) % (canPass ? 9 : 31);
  return canPass ? 88 + wobble : 35 + wobble;
}

function hashSample(sample) {
  let hash = 0;
  for (const ch of sample) {
    hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  }
  return hash;
}

function normalizeSample(sampleText) {
  return String(sampleText || "").replace(/[\s,，.。!！?？:：;；、"“”'‘’]/g, "").trim();
}

function summarizeSample(sample) {
  return `${sample.slice(0, 4)}…${sample.slice(-4)} · ${sample.length}字`;
}
