from __future__ import annotations

import math
import re
import wave
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Callable, Iterable

import numpy as np


VOICEPRINT_SAMPLE_PHRASE = "打开客厅灯并关闭风扇"
SUPPORTED_AUDIO_SUFFIXES = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4"}


class VoiceServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class AudioMetrics:
    duration_seconds: float
    rms: float
    clipped_ratio: float


@dataclass
class PreparedAudio:
    path: Path
    metrics: AudioMetrics
    cleanup_callback: Callable[[], None]

    def cleanup(self) -> None:
        self.cleanup_callback()


def normalize_phrase(value: str) -> str:
    return re.sub(r"[\s,，.。!！?？:：;；、\"“”'‘’]", "", str(value or "")).strip()


def phrase_similarity(actual: str, expected: str) -> float:
    normalized_actual = normalize_phrase(actual)
    normalized_expected = normalize_phrase(expected)
    if not normalized_actual or not normalized_expected:
        return 0.0
    return SequenceMatcher(None, normalized_actual, normalized_expected).ratio()


def normalize_embedding(values: Iterable[float]) -> np.ndarray:
    vector = np.asarray(list(values), dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(vector))
    if not math.isfinite(norm) or norm <= 1e-8:
        raise VoiceServiceError("poor_audio", "未能提取有效声纹特征")
    return vector / norm


def average_embeddings(embeddings: Iterable[Iterable[float]]) -> np.ndarray:
    vectors = [normalize_embedding(item) for item in embeddings]
    if not vectors:
        raise VoiceServiceError("poor_audio", "没有可用的声纹样本")
    return normalize_embedding(np.mean(np.stack(vectors), axis=0))


def speaker_similarity(left: Iterable[float], right: Iterable[float]) -> float:
    cosine = float(np.dot(normalize_embedding(left), normalize_embedding(right)))
    return max(0.0, min(1.0, (cosine + 1.0) / 2.0))


def analyze_wav(
    path: Path,
    *,
    min_duration_seconds: float,
    max_duration_seconds: float,
) -> AudioMetrics:
    try:
        with wave.open(str(path), "rb") as audio:
            channels = audio.getnchannels()
            sample_width = audio.getsampwidth()
            frame_rate = audio.getframerate()
            frame_count = audio.getnframes()
            frames = audio.readframes(frame_count)
    except (wave.Error, OSError) as error:
        raise VoiceServiceError("unsupported_audio", "音频格式无法解析") from error

    if channels != 1 or sample_width != 2 or frame_rate != 16000:
        raise VoiceServiceError("unsupported_audio", "转码后的音频必须为 16kHz 单声道 PCM")

    duration = frame_count / frame_rate if frame_rate else 0.0
    if duration < min_duration_seconds:
        raise VoiceServiceError("poor_audio", "录音过短，请持续朗读至少 1.5 秒")
    if duration > max_duration_seconds + 0.1:
        raise VoiceServiceError("poor_audio", "录音超过 8 秒，请重新录制")

    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    if samples.size == 0:
        raise VoiceServiceError("poor_audio", "录音中没有检测到有效声音")

    rms = float(np.sqrt(np.mean(np.square(samples))))
    clipped_ratio = float(np.mean(np.abs(samples) >= 0.995))
    if rms < 0.008:
        raise VoiceServiceError("poor_audio", "录音音量过低或接近静音")
    if clipped_ratio > 0.03:
        raise VoiceServiceError("poor_audio", "录音削波严重，请降低麦克风音量后重试")

    return AudioMetrics(duration_seconds=duration, rms=rms, clipped_ratio=clipped_ratio)
