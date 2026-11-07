"""Clone the upstream repositories Qute's server engines call, at pinned commits, and apply
Qute's small compatibility patches. Safe to re-run.

Usage (from server/): python scripts/vendor.py [vtoonify] [instantid] [warpgan] [--dest vendor]

Patches
- VToonify: use the pure-PyTorch StyleGAN ops (model/stylegan/op_cpu) instead of the JIT-compiled
  CUDA extensions. They run on CUDA, MPS-less CPU and avoid needing nvcc / a matching compiler.
"""
import argparse
import subprocess
import sys
from pathlib import Path

REPOS = {
    "vtoonify": ("https://github.com/williamyang1991/VToonify.git", "35922e049acad7c87c058929b15cef44c9968b30", "VToonify"),
    "instantid": ("https://github.com/InstantID/InstantID.git", "2145b67f9607da6234702063692330185f374486", "InstantID"),
    "warpgan": ("https://github.com/seasonSH/WarpGAN.git", "794e24d9c3abce08c0e95f975ce5914ccaa2e1bb", "WarpGAN"),
}


def git(*args, cwd=None):
    subprocess.run(["git", *args], cwd=cwd, check=True)


def clone(name: str, dest: Path) -> Path:
    url, sha, folder = REPOS[name]
    target = dest / folder
    if not (target / ".git").exists():
        dest.mkdir(parents=True, exist_ok=True)
        git("clone", "--quiet", url, str(target))
    git("-c", "advice.detachedHead=false", "checkout", "--quiet", sha, cwd=str(target))
    print("[vendor]", name, "at", sha[:8], "->", target)
    return target


def patch_vtoonify(root: Path) -> None:
    changed = 0
    for py in root.rglob("*.py"):
        text = py.read_text(encoding="utf-8")
        new = text.replace("from model.stylegan.op import", "from model.stylegan.op_cpu import")
        if new != text:
            py.write_text(new, encoding="utf-8")
            changed += 1
    (root / "checkpoint").mkdir(exist_ok=True)
    print("[vendor] VToonify: switched {} file(s) to op_cpu".format(changed))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("repos", nargs="*", default=list(REPOS), choices=list(REPOS))
    ap.add_argument("--dest", default="vendor")
    args = ap.parse_args(argv)
    for name in args.repos or list(REPOS):
        path = clone(name, Path(args.dest))
        if name == "vtoonify":
            patch_vtoonify(path)


if __name__ == "__main__":
    sys.exit(main())
