import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCommand, normalizeInput, chineseToNumber, gestureMap } from "../js/commands.js";

test("normalizeInput strips punctuation and whitespace", () => {
  assert.equal(normalizeInput("  打开，客厅灯。 "), "打开客厅灯");
  assert.equal(normalizeInput(""), "");
  assert.equal(normalizeInput(null), "");
});

test("parseCommand: empty input is rejected as empty", () => {
  const r = parseCommand("");
  assert.equal(r.ok, false);
  assert.equal(r.errorType, "empty");
});

test("parseCommand: unsupported input is rejected", () => {
  const r = parseCommand("播放音乐");
  assert.equal(r.ok, false);
  assert.equal(r.errorType, "unsupported");
});

test("parseCommand: basic on/off/toggle for each device", () => {
  assert.deepEqual(parseCommand("打开客厅灯").command, { device: "light", action: "on" });
  assert.deepEqual(parseCommand("关闭空调").command, { device: "airConditioner", action: "off" });
  assert.deepEqual(parseCommand("切换风扇").command, { device: "fan", action: "toggle" });
  assert.deepEqual(parseCommand("打开窗帘").command, { device: "curtain", action: "on" });
});

test("parseCommand: short forms still work", () => {
  assert.deepEqual(parseCommand("开灯").command, { device: "light", action: "on" });
  assert.deepEqual(parseCommand("关灯").command, { device: "light", action: "off" });
  assert.deepEqual(parseCommand("开空调").command, { device: "airConditioner", action: "on" });
});

test("parseCommand: scene all on/off", () => {
  assert.deepEqual(parseCommand("全部开启").command, { device: "all", action: "on" });
  assert.deepEqual(parseCommand("关闭所有设备").command, { device: "all", action: "off" });
  assert.deepEqual(parseCommand("打开全部设备").command, { device: "all", action: "on" });
});

// --- H1: negation must NOT trigger the opposite action -----------------------

test("H1: '不要关灯' is refused, not executed as 关灯", () => {
  const r = parseCommand("不要关灯");
  assert.equal(r.ok, false);
  assert.equal(r.errorType, "negated");
});

test("H1: negation variants are all refused", () => {
  for (const phrase of ["别关风扇", "先别开灯", "不用开空调", "千万别关窗帘", "无需打开空调"]) {
    const r = parseCommand(phrase);
    assert.equal(r.ok, false, `"${phrase}" should be refused`);
    assert.equal(r.errorType, "negated", `"${phrase}" should be 'negated'`);
  }
});

test("H1: legitimate commands are not falsely flagged as negation", () => {
  assert.equal(parseCommand("打开客厅灯").ok, true);
  assert.equal(parseCommand("关闭空调").ok, true);
});

// --- A3: level / setpoint slot extraction -----------------------------------

test("level: '把灯调到50%' parses to a set command", () => {
  assert.deepEqual(parseCommand("把灯调到50%").command, { device: "light", action: "set", value: 50 });
});

test("level: '空调26度' parses to a setpoint", () => {
  assert.deepEqual(parseCommand("空调26度").command, { device: "airConditioner", action: "set", value: 26 });
});

test("level: '风扇调到3档' parses to a set command", () => {
  assert.deepEqual(parseCommand("风扇调到3档").command, { device: "fan", action: "set", value: 3 });
});

test("planned voice phrases map to deterministic device commands", () => {
  assert.deepEqual(parseCommand("打开风扇").command, { device: "fan", action: "on" });
  assert.deepEqual(parseCommand("调整空调到26度").command, {
    device: "airConditioner",
    action: "set",
    value: 26,
  });
  assert.deepEqual(parseCommand("关闭窗帘").command, { device: "curtain", action: "off" });
});

test("level: Chinese numeral '把风扇调到三档'", () => {
  assert.deepEqual(parseCommand("把风扇调到三档").command, { device: "fan", action: "set", value: 3 });
});

test("level: ratio word '灯调到一半' → 50", () => {
  assert.deepEqual(parseCommand("把灯调到一半").command, { device: "light", action: "set", value: 50 });
});

test("level: '灯光最大' → 100", () => {
  assert.deepEqual(parseCommand("灯光最大").command, { device: "light", action: "set", value: 100 });
});

test("level: 'all' with a value does not become a set command", () => {
  // Heterogeneous units can't share one setpoint; fall back to on/off semantics.
  const r = parseCommand("全部打开");
  assert.equal(r.ok, true);
  assert.equal(r.command.action, "on");
});

// --- chineseToNumber unit tests ---------------------------------------------

test("chineseToNumber handles common forms", () => {
  assert.equal(chineseToNumber("三"), 3);
  assert.equal(chineseToNumber("十"), 10);
  assert.equal(chineseToNumber("二十"), 20);
  assert.equal(chineseToNumber("二十六"), 26);
  assert.equal(chineseToNumber("一百"), 100);
  assert.equal(chineseToNumber("两"), 2);
});

test("gestureMap maps thumb gestures to home and away scenes", () => {
  assert.equal(gestureMap.Thumb_Up.scene, "home");
  assert.equal(gestureMap.Thumb_Down.scene, "away");
  assert.equal(gestureMap.Thumb_Up.label, "拇指向上");
  assert.equal(gestureMap.Thumb_Down.label, "拇指向下");
});
