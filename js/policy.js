import { appState } from "./state.js";

export const PROTECTED_SOURCES = new Set(["voice"]);

const consumedVoiceRequests = new Set();

export function evaluateCommandPolicy(
  source,
  voiceprint = appState.voiceprint,
  context = {},
) {
  if (!PROTECTED_SOURCES.has(source)) {
    return { allowed: true, reason: "unprotected" };
  }

  if (!voiceprint.enrolled) {
    return {
      allowed: false,
      reason: "not_enrolled",
      message: "请先录入声纹样本，再使用语音控制",
    };
  }

  const verification = context.voiceVerification;
  if (!verification?.requestId) {
    return {
      allowed: false,
      reason: "verification_required",
      message: "本条语音指令缺少实时声纹验证",
    };
  }
  if (!verification.verified || verification.errorCode) {
    return {
      allowed: false,
      reason: "unauthorized",
      message: verification.message || "非授权用户，指令未执行",
    };
  }
  if (
    typeof verification.similarity !== "number" ||
    verification.similarity < (verification.threshold ?? voiceprint.threshold ?? 0.55)
  ) {
    return {
      allowed: false,
      reason: "below_threshold",
      message: "声纹相似度低于验证阈值，指令未执行",
    };
  }

  return {
    allowed: true,
    reason: "authorized",
    requestId: verification.requestId,
    verification,
  };
}

export function authorizeCommand(source, context = {}) {
  const decision = evaluateCommandPolicy(source, appState.voiceprint, context);
  if (!PROTECTED_SOURCES.has(source)) return decision;

  if (decision.allowed && consumedVoiceRequests.has(decision.requestId)) {
    const replayDecision = {
      allowed: false,
      reason: "verification_replayed",
      message: "该声纹验证结果已被使用，请重新说出指令",
    };
    recordVerification(replayDecision, context.voiceVerification);
    return replayDecision;
  }

  if (decision.allowed) consumedVoiceRequests.add(decision.requestId);
  recordVerification(decision, context.voiceVerification);
  return decision;
}

export function recordVerification(decision, verification = null) {
  appState.voiceprint.latestTime = new Date();
  appState.voiceprint.verified = decision.allowed;
  appState.voiceprint.mode = decision.allowed ? "authorized" : "rejected";
  appState.voiceprint.lastRequestId = verification?.requestId || "";
  appState.voiceprint.similarity =
    typeof verification?.similarity === "number" ? verification.similarity : null;
  appState.voiceprint.confidence =
    typeof verification?.similarity === "number"
      ? Math.round(verification.similarity * 100)
      : null;
  appState.voiceprint.lastMessage = decision.allowed
    ? "声纹验证通过，允许执行本条语音指令"
    : decision.message || "声纹验证失败";
  return decision;
}

export function resetPolicyState() {
  consumedVoiceRequests.clear();
}
