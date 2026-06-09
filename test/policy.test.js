import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { evaluateCommandPolicy, authorizeCommand, PROTECTED_SOURCES } from "../js/policy.js";
import { appState, resetState } from "../js/state.js";

beforeEach(() => resetState());

test("voice is a protected source; gui/gesture/text are not", () => {
  assert.equal(PROTECTED_SOURCES.has("voice"), true);
  assert.equal(PROTECTED_SOURCES.has("gui"), false);
  assert.equal(PROTECTED_SOURCES.has("gesture"), false);
  assert.equal(PROTECTED_SOURCES.has("text"), false);
});

test("unprotected sources are always allowed regardless of authorization", () => {
  const vp = { authorized: false, enrolled: false, mode: "not_enrolled" };
  for (const source of ["gui", "gesture", "text", "camera", "test"]) {
    assert.equal(evaluateCommandPolicy(source, vp).allowed, true, `${source} should pass`);
  }
});

test("voice is rejected before voiceprint enrollment", () => {
  const d = evaluateCommandPolicy("voice", { authorized: true, enrolled: false, mode: "not_enrolled" });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "not_enrolled");
});

test("voice is allowed when enrolled and authorized", () => {
  const d = evaluateCommandPolicy("voice", { authorized: true, enrolled: true, mode: "authorized" });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "authorized");
});

test("voice is rejected when unauthorized", () => {
  const d = evaluateCommandPolicy("voice", { authorized: false, enrolled: true, mode: "rejected" });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "unauthorized");
  assert.ok(d.message);
});

test("evaluateCommandPolicy is pure (does not mutate voiceprint)", () => {
  const vp = { authorized: false, enrolled: true, mode: "rejected", confidence: 96, verified: true };
  const snapshot = { ...vp };
  evaluateCommandPolicy("voice", vp);
  assert.deepEqual(vp, snapshot);
});

test("authorizeCommand records verification side-effects for protected sources", () => {
  appState.voiceprint.enrolled = true;
  appState.voiceprint.authorized = false;
  appState.voiceprint.mode = "rejected";
  const d = authorizeCommand("voice");
  assert.equal(d.allowed, false);
  assert.equal(appState.voiceprint.confidence, 42, "rejected confidence recorded");
  assert.equal(appState.voiceprint.verified, false);
});

test("authorizeCommand records authorized confidence", () => {
  appState.voiceprint.enrolled = true;
  appState.voiceprint.authorized = true;
  appState.voiceprint.mode = "authorized";
  authorizeCommand("voice");
  assert.equal(appState.voiceprint.confidence, 96);
  assert.equal(appState.voiceprint.verified, true);
});
