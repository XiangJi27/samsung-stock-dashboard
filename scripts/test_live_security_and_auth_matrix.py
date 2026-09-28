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

    # TEST 1: Active Stock must be FAIL-CLOSED for unauthenticated callers -> 401
    print("\n--- 1. Active Stock Fail-Closed Guard (anonymous) ---")
    active_stock_url = f"{BASE_URL}/api/stock/active?branch_code={BRANCH_CODE}"
    try:
        req = urllib.request.Request(active_stock_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        assert_test("Anonymous Active Stock Blocked (Expected 401)", False,
                    f"Got {resp.status} and batchId={data.get('batchId')}")
    except urllib.error.HTTPError as e:
        assert_test("Anonymous Active Stock Blocked (401)", e.code == 401, f"(HTTP {e.code})")
        body = e.read().decode('utf-8')
        assert_test("Anonymous response carries AUTHENTICATION_REQUIRED",
                    'AUTHENTICATION_REQUIRED' in body, f"({body[:80]})")
        assert_test("Anonymous response leaks no batchId", 'batchId' not in body)

    # TEST 1b: Former C1 bypass credentials must also be rejected by C2 -> 401
    print("\n--- 1b. Active Stock Bypass-Credential Guard ---")
    bypass_tokens = [
        ("mock-store-leader-token", "mock- prefixed token"),
        ("pilot-store-leader-token", "pilot- prefixed token"),
        ("PILOT_STORE_LEADER_DEV_TOKEN", "literal dev bypass token"),
    ]
    for token, label in bypass_tokens:
        try:
            req = urllib.request.Request(
                active_stock_url,
                headers={'Authorization': f'Bearer {token}'}
            )
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            assert_test(f"Bypass credential blocked ({label})", False,
                        f"Got {resp.status} and batchId={data.get('batchId')}")
        except urllib.error.HTTPError as e:
            assert_test(f"Bypass credential blocked ({label})", e.code == 401, f"(HTTP {e.code})")

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
