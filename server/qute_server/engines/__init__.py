from .. import config
from .base import Engine, EngineUnavailable
from .dctnet import DCTNetEngine
from .instantid import InstantIDChibiEngine
from .onnx_engines import OnnxCartoonEngine
from .remote import RemoteEngine
from .subprocess_engines import VToonifyEngine, WarpGANEngine


def build_engines():
    """Engines served by this process: local ones (filtered by QUTE_ENGINES) plus remote ones
    (QUTE_REMOTE_ENGINES), in the order the web app lists them."""
    factories = {
        "dctnet": DCTNetEngine,
        "vtoonify": VToonifyEngine,
        "instantid-chibi": InstantIDChibiEngine,
        "warpgan": WarpGANEngine,
        "server-whitebox": lambda: OnnxCartoonEngine("server-whitebox", "whitebox-cartoon.onnx", multiple=8),
    }
    wanted = set(factories) if config.LOCAL_ENGINES.strip() in ("", "all") else {
        e.strip() for e in config.LOCAL_ENGINES.split(",") if e.strip()}
    engines = {}
    for engine_id, factory in factories.items():
        if engine_id in config.REMOTE_ENGINES:
            engines[engine_id] = RemoteEngine(engine_id, config.REMOTE_ENGINES[engine_id])
        elif engine_id in wanted:
            engines[engine_id] = factory()
    return engines


ENGINES = build_engines()

__all__ = ["ENGINES", "Engine", "EngineUnavailable", "build_engines"]
