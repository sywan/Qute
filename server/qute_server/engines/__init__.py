import importlib
import importlib.util
import logging
from pathlib import Path

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
    for engine in load_plugins():
        if engine.id in engines:
            log.warning("plugin engine %s ignored: id already in use", engine.id)
        else:
            engines[engine.id] = engine
    return engines


log = logging.getLogger("qute")


def _import(spec: str):
    if spec.endswith(".py"):
        path = Path(spec).expanduser().resolve()
        module_spec = importlib.util.spec_from_file_location("qute_plugin_" + path.stem, str(path))
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        return module
    return importlib.import_module(spec)


def load_plugins():
    """Engines from QUTE_PLUGINS: comma-separated module names or .py files. Each must define
    ENGINES (a list of Engine instances) or engines() returning one. See examples/plugin_example.py."""
    found = []
    for spec in [s.strip() for s in config.PLUGINS.split(",") if s.strip()]:
        try:
            module = _import(spec)
            items = module.engines() if callable(getattr(module, "engines", None)) else getattr(module, "ENGINES", [])
            for item in items:
                if isinstance(item, Engine):
                    found.append(item)
                else:
                    log.warning("plugin %s: %r is not an Engine", spec, item)
        except Exception:  # noqa: BLE001
            log.exception("could not load plugin %s", spec)
    return found


ENGINES = build_engines()

__all__ = ["ENGINES", "Engine", "EngineUnavailable", "build_engines"]
