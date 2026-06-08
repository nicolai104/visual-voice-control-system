import { appState } from "./state.js";
import { addLog } from "./logger.js";
import { renderApp } from "./renderer.js";

export function setVoiceprintAuthorized(authorized) {
  appState.voiceprint.authorized = Boolean(authorized);
  appState.voiceprint.verified = Boolean(authorized);
  appState.voiceprint.confidence = authorized ? 96 : 42;
  appState.voiceprint.latestTime = new Date();

  if (authorized) {
    addLog("声纹验证：授权用户 验证通过（置信度 96%）", "success");
  } else {
    addLog("声纹验证：非授权用户 验证失败，语音控制将被拒绝", "warning");
  }

  renderApp();
}

export function canExecuteVoiceCommand() {
  appState.voiceprint.latestTime = new Date();
  appState.voiceprint.verified = appState.voiceprint.authorized;

  if (!appState.voiceprint.authorized) {
    appState.voiceprint.confidence = 42;
    return false;
  }

  appState.voiceprint.confidence = 96;
  return true;
}
