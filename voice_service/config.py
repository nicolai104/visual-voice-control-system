from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class VoiceServiceConfig:
    host: str = os.getenv("VOICE_SERVICE_HOST", "127.0.0.1")
    port: int = int(os.getenv("VOICE_SERVICE_PORT", "8780"))
    data_dir: Path = Path(
        os.getenv("VOICEPRINT_DATA_DIR", PROJECT_ROOT / "data" / "voiceprints")
    )
    ffmpeg_path: str = os.getenv("FFMPEG_PATH", "ffmpeg")
    asr_model: str = os.getenv("ZHIPU_ASR_MODEL", "glm-asr-2512")
    speaker_model: str = os.getenv("WESPEAKER_MODEL", "chinese")
    threshold: float = float(os.getenv("VOICEPRINT_THRESHOLD", "0.55"))
    phrase_threshold: float = float(os.getenv("VOICEPRINT_PHRASE_THRESHOLD", "0.85"))
    min_duration_seconds: float = float(os.getenv("VOICE_MIN_DURATION_SECONDS", "1.5"))
    max_duration_seconds: float = float(os.getenv("VOICE_MAX_DURATION_SECONDS", "8"))
    max_upload_bytes: int = int(os.getenv("VOICE_MAX_UPLOAD_BYTES", str(12 * 1024 * 1024)))
    zhipu_api_key: str | None = os.getenv("ZHIPUAI_API_KEY")

