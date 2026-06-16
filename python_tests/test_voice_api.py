from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from voice_service.app import create_app
from voice_service.core import VoiceServiceError


class FakeVoiceService:
    async def preload(self):
        return None

    def status(self):
        return {
            "service": "ready",
            "modelReady": True,
            "asrConfigured": True,
            "ffmpegReady": True,
            "enrolled": True,
            "threshold": 0.55,
            "samplePhrase": "打开客厅灯并关闭风扇",
        }

    async def enroll(self, samples):
        if len(samples) != 3:
            raise VoiceServiceError("poor_audio", "必须提交三段录音")
        return {"enrolled": True, "sampleCount": 3, "message": "录入成功"}

    async def verify_command(self, data, filename):
        if data == b"reject":
            return {
                "verified": False,
                "similarity": 0.2,
                "threshold": 0.55,
                "transcript": "关闭窗帘",
                "requestId": "voice-rejected",
                "errorCode": "speaker_rejected",
                "message": "非授权用户，指令未执行",
            }
        return {
            "verified": True,
            "similarity": 0.9,
            "threshold": 0.55,
            "transcript": "打开风扇",
            "requestId": "voice-ok",
            "errorCode": None,
            "message": "声纹验证通过",
        }

    def delete_enrollment(self):
        return {"deleted": True, "enrolled": False, "message": "声纹模板已删除"}


class VoiceApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app(FakeVoiceService()))

    def test_status_contract(self):
        response = self.client.get("/api/voice/status")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["modelReady"])

    def test_enrollment_requires_three_samples(self):
        response = self.client.post(
            "/api/voice/enroll",
            files=[
                ("samples", ("one.webm", b"one", "audio/webm")),
                ("samples", ("two.webm", b"two", "audio/webm")),
            ],
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["errorCode"], "poor_audio")

    def test_enrollment_accepts_three_samples(self):
        response = self.client.post(
            "/api/voice/enroll",
            files=[
                ("samples", ("one.webm", b"one", "audio/webm")),
                ("samples", ("two.webm", b"two", "audio/webm")),
                ("samples", ("three.webm", b"three", "audio/webm")),
            ],
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sampleCount"], 3)

    def test_verify_command_returns_structured_voice_result(self):
        response = self.client.post(
            "/api/voice/verify-command",
            files={"audio": ("command.webm", b"accept", "audio/webm")},
        )
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["verified"])
        self.assertEqual(payload["requestId"], "voice-ok")

    def test_delete_enrollment(self):
        response = self.client.delete("/api/voice/enrollment")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["enrolled"])


if __name__ == "__main__":
    unittest.main()
