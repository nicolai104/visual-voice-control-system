import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { appState, resetState, VOICEPRINT_SAMPLE_PHRASE } from "../js/state.js";
import {
  enrollVoiceprint,
  resetVoiceprint,
  setVoiceprintAuthorized,
  verifyVoiceprint,
  VOICEPRINT_THRESHOLD,
} from "../js/voiceprint.js";
import { evaluateCommandPolicy } from "../js/policy.js";

beforeEach(() => resetState());

test("voiceprint starts not enrolled and rejects voice policy", () => {
  assert.equal(appState.voiceprint.enrolled, false);
  assert.equal(appState.voiceprint.mode, "not_enrolled");
  const decision = evaluateCommandPolicy("voice", appState.voiceprint);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "not_enrolled");
});

test("enrollVoiceprint records a sample and authorizes the default test identity", () => {
  const result = enrollVoiceprint(VOICEPRINT_SAMPLE_PHRASE);
  assert.equal(result.enrolled, true);
  assert.equal(appState.voiceprint.enrolled, true);
  assert.equal(appState.voiceprint.mode, "authorized");
  assert.ok(appState.voiceprint.confidence >= VOICEPRINT_THRESHOLD);
  assert.ok(appState.voiceprint.sampleSummary.includes("字"));
});

test("verifyVoiceprint passes for authorized identity and fixed phrase", () => {
  enrollVoiceprint(VOICEPRINT_SAMPLE_PHRASE);
  const result = verifyVoiceprint(VOICEPRINT_SAMPLE_PHRASE);
  assert.equal(result.ok, true);
  assert.equal(appState.voiceprint.mode, "authorized");
  assert.ok(result.confidence >= VOICEPRINT_THRESHOLD);
});

test("verifyVoiceprint fails for unauthorized identity", () => {
  enrollVoiceprint(VOICEPRINT_SAMPLE_PHRASE);
  setVoiceprintAuthorized(false);
  const result = verifyVoiceprint(VOICEPRINT_SAMPLE_PHRASE);
  assert.equal(result.ok, false);
  assert.equal(appState.voiceprint.mode, "rejected");
  assert.ok(result.confidence >= 35);
  assert.ok(result.confidence <= 65);
});

test("resetVoiceprint clears enrollment", () => {
  enrollVoiceprint(VOICEPRINT_SAMPLE_PHRASE);
  resetVoiceprint();
  assert.equal(appState.voiceprint.enrolled, false);
  assert.equal(appState.voiceprint.mode, "not_enrolled");
  assert.equal(appState.voiceprint.confidence, null);
});
