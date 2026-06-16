from __future__ import annotations

import asyncio
import uuid
from typing import Iterable

from .config import VoiceServiceConfig
from .core import (
    VOICEPRINT_SAMPLE_PHRASE,
    VoiceServiceError,
    average_embeddings,
    phrase_similarity,
    speaker_similarity,
)
from .providers import FfmpegAudioProcessor, WeSpeakerEmbeddingProvider, ZhipuAsrClient
from .storage import VoiceprintStore


class VoiceIdentityService:
    def __init__(
        self,
        config: VoiceServiceConfig,
        *,
        audio_processor=None,
        asr_client=None,
        embedding_provider=None,
        store=None,
    ):
        self.config = config
        self.audio_processor = audio_processor or FfmpegAudioProcessor(config)
        self.asr_client = asr_client or ZhipuAsrClient(config)
        self.embedding_provider = embedding_provider or WeSpeakerEmbeddingProvider(config)
        self.store = store or VoiceprintStore(config.data_dir)
        self.model_error = ""

    async def preload(self) -> None:
        try:
            await asyncio.to_thread(self.embedding_provider.preload)
            self.model_error = ""
        except VoiceServiceError as error:
            self.model_error = error.message

    def status(self) -> dict:
        model_ready = bool(getattr(self.embedding_provider, "ready", False))
        asr_configured = bool(getattr(self.asr_client, "configured", False))
        ffmpeg_ready = bool(getattr(self.audio_processor, "available", False))
        ready = model_ready and asr_configured and ffmpeg_ready
        return {
            "service": "ready" if ready else "degraded",
            "modelReady": model_ready,
            "asrConfigured": asr_configured,
            "ffmpegReady": ffmpeg_ready,
            "enrolled": self.store.enrolled,
            "speakerModel": self.config.speaker_model,
            "asrModel": self.config.asr_model,
            "threshold": self.config.threshold,
            "samplePhrase": VOICEPRINT_SAMPLE_PHRASE,
            "message": self._status_message(model_ready, asr_configured, ffmpeg_ready),
        }

    async def enroll(self, samples: list[tuple[bytes, str]]) -> dict:
        if len(samples) != 3:
            raise VoiceServiceError("poor_audio", "声纹录入必须提交三段录音")

        prepared = []
        try:
            for data, filename in samples:
                prepared.append(
                    await asyncio.to_thread(self.audio_processor.prepare, data, filename)
                )

            embeddings = []
            transcripts = []
            phrase_scores = []
            for index, audio in enumerate(prepared):
                request_id = f"enroll-{uuid.uuid4().hex}"
                transcript, embedding = await self._analyze_audio(audio.path, request_id)
                score = phrase_similarity(transcript, VOICEPRINT_SAMPLE_PHRASE)
                if score < self.config.phrase_threshold:
                    raise VoiceServiceError(
                        "phrase_mismatch",
                        f"第 {index + 1} 段短句不匹配，请完整朗读固定短句",
                    )
                transcripts.append(transcript)
                embeddings.append(embedding)
                phrase_scores.append(score)

            template = average_embeddings(embeddings)
            saved = self.store.save(
                template,
                model=self.config.speaker_model,
                threshold=self.config.threshold,
                phrase=VOICEPRINT_SAMPLE_PHRASE,
            )
            return {
                "enrolled": True,
                "sampleCount": 3,
                "phraseScores": [round(score, 4) for score in phrase_scores],
                "transcripts": transcripts,
                "threshold": self.config.threshold,
                "enrolledAt": saved["enrolledAt"],
                "message": "三段声纹样本录入成功，可以开始语音控制",
            }
        finally:
            for audio in prepared:
                audio.cleanup()

    async def verify_command(self, data: bytes, filename: str) -> dict:
        template = self.store.load()
        if template is None:
            raise VoiceServiceError("not_enrolled", "请先录入授权用户声纹", 409)

        audio = await asyncio.to_thread(self.audio_processor.prepare, data, filename)
        request_id = f"voice-{uuid.uuid4().hex}"
        try:
            transcript, embedding = await self._analyze_audio(audio.path, request_id)
            similarity = speaker_similarity(template["embedding"], embedding)
            verified = similarity >= self.config.threshold
            return {
                "verified": verified,
                "similarity": round(similarity, 4),
                "threshold": self.config.threshold,
                "transcript": transcript,
                "requestId": request_id,
                "verifiedAt": self._utc_now(),
                "errorCode": None if verified else "speaker_rejected",
                "message": (
                    "声纹验证通过，正在匹配控制指令"
                    if verified
                    else "非授权用户，指令未执行"
                ),
            }
        finally:
            audio.cleanup()

    def delete_enrollment(self) -> dict:
        deleted = self.store.delete()
        return {
            "deleted": deleted,
            "enrolled": False,
            "message": "声纹模板已删除" if deleted else "当前没有已录入的声纹模板",
        }

    def _status_message(self, model_ready: bool, asr_configured: bool, ffmpeg_ready: bool) -> str:
        missing = []
        if not model_ready:
            missing.append("WeSpeaker 模型")
        if not asr_configured:
            missing.append("ZHIPUAI_API_KEY")
        if not ffmpeg_ready:
            missing.append("FFmpeg")
        return "语音服务已就绪" if not missing else f"缺少：{'、'.join(missing)}"

    async def _analyze_audio(self, path, request_id):
        results = await asyncio.gather(
            asyncio.to_thread(self.asr_client.transcribe, path, request_id),
            asyncio.to_thread(self.embedding_provider.extract_embedding, path),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, Exception):
                if isinstance(result, VoiceServiceError):
                    raise result
                raise VoiceServiceError("poor_audio", "音频分析失败", 503) from result
        return results[0], results[1]

    @staticmethod
    def _utc_now() -> str:
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).isoformat()
