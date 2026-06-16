# 可视化智能语音交互控制系统

项目包含 React 产品 Landing Page、原生前端控制台、本机 Python 摄像头手势识别服务，以及独立 FastAPI 声纹与智谱语音识别服务。当前阶段不接入真实智能家居硬件；声纹使用真实说话人向量比对，但不包含活体检测。

## 当前真实能力

- 前端控制台：客厅灯、空调、风扇、窗帘的开关、滑块调节、状态可视化和房间仿真。
- 中文文本/语音指令：支持“打开客厅灯”“风扇调到 5 档”“灯光调到一半”“全部关闭”等常见命令。
- 命令安全解析：否定表达如“不要关灯”会被拒绝，不会被误执行成“关灯”。
- 统一控制内核：GUI、文本、语音、手势、场景模式共享 `controller -> reducer -> render` 链路。
- 真实摄像头手势：Python + OpenCV + MediaPipe Gesture Recognizer 识别 `Open_Palm`、`Closed_Fist`、`Thumb_Up`、`Thumb_Down`，通过 WebSocket 触发控制。
- 系统诊断面板：展示浏览器录音、临时字幕、麦克风权限、摄像头服务、声纹服务和自检结果。
- 结构化自检：页面可自动跑 GUI、文本、场景、声纹拒绝、模拟手势、摄像头降级提示等路径，并生成报告。
- 本地持久化：设备状态和昼夜氛围偏好保存在浏览器 `localStorage` 中；声纹模板只保存在服务器。

## 语音与声纹能力

- 声纹录入需要连续朗读固定短句“打开客厅灯并关闭风扇”三次。每条语音指令都会重新完成声纹比对，验证结果不可复用。
- 智谱 `GLM-ASR-2512` 负责最终字幕，浏览器 Web Speech API 仅用于可选的临时字幕。

## 真实声纹与智谱语音服务

生产环境建议使用 Python 3.9 或 3.10。WeSpeaker/PyTorch 当前不建议在项目开发机的 Python 3.13 环境直接安装。

```powershell
python -m venv .venv-voice
.\.venv-voice\Scripts\Activate.ps1
python -m pip install -r requirements-voice.txt
$env:ZHIPUAI_API_KEY="your-server-side-key"
python -m voice_service
```

服务器还必须安装 FFmpeg。服务默认监听 `127.0.0.1:8780`，前端统一访问 `/api/voice/`，API Key 不会进入浏览器或构建产物。

接口：

- `GET /api/voice/status`
- `POST /api/voice/enroll`，multipart 字段 `samples`，必须为三段录音
- `POST /api/voice/verify-command`，multipart 字段 `audio`
- `DELETE /api/voice/enrollment`

声纹模板只保存归一化 embedding，默认位置为 `data/voiceprints/owner.json`。原始录音仅存在于系统临时目录，处理成功或失败后都会删除。

## 仍为仿真的能力

- 模拟手势按钮包含手掌、拳头、拇指向上、拇指向下、比耶、举手；真实摄像头识别当前覆盖 `Open_Palm`、`Closed_Fist`、`Thumb_Up`、`Thumb_Down`。
- 设备控制是前端仿真状态，不会发送到 Matter、MQTT、Home Assistant、Tuya 或真实硬件。

## 运行方式

安装依赖并启动 Vite 开发服务器：

```powershell
cd D:\作业项目\visual-voice-control-system
npm.cmd install
npm.cmd run dev
```

页面路由：

```text
http://127.0.0.1:5173/       产品 Landing Page
http://127.0.0.1:5173/app/   原有控制台
```

构建和预览生产产物：

```powershell
npm.cmd run build
npm.cmd run preview
```

`dist/` 可直接部署到 Nginx 或其他静态服务器，示例配置见 `deploy/nginx.conf`。

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

