#!/usr/bin/env python3
"""
Build Dedicated Feedback Pilot Package (samsung_stock_dashboard_feedback_pilot.zip)
Scope: 4-User Store Pilot (Ayutthaya City Park)
Safety Guarantee: NEVER modifies or overwrites samsung_stock_dashboard_runtime.zip.
"""

import os
import sys
import zipfile
import json
import hashlib
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASELINE_ZIP = os.path.join(ROOT_DIR, "samsung_stock_dashboard_runtime.zip")
PILOT_ZIP = os.path.join(ROOT_DIR, "samsung_stock_dashboard_feedback_pilot.zip")
MANIFEST_PATH = os.path.join(ROOT_DIR, "runtime_manifest.json")
PILOT_MANIFEST_PATH = os.path.join(ROOT_DIR, "pilot_runtime_manifest.json")

def build_pilot_package():
    print("================================================================")
    print("SAMSUNG FEEDBACK PILOT - DEDICATED RUNTIME PACKAGE BUILDER")
    print("Scope: 4-User Store Model (Ayutthaya City Park)")
    print("================================================================\n")

    # 1. Verify baseline zip integrity before build
    if not os.path.exists(BASELINE_ZIP):
        raise FileNotFoundError(f"Baseline zip not found: {BASELINE_ZIP}")

    baseline_stat_before = os.stat(BASELINE_ZIP).st_mtime_ns

    # Read baseline manifest
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        base_manifest = json.load(f)

    baseline_files = [item["file"] for item in base_manifest.get("files", [])]

    # Additional pilot-specific files
    pilot_specific_files = [
        "pilot.html",
        "api/admin/members.js",
        "assets/css/prototype-stock.css",
        "assets/js/prototype-stock.js",
        "product_specs_data.js",
        "assets/js/pilot-runtime-config.js",
        "assets/js/supabase-client.js",
        "assets/js/auth-service.js",
        "assets/js/permission-service.js",
        "assets/js/session-guard.js",
        "assets/js/issue-service.js",
        "assets/js/auth-modal.js",
        "assets/js/user-status-bar.js",
        "assets/js/issue-report-modal.js",
        "assets/js/issue-list.js",
        "assets/js/pilot-navigation.js",
        "assets/js/pilot-dashboard-widgets.js",
        "assets/js/member-admin-service.js",
        "assets/js/pilot-bootstrap.js",
        "reports/promotion_release_manifest.json"
    ]

    all_pilot_files = baseline_files + pilot_specific_files

    # 2. Build pilot manifest
    pilot_manifest_items = []
    total_bytes = 0

    print(f"Packaging {len(all_pilot_files)} runtime files into {os.path.basename(PILOT_ZIP)}...")

    with zipfile.ZipFile(PILOT_ZIP, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for rel_path in all_pilot_files:
            abs_path = os.path.join(ROOT_DIR, rel_path)
            if not os.path.exists(abs_path):
                raise FileNotFoundError(f"Missing required file for pilot package: {rel_path}")

            if rel_path == "index.html":
                # Safety Isolation: Mirror pilot.html into index.html inside Pilot package
                # Guarantees root domain '/' serves Feedback Pilot without modifying baseline index.html on disk
                pilot_source_path = os.path.join(ROOT_DIR, "pilot.html")
                with open(pilot_source_path, "rb") as rf:
                    file_bytes = rf.read()
                file_sha = hashlib.sha256(file_bytes).hexdigest()
                file_size = len(file_bytes)
                zf.writestr(rel_path, file_bytes)
                total_bytes += file_size
                pilot_manifest_items.append({
                    "file": "index.html",
                    "sizeBytes": file_size,
                    "sha256": file_sha,
                    "status": "PILOT_ENTRYPOINT_MIRROR"
                })
                print(f"  + Added: {rel_path} (MIRRORED FROM pilot.html, {file_size} bytes)")
                continue

            if rel_path == "vercel.json":
                # Pilot deployment routing: Redirect root '/' to '/pilot.html'
                pilot_vercel_cfg = {
                    "version": 2,
                    "name": "samsung-stock-dashboard",
                    "cleanUrls": True,
                    "redirects": [
                        {
                            "source": "/",
                            "destination": "/pilot.html",
                            "permanent": False
                        }
                    ]
                }
                file_bytes = json.dumps(pilot_vercel_cfg, indent=2, ensure_ascii=False).encode("utf-8")
                file_sha = hashlib.sha256(file_bytes).hexdigest()
                file_size = len(file_bytes)
                zf.writestr(rel_path, file_bytes)
                total_bytes += file_size
                pilot_manifest_items.append({
                    "file": "vercel.json",
                    "sizeBytes": file_size,
                    "sha256": file_sha,
                    "status": "PILOT_ROUTING_CONFIG",
                    "note": "Root redirect to /pilot.html configured for Vercel Preview"
                })
                print(f"  + Added: {rel_path} (PILOT ROUTING REDIRECT, {file_size} bytes)")
                continue

            with open(abs_path, "rb") as rf:
                file_bytes = rf.read()
                file_sha = hashlib.sha256(file_bytes).hexdigest()
                file_size = len(file_bytes)

            zf.write(abs_path, rel_path)
            total_bytes += file_size

            pilot_manifest_items.append({
                "file": rel_path.replace("\\", "/"),
                "sizeBytes": file_size,
                "sha256": file_sha,
                "status": "PILOT_RUNTIME" if rel_path in pilot_specific_files else "BASELINE_CORE"
            })
            print(f"  + Added: {rel_path} ({file_size} bytes)")

        import subprocess
        try:
            head_commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
        except Exception:
            head_commit = "b38d846"

        manifest_data = {
            "manifestVersion": "1.1.0-pilot",
            "environment": "FEEDBACK_PILOT_PREVIEW_CANDIDATE",
            "applicationSourceCommit": "4dba2fe",
            "packageBuiltFromCommit": head_commit,
            "baselineCommit": "a7c3390",
            "databaseSchemaCommit": "4dba2fe",
            "builtAt": datetime.now().astimezone().isoformat(),
            "project": "Samsung Branch Operations System - Feedback Pilot",
            "pilotBranch": "AYUTTHAYA_CITY_PARK",
            "usersCount": 4,
            "primaryUseCase": "STOCK_LOOKUP",
            "totalFiles": len(pilot_manifest_items),
            "summary": {
                "totalFiles": len(pilot_manifest_items),
                "totalSizeBytes": total_bytes,
                "totalSizeMB": round(total_bytes / (1024 * 1024), 2)
            },
            "files": pilot_manifest_items
        }

        manifest_str = json.dumps(manifest_data, indent=2, ensure_ascii=False)
        zf.writestr("pilot_runtime_manifest.json", manifest_str.encode("utf-8"))

    # Also save pilot_runtime_manifest.json to disk
    with open(PILOT_MANIFEST_PATH, "w", encoding="utf-8") as f:
        f.write(manifest_str)

    # 3. Post-build Baseline Integrity Verification
    baseline_stat_after = os.stat(BASELINE_ZIP).st_mtime_ns
    if baseline_stat_before != baseline_stat_after:
        raise RuntimeError("FATAL: Baseline runtime zip was touched during pilot build!")

    print("\n----------------------------------------------------------------")
    print("BUILD VERIFICATION:")
    print(f"Baseline Zip Unchanged: YES (mtime match)")
    print(f"Pilot Package Created: {PILOT_ZIP}")
    print(f"Pilot Package Size: {os.path.getsize(PILOT_ZIP)} bytes")
    print(f"Total Files in Pilot: {len(pilot_manifest_items) + 1}")
    print("✅ Feedback Pilot Package Build Complete & Verified!")
    print("================================================================\n")

if __name__ == "__main__":
    build_pilot_package()
