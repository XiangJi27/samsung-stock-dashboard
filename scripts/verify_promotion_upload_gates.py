#!/usr/bin/env python3
"""
CI Verifier for Promotion Upload 5-Stage Gate & Isolation Invariants
Samsung Branch Operations - Ayutthaya City Park
"""

import json
import os
import sys
from jsonschema import validate, ValidationError

sys.stdout.reconfigure(encoding="utf-8")

def verify_promotion_upload_gates():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    contract_schema_path = os.path.join(root, "schemas", "promotion_import_contract.schema.json")
    fixtures_path = os.path.join(root, "fixtures", "promotions", "promotion_pilot_fixtures.json")
    preview_diff_path = os.path.join(root, "reports", "promotion_preview_diff.json")
    drafts_path = os.path.join(root, "reports", "promotion_import_drafts.json")

    print("================================================================================")
    print("CHECKING PROMOTION UPLOAD 5-STAGE GATE & ISOLATION INVARIANTS")
    print("================================================================================\n")

    # 1. Contract Schema Validation on Saved Drafts & Valid Fixtures
    if not os.path.exists(contract_schema_path):
        print(f"❌ Contract schema missing: {contract_schema_path}")
        return False
    with open(contract_schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    if not os.path.exists(drafts_path):
        print(f"❌ Drafts file missing: {drafts_path}")
        return False
    with open(drafts_path, "r", encoding="utf-8") as f:
        drafts = json.load(f).get("draftPromotions", [])

    print(f"Found {len(drafts)} valid promotion drafts imported.")
    for d in drafts:
        try:
            validate(instance=d, schema=schema)
        except ValidationError as e:
            print(f"❌ Schema validation failed for draft {d.get('promotionId')}: {e.message}")
            return False

    print("✅ All imported promotion drafts strictly conform to promotion_import_contract.schema.json")

    # 2. Preview Diff Verification
    if not os.path.exists(preview_diff_path):
        print(f"❌ Preview diff report missing: {preview_diff_path}")
        return False
    with open(preview_diff_path, "r", encoding="utf-8") as f:
        diff = json.load(f)

    policy = diff.get("policy", {})
    if policy.get("autoPublishPromotion") != "OFF":
        print(f"❌ Auto publish promotion is not OFF: {policy.get('autoPublishPromotion')}")
        return False
    if policy.get("importStatus") != "DRAFT":
        print(f"❌ Import status is not DRAFT: {policy.get('importStatus')}")
        return False
    if not policy.get("previewDiffRequired"):
        print("❌ Preview diff requirement not enforced")
        return False
    if not policy.get("managerApprovalRequired"):
        print("❌ Manager approval requirement not enforced")
        return False

    print("✅ Pilot Promotion Policy Enforced: AUTO_PUBLISH=OFF, DRAFT=TRUE, PREVIEW_DIFF=TRUE, MANAGER_APPROVAL=TRUE")

    # 3. Isolation Guards
    guards = diff.get("isolationGuards", {})
    for k, v in guards.items():
        if v != 0:
            print(f"❌ Isolation breach detected: {k} = {v} (Must be 0)")
            return False
    print("✅ Isolation Guards Verified: 0 mutations to Product Master, Specs, Stock, or ERP Prices")

    # 4. Results Gate Outcomes
    with open(fixtures_path, "r", encoding="utf-8") as f:
        fixtures_data = json.load(f)
    fixtures = fixtures_data.get("fixtures", [])

    results = diff.get("results", [])
    if len(results) != len(fixtures):
        print(f"❌ Result count mismatch: {len(results)} vs {len(fixtures)}")
        return False

    for res in results:
        t_id = res["testId"]
        exp_gate = res["expectedGateOutcome"]
        act_gate = res["gateOutcome"]
        exp_status = res["expectedStatus"]
        act_status = res["status"]

        if exp_gate != act_gate:
            print(f"❌ Test {t_id}: Gate outcome mismatch (Expected: {exp_gate}, Actual: {act_gate})")
            return False
        if exp_status != act_status:
            print(f"❌ Test {t_id}: Status mismatch (Expected: {exp_status}, Actual: {act_status})")
            return False

    print(f"✅ All {len(results)} fixture test cases matched exact gate outcomes and expected statuses.")
    print("🎉 ALL PROMOTION UPLOAD GATES & ISOLATION INVARIANTS PASSED!")
    return True

if __name__ == "__main__":
    success = verify_promotion_upload_gates()
    sys.exit(0 if success else 1)
