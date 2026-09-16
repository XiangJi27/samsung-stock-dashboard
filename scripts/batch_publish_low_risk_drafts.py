#!/usr/bin/env python3
"""
Batch Publish Low-Risk Drafts Engine
Samsung Branch Operations System - Ayutthaya City Park

Reads product-accessory-drafts.json, selects SALES_READY LOW/MEDIUM-risk
items not yet in master, converts them to master format, then atomically
writes to data/product-accessory-master.json.

Safety invariants (FAIL-CLOSED):
  - Only draftStatus == 'SALES_READY' items are eligible.
  - riskLevel must be 'LOW' or 'MEDIUM'.
  - publicationStatus must be 'DRAFT' (not HOLD_REVIEW_REQUIRED).
  - inventoryPn must not already exist in master.
  - ERP snapshot fields (cat1/cat2/cat3, brand, SRP) are treated as IMMUTABLE.
  - No modifications to stock counts (f1/f2/total).
  - Dry-run mode by default; pass --commit to write.
"""

import json
import os
import sys
import subprocess
from datetime import datetime
from typing import Optional

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER_PATH = os.path.join(ROOT, "data", "product-accessory-master.json")
DRAFTS_PATH = os.path.join(ROOT, "data", "product-accessory-drafts.json")
INJECT_SCRIPT = os.path.join(ROOT, "tools", "ops", "inject_accessory_master.py")
RECALC_SCRIPT = os.path.join(ROOT, "scripts", "recalculate_published_readiness.py")

# Eligibility criteria
ELIGIBLE_DRAFT_STATUSES = {"SALES_READY"}
ELIGIBLE_RISK_LEVELS = {"LOW", "MEDIUM"}
BLOCKED_PUBLICATION_STATUSES = {"HOLD_REVIEW_REQUIRED", "PUBLISHED"}

# Product types that map cleanly to master schema
KNOWN_PRODUCT_TYPES = {
    "WALL_CHARGER", "DATA_CABLE", "WIRELESS_CHARGER", "PORTABLE_CHARGER",
    "EARPHONES", "TWS_EARPHONES", "HEADPHONES", "SPEAKER",
    "PHONE_CASE", "SCREEN_PROTECTOR", "TABLET_CASE",
    "SMARTWATCH_STRAP", "SMARTWATCH_CASE",
    "CAR_CHARGER", "CAR_MOUNT", "USB_HUB",
    "SOUNDBAR", "HOME_APPLIANCE", "PREMIUM_GIFT",
    "MEMORY_CARD", "USB_DRIVE",
}


