#!/usr/bin/env python3
"""
AI Critic Reviewer (Secondary Independent Critic)
Samsung Branch Operations System - Ayutthaya City Park

Operates independently from AI Generator to perform adversarial critique on drafts:
1. Detects Unsupported Claims (claims exceeding evidence or lacking verified sources)
2. Detects Variant Conflicts (variant-specific attributes leaking across families)
3. Detects Missing Sales Fields vs Missing Technical Fields
4. Identifies High-Risk Fields lacking lab/manufacturer evidence
5. Generates structured recommendations:
   - APPROVE_SALES_READY
   - APPROVE_SALES_READY_PARTIAL
   - HOLD_HUMAN_REVIEW
   - REJECT_CONFLICT

CRITICAL RULE: AI Critic has READ-ONLY critique authority and NO publishing authority (AUTO_PUBLISH = DENIED).
Output saved to: reports/ai_critic_review.json
"""

import json
import os
import re
import sys
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")

REQUIRED_SALES_FIELDS = {
    "WALL_CHARGER": ["maximumOutputPower", "outputPorts", "cableIncluded", "color"],
    "WIRELESS_CHARGER": ["maximumOutputPower", "chargerType", "fastWirelessChargingSupport"],
    "DATA_CABLE": ["connectorA", "connectorB", "maximumPower", "length", "color"],
    "SCREEN_PROTECTOR": ["compatibleModels", "protectorType"],
    "PHONE_CASE": ["compatibleModels", "caseType", "color"],
    "TABLET_CASE": ["compatibleModels", "caseType", "color"],
    "WATCH_BAND": ["compatibleModels", "bandStyle", "color"],
    "POWER_BANK": ["batteryCapacity", "maximumOutputPower"],
    "BLUETOOTH_SPEAKER": ["outputPower", "playTime", "ipRating"],
    "EARBUDS": ["driverSize", "batteryLife"]
}

HIGH_RISK_FIELDS = {
    "pps", "eMarkerChip", "dataTransferSpeed", "videoOutput",
    "batteryCapacity", "thailandWarrantyPeriod", "safetyCertification",
    "inputVoltage", "outputProfiles", "usbPowerDelivery"
}

