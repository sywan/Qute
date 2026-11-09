from PIL import Image


def test_plugin_engines_are_listed_with_metadata_and_run(monkeypatch):
    monkeypatch.setenv("QUTE_PLUGINS", "examples/plugin_example.py")
    from qute_server import config
    monkeypatch.setattr(config, "PLUGINS", "examples/plugin_example.py")
    from qute_server import engines as engines_pkg
    found = {e.id: e for e in engines_pkg.load_plugins()}
    assert set(found) == {"example-sepia", "example-pencil"}
    info = found["example-sepia"].describe()
    assert info["available"] and info["label"]["zh-TW"].startswith("懷舊")
    assert [p["name"] for p in info["params"]] == ["strength", "tone"]
    assert found["example-pencil"].describe()["variants"] == ["soft", "bold"]
    out = found["example-sepia"].run(Image.new("RGB", (40, 30), (10, 120, 200)), None, {"strength": 1, "tone": "warm"})
    assert out.size == (40, 30)
    r, g, b = out.getpixel((5, 5))
    assert r > b, "warm tone"


def test_health_declares_protocol_version():
    from fastapi.testclient import TestClient
    from qute_server.app import app
    body = TestClient(app).get("/api/health").json()
    assert body["ok"] is True and body["api"] == "qute-server/1"


def test_bad_plugin_is_skipped(monkeypatch, tmp_path):
    bad = tmp_path / "bad.py"
    bad.write_text("raise RuntimeError('boom')")
    from qute_server import config
    monkeypatch.setattr(config, "PLUGINS", str(bad))
    from qute_server import engines as engines_pkg
    assert engines_pkg.load_plugins() == []
