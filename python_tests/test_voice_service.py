from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np

from voice_service.config import VoiceServiceConfig
from voice_service.core import AudioMetrics, PreparedAudio, VoiceServiceError
from voice_service.service import VoiceIdentityService
from voice_service.storage import VoiceprintStore


PHRASE = "打开客厅灯并关闭风扇"


class FakeAudioProcessor:
    available = True

    def __init__(self):
        self.cleaned = 0

    def prepare(self, data: bytes, filename: str) -> PreparedAudio:
        if data == b"poor":
            raise VoiceServiceError("poor_audio", "录音音量过低")
        handle = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        handle.write(data)
        handle.close()
        path = Path(handle.name)

        def cleanup():
            self.cleaned += 1
            path.unlink(missing_ok=True)

        return PreparedAudio(
            path=path,
            metrics=AudioMetrics(duration_seconds=2.0, rms=0.1, clipped_ratio=0.0),
            cleanup_callback=cleanup,
        )


class FakeAsr:
    configured = True

    def preload(self):
        return None

    def transcribe(self, path: Path, request_id: str) -> str:
        value = path.read_bytes().decode("utf-8")
        if value.startswith("asr-error"):
            raise VoiceServiceError("asr_unavailable", "智谱不可用", 503)
        return value.split("|", 1)[0]


class FakeEmbeddings:
    ready = True

    def preload(self):
        return None

    def extract_embedding(self, path: Path):
        marker = path.read_bytes().decode("utf-8").split("|", 1)[-1]
        vectors = {
            "owner": np.array([1.0, 0.0, 0.0]),
            "owner-soft": np.array([0.95, 0.05, 0.0]),
            "stranger": np.array([-1.0, 0.0, 0.0]),
        }
        return vectors.get(marker, vectors["owner"])


class VoiceIdentityServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config = VoiceServiceConfig(data_dir=Path(self.temp_dir.name))
        self.processor = FakeAudioProcessor()
        self.service = VoiceIdentityService(
            self.config,
            audio_processor=self.processor,
            asr_client=FakeAsr(),
            embedding_provider=FakeEmbeddings(),
            store=VoiceprintStore(Path(self.temp_dir.name)),
        )

    async def asyncTearDown(self):
        self.temp_dir.cleanup()

    async def enroll_owner(self):
        return await self.service.enroll(
            [
                (f"{PHRASE}|owner".encode(), "one.webm"),
                (f"{PHRASE}|owner-soft".encode(), "two.webm"),
                (f"{PHRASE}|owner".encode(), "three.webm"),
            ]
        )

    async def test_three_valid_samples_create_a_template_and_cleanup_audio(self):
        result = await self.enroll_owner()
        self.assertTrue(result["enrolled"])
        self.assertTrue(self.service.store.enrolled)
        self.assertEqual(self.processor.cleaned, 3)

    async def test_phrase_mismatch_rejects_enrollment_without_saving_template(self):
        with self.assertRaisesRegex(VoiceServiceError, "短句不匹配"):
            await self.service.enroll(
                [
                    (f"{PHRASE}|owner".encode(), "one.webm"),
                    ("播放音乐|owner".encode(), "two.webm"),
                    (f"{PHRASE}|owner".encode(), "three.webm"),
                ]
            )
        self.assertFalse(self.service.store.enrolled)
        self.assertEqual(self.processor.cleaned, 3)

    async def test_poor_audio_is_rejected(self):
        with self.assertRaisesRegex(VoiceServiceError, "音量过低"):
            await self.service.enroll(
                [(b"poor", "one.webm"), (b"poor", "two.webm"), (b"poor", "three.webm")]
            )
        self.assertFalse(self.service.store.enrolled)

    async def test_owner_passes_and_stranger_is_rejected(self):
        await self.enroll_owner()
        owner = await self.service.verify_command("打开风扇|owner".encode(), "command.webm")
        stranger = await self.service.verify_command(
            "关闭窗帘|stranger".encode(), "command.webm"
        )
        self.assertTrue(owner["verified"])
        self.assertFalse(stranger["verified"])
        self.assertEqual(stranger["errorCode"], "speaker_rejected")
        self.assertEqual(self.processor.cleaned, 5)

    async def test_asr_failure_is_safe_and_temp_audio_is_deleted(self):
        await self.enroll_owner()
        with self.assertRaises(VoiceServiceError) as context:
            await self.service.verify_command(b"asr-error|owner", "command.webm")
        self.assertEqual(context.exception.code, "asr_unavailable")
        self.assertEqual(self.processor.cleaned, 4)

    async def test_verification_requires_enrollment(self):
        with self.assertRaises(VoiceServiceError) as context:
            await self.service.verify_command("打开风扇|owner".encode(), "command.webm")
        self.assertEqual(context.exception.code, "not_enrolled")


if __name__ == "__main__":
    unittest.main()
