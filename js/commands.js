const punctuationPattern = /[\s,，.。!！?？:：;；、"“”'‘’]/g;

export const commandMap = [
  { keywords: ["打开灯", "开灯", "打开客厅灯", "开启客厅灯", "灯光打开"], device: "light", action: "on" },
  { keywords: ["关闭灯", "关灯", "关闭客厅灯", "灯光关闭"], device: "light", action: "off" },
  { keywords: ["切换灯", "切换客厅灯", "切换灯光"], device: "light", action: "toggle" },
  { keywords: ["打开空调", "开空调", "开启空调"], device: "airConditioner", action: "on" },
  { keywords: ["关闭空调", "关空调"], device: "airConditioner", action: "off" },
  { keywords: ["切换空调"], device: "airConditioner", action: "toggle" },
  { keywords: ["打开风扇", "开风扇", "开启风扇"], device: "fan", action: "on" },
  { keywords: ["关闭风扇", "关风扇"], device: "fan", action: "off" },
  { keywords: ["切换风扇"], device: "fan", action: "toggle" },
  { keywords: ["打开窗帘", "开启窗帘", "拉开窗帘"], device: "curtain", action: "on" },
  { keywords: ["关闭窗帘", "关窗帘", "合上窗帘"], device: "curtain", action: "off" },
  { keywords: ["切换窗帘"], device: "curtain", action: "toggle" },
  { keywords: ["全部打开", "全部开启", "开启所有设备", "打开所有设备", "打开全部设备"], device: "all", action: "on" },
  { keywords: ["全部关闭", "关闭全部", "关闭所有设备", "关闭全部设备", "关掉所有设备"], device: "all", action: "off" },
];

export const gestureMap = {
  palm: {
    label: "手掌",
    actionType: "all_on",
    description: "手掌 → 全部设备补充开启",
  },
  fist: {
    label: "拳头",
    actionType: "all_minimum_off",
    description: "拳头 → 全部设备关闭至最低状态",
  },
  Open_Palm: {
    label: "五指打开全手掌",
    actionType: "all_on",
    description: "Open_Palm → 全部设备补充开启",
  },
  Closed_Fist: {
    label: "五指握拳",
    actionType: "all_minimum_off",
    description: "Closed_Fist → 全部设备关闭至最低状态",
  },
  victory: {
    label: "比耶",
    command: { device: "fan", action: "on" },
    description: "比耶 → 打开风扇",
  },
  raise: {
    label: "举手",
    command: { device: "all", action: "off" },
    description: "举手 → 关闭全部设备",
  },
};

export function normalizeInput(inputText) {
  return String(inputText || "").replace(punctuationPattern, "").trim();
}

export function parseCommand(inputText) {
  const normalizedInput = normalizeInput(inputText);

  if (!normalizedInput) {
    return {
      ok: false,
      errorType: "empty",
      message: "未检测到有效输入",
    };
  }

  const matchedCommand = commandMap.find((item) =>
    item.keywords.some((keyword) => normalizedInput.includes(normalizeInput(keyword)))
  );

  if (!matchedCommand) {
    return {
      ok: false,
      errorType: "unsupported",
      message: `暂不支持该指令：${inputText}`,
    };
  }

  return {
    ok: true,
    inputText,
    normalizedInput,
    matchedKeyword: matchedCommand.keywords[0],
    command: {
      device: matchedCommand.device,
      action: matchedCommand.action,
    },
  };
}
