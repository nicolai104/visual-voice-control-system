import { appState } from "./state.js";

// Access-control policy layer.
//
// Centralizes "is this command allowed to run?" so the decision is no longer
// buried inside the command dispatcher (architecture issue A6). The set of
// protected sources is declared here in one place; the decision function is
// pure (no state mutation) so it can be unit-tested, and the verification
// side-effects are recorded separately via recordVerification().
//
// NOTE: this is a DEMO gate, not real security. It is enforced only on the
// client and the whole control surface is reachable from the console — see the
// README's "已知限制 / 安全提醒" section. Treat it as a UX simulation of
// voiceprint gating, not an access-control boundary.

// Sources that must pass voiceprint verification before they can control devices.
// Adding e.g. "camera" here would extend the gate to camera gestures.
export const PROTECTED_SOURCES = new Set(["voice"]);

const CONFIDENCE_AUTHORIZED = 96;
const CONFIDENCE_REJECTED = 42;

// Pure: decide whether a command from `source` may execute, given the current
// voiceprint authorization. Does NOT mutate state.
export function evaluateCommandPolicy(source, voiceprint = appState.voiceprint) {
  if (!PROTECTED_SOURCES.has(source)) {
    return { allowed: true, reason: "unprotected" };
  }

  if (!voiceprint.enrolled || voiceprint.mode === "not_enrolled") {
    return {
      allowed: false,
      reason: "not_enrolled",
      message: "请先录入声纹样本，再使用语音控制",
    };
  }

  if (!voiceprint.authorized || voiceprint.mode !== "authorized") {
    return { allowed: false, reason: "unauthorized", message: "非授权用户，已拒绝控制" };
  }
  return { allowed: true, reason: "authorized" };
}

// Records the verification outcome on appState (the side-effect half that used
// to be tangled into canExecuteVoiceCommand's return path).
export function recordVerification(decision) {
  appState.voiceprint.latestTime = new Date();
  appState.voiceprint.verified = decision.allowed;

  if (!appState.voiceprint.enrolled) {
    appState.voiceprint.mode = "not_enrolled";
    appState.voiceprint.confidence = null;
    appState.voiceprint.lastMessage = decision.message || "请先录入声纹样本";
  } else if (decision.allowed) {
    appState.voiceprint.mode = "authorized";
    appState.voiceprint.confidence =
      typeof appState.voiceprint.confidence === "number" ? appState.voiceprint.confidence : CONFIDENCE_AUTHORIZED;
    appState.voiceprint.lastMessage = "声纹验证通过，允许语音控制";
  } else {
    appState.voiceprint.mode = "rejected";
    appState.voiceprint.confidence =
      typeof appState.voiceprint.confidence === "number" ? appState.voiceprint.confidence : CONFIDENCE_REJECTED;
    appState.voiceprint.lastMessage = decision.message || "非授权用户，已拒绝控制";
  }
  return decision;
}

// Convenience used by the controller: evaluate + record in one call.
export function authorizeCommand(source) {
  const decision = evaluateCommandPolicy(source);
  if (PROTECTED_SOURCES.has(source)) {
    recordVerification(decision);
  }
  return decision;
}
