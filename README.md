# 可视化智能语音交互控制系统

工程化拆分版 Demo，用于课程实验、项目答辩和系统演示。主体为前端页面，真实摄像头手势识别通过本机 Python 服务接入。

## 功能范围

- GUI 控制：客厅灯、空调、风扇、窗帘、全部开启、全部关闭。
- 中文指令解析：支持“打开客厅灯”“关闭空调”“开启所有设备”等常见命令。
- 语音控制：使用浏览器 Web Speech API，推荐 Chrome / Edge。
- 模拟手势：手掌、拳头、比耶、举手映射到设备控制。
- 摄像头手势：通过 Python + OpenCV + MediaPipe Gesture Recognizer 识别 `Open_Palm` 和 `Closed_Fist`。
- 模拟声纹：授权 / 未授权模式切换；未授权用户的语音控制会被拒绝。
- 可视化反馈：灯光发光、空调气流、风扇旋转、窗帘开合、状态灯和日志动效。
- 自检入口：页面右侧“运行交互自检”会自动跑 GUI、手势、声纹拒绝和异常指令路径。

## 运行方式

在项目目录启动本地静态服务：

```powershell
cd D:\作业项目\visual-voice-control-system
node server.mjs
```

然后访问：

```text
http://localhost:5173/
```

语音识别和麦克风权限建议通过 `localhost` 打开，不建议直接双击 `index.html`。

## 主要文件

- `index.html`：页面结构。
- `css/style.css`：视觉风格、布局、设备动效、响应式适配。
- `js/app.js`：程序入口和事件绑定。
- `js/state.js`：全局状态。
- `js/commands.js`：中文指令字典和解析。
- `js/controller.js`：统一控制入口。
- `js/renderer.js`：界面渲染和图标渲染。
- `js/voice.js`：语音识别接入。
- `js/gesture.js`：模拟手势识别。
- `js/gestureCamera.js`：摄像头手势识别 WebSocket 客户端。
- `js/voiceprint.js`：模拟声纹身份鉴别。
- `js/logger.js`：实时日志。
- `server.mjs`：无依赖本地静态服务，默认监听 `http://127.0.0.1:5173/`。
- `gesture_service.py`：Python 摄像头手势识别服务，默认监听 `ws://127.0.0.1:8765/ws/gesture`。
- `requirements.txt`：Python 手势识别依赖。
- `start-gesture-service.ps1`：摄像头识别服务启动脚本。

## 真实摄像头手势识别

建议使用 Python 3.10-3.12 环境运行 MediaPipe；如果当前 Python 版本无法安装 `mediapipe`，请新建兼容版本虚拟环境。

安装依赖：

```powershell
cd D:\作业项目\visual-voice-control-system
python -m pip install -r requirements.txt
```

下载 MediaPipe 手势模型：

```powershell
python scripts/download_gesture_model.py
```

启动摄像头识别服务：

```powershell
python gesture_service.py
```

也可以使用项目脚本：

```powershell
.\start-gesture-service.ps1
```

带摄像头预览窗口启动：

```powershell
python gesture_service.py --preview
```

用静态图片测试识别：

```powershell
python gesture_service.py --test-images "D:\path\open-palm.jpg" "D:\path\fist.jpg"
```

手势映射：

- `Open_Palm`：五指打开全手掌，全部设备补充开启。已开启设备保持当前值，未开启设备恢复默认开启值。
- `Closed_Fist`：五指握拳，全部设备关闭或降到最低状态。灯光 0%、空调 16°C 并关闭、风扇 0档、窗帘 0%。

前端使用方式：

1. 先运行 `node server.mjs` 打开前端页面。
2. 再运行 `python gesture_service.py`。
3. 在页面“手势控制”区域点击“开启摄像头识别”。
4. 对摄像头做五指打开或握拳，观察设备状态和日志。

## 测试建议

1. 点击设备手动控制按钮，确认状态文字、状态灯和仿真动效同步变化。
2. 在文本指令测试中输入“打开客厅灯”“关闭空调”“关闭全部设备”等命令。
3. 切换为“未授权用户”，再用语音或自检路径执行控制，确认系统拒绝执行。
4. 点击手势按钮，确认“手掌 / 拳头 / 比耶 / 举手”能触发对应设备动作；该入口也是摄像头服务未启动时的降级测试。
5. 点击“运行交互自检”，观察日志中的成功、异常和拒绝路径。

## 已知限制

- 真实摄像头手势识别需要额外安装 Python 依赖并下载 `models/gesture_recognizer.task`。
- 真实声纹特征提取暂未接入，当前为可演示的授权状态模拟。
- Web Speech API 的可用性取决于浏览器、麦克风权限和网络环境。
