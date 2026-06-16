import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  authorizeCommand,
  evaluateCommandPolicy,
  PROTECTED_SOURCES,
  resetPolicyState,
} from "../js/policy.js";
import { appState, resetState } from "../js/state.js";

beforeEach(() => {
  resetState();
  resetPolicyState();
});

function verification(overrides = {}) {
  return {
    requestId: "voice-request-1",
    verified: true,
    similarity: 0.91,
    threshold: 0.55,
    errorCode: null,
    message: "声纹验证通过",
    ...overrides,
  };
}

test("voice is protected while gui, gesture, and text remain unprotected", () => {
  assert.equal(PROTECTED_SOURCES.has("voice"), true);
  for (const source of ["gui", "gesture", "text", "camera", "test"]) {
    assert.equal(evaluateCommandPolicy(source).allowed, true);
  }
});

test("voice is rejected before enrollment", () => {
  const decision = evaluateCommandPolicy("voice", appState.voiceprint, {
    voiceVerification: verification(),
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "not_enrolled");
});

test("voice requires a verification result for the current command", () => {
  appState.voiceprint.enrolled = true;
  const decision = evaluateCommandPolicy("voice", appState.voiceprint, {});
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "verification_required");
});

test("verified voice passes when similarity reaches the threshold", () => {
  appState.voiceprint.enrolled = true;
  const decision = evaluateCommandPolicy("voice", appState.voiceprint, {
    voiceVerification: verification(),
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "authorized");
});

test("speaker rejection and below-threshold scores are refused", () => {
  appState.voiceprint.enrolled = true;
  const rejected = evaluateCommandPolicy("voice", appState.voiceprint, {
    voiceVerification: verification({
      verified: false,
      similarity: 0.31,
      errorCode: "speaker_rejected",
    }),
  });
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.reason, "unauthorized");

  const belowThreshold = evaluateCommandPolicy("voice", appState.voiceprint, {
    voiceVerification: verification({ similarity: 0.54 }),
  });
  assert.equal(belowThreshold.allowed, false);
  assert.equal(belowThreshold.reason, "below_threshold");
});

test("a successful request id is single-use", () => {
  appState.voiceprint.enrolled = true;
  const context = { voiceVerification: verification() };
  assert.equal(authorizeCommand("voice", context).allowed, true);
  const replay = authorizeCommand("voice", context);
  assert.equal(replay.allowed, false);
  assert.equal(replay.reason, "verification_replayed");
});

test("evaluateCommandPolicy remains pure", () => {
  appState.voiceprint.enrolled = true;
  const voiceprint = { ...appState.voiceprint };
  const context = { voiceVerification: verification() };
  const snapshot = structuredClone({ voiceprint, context });
  evaluateCommandPolicy("voice", voiceprint, context);
  assert.deepEqual({ voiceprint, context }, snapshot);
});
