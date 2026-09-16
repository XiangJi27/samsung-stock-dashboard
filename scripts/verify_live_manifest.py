#!/usr/bin/env python3
"""
Samsung Branch Operations
Live Manifest and Runtime Artifact Verifier (Top-level Runner)
"""
import os
import sys
from pathlib import Path

# Dispatch to skill implementation
script_path = Path(__file__).resolve().parent.parent / ".agents" / "skills" / "samsung-branch-operations-engineer" / "scripts" / "verify_live_manifest.py"
if script_path.exists():
    with open(script_path, "r", encoding="utf-8") as f:
        code = f.read()
    exec(compile(code, str(script_path), "exec"))
else:
    print(f"ERROR: Cannot find {script_path}", file=sys.stderr)
    sys.exit(1)
