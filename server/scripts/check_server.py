"""Check that a server speaks the Qute server protocol (docs/SERVER_API.md). Standard library only.

Usage:  python scripts/check_server.py http://localhost:8765 [--origin https://sywan.github.io] [--engine ID]
Runs: health, engine list schema, CORS + Private Network preflight, and one stylize call per
available engine (or the one given with --engine) on a generated test image.
"""
import argparse
import io
import json
import struct
import sys
import time
import urllib.error
import urllib.request
import uuid
import zlib

OK, FAIL = "\033[32mPASS\033[0m", "\033[31mFAIL\033[0m"
problems = []


def check(cond, label, detail=""):
    print(" ", OK if cond else FAIL, label, ("— " + detail) if detail and not cond else "")
    if not cond:
        problems.append(label)
    return cond


def test_png(w=96, h=64):
    """A small gradient PNG, built without third-party libraries."""
    rows = b"".join(b"\x00" + bytes(c for x in range(w) for c in (x * 2 % 256, y * 3 % 256, 128)) for y in range(h))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


def request(url, method="GET", data=None, headers=None, timeout=900):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.headers, resp.read()  # case-insensitive header access


def multipart(fields, files):
    b = uuid.uuid4().hex
    out = io.BytesIO()
    for k, v in fields.items():
        out.write('--{}\r\nContent-Disposition: form-data; name="{}"\r\n\r\n{}\r\n'.format(b, k, v).encode())
    for k, (fn, data, ct) in files.items():
        out.write('--{}\r\nContent-Disposition: form-data; name="{}"; filename="{}"\r\nContent-Type: {}\r\n\r\n'.format(b, k, fn, ct).encode())
        out.write(data + b"\r\n")
    out.write("--{}--\r\n".format(b).encode())
    return out.getvalue(), "multipart/form-data; boundary=" + b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--origin", default="https://sywan.github.io")
    ap.add_argument("--engine")
    args = ap.parse_args()
    base = args.url.rstrip("/")

    print("1. Health")
    try:
        status, _, body = request(base + "/api/health", timeout=10)
        info = json.loads(body)
        check(status == 200 and info.get("ok") is True, "GET /api/health returns {\"ok\": true}")
        check(str(info.get("api", "")).startswith("qute-server/1"), "declares api \"qute-server/1\"", "got %r" % info.get("api"))
    except Exception as exc:  # noqa: BLE001
        check(False, "server reachable", str(exc))
        sys.exit(1)

    print("2. Engine list")
    status, headers, body = request(base + "/api/engines", headers={"Origin": args.origin}, timeout=10)
    engines = json.loads(body).get("engines")
    check(isinstance(engines, list), "GET /api/engines returns {\"engines\": [...]}")
    check(headers.get("Access-Control-Allow-Origin") in (args.origin, "*"), "CORS allows " + args.origin, "Access-Control-Allow-Origin=%r" % headers.get("Access-Control-Allow-Origin"))
    for e in engines or []:
        check(isinstance(e.get("id"), str) and isinstance(e.get("available"), bool), "engine %r has id and available" % e.get("id"))
        for p in e.get("params", []) or []:
            check(p.get("type") in ("number", "select", "boolean", "text") and p.get("name"), "engine %s param %r well-formed" % (e.get("id"), p.get("name")))
    print("   available:", ", ".join(e["id"] for e in engines or [] if e.get("available")) or "(none)")

    print("3. Browser preflight (CORS + Private Network Access)")
    try:
        status, headers, _ = request(base + "/api/stylize", method="OPTIONS", headers={
            "Origin": args.origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Private-Network": "true"}, timeout=10)
        check(status in (200, 204), "OPTIONS /api/stylize succeeds", "status %s" % status)
        check(headers.get("Access-Control-Allow-Private-Network") == "true", "answers Access-Control-Allow-Private-Network: true")
    except urllib.error.HTTPError as exc:
        check(False, "OPTIONS /api/stylize succeeds", "HTTP %s" % exc.code)

    print("4. Stylize")
    targets = [e for e in engines or [] if e.get("available") and (not args.engine or e["id"] == args.engine)]
    for e in targets:
        params = {p["name"]: p.get("default") for p in e.get("params", []) or [] if "default" in p}
        if e.get("variants"):
            params["variant"] = e["variants"][0]
        body, ctype = multipart({"engine": e["id"], "params": json.dumps(params)}, {"image": ("test.png", test_png(), "image/png")})
        t0 = time.time()
        try:
            status, headers, data = request(base + "/api/stylize", "POST", body, {"Content-Type": ctype, "Origin": args.origin})
            check(status == 200 and data[:8] == b"\x89PNG\r\n\x1a\n", "%s returns a PNG (%.1f s)" % (e["id"], time.time() - t0), headers.get("Content-Type", ""))
        except urllib.error.HTTPError as exc:
            check(False, "%s stylize" % e["id"], "HTTP %s %s" % (exc.code, exc.read()[:200]))
    body, ctype = multipart({"engine": "no-such-engine", "params": "{}"}, {"image": ("t.png", test_png(), "image/png")})
    try:
        request(base + "/api/stylize", "POST", body, {"Content-Type": ctype})
        check(False, "unknown engine is rejected with 404")
    except urllib.error.HTTPError as exc:
        check(exc.code == 404, "unknown engine is rejected with 404", "HTTP %s" % exc.code)

    print("\nResult:", "all checks passed" if not problems else "%d problem(s): %s" % (len(problems), "; ".join(problems)))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
