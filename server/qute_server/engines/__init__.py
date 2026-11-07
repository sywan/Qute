from .base import Engine, EngineUnavailable
from .dctnet import DCTNetEngine
from .instantid import InstantIDChibiEngine
from .onnx_engines import OnnxCartoonEngine
from .subprocess_engines import VToonifyEngine, WarpGANEngine

ENGINES: dict[str, Engine] = {
    e.id: e
    for e in (
        DCTNetEngine(),
        VToonifyEngine(),
        InstantIDChibiEngine(),
        WarpGANEngine(),
        OnnxCartoonEngine("server-whitebox", "whitebox-cartoon.onnx", multiple=8),
    )
}

__all__ = ["ENGINES", "Engine", "EngineUnavailable"]
