import { LEVEL_SETTINGS } from "./state.js";

const punctuationPattern = /[\s,，.。!！?？:：;；、"“”'‘’]/g;

// --- Slot tables -------------------------------------------------------------
// Ordered so multi-character aliases are tried before their substrings.
const DEVICE_ALIASES = {
  light: ["客厅灯", "灯光", "灯"],
  airConditioner: ["空调", "冷气"],
  fan: ["风扇", "电扇"],
  curtain: ["窗帘", "帘"],
  all: ["全部设备", "所有设备", "所有的设备", "全部的设备", "全部", "所有"],
};

// Action verbs. Each device's natural verbs are unioned; matching is by the
// earliest position in the input, so "打开空调" resolves to on, not a stray 关.
const ACTION_VERBS = {
  on: ["打开", "开启", "启动", "拉开", "开"],
  off: ["关闭", "关掉", "关上", "合上", "关"],
  toggle: ["切换"],
};

// Verbs that introduce a level/setpoint value.
const SET_VERBS = ["调到", "调至", "调成", "设为", "设成", "设置为", "设置成", "调节到", "调", "设", "到"];

// Negation markers. If any appears we refuse rather than risk doing the
// opposite of the user's intent (bug H1: "不要关灯" must NOT close the light).
const NEGATION_MARKERS = ["不要", "不用", "不需要", "无需", "没必要", "千万别", "先别", "别", "勿", "甭", "不想"];
const NEGATION_PATTERN = /不[要用想需开关闭]/;

// Ratio words map to a fraction of the device's [min, max] range.
const RATIO_WORDS = [
  { words: ["最大", "最高", "最亮", "最强", "最快", "全开"], ratio: 1 },
  { words: ["最小", "最低", "最暗", "最弱", "最慢", "最少"], ratio: 0 },
  { words: ["一半", "过半", "中等"], ratio: 0.5 },
];

const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const CN_NUMERAL_RUN = /[零一二两三四五六七八九十百]+/;

export const gestureMap = {
  palm: { label: "手掌", actionType: "all_on", description: "手掌 → 全部设备补充开启" },
  fist: { label: "拳头", actionType: "all_minimum_off", description: "拳头 → 全部设备关闭至最低状态" },
  Open_Palm: { label: "五指打开全手掌", actionType: "all_on", description: "Open_Palm → 全部设备补充开启" },
  Closed_Fist: { label: "五指握拳", actionType: "all_minimum_off", description: "Closed_Fist → 全部设备关闭至最低状态" },
  victory: { label: "比耶", command: { device: "fan", action: "on" }, description: "比耶 → 打开风扇" },
  raise: { label: "举手", command: { device: "all", action: "off" }, description: "举手 → 关闭全部设备" },
};

export function normalizeInput(inputText) {
  return String(inputText || "").replace(punctuationPattern, "").trim();
}

// Converts a Chinese numeral run (零..九, 十, 百; up to 100) to a number.
export function chineseToNumber(run) {
  if (!run) return NaN;
  if (run === "十") return 10;

  if (run.includes("百")) {
    const idx = run.indexOf("百");
    const hundreds = idx === 0 ? 1 : CN_DIGITS[run[idx - 1]] ?? 1;
    const rest = run.slice(idx + 1);
    return hundreds * 100 + (rest ? chineseToNumber(rest) || 0 : 0);
  }

  if (run.includes("十")) {
    const idx = run.indexOf("十");
    const tens = idx === 0 ? 1 : CN_DIGITS[run[idx - 1]] ?? 1;
    const rest = run.slice(idx + 1);
    const ones = rest ? CN_DIGITS[rest[0]] ?? 0 : 0;
    return tens * 10 + ones;
  }

  let n = 0;
  let matched = false;
  for (const ch of run) {
    if (ch in CN_DIGITS) {
      n = n * 10 + CN_DIGITS[ch];
      matched = true;
    }
  }
  return matched ? n : NaN;
}

function earliestMatch(text, tokens) {
  let best = -1;
  for (const token of tokens) {
    const idx = text.indexOf(token);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

function detectDevice(text) {
  let chosen = null;
  let bestIdx = Infinity;
  for (const [device, aliases] of Object.entries(DEVICE_ALIASES)) {
    const idx = earliestMatch(text, aliases);
    if (idx !== -1 && idx < bestIdx) {
      bestIdx = idx;
      chosen = device;
    }
  }
  return chosen;
}

function detectAction(text) {
  const candidates = [
    { action: "toggle", idx: earliestMatch(text, ACTION_VERBS.toggle) },
    { action: "off", idx: earliestMatch(text, ACTION_VERBS.off) },
    { action: "on", idx: earliestMatch(text, ACTION_VERBS.on) },
  ].filter((c) => c.idx !== -1);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.idx - b.idx);
  return candidates[0].action;
}

// Returns { kind: "absolute", value } | { kind: "ratio", ratio } | null.
function detectValue(text) {
  for (const { words, ratio } of RATIO_WORDS) {
    if (earliestMatch(text, words) !== -1) return { kind: "ratio", ratio };
  }

  const arabic = text.match(/\d{1,3}/);
  if (arabic) return { kind: "absolute", value: Number(arabic[0]) };

  const cn = text.match(CN_NUMERAL_RUN);
  if (cn) {
    const value = chineseToNumber(cn[0]);
    if (Number.isFinite(value)) return { kind: "absolute", value };
  }
  return null;
}

function resolveLevelValue(deviceKey, valueSlot) {
  const settings = LEVEL_SETTINGS[deviceKey];
  if (!settings) return null;
  if (valueSlot.kind === "ratio") {
    return Math.round(settings.min + valueSlot.ratio * (settings.max - settings.min));
  }
  return valueSlot.value;
}

export function parseCommand(inputText) {
  const normalizedInput = normalizeInput(inputText);

  if (!normalizedInput) {
    return { ok: false, errorType: "empty", message: "未检测到有效输入" };
  }

  if (earliestMatch(normalizedInput, NEGATION_MARKERS) !== -1 || NEGATION_PATTERN.test(normalizedInput)) {
    return {
      ok: false,
      errorType: "negated",
      message: `检测到否定表达，未执行：${inputText}`,
    };
  }

  const device = detectDevice(normalizedInput);
  if (!device) {
    return { ok: false, errorType: "unsupported", message: `暂不支持该指令：${inputText}` };
  }

  const hasSetVerb = earliestMatch(normalizedInput, SET_VERBS) !== -1;
  const valueSlot = detectValue(normalizedInput);
  const explicitAction = detectAction(normalizedInput);

  // A value (or an explicit "调到/设为" verb with a value) means a level command,
  // unless it targets "all" (heterogeneous units can't share one setpoint).
  if (valueSlot && device !== "all" && (hasSetVerb || !explicitAction || explicitAction === "on")) {
    const value = resolveLevelValue(device, valueSlot);
    if (value === null) {
      return { ok: false, errorType: "unsupported", message: `暂不支持该指令：${inputText}` };
    }
    return {
      ok: true,
      inputText,
      normalizedInput,
      command: { device, action: "set", value },
    };
  }

  if (!explicitAction) {
    return { ok: false, errorType: "unsupported", message: `暂不支持该指令：${inputText}` };
  }

  return {
    ok: true,
    inputText,
    normalizedInput,
    command: { device, action: explicitAction },
  };
}
