import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { appState, resetState } from "../js/state.js";
import {
  applyVoiceVerification,
  applyVoiceVerificationError,
  VOICEPRINT_THRESHOLD,
} from "../js/voiceprint.js";

beforeEach(() => resetState());

test("voiceprint state starts not enrolled with the production threshold", () => {
  assert.equal(appState.voiceprint.enrolled, false);
  assert.equal(appState.voiceprint.mode, "not_enrolled");
  assert.equal(VOICEPRINT_THRESHOLD, 0.55);
});

test("applyVoiceVerification records a successful per-command result", () => {
  appState.voiceprint.enrolled = true;
  applyVoiceVerification({
    verified: true,
    similarity: 0.913,
    threshold: 0.55,
    requestId: "request-1",
    message: "声纹验证通过",
  });
  assert.equal(appState.voiceprint.mode, "authorized");
  assert.equal(appState.voiceprint.confidence, 91);
  assert.equal(appState.voiceprint.lastRequestId, "request-1");
});

test("applyVoiceVerification records speaker rejection without clearing enrollment", () => {
  appState.voiceprint.enrolled = true;
  applyVoiceVerification({
    verified: false,
    similarity: 0.32,
    threshold: 0.55,
    requestId: "request-2",
    errorCode: "speaker_rejected",
    message: "非授权用户，指令未执行",
  });
  assert.equal(appState.voiceprint.enrolled, true);
  assert.equal(appState.voiceprint.mode, "rejected");
  assert.equal(appState.voiceprint.confidence, 32);
});

test("not_enrolled service errors clear the local enrollment flag", () => {
  appState.voiceprint.enrolled = true;
  applyVoiceVerificationError({
    code: "not_enrolled",
    message: "请先录入授权用户声纹",
  });
  assert.equal(appState.voiceprint.enrolled, false);
  assert.equal(appState.voiceprint.mode, "not_enrolled");
});
