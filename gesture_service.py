"""Camera gesture recognition service for the voice-control demo.

The service reads the local webcam with OpenCV, recognizes hand gestures with
MediaPipe Gesture Recognizer, and publishes stable trigger events over
WebSocket for the frontend.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ACCEPTED_GESTURES = {
    "Open_Palm": {
        "label": "五指打开全手掌",
        "action": "all_on",
        "description": "全部设备补充开启",
    },
    "Closed_Fist": {
        "label": "五指握拳",
        "action": "all_minimum_off",
        "description": "全部设备关闭或降至最低状态",
    },
    "Thumb_Up": {
        "label": "拇指向上",
        "action": "scene_home",
        "description": "执行回家场景",
    },
    "Thumb_Down": {
        "label": "拇指向下",
        "action": "scene_away",
        "description": "执行离家场景",
    },
}


@dataclass
class GestureObservation:
    gesture: str | None
    label: str
    confidence: float
    accepted: bool
    stable_ms: int
    status: str


@dataclass
class GestureTrigger:
    gesture: str
    label: str
    action: str
    confidence: float
    stable_ms: int


class GestureStabilizer:
    def __init__(self, confidence_threshold: float, stable_ms: int, cooldown_ms: int) -> None:
        self.confidence_threshold = confidence_threshold
        self.stable_ms = stable_ms
        self.cooldown_ms = cooldown_ms
        self.pending_gesture: str | None = None
        self.pending_since_ms = 0
        self.cooldown_until_ms = 0

    def update(self, gesture: str | None, confidence: float, now_ms: int) -> tuple[GestureObservation, GestureTrigger | None]:
        if gesture not in ACCEPTED_GESTURES or confidence < self.confidence_threshold:
            self.pending_gesture = None
            observation = GestureObservation(
                gesture=gesture,
                label=self._label_for(gesture),
                confidence=confidence,
                accepted=False,
                stable_ms=0,
                status="low_confidence" if gesture else "no_hand",
            )
            return observation, None

        if now_ms < self.cooldown_until_ms:
            stable_ms = max(0, now_ms - self.pending_since_ms)
            observation = GestureObservation(
                gesture=gesture,
                label=ACCEPTED_GESTURES[gesture]["label"],
                confidence=confidence,
                accepted=True,
                stable_ms=stable_ms,
                status="cooldown",
            )
            return observation, None

        if gesture != self.pending_gesture:
            self.pending_gesture = gesture
            self.pending_since_ms = now_ms

        stable_ms = now_ms - self.pending_since_ms
        observation = GestureObservation(
            gesture=gesture,
            label=ACCEPTED_GESTURES[gesture]["label"],
            confidence=confidence,
            accepted=True,
            stable_ms=stable_ms,
            status="stabilizing",
        )

        if stable_ms < self.stable_ms:
            return observation, None

        self.cooldown_until_ms = now_ms + self.cooldown_ms
        self.pending_gesture = None
        trigger_info = ACCEPTED_GESTURES[gesture]
        trigger = GestureTrigger(
            gesture=gesture,
            label=trigger_info["label"],
            action=trigger_info["action"],
            confidence=confidence,
            stable_ms=stable_ms,
        )
        observation.status = "triggered"
        return observation, trigger

    @staticmethod
    def _label_for(gesture: str | None) -> str:
        if gesture in ACCEPTED_GESTURES:
            return ACCEPTED_GESTURES[gesture]["label"]
        return gesture or "未检测到手势"


def import_runtime_modules() -> tuple[Any, Any, Any, Any]:
    try:
        import cv2  # type: ignore
        import mediapipe as mp  # type: ignore
        import websockets  # type: ignore
        from mediapipe.tasks.python import vision  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "缺少手势识别依赖。请先运行：python -m pip install -r requirements.txt\n"
            f"导入失败：{exc}"
        ) from exc

    return cv2, mp, vision, websockets


def create_recognizer(model_path: Path, running_mode: str) -> Any:
    if not model_path.exists():
        raise SystemExit(
            f"未找到 MediaPipe 模型文件：{model_path}\n"
            "请运行：python scripts/download_gesture_model.py\n"
            "或手动下载 gesture_recognizer.task 放入 models/ 目录。"
        )

    _, mp, vision, _ = import_runtime_modules()
    mode = vision.RunningMode.IMAGE if running_mode == "image" else vision.RunningMode.VIDEO
    # On Windows, MediaPipe's native layer can fail to open non-ASCII paths
    # such as D:\作业项目\..., so pass the model bytes instead of a file path.
    options = vision.GestureRecognizerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_buffer=model_path.read_bytes()),
        running_mode=mode,
        num_hands=1,
    )
    return vision.GestureRecognizer.create_from_options(options)


def recognize_frame(recognizer: Any, frame: Any, timestamp_ms: int | None = None) -> tuple[str | None, float]:
    cv2, mp, _, _ = import_runtime_modules()
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

    if timestamp_ms is None:
        result = recognizer.recognize(image)
    else:
        result = recognizer.recognize_for_video(image, timestamp_ms)

    if not result.gestures or not result.gestures[0]:
        return None, 0.0

    top_category = result.gestures[0][0]
    return top_category.category_name, float(top_category.score)


def event_payload(event_type: str, **payload: Any) -> str:
    return json.dumps({"type": event_type, "timestamp": time.time(), **payload}, ensure_ascii=False)


async def broadcast(clients: set[Any], event: str) -> None:
    if not clients:
        return

    disconnected: list[Any] = []
    for client in clients:
        try:
            await client.send(event)
        except Exception:
            disconnected.append(client)

    for client in disconnected:
        clients.discard(client)


async def run_camera_loop(args: argparse.Namespace, clients: set[Any]) -> None:
    cv2, _, _, _ = import_runtime_modules()
    recognizer = create_recognizer(args.model, "video")
    stabilizer = GestureStabilizer(args.confidence, args.stable_ms, args.cooldown_ms)

    capture = cv2.VideoCapture(args.camera)
    if not capture.isOpened():
        await broadcast(
            clients,
            event_payload(
                "error",
                message=f"无法打开摄像头 index={args.camera}",
            ),
        )
        return

    await broadcast(clients, event_payload("status", state="camera_opened", message="摄像头已打开，开始识别"))

    last_observation_sent_ms = 0

    try:
        while True:
            ok, frame = capture.read()
            now_ms = int(time.time() * 1000)

            if not ok:
                await broadcast(clients, event_payload("warning", message="摄像头帧读取失败"))
                await asyncio.sleep(0.08)
                continue

            gesture, confidence = recognize_frame(recognizer, frame, now_ms)
            observation, trigger = stabilizer.update(gesture, confidence, now_ms)

            if trigger:
                await broadcast(
                    clients,
                    event_payload(
                        "trigger",
                        gesture=trigger.gesture,
                        label=trigger.label,
                        action=trigger.action,
                        confidence=round(trigger.confidence, 4),
                        stableMs=trigger.stable_ms,
                    ),
                )
            elif now_ms - last_observation_sent_ms >= args.observation_interval_ms:
                await broadcast(
                    clients,
                    event_payload(
                        "observation",
                        gesture=observation.gesture,
                        label=observation.label,
                        confidence=round(observation.confidence, 4),
                        accepted=observation.accepted,
                        stableMs=observation.stable_ms,
                        status=observation.status,
                    ),
                )
                last_observation_sent_ms = now_ms

            if args.preview:
                draw_preview(cv2, frame, observation, trigger)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            await asyncio.sleep(args.frame_delay_ms / 1000)
    finally:
        capture.release()
        if args.preview:
            cv2.destroyAllWindows()
        await broadcast(clients, event_payload("status", state="camera_closed", message="摄像头识别已停止"))


def draw_preview(cv2: Any, frame: Any, observation: GestureObservation, trigger: GestureTrigger | None) -> None:
    label = observation.label
    confidence = f"{observation.confidence:.2f}"
    status = trigger.action if trigger else observation.status
    cv2.putText(frame, f"{label} {confidence} {status}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (50, 230, 90), 2)
    cv2.imshow("Gesture Recognizer - press q to quit", frame)


async def run_websocket_server(args: argparse.Namespace) -> None:
    _, _, _, websockets = import_runtime_modules()
    clients: set[Any] = set()

    async def handler(websocket: Any) -> None:
        clients.add(websocket)
        await websocket.send(event_payload("status", state="connected", message="手势识别服务已连接"))
        try:
            await websocket.wait_closed()
        finally:
            clients.discard(websocket)

    async with websockets.serve(handler, args.host, args.port):
        print(f"Gesture service running at ws://{args.host}:{args.port}/ws/gesture")
        print(
            "Config: "
            f"camera={args.camera}, model={args.model}, confidence={args.confidence}, "
            f"stable_ms={args.stable_ms}, cooldown_ms={args.cooldown_ms}, "
            f"frame_delay_ms={args.frame_delay_ms}"
        )
        print("Press Ctrl+C to stop.")
        await run_camera_loop(args, clients)


def self_check(args: argparse.Namespace) -> int:
    checks: list[dict[str, Any]] = []

    def record(name: str, ok: bool, detail: str) -> None:
        checks.append({"name": name, "ok": ok, "detail": detail})

    try:
        cv2, _, _, _ = import_runtime_modules()
        record("dependencies", True, "OpenCV, MediaPipe and websockets imported")
    except SystemExit as exc:
        record("dependencies", False, str(exc))
        print(json.dumps({"status": "fail", "checks": checks}, ensure_ascii=False, indent=2))
        return 1

    record(
        "model",
        args.model.exists() and args.model.stat().st_size > 0,
        str(args.model) if args.model.exists() else "model file missing",
    )

    capture = cv2.VideoCapture(args.camera)
    camera_ok = capture.isOpened()
    record(
        "camera",
        camera_ok,
        f"camera index {args.camera} opened" if camera_ok else f"cannot open camera index {args.camera}",
    )
    capture.release()

    ok = all(item["ok"] for item in checks)
    print(
        json.dumps(
            {
                "status": "pass" if ok else "fail",
                "host": args.host,
                "port": args.port,
                "camera": args.camera,
                "confidence": args.confidence,
                "stable_ms": args.stable_ms,
                "cooldown_ms": args.cooldown_ms,
                "checks": checks,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if ok else 1


def test_images(args: argparse.Namespace) -> None:
    cv2, _, _, _ = import_runtime_modules()
    recognizer = create_recognizer(args.model, "image")

    for image_path in args.test_images:
        frame = cv2.imread(str(image_path))
        if frame is None:
            print(json.dumps({"image": str(image_path), "error": "无法读取图片"}, ensure_ascii=False))
            continue

        gesture, confidence = recognize_frame(recognizer, frame)
        accepted = gesture in ACCEPTED_GESTURES and confidence >= args.confidence
        print(
            json.dumps(
                {
                    "image": str(image_path),
                    "gesture": gesture,
                    "label": ACCEPTED_GESTURES.get(gesture, {}).get("label", gesture),
                    "confidence": round(confidence, 4),
                    "accepted": accepted,
                    "action": ACCEPTED_GESTURES.get(gesture, {}).get("action"),
                },
                ensure_ascii=False,
            )
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Real camera hand gesture recognition service")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--model", type=Path, default=Path("models/gesture_recognizer.task"))
    parser.add_argument("--confidence", type=float, default=0.65)
    parser.add_argument("--stable-ms", type=int, default=600)
    parser.add_argument("--cooldown-ms", type=int, default=1200)
    parser.add_argument("--frame-delay-ms", type=int, default=35)
    parser.add_argument("--observation-interval-ms", type=int, default=300)
    parser.add_argument("--preview", action="store_true", help="Show OpenCV preview window. Press q to quit.")
    parser.add_argument("--test-images", type=Path, nargs="*", help="Run static image recognition and exit.")
    parser.add_argument("--self-check", action="store_true", help="Check dependencies, model file and camera, then exit.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.model = args.model.resolve()

    if args.self_check:
        return self_check(args)

    if args.test_images:
        test_images(args)
        return

    try:
        asyncio.run(run_websocket_server(args))
    except KeyboardInterrupt:
        print("Gesture service stopped.")


if __name__ == "__main__":
    sys.exit(main())
