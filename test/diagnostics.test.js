import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { appState, resetState } from "../js/state.js";
import {
  buildFrontendDiagnostics,
  detectBrowser,
  updateSelfCheckDiagnostics,
  updateVoiceprintDiagnostics,
} from "../js/diagnostics.js";
import { createSmokeTestReport } from "../js/smokeTest.js";

beforeEach(() => resetState());

test("buildFrontendDiagnostics marks localhost as ok", () => {
  const result = buildFrontendDiagnostics({
    locationRef: { protocol: "http:", hostname: "localhost", origin: "http://localhost:5173" },
    navigatorRef: { userAgent: "Mozilla/5.0 Chrome/126.0" },
    secureContext: true,
  });
  assert.equal(result.status, "ok");
  assert.match(result.meta, /Chrome/);
});

test("detectBrowser recognizes Edge before Chrome", () => {
  assert.equal(detectBrowser("Mozilla/5.0 Chrome/126.0 Edg/126.0"), "Edge");
});

test("voiceprint diagnostics mirror appState voiceprint mode", () => {
  appState.voiceprint.enrolled = true;
  appState.voiceprint.mode = "rejected";
  appState.voiceprint.confidence = 42;
  appState.voiceprint.lastMessage = "验证失败";
  updateVoiceprintDiagnostics({ render: false });
  assert.equal(appState.diagnostics.voiceprint.status, "rejected");
  assert.equal(appState.diagnostics.voiceprint.confidence, 42);
});

test("self-check diagnostics summarize pass/fail report", () => {
  const report = createSmokeTestReport([
    { name: "A", status: "pass", durationMs: 1, error: "" },
    { name: "B", status: "fail", durationMs: 2, error: "boom" },
  ]);
  updateSelfCheckDiagnostics(report, { render: false });
  assert.equal(appState.diagnostics.selfCheck.status, "fail");
  assert.equal(appState.diagnostics.selfCheck.passed, 1);
  assert.deepEqual(appState.diagnostics.selfCheck.failures, ["B"]);
});
