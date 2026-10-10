"""Server that writes garbage to stdout (the MCP wire)."""
from __future__ import annotations

import sys
import time

if __name__ == "__main__":
    sys.stdout.write("this is not json\n")
    sys.stdout.flush()
    time.sleep(30)
