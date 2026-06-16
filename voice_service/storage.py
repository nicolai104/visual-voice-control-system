from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import numpy as np

from .core import normalize_embedding


class VoiceprintStore:
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.path = self.data_dir / "owner.json"

    @property
    def enrolled(self) -> bool:
        return self.path.is_file()

    def load(self) -> dict | None:
        if not self.path.is_file():
            return None
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        payload["embedding"] = normalize_embedding(payload["embedding"])
        return payload

    def save(
        self,
        embedding: Iterable[float],
        *,
        model: str,
        threshold: float,
        phrase: str,
    ) -> dict:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "model": model,
            "threshold": threshold,
            "phrase": phrase,
            "enrolledAt": datetime.now(timezone.utc).isoformat(),
            "embedding": normalize_embedding(embedding).tolist(),
        }
        descriptor, temp_name = tempfile.mkstemp(
            prefix="owner-",
            suffix=".json",
            dir=self.data_dir,
        )
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False)
            os.chmod(temp_name, 0o600)
            os.replace(temp_name, self.path)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
        return payload

    def delete(self) -> bool:
        if not self.path.exists():
            return False
        self.path.unlink()
        return True

