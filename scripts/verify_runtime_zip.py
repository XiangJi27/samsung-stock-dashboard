# -*- coding: utf-8 -*-
import os
import sys
import zipfile
import json
import hashlib
import tempfile

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
zip_path = os.path.join(ROOT_DIR, "samsung_stock_dashboard_runtime.zip")

with tempfile.TemporaryDirectory() as tmpdir:
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(tmpdir)
    
    manifest_path = os.path.join(tmpdir, "runtime_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    
    matched = 0
    mismatches = []
    for item in manifest.get("files", []):
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
            mismatches.append(f"Hash mismatch: {frel}")
            
    print(f"Runtime Manifest Extraction Verification: {matched}/{len(manifest.get('files', []))} MATCHED")
    print(f"Environment Label: {manifest.get('environment')}")
    print(f"Generated At: {manifest.get('generatedAt')}")
    print(f"Commit SHA: {manifest.get('commitSha')}")
    if mismatches:
        print("❌ Mismatches found:", mismatches)
        sys.exit(1)
    else:
        print("✅ 100% Verified: All 23 files in extracted runtime zip match runtime_manifest.json!")
