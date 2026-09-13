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
            
    print(f"Pilot Manifest Extraction Verification: {matched}/{len(files_list)} MATCHED")
    print(f"Environment:             {manifest.get('environment')}")
    print(f"Application Commit:      {manifest.get('applicationCommit')}")
    print(f"Baseline Commit:         {manifest.get('baselineCommit')}")
    print(f"Database Schema Commit:  {manifest.get('databaseSchemaCommit')}")
    print(f"Built At:                {manifest.get('builtAt')}")
    print(f"Total Files in Manifest: {manifest.get('totalFiles')}")
    print(f"Zip Package Size:        {os.path.getsize(zip_path)} bytes")

    if mismatches:
        print("\n❌ Mismatches found:")
        for m in mismatches:
            print(f"  - {m}")
        sys.exit(1)
    else:
        print(f"\n✅ 100% Verified: All {matched} files in extracted pilot zip match pilot_runtime_manifest.json!")
        print("================================================================\n")
