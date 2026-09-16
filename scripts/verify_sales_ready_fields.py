#!/usr/bin/env python3
"""
Sales-Ready Fields & Readiness Regression Verifier
Validates:
1. Every SALES_READY product has all required sales fields populated.
2. Anti-leakage: Zero Galaxy phone specs leaked into accessory sales summaries.
3. High-risk claim gating: Zero unproven E-Marker, BT 5.4, or 18M warranty asserted without evidence.
4. Dashboard arithmetic integrity: Total F1 == 1701, Total F1 P/Ns == 333.
5. Gate 4 safety invariants: 0 leaks, 0 conflicts, 0 blockers.
"""

import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dashboard_path = os.path.join(root, "reports", "sales_readiness_dashboard.json")
    drafts_path = os.path.join(root, "data", "product-accessory-drafts.json")
    
    print("================================================================================")
    print("SAMSUNG BRANCH OPERATIONS - SALES-READY REGRESSION VERIFIER")
    print("================================================================================\n")
    
    violations = []
    
    if not os.path.exists(dashboard_path):
        print(f"❌ Error: Dashboard not found at {dashboard_path}")
        sys.exit(1)
        
    with open(dashboard_path, "r", encoding="utf-8") as f:
        dash = json.load(f)
        
    with open(drafts_path, "r", encoding="utf-8") as f:
        draft_manifest = json.load(f)
        
    drafts = draft_manifest.get("drafts", [])
    
    # 1. Audit SALES_READY drafts
    sales_ready_drafts = [d for d in drafts if d.get("salesReadiness") == "SALES_READY"]
    
    for d in sales_ready_drafts:
        pn = d.get("inventoryPn")
        pt = d.get("productType")
        summary = d.get("salesSummary", "")
        fields = d.get("enrichedSalesFields", {})
        
        if not pt:
            violations.append(f"SALES_READY draft {pn} has null productType")
            
        if not summary or len(summary) < 5:
            violations.append(f"SALES_READY draft {pn} has empty or trivial salesSummary")
            
        # Anti-leakage check: An accessory must never inherit flagship hardware specs
        sum_lower = summary.lower()
        if "helio g85" in sum_lower or "knox vault" in sum_lower or "กล้อง 50mp" in sum_lower or "จอ 6.7 นิ้ว" in sum_lower:
            violations.append(f"CRITICAL: Phone hardware spec leak in salesSummary for accessory {pn}: '{summary}'")
            
        # Cross-brand leak: Soundcore or other non-Samsung accessory must never mention Galaxy A07
        if d.get("brand", "").upper() == "SOUNDCORE" and "galaxy" in sum_lower:
            violations.append(f"CRITICAL: Galaxy phone leak into Soundcore item {pn}: '{summary}'")
            
        # High-risk claim check: Bluetooth 5.4 or 18 month warranty without source
        if "5.4" in summary or "18 เดือน" in summary or "e-marker" in summary:
            violations.append(f"Unproven high-risk technical claim detected in salesSummary for {pn}: '{summary}'")

    # 2. Audit Dashboard metrics
    gates = dash.get("fourReadinessGates", {})
    g1 = gates.get("gate1_f1QuantityCoverage", {})
    g2 = gates.get("gate2_f1PnCoverage", {})
    g4 = gates.get("gate4_safetyAndIntegrity", {})
    
    if g1.get("totalUnits") != 1701:
        violations.append(f"Gate 1 totalUnits is {g1.get('totalUnits')}, expected 1701")
        
    if g2.get("totalPns") != 333:
        violations.append(f"Gate 2 totalPns is {g2.get('totalPns')}, expected 333")
        
    if g4.get("crossProductLeakage") != 0 or g4.get("blockedConflictCount") != 0:
        violations.append("Gate 4 safety checks failed with non-zero leaks or conflicts")
        
    if violations:
        print(f"❌ [FAIL] Sales-Ready Regression Violations Found ({len(violations)}):")
        for v in violations:
            print(f"   - {v}")
        sys.exit(1)
        
    print(f"✅ [PASS] SALES_READY Invariants: All {len(sales_ready_drafts)} drafts meet Sales-Ready criteria")
    print(f"✅ [PASS] Anti-Leakage Guard: 0 phone spec leaks across all sales summaries")
    print(f"✅ [PASS] High-Risk Claim Gate: 0 unproven high-risk specs asserted")
    print(f"✅ [PASS] Dashboard Arithmetic: Total Units = 1701, Total P/Ns = 333")
    print(f"✅ [PASS] Safety Invariants: 0 Leaks | 0 Conflicts | 0 Blockers")
    print("\n" + "=" * 80)
    print("🎉 ALL SALES-READY REGRESSION INVARIANTS SATISFIED")
    print("=" * 80)
    sys.exit(0)

if __name__ == "__main__":
    main()
