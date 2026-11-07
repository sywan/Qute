import os
import sys
from pathlib import Path

# Tests must not pick up a developer's server/.env.
os.environ["QUTE_ENV_FILE"] = "/nonexistent"
for key in ("QUTE_ENGINES", "QUTE_REMOTE_ENGINES", "VTOONIFY_DIR", "WARPGAN_DIR", "INSTANTID_DIR"):
    os.environ.pop(key, None)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
