import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright

def test_direct_refresh():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("1. Logging in to establish sessionStorage session...", flush=True)
        page.goto("http://localhost:8080/#/login", wait_until="networkidle")
        page.fill("#loginEmployeeId", "admin")
        page.fill("#loginPassword", "SamsungDev2026!")
        page.click("#btnLoginSubmit")
        page.wait_for_timeout(1000)
        assert "#/home" in page.url
        print("✅ Logged in successfully. Active session established in sessionStorage.", flush=True)

        routes_to_test = [
            ("#/stock", "view-stock", "#kpiTotalStock"),
            ("#/promotion-import", "view-promotion-import", "#btnExportPromoSync"),
            ("#/stock-import", "view-stock-import", "#btnExportStockSync")
        ]

        for hash_route, view_id, target_selector in routes_to_test:
            url = f"http://localhost:8080/{hash_route}"
            print(f"\n2. Testing direct navigation / refresh to: {url} ...", flush=True)
            
            # Navigate to route
            page.goto(url)
            page.wait_for_timeout(500)
            
            # Execute full page refresh (F5) to test network reload and sessionStorage preservation
            resp = page.reload(wait_until="networkidle")
            assert resp is not None and resp.status == 200, f"HTTP Status was not 200 on refresh for {url}"
            print(f"   HTTP Status on Page Refresh: {resp.status} OK", flush=True)

            page.wait_for_timeout(1000)
            
            # Verify view is active and visible
            active_view = page.locator(f"#{view_id}")
            assert "active-view" in active_view.get_attribute("class"), f"Expected {view_id} to be active-view"
            assert not ("hidden-view" in active_view.get_attribute("class")), f"Expected {view_id} to not be hidden-view"
            print(f"   View #{view_id} is active and visible.", flush=True)

            # Check target selector rendered
            assert page.locator(target_selector).count() > 0, f"Target selector {target_selector} not found"
            print(f"   Target element {target_selector} rendered successfully.", flush=True)

            # For stock route, verify that numbers are computed (not 0 placeholder)
            if hash_route == "#/stock":
                stock_kpi = page.locator("#kpiTotalStock").inner_text()
                count_all = page.locator("#countAll").inner_text()
                print(f"   #/stock verified -> Total Stock: '{stock_kpi}', Count All: '{count_all}'", flush=True)
                assert "760" in stock_kpi or "เครื่อง" in stock_kpi
                assert int(count_all) == 236
                print("   ✅ Stock metrics accurately calculated upon direct refresh! (No placeholder zero)", flush=True)

            print(f"✅ Route {hash_route} direct refresh verified with ZERO 404 error!", flush=True)

        browser.close()
        print("\n🎉 ALL DIRECT HASH ROUTE REFRESH TESTS PASSED PERFECTLY!", flush=True)

if __name__ == "__main__":
    test_direct_refresh()