- `index.html`、`src/landing/`：React Landing Page 入口、组件、动效和响应式样式。
- `app/index.html`：原有控制台页面结构、诊断面板和自检报告容器。
- `assets-source/landing/`：原创家居视觉母图。
- `public/assets/landing/`：AVIF/WebP 响应式图片和真实控制台预览。
- `css/style.css`：视觉风格、响应式布局、房间仿真和新增诊断/声纹/自检样式。
- `js/state.js`：设备目录、场景预设、全局状态、诊断状态和声纹状态。
- `js/controller.js`：统一控制入口，包含文本命令、单设备控制、滑块调节和场景执行。
- `js/reducer.js`：纯函数设备状态规约。
- `js/commands.js`：中文指令解析和手势映射。
- `js/policy.js`：语音来源的声纹门控策略。
- `js/voiceprint.js`：三段声纹录入、服务状态同步和验证结果展示。
- `js/voiceApi.js`、`js/audioCapture.js`：同源语音 API 和浏览器录音/临时字幕。
- `voice_service/`：FastAPI、智谱 ASR、WeSpeaker embedding、音频质量检查和模板持久化。
- `js/diagnostics.js`：浏览器能力、语音、摄像头、声纹、自检诊断状态。
- `js/smokeTest.js`：结构化交互自检。
- `js/persistence.js`：设备状态的 localStorage 持久化。
- `js/gestureCamera.js`：摄像头手势 WebSocket 客户端。
- `gesture_service.py`：Python 摄像头手势识别服务。
- `test/`：Node 内置测试覆盖解析、策略、规约、调度、日志、声纹、场景等逻辑。
- `e2e/`：Playwright 覆盖 Landing 路由、场景交互和控制台入口。

## 开发与测试

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run verify
```

`verify` 会依次执行 JavaScript 语法检查、Node 测试、Python 语音服务测试、生产构建和浏览器关键路径测试。

重新生成真实控制台预览图时，先运行生产预览服务，再执行：

```powershell
npm.cmd run assets:console
```

## 部署

将 `dist/` 上传到服务器后，让 `/` 返回 `dist/index.html`，让 `/app/` 返回 `dist/app/index.html`。HTML 应使用 `no-cache`，带哈希的 JS、CSS、字体和图片可使用长期缓存。Nginx 示例同时配置了 Gzip；服务器支持 Brotli 时可在对应模块中开启。

语音服务需要持久化目录和服务器端环境文件：

```bash
sudo install -d -o www-data -g www-data -m 750 \
  /var/lib/visual-voice-control-system/voiceprints
sudo install -d -o root -g www-data -m 750 \
  /etc/visual-voice-control-system
```

`/etc/visual-voice-control-system/voice.env` 至少应包含：

```dotenv
ZHIPUAI_API_KEY=replace-with-server-side-key
VOICEPRINT_DATA_DIR=/var/lib/visual-voice-control-system/voiceprints
FFMPEG_PATH=ffmpeg
```

安装 FFmpeg、创建 Python 3.9/3.10 虚拟环境并安装 `requirements-voice.txt` 后，可使用 `deploy/voice-service.service` 启动服务。该 unit 将 WeSpeaker 模型缓存限制在 `/var/lib/visual-voice-control-system`，声纹模板目录应挂载到持久化卷。

## 手动验收建议

1. 打开页面后查看“系统诊断”，确认前端、语音、摄像头、声纹、自检状态可读。
2. 未录入声纹时尝试语音控制，应提示先录入声纹样本。
3. 连续录入三段固定短句后，使用同一说话人发出指令应通过；其他说话人应被拒绝。
4. 不启动 Python 服务时点击“开启摄像头识别”，应看到明确修复提示。
5. 启动 Python 服务后，对摄像头做五指张开、握拳、拇指向上或拇指向下，观察设备状态和日志变化。
6. 点击“运行交互自检”，确认报告显示每项通过/失败、耗时和失败原因。
7. 刷新页面后确认设备状态、昼夜氛围和服务器声纹录入状态仍正确恢复。

## 后续可扩展方向

- 后续可增加录音回放检测、活体检测和多家庭成员声纹管理。
- 接入真实设备网关：MQTT、Matter、Home Assistant、Tuya 或自定义 IoT API。
- 增加后端鉴权层：所有控制入口由后端统一授权、审计和回放。
- 扩展摄像头手势：增加更多可稳定识别的手势类别、手势校准和误触确认。
- 增加多房间、多用户、自动化规则、定时任务和设备在线状态。

## 安全提醒

声纹门控由后端真实 embedding 比对驱动，但尚未实现回放攻击检测和活体检测。请勿将其用于门禁、支付、安防或其他高风险身份认证场景。