def critique_draft(draft, family_info):
    pn = draft.get("inventoryPn")
    pt = draft.get("productType")
    cls_status = draft.get("classificationStatus")
    sales_readiness = draft.get("salesReadiness")
    enriched = draft.get("enrichedSalesFields", {})
    summary = draft.get("salesSummary", "")
    desc = draft.get("erpSnapshot", {}).get("description", "")
    
    unsupported_claims = []
    variant_conflicts = []
    missing_sales_fields = []
    high_risk_fields_without_evidence = []
    
    # 1. Identity Result
    identity_result = "PASS"
    if not pn or draft.get("draftId", "") == "":
        identity_result = "FAIL"
        unsupported_claims.append("Missing canonical draft or inventory P/N identity")

    # 2. Unsupported Claims / Spec Leakage
    summary_lower = (summary or "").lower()
    if "helio g85" in summary_lower or "knox vault" in summary_lower:
        unsupported_claims.append("Phone hardware chipset/security spec leaked into accessory summary")
        
    for k, v in enriched.items():
        if isinstance(v, dict):
            status = v.get("status")
            if status == "AI_EXTRACTED" and k in HIGH_RISK_FIELDS:
                unsupported_claims.append(f"High-risk field '{k}' asserted by AI without verified manufacturer source")
                high_risk_fields_without_evidence.append(k)

    # 3. Variant Conflicts
    if family_info:
        fam_name = family_info.get("familyName", "")
        # Check cableIncluded conflict in chargers
        if "EP-T4511" in pn or "EP-T2510" in pn:
            cable_field = enriched.get("cableIncluded")
            if cable_field and cable_field.get("value") is True and ("without cable" in desc.lower() or "no cable" in desc.lower()):
                variant_conflicts.append(f"P/N {pn} description says 'no cable' but variant enriched with cableIncluded=True")

    # 4. Missing Sales Fields
    if pt in REQUIRED_SALES_FIELDS:
        req = REQUIRED_SALES_FIELDS[pt]
        for field in req:
            if field not in enriched:
                missing_sales_fields.append(field)

    # 5. Recommendation Formulation
    if identity_result == "FAIL" or len(unsupported_claims) > 0 or len(variant_conflicts) > 0:
        recommendation = "REJECT_CONFLICT"
    elif cls_status == "REVIEW_REQUIRED" or pt is None:
        recommendation = "HOLD_HUMAN_REVIEW"
    elif len(missing_sales_fields) > 1:
        recommendation = "HOLD_HUMAN_REVIEW"
    elif len(missing_sales_fields) == 1:
        recommendation = "APPROVE_SALES_READY_PARTIAL"
    else:
        recommendation = "APPROVE_SALES_READY"

    return {
        "inventoryPn": pn,
        "draftId": draft.get("draftId"),
        "productType": pt,
        "identityResult": identity_result,
        "unsupportedClaims": unsupported_claims,
        "variantConflicts": variant_conflicts,
        "missingSalesFields": missing_sales_fields,
        "highRiskFieldsWithoutEvidence": high_risk_fields_without_evidence,
        "recommendation": recommendation,
        "publishingAuthority": "DENIED"  # Permanent policy: AI Critic has NO publish rights
    }

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    drafts_path = os.path.join(root, "data", "product-accessory-drafts.json")
    family_path = os.path.join(root, "reports", "product_family_map.json")
    output_path = os.path.join(root, "reports", "ai_critic_review.json")

    print("================================================================================")
    print("SAMSUNG BRANCH OPERATIONS - INDEPENDENT AI CRITIC REVIEW ENGINE")
    print("================================================================================\n")

    if not os.path.exists(drafts_path):
        print(f"❌ Error: Drafts file not found at {drafts_path}")
        sys.exit(1)

    with open(drafts_path, "r", encoding="utf-8") as f:
        drafts_manifest = json.load(f)

    family_map = {}
    if os.path.exists(family_path):
        with open(family_path, "r", encoding="utf-8") as f:
            fam_data = json.load(f)
            for fam in fam_data.get("families", []):
                for var in fam.get("variants", []):
                    family_map[var.get("inventoryPn")] = fam

    drafts = drafts_manifest.get("drafts", [])
    critic_reviews = []
    
    rec_counts = {
        "APPROVE_SALES_READY": 0,
        "APPROVE_SALES_READY_PARTIAL": 0,
        "HOLD_HUMAN_REVIEW": 0,
        "REJECT_CONFLICT": 0
    }

    for d in drafts:
        pn = d.get("inventoryPn")
        fam_info = family_map.get(pn)
        critique = critique_draft(d, fam_info)
        critic_reviews.append(critique)
        rec = critique["recommendation"]
        rec_counts[rec] = rec_counts.get(rec, 0) + 1

    report = {
        "generatedAt": datetime.now().isoformat(),
        "totalDraftsCritiqued": len(drafts),
        "publishingAuthority": "DENIED",
        "criticSummary": rec_counts,
        "totalConflictsDetected": sum(len(c["unsupportedClaims"]) + len(c["variantConflicts"]) for c in critic_reviews),
        "reviews": critic_reviews
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"Total Drafts Critiqued           : {len(drafts)}")
    print(f"  ✅ APPROVE_SALES_READY          : {rec_counts['APPROVE_SALES_READY']}")
    print(f"  ⚡ APPROVE_SALES_READY_PARTIAL  : {rec_counts['APPROVE_SALES_READY_PARTIAL']}")
    print(f"  ⏳ HOLD_HUMAN_REVIEW            : {rec_counts['HOLD_HUMAN_REVIEW']}")
    print(f"  ❌ REJECT_CONFLICT              : {rec_counts['REJECT_CONFLICT']}")
    print(f"\nTotal Conflicts / Claims Flagged : {report['totalConflictsDetected']}")
    print(f"Publishing Authority Policy      : STRICTLY DENIED (Human/Deterministic Gate Required)")
    print("================================================================================")
    print(f"Saved AI Critic Review report to: {output_path}")

    if rec_counts["REJECT_CONFLICT"] > 0:
        print("\n🚨 CRITIC ALERT: Unresolved conflicts detected in drafts!")
        sys.exit(1)
    else:
        print("\n🎉 ALL DRAFTS PASSED AI CRITIC INTEGRITY CHECKS!")
        sys.exit(0)

if __name__ == "__main__":
    main()
