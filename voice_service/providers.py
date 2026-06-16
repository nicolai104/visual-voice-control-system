from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import numpy as np

from .config import VoiceServiceConfig
from .core import (
    PreparedAudio,
    SUPPORTED_AUDIO_SUFFIXES,
    VoiceServiceError,
    analyze_wav,
    normalize_embedding,
)


class FfmpegAudioProcessor:
    def __init__(self, config: VoiceServiceConfig):
        self.config = config

    @property
    def available(self) -> bool:
        return bool(shutil.which(self.config.ffmpeg_path))

    def prepare(self, data: bytes, filename: str) -> PreparedAudio:
        if not data:
            raise VoiceServiceError("poor_audio", "未收到音频内容")
        if len(data) > self.config.max_upload_bytes:
            raise VoiceServiceError("unsupported_audio", "音频文件超过 12 MB 限制", 413)

        suffix = Path(filename or "recording.webm").suffix.lower()
        if suffix not in SUPPORTED_AUDIO_SUFFIXES:
            raise VoiceServiceError("unsupported_audio", f"不支持的音频格式：{suffix or '未知'}")
        if not self.available:
            raise VoiceServiceError("unsupported_audio", "服务器未安装 FFmpeg", 503)

        temp_dir = Path(tempfile.mkdtemp(prefix="voice-command-"))
        source_path = temp_dir / f"source{suffix}"
        wav_path = temp_dir / "audio.wav"
        source_path.write_bytes(data)

        command = [
            self.config.ffmpeg_path,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source_path),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-sample_fmt",
            "s16",
            str(wav_path),
        ]
        try:
            subprocess.run(command, check=True, capture_output=True, timeout=20)
            metrics = analyze_wav(
                wav_path,
                min_duration_seconds=self.config.min_duration_seconds,
                max_duration_seconds=self.config.max_duration_seconds,
            )
        except VoiceServiceError:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise
        except (subprocess.SubprocessError, OSError) as error:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise VoiceServiceError("unsupported_audio", "音频转码失败") from error

        return PreparedAudio(
            path=wav_path,
            metrics=metrics,
            cleanup_callback=lambda: shutil.rmtree(temp_dir, ignore_errors=True),
        )


class ZhipuAsrClient:
    def __init__(self, config: VoiceServiceConfig):
        self.config = config
        self._client: Any = None

    @property
    def configured(self) -> bool:
        return bool(self.config.zhipu_api_key)

    def preload(self) -> None:
        if not self.configured:
            raise VoiceServiceError("asr_unavailable", "未配置 ZHIPUAI_API_KEY", 503)
        self._get_client()

    def transcribe(self, path: Path, request_id: str) -> str:
        if not self.configured:
            raise VoiceServiceError("asr_unavailable", "未配置智谱语音识别 API Key", 503)
        try:
            with path.open("rb") as audio_file:
                response = self._get_client().audio.transcriptions.create(
                    model=self.config.asr_model,
                    file=audio_file,
                    request_id=request_id,
                    stream=False,
                )
        except VoiceServiceError:
            raise
        except Exception as error:
            raise VoiceServiceError("asr_unavailable", "智谱语音识别服务调用失败", 503) from error

        transcript = self._extract_text(response).strip()
        if not transcript:
            raise VoiceServiceError("asr_unavailable", "智谱未返回有效字幕", 503)
        return transcript

    def _get_client(self):
        if self._client is None:
            try:
                from zhipuai import ZhipuAI
            except ImportError as error:
                raise VoiceServiceError("asr_unavailable", "服务器未安装 zhipuai SDK", 503) from error
            self._client = ZhipuAI(api_key=self.config.zhipu_api_key)
        return self._client

    @staticmethod
    def _extract_text(response: Any) -> str:
        if isinstance(response, dict):
            if isinstance(response.get("text"), str):
                return response["text"]
        text = getattr(response, "text", None)
        if isinstance(text, str):
            return text
        choices = getattr(response, "choices", None) or (
            response.get("choices") if isinstance(response, dict) else None
        )
        if choices:
            first = choices[0]
            message = getattr(first, "message", None) or (
                first.get("message") if isinstance(first, dict) else None
            )
            content = getattr(message, "content", None) or (
                message.get("content") if isinstance(message, dict) else None
            )
            if isinstance(content, str):
                return content
        return ""


class WeSpeakerEmbeddingProvider:
    def __init__(self, config: VoiceServiceConfig):
        self.config = config
        self._model: Any = None
        self.load_error = ""

    @property
    def ready(self) -> bool:
        return self._model is not None

    def preload(self) -> None:
        self._get_model()

    def extract_embedding(self, path: Path) -> np.ndarray:
        try:
            embedding = self._get_model().extract_embedding(str(path))
            if hasattr(embedding, "detach"):
                embedding = embedding.detach()
            if hasattr(embedding, "cpu"):
                embedding = embedding.cpu()
            if hasattr(embedding, "numpy"):
                embedding = embedding.numpy()
            return normalize_embedding(np.asarray(embedding).reshape(-1))
        except VoiceServiceError:
            raise
        except Exception as error:
            raise VoiceServiceError("poor_audio", "声纹特征提取失败", 503) from error

    def _get_model(self):
        if self._model is not None:
            return self._model
        try:
            import wespeaker

            self._model = wespeaker.load_model(self.config.speaker_model)
            self.load_error = ""
            return self._model
        except Exception as error:
            self.load_error = str(error)
            raise VoiceServiceError("poor_audio", "WeSpeaker 中文声纹模型未就绪", 503) from error

