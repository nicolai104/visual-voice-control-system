import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { configureRenderer, markDirty, renderNow } from "../js/scheduler.js";

// Node has no requestAnimationFrame; the scheduler falls back to setTimeout(16).
// We await a macrotask to let a scheduled flush run.
const nextTick = () => new Promise((r) => setTimeout(r, 25));

let calls;
beforeEach(() => {
  calls = [];
  configureRenderer({
    full: () => calls.push("full"),
    runtime: () => calls.push("runtime"),
  });
});

test("markDirty coalesces multiple calls into one render per frame", async () => {
  markDirty("runtime");
  markDirty("runtime");
  markDirty("runtime");
  assert.deepEqual(calls, [], "nothing renders synchronously");
  await nextTick();
  assert.equal(calls.length, 1, "burst collapses to a single render");
});

test("a full request supersedes a pending runtime request", async () => {
  markDirty("runtime");
  markDirty("full");
  await nextTick();
  assert.deepEqual(calls, ["full"]);
});

test("scope resets to runtime after a flush", async () => {
  markDirty("full");
  await nextTick();
  markDirty("runtime");
  await nextTick();
  assert.deepEqual(calls, ["full", "runtime"]);
});

test("renderNow renders synchronously", () => {
  renderNow("full");
  assert.deepEqual(calls, ["full"]);
});
