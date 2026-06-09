# 可视化智能语音交互控制系统

可信演示版 Demo，用于课程实验、项目答辩和系统展示。项目主体是原生前端控制台，配套一个本机 Python 摄像头手势识别服务。当前阶段不接入真实智能家居硬件，不做云部署，也不提供安全级声纹认证。

## 当前真实能力

- 前端控制台：客厅灯、空调、风扇、窗帘的开关、滑块调节、状态可视化和房间仿真。
- 中文文本/语音指令：支持“打开客厅灯”“风扇调到 5 档”“灯光调到一半”“全部关闭”等常见命令。
- 命令安全解析：否定表达如“不要关灯”会被拒绝，不会被误执行成“关灯”。
- 统一控制内核：GUI、文本、语音、手势、场景模式共享 `controller -> reducer -> render` 链路。
- 真实摄像头手势：Python + OpenCV + MediaPipe Gesture Recognizer 识别 `Open_Palm` 和 `Closed_Fist`，通过 WebSocket 触发控制。
- 系统诊断面板：展示前端环境、Web Speech API、麦克风权限、摄像头服务、声纹状态和自检结果。
- 结构化自检：页面可自动跑 GUI、文本、场景、声纹拒绝、模拟手势、摄像头降级提示等路径，并生成报告。
- 本地持久化：设备状态、声纹演示状态和昼夜氛围偏好会保存在浏览器 `localStorage` 中。

## 演示模拟能力

- 声纹验证是可信演示流程，不是真实生物识别。用户需要录入固定短句“打开客厅灯并关闭风扇”，再进行验证。
- “授权测试 / 未授权测试”按钮用于演示通过和拒绝路径，不代表真实身份认证。
- 模拟手势按钮包含手掌、拳头、比耶、举手；真实摄像头识别当前只覆盖 `Open_Palm` 和 `Closed_Fist`。
- 设备控制是前端仿真状态，不会发送到 Matter、MQTT、Home Assistant、Tuya 或真实硬件。

## 运行方式

启动前端静态服务：

```powershell
cd D:\作业项目\visual-voice-control-system
node server.mjs
```

然后访问：

```text
http://localhost:5173/
```

PowerShell 若拦截 `npm.ps1`，可使用 `npm.cmd`：

```powershell
npm.cmd run verify
```

## 摄像头手势服务

安装依赖：

```powershell
python -m pip install -r requirements.txt
```

下载 MediaPipe 模型：

```powershell
python scripts/download_gesture_model.py
```

先做本机自检：

```powershell
python gesture_service.py --self-check
```

启动服务：

```powershell
python gesture_service.py
```

带预览窗口启动：

```powershell
python gesture_service.py --preview
```

默认 WebSocket 地址：

```text
ws://127.0.0.1:8765/ws/gesture
```

服务启动时会打印 host、port、camera、confidence、stable-ms、cooldown-ms 等参数。页面中的“摄像头手势”卡片也允许修改 WebSocket 地址。

## 主要文件

- `index.html`：页面结构、控制面板、诊断面板、自检报告容器。
- `css/style.css`：视觉风格、响应式布局、房间仿真和新增诊断/声纹/自检样式。
- `js/state.js`：设备目录、场景预设、全局状态、诊断状态和声纹状态。
- `js/controller.js`：统一控制入口，包含文本命令、单设备控制、滑块调节和场景执行。
- `js/reducer.js`：纯函数设备状态规约。
- `js/commands.js`：中文指令解析和手势映射。
- `js/policy.js`：语音来源的声纹门控策略。
- `js/voiceprint.js`：演示声纹录入、验证、重置和测试身份切换。
- `js/diagnostics.js`：浏览器能力、语音、摄像头、声纹、自检诊断状态。
- `js/smokeTest.js`：结构化交互自检。
- `js/persistence.js`：设备和声纹状态的 localStorage 持久化。
- `js/gestureCamera.js`：摄像头手势 WebSocket 客户端。
- `gesture_service.py`：Python 摄像头手势识别服务。
- `test/`：Node 内置测试覆盖解析、策略、规约、调度、日志、声纹、场景等逻辑。

## 开发与测试

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run verify
```

`verify` 会先对 JS 文件做语法检查，再运行单元测试。

## 手动验收建议

1. 打开页面后查看“系统诊断”，确认前端、语音、摄像头、声纹、自检状态可读。
2. 未录入声纹时尝试语音控制，应提示先录入声纹样本。
3. 录入固定短句后，授权测试用户应能通过验证，未授权测试用户应被拒绝。
4. 不启动 Python 服务时点击“开启摄像头识别”，应看到明确修复提示。
5. 启动 Python 服务后，对摄像头做五指张开或握拳，观察设备状态和日志变化。
6. 点击“运行交互自检”，确认报告显示每项通过/失败、耗时和失败原因。
7. 刷新页面后确认设备状态、声纹状态和昼夜氛围偏好仍保留。

## 后续可扩展方向

- 接入真实声纹模型：录音采样、特征提取、embedding 比对、阈值配置和活体检测。
- 接入真实设备网关：MQTT、Matter、Home Assistant、Tuya 或自定义 IoT API。
- 增加后端鉴权层：所有控制入口由后端统一授权、审计和回放。
- 扩展摄像头手势：增加更多可稳定识别的手势类别、手势校准和误触确认。
- 增加多房间、多用户、自动化规则、定时任务和设备在线状态。

## 安全提醒

当前项目是演示原型。声纹门控仅在浏览器端生效，且控制面可通过浏览器控制台访问。请勿将其用于真实门禁、安防或生产级设备控制场景。
