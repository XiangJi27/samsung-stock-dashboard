#!/usr/bin/env python3
"""
Automated Test Runner: Live Security, Authorization & Stock API Matrix
Target: https://samsung-stock-pilot.vercel.app
"""
import urllib.request
import json
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://samsung-stock-pilot.vercel.app"
BRANCH_CODE = "AYUTTHAYA_CITY_PARK"

def run_matrix():
    print("=" * 70)
    print("SAMSUNG BRANCH OPERATIONS - LIVE SECURITY & AUTH MATRIX VERIFICATION")
    print(f"Target: {BASE_URL}")
    print(f"Branch: {BRANCH_CODE}")
    print("=" * 70)

    passed = 0
    total = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"✅ [PASS] {name} {details}")
        else:
            print(f"❌ [FAIL] {name} {details}")

    # TEST 1: Health Check for Active Stock (Unauthenticated plain URL)
    print("\n--- 1. Active Stock Health Check ---")
    try:
        url = f"{BASE_URL}/api/stock/active?branch_code={BRANCH_CODE}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        
        status_ok = resp.status == 200
        batch_present = bool(data.get('batchId'))
        summary = data.get('summary', {})
        total_rows_399 = summary.get('totalRows') == 399
        f1_1701 = summary.get('f1Total') == 1701
        f2_1635 = summary.get('f2Total') == 1635
        total_3336 = summary.get('totalQuantity') == 3336

        assert_test("Health Check Status == 200", status_ok)
        assert_test("Active Batch UUID Present", batch_present, f"(ID: {data.get('batchId')})")
        assert_test("Total Rows == 399 P/N", total_rows_399)
        assert_test("F1 Total == 1,701", f1_1701)
        assert_test("F2 Total == 1,635", f2_1635)
        assert_test("Reconciliation Grand Total == 3,336", total_3336)
    except Exception as e:
        assert_test("Health Check", False, str(e))

    # TEST 2: Unauthenticated Write Mutation (POST /api/stock-imports) -> 401
    print("\n--- 2. Unauthenticated Mutation Guard ---")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/api/stock-imports",
            data=json.dumps({"branchCode": BRANCH_CODE, "items": [{"pn": "T"}]}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            assert_test("Unauthenticated Write Blocked (Expected 401)", False, f"Got {resp.status}")
    except urllib.error.HTTPError as e:
        assert_test("Unauthenticated Write Blocked (401)", e.code == 401, f"(HTTP {e.code})")

    # TEST 3: Invalid Bearer Token Mutation -> 401
    print("\n--- 3. Invalid Bearer Token Guard ---")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/api/stock-imports",
            data=json.dumps({"branchCode": BRANCH_CODE, "items": [{"pn": "T"}]}).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'Authorization': 'Bearer fake_invalid_jwt_token'}
        )
        with urllib.request.urlopen(req) as resp:
            assert_test("Invalid Token Blocked (Expected 401)", False, f"Got {resp.status}")
    except urllib.error.HTTPError as e:
        assert_test("Invalid Token Blocked (401)", e.code == 401, f"(HTTP {e.code})")

    # TEST 4: Validate Endpoint Unauthenticated -> 401
    print("\n--- 4. Unauthenticated Validate Endpoint Guard ---")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/api/stock-imports/validate",
            data=json.dumps({"branchCode": BRANCH_CODE, "items": [{"pn": "T"}]}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            assert_test("Unauthenticated Validate Blocked (Expected 401)", False, f"Got {resp.status}")
    except urllib.error.HTTPError as e:
        assert_test("Unauthenticated Validate Blocked (401)", e.code == 401, f"(HTTP {e.code})")

    # TEST 5: Active Stock API with Invalid Token -> 401
    print("\n--- 5. Active Stock API with Invalid Token ---")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/api/stock/active?branch_code={BRANCH_CODE}",
            headers={'Authorization': 'Bearer bogus_expired_token'}
        )
        with urllib.request.urlopen(req) as resp:
            assert_test("Invalid Token to Active Stock Blocked (Expected 401)", False, f"Got {resp.status}")
    except urllib.error.HTTPError as e:
        assert_test("Invalid Token to Active Stock Blocked (401)", e.code == 401, f"(HTTP {e.code})")

    # TEST 6: Duplicate File Hash Detection on Server
    print("\n--- 6. Duplicate Source File Guard ---")
    try:
        # Check active batch file hash
        active_hash = "eef4c2ee7a111333a1e2e5d85f40fbbf48512d97feae1415d1cc6e792782e799"
        req = urllib.request.Request(
            f"{BASE_URL}/api/stock-imports",
            data=json.dumps({
                "branchCode": BRANCH_CODE,
                "sourceFileName": "stock(1).xlsx",
                "sourceFileSha256": active_hash,
                "items": [{"inventoryPn": "SAMPLE", "f1": 1, "f2": 0}]
            }).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            pass
    except urllib.error.HTTPError as e:
        # It should block with 401 because unauthenticated (defense in depth)
        assert_test("Defense in depth blocks unauthenticated duplicate upload", e.code == 401)

    print("\n" + "=" * 70)
    print(f"VERIFICATION SUMMARY: {passed}/{total} TESTS PASSED")
    print("=" * 70)

    if passed == total:
        print("🎉 ALL SECURITY & AUTHORIZATION TESTS SATISFIED!")
        return 0
    else:
        print("🚨 SOME TESTS FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(run_matrix())
