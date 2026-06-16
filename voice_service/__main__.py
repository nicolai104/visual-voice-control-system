from __future__ import annotations

import uvicorn

from .config import VoiceServiceConfig


def main() -> None:
    config = VoiceServiceConfig()
    uvicorn.run(
        "voice_service.app:app",
        host=config.host,
        port=config.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
