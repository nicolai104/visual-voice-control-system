from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.responses import JSONResponse

from .config import VoiceServiceConfig
from .core import VoiceServiceError
from .service import VoiceIdentityService


def create_app(service: VoiceIdentityService | None = None) -> FastAPI:
    active_service = service or VoiceIdentityService(VoiceServiceConfig())

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await active_service.preload()
        yield

    app = FastAPI(
        title="Visual Voice Control - Voice Identity Service",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.state.voice_service = active_service

    @app.exception_handler(VoiceServiceError)
    async def handle_voice_error(_: Request, error: VoiceServiceError):
        return JSONResponse(
            status_code=error.status_code,
            content={
                "verified": False,
                "errorCode": error.code,
                "message": error.message,
            },
        )

    @app.get("/api/voice/status")
    async def get_status():
        return active_service.status()

    @app.post("/api/voice/enroll")
    async def enroll(samples: list[UploadFile] = File(...)):
        payloads = []
        for sample in samples:
            payloads.append((await sample.read(), sample.filename or "sample.webm"))
        return await active_service.enroll(payloads)

    @app.post("/api/voice/verify-command")
    async def verify_command(audio: UploadFile = File(...)):
        return await active_service.verify_command(
            await audio.read(),
            audio.filename or "command.webm",
        )

    @app.delete("/api/voice/enrollment")
    async def delete_enrollment():
        return active_service.delete_enrollment()

    return app


app = create_app()

