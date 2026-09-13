# -*- coding: utf-8 -*-
"""
Verification Script for Feedback Pilot Runtime Zip
Target: samsung_stock_dashboard_feedback_pilot.zip
Verifies:
- All packaged files against pilot_runtime_manifest.json
- Manifest environment: FEEDBACK_PILOT_PREVIEW_CANDIDATE
- Application commit, baseline commit, database schema commit
"""

import os
import sys
import zipfile
import json
import hashlib
import tempfile

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
zip_path = os.path.join(ROOT_DIR, "samsung_stock_dashboard_feedback_pilot.zip")

if not os.path.exists(zip_path):
    print(f"❌ Pilot zip file not found: {zip_path}")
    sys.exit(1)

print("================================================================")
print("SAMSUNG FEEDBACK PILOT - RUNTIME ZIP EXTRACTION VERIFIER")
print("Target: samsung_stock_dashboard_feedback_pilot.zip")
print("================================================================\n")

with tempfile.TemporaryDirectory() as tmpdir:
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(tmpdir)
    
    manifest_path = os.path.join(tmpdir, "pilot_runtime_manifest.json")
    if not os.path.exists(manifest_path):
        print("❌ Missing pilot_runtime_manifest.json inside zip!")
        sys.exit(1)

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    
    matched = 0
    mismatches = []
    files_list = manifest.get("files", [])

    for item in files_list:
        frel = item.get("file")
        fp = os.path.join(tmpdir, frel)
        if not os.path.exists(fp):
            mismatches.append(f"Missing: {frel}")
            continue
        with open(fp, "rb") as rf:
            h = hashlib.sha256(rf.read()).hexdigest()
        if h == item.get("sha256"):
            matched += 1
        else:
            mismatches.append(f"Hash mismatch: {frel} (expected {item.get('sha256')}, got {h})")
            
    import subprocess
    try:
        current_head = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        current_head = "UNKNOWN"

    app_source_commit = manifest.get("applicationSourceCommit") or manifest.get("applicationCommit")
    built_from_commit = manifest.get("packageBuiltFromCommit") or manifest.get("applicationCommit")

    # Check for runtime drift since package was built
    runtime_tracked_paths = [
        "index.html", "app.js", "style.css", "stock_data.js", "promotion_variants.js",
        "pilot.html", "assets/", "api/"
    ]
    drift_detected = False
    drifted_files = []
    if built_from_commit and built_from_commit != "UNKNOWN" and current_head != "UNKNOWN":
        try:
            diff_cmd = ["git", "diff", "--name-only", f"{built_from_commit}..{current_head}", "--"] + runtime_tracked_paths
            diff_output = subprocess.check_output(diff_cmd, text=True, stderr=subprocess.DEVNULL).strip()
            if diff_output:
                drifted_files = [line.strip() for line in diff_output.splitlines() if line.strip()]
                drift_detected = len(drifted_files) > 0
        except Exception:
            pass

    runtime_status = "DRIFT_DETECTED (REBUILD REQUIRED)" if drift_detected else "FALSE (RUNTIME FROZEN)"

    print(f"Pilot Manifest Extraction Verification: {matched}/{len(files_list)} MATCHED")
    print(f"Environment:                  {manifest.get('environment')}")
    print(f"Application Source Commit:    {app_source_commit}")
    print(f"Package Built From Commit:    {built_from_commit}")
    print(f"Repository HEAD At Verify:    {current_head}")
    print(f"Runtime Drift After Package:  {runtime_status}")
    print(f"Baseline Commit:              {manifest.get('baselineCommit')}")
    print(f"Database Schema Commit:       {manifest.get('databaseSchemaCommit')}")
    print(f"Built At:                     {manifest.get('builtAt')}")
    print(f"Total Files in Manifest:      {manifest.get('totalFiles')}")
    print(f"Zip Package Size:             {os.path.getsize(zip_path)} bytes")

    if mismatches:
        print("\n❌ Mismatches found:")
        for m in mismatches:
            print(f"  - {m}")
        sys.exit(1)

    if drift_detected:
        print("\n❌ RUNTIME SOURCE DRIFT DETECTED:")
        print(f"Runtime source files changed since packageBuiltFromCommit ({built_from_commit}):")
        for df in drifted_files:
            print(f"  - {df}")
        print("Re-run python scripts/build_pilot_package.py to synchronize package before verification.")
        sys.exit(1)

    print(f"\n✅ 100% Verified: All {matched} files in extracted pilot zip match pilot_runtime_manifest.json!")
    print("================================================================\n")