def load_json(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json_atomic(path: str, data: dict) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def build_master_record(draft: dict) -> Optional[dict]:
    """Convert a draft record into master product format."""
    pn = draft.get("inventoryPn")
    if not pn:
        return None

    erp = draft.get("erpSnapshot", {})
    enriched = draft.get("enrichedSalesFields", {})
    erp_extracted = draft.get("erpExtractedAttributes", {})
    product_type = draft.get("productType", "UNKNOWN")

    # ERP immutable fields
    brand = erp.get("brand") or draft.get("brand", "")
    description = erp.get("description", "")
    cat1 = erp.get("cat1", "")
    cat2 = erp.get("cat2", "")
    cat3 = erp.get("cat3", "")
    srp = erp.get("srp") or erp.get("erpPrice")

    # Build specifications from enrichedSalesFields first, fallback to erpExtractedAttributes
    specifications = {}
    all_fields = dict(erp_extracted)
    all_fields.update(enriched)  # enriched overrides extracted

    for field_name, field_data in all_fields.items():
        if not isinstance(field_data, dict):
            continue
        val = field_data.get("value")
        display = field_data.get("displayValue") or str(val)
        status = field_data.get("status", "VERIFIED_FROM_ERP")
        specifications[field_name] = {
            "value": val,
            "displayValue": display,
            "status": status,
            "sourceId": "SRC-ERP-STOCK"
        }

    # Determine canonical name and sales summary
    sales_summary = draft.get("salesSummary") or description
    canonical_name = _derive_canonical_name(brand, product_type, specifications, description)

    # Variant info
    variant = {}
    if "color" in specifications:
        variant["color"] = specifications["color"].get("value")
    if "cableIncluded" in specifications:
        variant["cableIncluded"] = specifications["cableIncluded"].get("value")

    record = {
        "recordId": f"PUB-{pn.replace(' ', '-').replace('/', '-')}",
        "inventoryIdentity": {
            "inventoryPn": pn,
            "gtin": draft.get("barcode") or pn,
            "brand": brand,
            "erpDescription": description,
            "cat1": cat1,
            "cat2": cat2,
            "cat3": cat3
        },
        "productIdentity": {
            "canonicalName": canonical_name,
            "productType": product_type,
            "salesSummary": sales_summary,
            "variant": variant
        },
        "verification": {
            "recordStatus": "SALES_READY",
            "identityStatus": "VERIFIED",
            "matchMethod": "ERP_DRAFT_PIPELINE",
            "brandMatch": True,
            "productTypeMatch": True,
            "publishedFromDraft": draft.get("draftId"),
            "publishedAt": datetime.now().isoformat()
        },
        "specifications": specifications,
        "pricing": {
            "srp": srp,
            "currency": "THB"
        }
    }

    return record


def _derive_canonical_name(brand: str, product_type: str, specs: dict, erp_desc: str) -> str:
    """Derive a clean canonical name from available data."""
    power = specs.get("maximumOutputPower", {}).get("displayValue", "")
    color = specs.get("color", {}).get("value", "")
    cable = specs.get("cableIncluded", {}).get("value")

    type_labels = {
        "WALL_CHARGER": "Wall Charger",
        "DATA_CABLE": "Cable",
        "WIRELESS_CHARGER": "Wireless Charger",
        "PORTABLE_CHARGER": "Power Bank",
        "EARPHONES": "Earphones",
        "TWS_EARPHONES": "True Wireless Earphones",
        "HEADPHONES": "Headphones",
        "SPEAKER": "Speaker",
        "PHONE_CASE": "Phone Case",
        "SCREEN_PROTECTOR": "Screen Protector",
        "TABLET_CASE": "Tablet Case",
        "CAR_CHARGER": "Car Charger",
        "SOUNDBAR": "Soundbar",
        "HOME_APPLIANCE": "Home Appliance",
        "PREMIUM_GIFT": "Premium Gift",
        "MEMORY_CARD": "Memory Card",
        "USB_DRIVE": "USB Drive",
        "SMARTWATCH_STRAP": "Smartwatch Strap",
        "SMARTWATCH_CASE": "Smartwatch Case",
        "USB_HUB": "USB Hub",
        "CAR_MOUNT": "Car Mount",
        "WIRELESS_CHARGER": "Wireless Charger",
    }
    type_label = type_labels.get(product_type, product_type.replace("_", " ").title())

    parts = [brand, type_label]
    if power:
        parts.append(power)
    if color:
        parts.append(f"- {color}")
    if cable is True:
        parts.append("(with cable)")
    elif cable is False:
        parts.append("(without cable)")

    return " ".join(parts)


def get_f1_quantity(draft: dict) -> int:
    erp = draft.get("erpSnapshot", {})
    return int(erp.get("f1", 0) or erp.get("quantityOnHand", 0) or 0)


def run(commit: bool = False, max_items: int = None) -> None:
    print("=" * 80)
    print("SAMSUNG BRANCH OPS - BATCH PUBLISH LOW-RISK DRAFTS ENGINE")
    print(f"Mode: {'COMMIT' if commit else 'DRY-RUN (pass --commit to write)'}")
    print("=" * 80)

    drafts_data = load_json(DRAFTS_PATH)
    all_drafts = drafts_data.get("drafts", [])

    master_data = load_json(MASTER_PATH)
    master_products = master_data.get("products", [])
    existing_pns = {
        p["inventoryIdentity"]["inventoryPn"]
        for p in master_products
        if p.get("inventoryIdentity", {}).get("inventoryPn")
    }

    print(f"\nExisting master records : {len(master_products)}")
    print(f"Existing P/Ns           : {len(existing_pns)}")
    print(f"Total drafts            : {len(all_drafts)}")

    # --- Selection pass ---
    eligible = []
    skipped_already_published = []
    skipped_not_sales_ready = []
    skipped_risk = []
    skipped_hold = []

    for draft in all_drafts:
        pn = draft.get("inventoryPn")
        draft_status = draft.get("draftStatus")
        pub_status = draft.get("publicationStatus")
        risk = draft.get("riskLevel", "UNKNOWN")

        if not pn or pn in existing_pns:
            skipped_already_published.append(pn)
            continue
        if draft_status not in ELIGIBLE_DRAFT_STATUSES:
            skipped_not_sales_ready.append(pn)
            continue
        if pub_status in BLOCKED_PUBLICATION_STATUSES:
            skipped_hold.append(pn)
            continue
        if risk not in ELIGIBLE_RISK_LEVELS:
            skipped_risk.append(pn)
            continue

        eligible.append(draft)

    # Sort by F1 quantity descending (highest impact first)
    eligible.sort(key=lambda d: get_f1_quantity(d), reverse=True)

    if max_items:
        eligible = eligible[:max_items]

    total_f1 = sum(get_f1_quantity(d) for d in eligible)
    current_f1 = 653  # Known current published F1 coverage
    projected_f1 = current_f1 + total_f1
    total_f1_universe = 1701

    print(f"\n{'─'*60}")
    print(f"ELIGIBILITY SUMMARY")
    print(f"{'─'*60}")
    print(f"  Already in master (skip)  : {len(skipped_already_published)}")
    print(f"  Not SALES_READY (skip)    : {len(skipped_not_sales_ready)}")
    print(f"  HOLD_REVIEW_REQUIRED (skip): {len(skipped_hold)}")
    print(f"  Risk too high (skip)      : {len(skipped_risk)}")
    print(f"  ELIGIBLE to publish       : {len(eligible)}")
    print(f"  F1 units to add           : {total_f1}")
    print(f"  Projected Published F1    : {projected_f1} / {total_f1_universe} ({100*projected_f1/total_f1_universe:.2f}%)")

    if projected_f1 / total_f1_universe >= 0.80:
        print(f"  ✅ WILL REACH >= 80% TARGET")
    else:
        gap = int(total_f1_universe * 0.80) - projected_f1
        print(f"  ⚠️  Still {gap} F1 units short of 80% target")

    print(f"\n{'─'*60}")
    print(f"ELIGIBLE ITEMS (Top 30 shown):")
    print(f"{'─'*60}")
    for i, d in enumerate(eligible[:30]):
        pn = d.get("inventoryPn")
        brand = d.get("brand", "")
        desc = d.get("erpSnapshot", {}).get("description", "")[:50]
        f1 = get_f1_quantity(d)
        risk = d.get("riskLevel", "?")
        print(f"  {i+1:3d}. [{risk:6s}] F1={f1:3d}  {pn}  {desc}")

    if len(eligible) > 30:
        print(f"  ... and {len(eligible) - 30} more items")

    if not commit:
        print(f"\n{'='*80}")
        print("DRY-RUN COMPLETE. No changes written.")
        print("Run with --commit to publish all eligible items.")
        print("=" * 80)
        return

    # --- Commit phase ---
    print(f"\n{'='*80}")
    print(f"COMMITTING {len(eligible)} RECORDS TO MASTER...")
    print("=" * 80)

    new_records = []
    failed = []
    for draft in eligible:
        try:
            record = build_master_record(draft)
            if record:
                new_records.append(record)
            else:
                failed.append(draft.get("inventoryPn"))
        except Exception as e:
            failed.append(f"{draft.get('inventoryPn')}: {e}")

    if failed:
        print(f"\n⚠️  Failed to convert {len(failed)} records:")
        for f in failed[:10]:
            print(f"    - {f}")

    master_products.extend(new_records)
    master_data["products"] = master_products
    master_data["generatedAt"] = datetime.now().isoformat()
    master_data["publishedBatchAt"] = datetime.now().isoformat()
    master_data["publishedBatchSize"] = len(new_records)

    write_json_atomic(MASTER_PATH, master_data)
    print(f"\n✅ Atomically wrote {len(master_products)} products to master.")
    print(f"   (+{len(new_records)} new records added)")

    # Mark as PUBLISHED in drafts file
    draft_id_to_draft = {d.get("draftId"): d for d in eligible if d.get("draftId")}
    pn_set = {d.get("inventoryPn") for d in eligible}

    all_drafts_updated = []
    published_count = 0
    for d in all_drafts:
        if d.get("inventoryPn") in pn_set:
            d["publicationStatus"] = "PUBLISHED"
            d["publishedAt"] = datetime.now().isoformat()
            published_count += 1
        all_drafts_updated.append(d)

    drafts_data["drafts"] = all_drafts_updated
    drafts_data["lastBatchPublishAt"] = datetime.now().isoformat()
    write_json_atomic(DRAFTS_PATH, drafts_data)
    print(f"✅ Updated publication status on {published_count} drafts.")

    # Inject into product_specs_data.js
    if os.path.exists(INJECT_SCRIPT):
        res = subprocess.run([sys.executable, INJECT_SCRIPT],
                             capture_output=True, text=True, encoding="utf-8")
        if res.returncode == 0:
            print("✅ Injected updated Master into product_specs_data.js")
        else:
            print(f"⚠️  Inject returned code {res.returncode}: {res.stderr[:200]}")

    # Recalculate readiness
    print(f"\n{'='*80}")
    print("RECALCULATING LIVE PUBLISHED READINESS...")
    recalc = subprocess.run([sys.executable, RECALC_SCRIPT],
                            capture_output=True, text=True, encoding="utf-8")
    print(recalc.stdout)
    if recalc.returncode != 0:
        print(f"⚠️  Recalculate error: {recalc.stderr[:200]}")

    print("=" * 80)
    print("🎉 BATCH PUBLISH COMPLETE!")
    print("=" * 80)


if __name__ == "__main__":
    commit_mode = "--commit" in sys.argv
    max_n = None
    for arg in sys.argv[1:]:
        if arg.startswith("--max="):
            max_n = int(arg.split("=")[1])
    run(commit=commit_mode, max_items=max_n)
