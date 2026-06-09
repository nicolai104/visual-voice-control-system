import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { addLog, subscribeLog, clearLogs } from "../js/logger.js";
import { appState } from "../js/state.js";

beforeEach(() => clearLogs());

test("addLog returns the entry with id/time/type/message", () => {
  const entry = addLog("hello", "success");
  assert.equal(entry.message, "hello");
  assert.equal(entry.type, "success");
  assert.ok(entry.id);
  assert.ok(entry.time instanceof Date);
});

test("subscribeLog notifies on every addLog", () => {
  const seen = [];
  const unsub = subscribeLog((e) => seen.push(e));
  addLog("a", "info");
  addLog("b", "error");
  assert.equal(seen.length, 2);
  assert.equal(seen[0].message, "a");
  assert.equal(seen[1].type, "error");
  unsub();
});

test("unsubscribe stops notifications", () => {
  let count = 0;
  const unsub = subscribeLog(() => count++);
  addLog("x");
  unsub();
  addLog("y");
  assert.equal(count, 1, "no notification after unsubscribe");
});

test("addLog still trims to MAX_LOGS regardless of subscribers", () => {
  for (let i = 0; i < 90; i++) addLog(`m${i}`);
  assert.ok(appState.logs.length <= 80);
});
