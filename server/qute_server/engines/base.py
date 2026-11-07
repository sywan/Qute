from __future__ import annotations

import importlib.util
import threading

from PIL import Image


class EngineUnavailable(RuntimeError):
    """Raised when an engine is requested but its dependencies or weights are missing."""


class Engine:
    """Base class. Subclasses override check(), load() and infer()."""

    def __init__(self, id: str, variants=None):
        self.id = id
        self.variants = list(variants or [])
        self._lock = threading.Lock()
        self._loaded = None

    def check(self):
        """Return (available, reason)."""
        return True, ""

    def load(self):
        """Load heavy weights once (called under the engine lock)."""
        return None

    def infer(self, model, image: Image.Image, reference, params: dict) -> Image.Image:
        raise NotImplementedError

    def available_variants(self):
        return self.variants

    def describe(self) -> dict:
        ok, reason = self.check()
        info = {"id": self.id, "available": ok}
        if reason:
            info["reason"] = reason
        variants = self.available_variants() if ok else self.variants
        if variants:
            info["variants"] = variants
        return info

    def warmup(self) -> None:
        ok, reason = self.check()
        if not ok:
            raise EngineUnavailable(reason)
        with self._lock:
            if self._loaded is None:
                self._loaded = self.load() or True

    def run(self, image: Image.Image, reference, params: dict) -> Image.Image:
        ok, reason = self.check()
        if not ok:
            raise EngineUnavailable(reason)
        # GPU models are not re-entrant; serialise per engine.
        with self._lock:
            if self._loaded is None:
                self._loaded = self.load() or True
            return self.infer(self._loaded, image, reference, params)


def has_module(*names: str):
    missing = [n for n in names if importlib.util.find_spec(n) is None]
    return (not missing, "missing Python packages: " + ", ".join(missing) if missing else "")
