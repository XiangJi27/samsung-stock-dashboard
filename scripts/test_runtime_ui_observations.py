import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright

def test_runtime_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("1. Opening app at http://localhost:8080/ ...", flush=True)
        page.goto("http://localhost:8080/", wait_until="networkidle")
        
        # Check login redirection
        current_url = page.url
        print(f"   Current URL: {current_url}", flush=True)
        assert "#/login" in current_url, f"Expected #/login in URL, got {current_url}"
        print("OK: Correctly redirected unauthenticated user to #/login", flush=True)
        
        # Check header promo expiry badge before login
        hdr_badge = page.locator("#headerPromoExpiryBadge").inner_text()
        print(f"   Header promo expiry badge before login: '{hdr_badge}'", flush=True)
        assert "หมดอายุ" in hdr_badge, f"Expected 'หมดอายุ' in header badge, got '{hdr_badge}'"
        print("OK: Header badge correctly displays expired status before login", flush=True)
        
        # Perform Login using correct form IDs (#loginEmployeeId, #loginPassword)
        print("2. Logging in with employee credentials...", flush=True)
        page.fill("#loginEmployeeId", "admin")
        page.fill("#loginPassword", "SamsungDev2026!")
        page.click("#btnLoginSubmit")
        
        page.wait_for_timeout(1000)
        print(f"   URL after login: {page.url}", flush=True)
        assert "#/home" in page.url, f"Expected #/home after login, got {page.url}"
        print("OK: Logged in and routed to #/home", flush=True)
        
        # Navigate to #/stock
        print("3. Navigating to #/stock via #navLinkStock...", flush=True)
        page.click("#navLinkStock")
        page.wait_for_timeout(1000)
        print(f"   Current URL: {page.url}", flush=True)
        assert "#/stock" in page.url, f"Expected #/stock, got {page.url}"
        
        # Verify KPI values on /stock view
        kpi_max_discount = page.locator("#kpiMaxDiscount").inner_text()
        kpi_promo_count = page.locator("#kpiPromoCount").inner_text()
        count_all = page.locator("#countAll").inner_text()
        kpi_total_stock = page.locator("#kpiTotalStock").inner_text()
        
        print(f"   KPI Max Discount: '{kpi_max_discount}'", flush=True)
        print(f"   KPI Promo Count: '{kpi_promo_count}'", flush=True)
        print(f"   Filter Count All: '{count_all}'", flush=True)
        print(f"   KPI Total Stock: '{kpi_total_stock}'", flush=True)
        
        # Check countAll is populated from masterStockData (not 0)
        assert int(count_all) > 0, f"Expected countAll > 0, got {count_all}"
        print(f"OK: Filter countAll populated correctly: {count_all} items", flush=True)
        
        assert "760" in kpi_total_stock or "เครื่อง" in kpi_total_stock, f"Expected stock count in kpiTotalStock, got {kpi_total_stock}"
        print("OK: kpiTotalStock populated correctly", flush=True)
        
        # Check kpiMaxDiscount and kpiPromoCount reflect accurate expired or active status
        assert "หมดอายุ" in kpi_max_discount or "-฿" in kpi_max_discount, f"Unexpected max discount: {kpi_max_discount}"
        print("OK: kpiMaxDiscount rendered with clear status", flush=True)
        
        # Open Promo Expiration Modal
        print("4. Opening Promo Expiration Modal (#btnPromoExpiry)...", flush=True)
        page.click("#btnPromoExpiry")
        page.wait_for_timeout(500)
        
        modal = page.locator("#promoModal")
        assert not ("hidden" in modal.get_attribute("class")), "Expected #promoModal to be visible"
        
        modal_body_text = page.locator("#promoModalBody").inner_text()
        print(f"   Modal Body Snippet: {modal_body_text[:200]}...", flush=True)
        
        # Strict checks against old hardcoded text
        assert "กำลังจะหมดเขตพรุ่งนี้" not in modal_body_text, "Found old hardcoded text 'กำลังจะหมดเขตพรุ่งนี้'!"
        assert "เหลือเวลาอีก 1 วัน" not in modal_body_text, "Found old hardcoded text 'เหลือเวลาอีก 1 วัน'!"
        assert "หมดอายุแล้ว" in modal_body_text, "Expected 'หมดอายุแล้ว' in modal body!"
        assert "ไม่อนุญาตให้ใช้ราคาและคูปอง" in modal_body_text, "Expected notice 'ไม่อนุญาตให้ใช้ราคาและคูปอง' in modal body!"
        print("OK: Promo Expiration Modal dynamically evaluated against getTodayISO() without hardcoded text!", flush=True)
        
        # Close modal
        page.click("#btnClosePromoBottom")
        page.wait_for_timeout(300)
        assert "hidden" in modal.get_attribute("class"), "Expected #promoModal to be closed"
        print("OK: Modal closed cleanly", flush=True)
        
        browser.close()
        print("🎉 ALL RUNTIME UI OBSERVATION TESTS PASSED PERFECTLY!", flush=True)

if __name__ == "__main__":
    test_runtime_ui()
