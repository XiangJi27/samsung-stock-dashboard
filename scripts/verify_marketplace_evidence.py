#!/usr/bin/env python3
"""
Samsung Branch Operations
Marketplace & Shopee Official Evidence Verifier (Top-level Wrapper)

Source of Truth:
.agents/skills/samsung-branch-operations-engineer/scripts/verify_marketplace_evidence.py
"""
import runpy
import sys
from pathlib import Path

target = (
    Path(__file__).resolve().parent.parent
    / ".agents"
    / "skills"
    / "samsung-branch-operations-engineer"
    / "scripts"
    / "verify_marketplace_evidence.py"
)

if not target.exists():
    print(f"ERROR: Source of Truth script not found: {target}", file=sys.stderr)
    sys.exit(1)

runpy.run_path(str(target), run_name="__main__")
