from __future__ import annotations

import importlib.util
import threading
from dataclasses import dataclass, field
from typing import Any

from PIL import Image


class EngineUnavailable(RuntimeError):
    """Raised when an engine is requested but its dependencies or weights are missing."""


@dataclass
class Engine:
    id: str
    variants: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._lock = threading.Lock()
        self._loaded: Any = None

    # Override: return (available, reason)
    def check(self) -> tuple[bool, str]:
        return True, ""

    # Override: load heavy weights once (called under the engine lock).
    def load(self) -> Any:
        return None

    # Override: run inference.
    def infer(self, model: Any, image: Image.Image, reference: Image.Image | None, params: dict) -> Image.Image:
        raise NotImplementedError

    def describe(self) -> dict:
        ok, reason = self.check()
        info = {"id": self.id, "available": ok}
        if reason:
            info["reason"] = reason
        if self.variants:
            info["variants"] = self.variants
        return info

    def run(self, image: Image.Image, reference: Image.Image | None, params: dict) -> Image.Image:
        ok, reason = self.check()
        if not ok:
            raise EngineUnavailable(reason)
        # GPU models are not re-entrant; serialise per engine.
        with self._lock:
            if self._loaded is None:
                self._loaded = self.load() or True
            return self.infer(self._loaded, image, reference, params)


def has_module(*names: str) -> tuple[bool, str]:
    missing = [n for n in names if importlib.util.find_spec(n) is None]
    return (not missing, "missing Python packages: " + ", ".join(missing) if missing else "")
