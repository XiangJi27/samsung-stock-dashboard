#!/usr/bin/env python3
"""
Verify Pilot ZIP Hygiene - ensures no test/development assets leak into runtime package.
Part of PRE_DEPLOY_STATIC_GATE pipeline.
"""

import os
import sys
import zipfile

sys.stdout.reconfigure(encoding="utf-8")

# Script is at: .agents/skills/samsung-branch-operations-engineer/scripts/verify_pilot_zip_hygiene.py
# Project root is 4 levels up: scripts/ -> samsung-branch-operations-engineer/ -> skills/ -> .agents/ -> ROOT
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(_SCRIPT_DIR))))
PILOT_ZIP = os.path.join(ROOT_DIR, "samsung_stock_dashboard_feedback_pilot.zip")

FORBIDDEN_PREFIXES = (
    ".agents/",
    "tests/",
    "test-results/",
    "playwright-report/",
    "node_modules/",
    "scratch/",
    "__pycache__/",
    ".pilot-deploy/",
    ".vercel/",
    "secrets/",
    "credentials/",
)

FORBIDDEN_EXTENSIONS = (
    ".xlsx",
    ".zip",
    ".pyc",
    ".key",
    ".pem",
    ".env",
    ".log",
    ".bak",
    ".ps1",
)

FORBIDDEN_EXACT = (
    "package-lock.json",
    ".gitignore",
    ".gitattributes",
    ".env.example",
)


def verify_pilot_zip_hygiene():
    print("================================================================")
    print("PILOT ZIP HYGIENE VERIFICATION")
    print("================================================================\n")

    if not os.path.exists(PILOT_ZIP):
        print(f"ERROR: Pilot ZIP not found: {PILOT_ZIP}")
        print("Run python scripts/build_pilot_package.py first.")
        sys.exit(1)

    with zipfile.ZipFile(PILOT_ZIP) as archive:
        all_names = archive.namelist()
        violations = []

        for name in all_names:
            # Check forbidden prefixes
            for prefix in FORBIDDEN_PREFIXES:
                if name.startswith(prefix):
                    violations.append((name, f"FORBIDDEN_PREFIX: {prefix}"))
                    break
            else:
                # Check forbidden extensions
                for ext in FORBIDDEN_EXTENSIONS:
                    if name.endswith(ext):
                        violations.append((name, f"FORBIDDEN_EXTENSION: {ext}"))
                        break
                else:
                    # Check forbidden exact names
                    basename = os.path.basename(name)
                    if basename in FORBIDDEN_EXACT:
                        violations.append((name, f"FORBIDDEN_FILE: {basename}"))

        print(f"Total entries in ZIP: {len(all_names)}")
        print(f"Violations found: {len(violations)}")

        if violations:
            print("\nFORBIDDEN ENTRIES:")
            for entry, reason in violations:
                print(f"  ✗ {entry} ({reason})")
            print("\n================================================================")
            print("PILOT ZIP HYGIENE: FAILED")
            print("================================================================")
            sys.exit(1)
        else:
            print("\n✅ All entries are legitimate runtime files.")
            print("\n================================================================")
            print("PILOT ZIP HYGIENE: PASSED")
            print("================================================================")
            sys.exit(0)


if __name__ == "__main__":
    verify_pilot_zip_hygiene()
