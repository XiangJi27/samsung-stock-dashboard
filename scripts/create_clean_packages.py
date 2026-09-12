# -*- coding: utf-8 -*-
"""
Script to create two clean deployment and audit zip packages:
1. samsung_stock_dashboard_runtime.zip (Static Web Application Runtime Package)
   - Contains ONLY files required to run the dashboard (runtime_manifest.json + api/ + active_promotions.csv)
   - Zero .git
   - Zero reports/archive
   - Zero source Excel or extracted XML
   - Zero temporary/scratch files or logs
   - Zero credentials or sensitive configs
   - Tiny size (~2 MB)
2. samsung_stock_dashboard_audit_evidence.zip (Audit & Governance Evidence Package)
   - Contains all 5 September reports
   - Contains CI quality gate results & execution evidence
   - Contains runtime_manifest.json
   - Contains test scripts & validation suites
   - Zero .git
   - Zero secrets
"""
import os
import sys
import io
import json
import zipfile

# Force utf-8 stdout
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
runtime_zip = os.path.join(ROOT_DIR, "samsung_stock_dashboard_runtime.zip")
audit_zip = os.path.join(ROOT_DIR, "samsung_stock_dashboard_audit_evidence.zip")

# Remove previous zips if exist
for z in [runtime_zip, audit_zip]:
    if os.path.exists(z):
        try:
            os.remove(z)
        except Exception:
            pass

# -------------------------------------------------------------
# 1. Package: Runtime Package
# -------------------------------------------------------------
manifest_path = os.path.join(ROOT_DIR, "runtime_manifest.json")
with open(manifest_path, "r", encoding="utf-8") as f:
    manifest_data = json.load(f)

runtime_files = [item["file"] for item in manifest_data.get("files", [])]

# Add optional serverless api files and runtime active promotions
additional_runtime_files = [
    "api/vision-proxy.js",
    "active_promotions.csv",
    "runtime_manifest.json"
]

for af in additional_runtime_files:
    if af not in runtime_files and os.path.exists(os.path.join(ROOT_DIR, af)):
        runtime_files.append(af)

print("Packaging Clean Runtime Package: samsung_stock_dashboard_runtime.zip...")
with zipfile.ZipFile(runtime_zip, "w", zipfile.ZIP_DEFLATED) as zf:
    for rel_path in runtime_files:
        full_path = os.path.join(ROOT_DIR, rel_path)
        if os.path.exists(full_path):
            zf.write(full_path, rel_path)
            print(f"  + {rel_path}")

runtime_size_mb = os.path.getsize(runtime_zip) / (1024 * 1024)
print(f"✅ Clean Runtime Package created: {runtime_zip} ({runtime_size_mb:.2f} MB)")

# -------------------------------------------------------------
# 2. Package: Audit Evidence Package
# -------------------------------------------------------------
audit_files_to_include = [
    "reports/september_header_mapping_before.json",
    "reports/september_header_mapping_after.json",
    "reports/september_sheet_classification.json",
    "reports/september_product_match_results.json",
    "reports/september_import_regression.json",
    "reports/ci_quality_gate_results.json",
    "reports/batch_consistency_gate.json",
    "reports/exact_pn_quality_gate.json",
    "reports/runtime_hash_verification.json",
    "reports/addon_purchase_regression_results.json",
    "reports/sheet_sync_test_results.json",
    "reports/ai_promotion_ingestion_test_results.json",
    "runtime_manifest.json",
    "audit_summary.json",
    "business_rules.json",
    "test_golden_cases.py",
    "scripts/ci_quality_gate.py",
    "scripts/generate_september_reports.py",
    "scripts/test_addon_purchase.py",
    "scripts/test_sheet_sync.py",
    "scripts/test_ai_promotion_ingestion.py",
    "scripts/test_pn_confirmation_workflow.py"
]

print("\nPackaging Clean Audit Evidence Package: samsung_stock_dashboard_audit_evidence.zip...")
with zipfile.ZipFile(audit_zip, "w", zipfile.ZIP_DEFLATED) as zf:
    for rel_path in audit_files_to_include:
        full_path = os.path.join(ROOT_DIR, rel_path)
        if os.path.exists(full_path):
            zf.write(full_path, rel_path)
            print(f"  + {rel_path}")

audit_size_mb = os.path.getsize(audit_zip) / (1024 * 1024)
print(f"✅ Clean Audit Evidence Package created: {audit_zip} ({audit_size_mb:.2f} MB)")

# Remove the old 73MB zip if present
old_zip = os.path.join(ROOT_DIR, "samsung_stock_dashboard_september_fix.zip")
old_zip_txt = os.path.join(ROOT_DIR, "samsung_stock_dashboard_september_fix.zip.txt")
for oz in [old_zip, old_zip_txt]:
    if os.path.exists(oz):
        try:
            os.remove(oz)
            print(f"Cleaned up obsolete {oz}")
        except Exception:
            pass
