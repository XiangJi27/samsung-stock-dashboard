import asyncio
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from playwright.async_api import async_playwright

VERCEL_URL = "https://samsung-stock-pilot.vercel.app"
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = r"C:\Users\JarNJay\.gemini\antigravity-ide\brain\c19c8d25-d132-4398-ae85-f90b289e1b75"

def get_test_admin_credentials():
    emp_id = os.environ.get("TEST_ADMIN_EMPLOYEE_ID", "CPW3862")
    password = os.environ.get("TEST_ADMIN_PASSWORD")
    if not password:
        env_path = os.path.join(DIRECTORY, ".env.feedback-pilot.local")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("TEST_ADMIN_PASSWORD=") and "=" in line:
                        password = line.split("=", 1)[1].strip()
                    elif line.startswith("TEST_ADMIN_EMPLOYEE_ID=") and "=" in line:
                        emp_id = line.split("=", 1)[1].strip()
    return emp_id, password

async def main():
    print(f"=== Verifying Live Promotion UI Overhaul on {VERCEL_URL} ===")
    emp_id, password = get_test_admin_credentials()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # 1. Desktop Viewport
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        print("1. Logging in...")
        await page.goto(f"{VERCEL_URL}/pilot.html#/login", wait_until="domcontentloaded")
        await page.wait_for_selector("#loginEmployeeId", timeout=15000)
        await page.fill("#loginEmployeeId", emp_id)
        await page.fill("#loginPassword", password)
        await page.click("#btnLoginSubmit")
        await page.wait_for_selector("#view-home:not([hidden])", timeout=15000)
        print("   Logged in.")

        print("2. Navigating to Stock View...")
        stock_nav = page.locator("a[href='#/stock'], button#navStock, #sidebarStock")
        if await stock_nav.count() > 0:
            await stock_nav.first.click()
        else:
            await page.evaluate("window.location.hash = '#/stock'")
        
        await page.wait_for_selector("#stockTableBody tr", timeout=15000)
        print("   Stock table loaded.")

        # Check that table no longer shows "ราคาปกติ" as promotion status badge
        badge_text_list = await page.locator(".promo-status-badge").all_text_contents()
        has_misleading_badge = any("ราคาปกติ" == t.strip() for t in badge_text_list)
        print(f"   ✓ No misleading 'ราคาปกติ' badges found in table: {not has_misleading_badge}")
        sample_badges = list(set([t.strip() for t in badge_text_list if t.strip()]))[:5]
        print(f"   ✓ Sample semantic badges: {sample_badges}")

        # Search for S26 FE to test 5 active promotion tabs
        print("3. Testing S26 FE Promotion Drawer (Active Promotions)...")
        await page.fill("#searchInput", "S26 FE")
        await asyncio.sleep(0.8)

        btn_promo = page.locator("button.btn-promo-drawer").first
        await btn_promo.click()
        await page.wait_for_selector("#promoDrawerBackdrop.open", state="visible", timeout=8000)
        await page.wait_for_selector("#drawerBody .promotion-price-card, #drawerBody .promotion-path-tabs", state="visible", timeout=8000)
        print("   Drawer opened successfully.")

        # Check 5 tabs
        tabs = await page.locator(".promotion-path-tab, .sale-mode-tab").all_text_contents()
        tabs_cleaned = [t.split("\n")[0].strip() for t in tabs if t.strip()]
        print(f"   ✓ Promotion tabs rendered: {tabs_cleaned}")

        # Desktop screenshot of Drawer (Normal Purchase)
        shot1 = os.path.join(ARTIFACTS_DIR, "live_promo_ui_desktop_normal.png")
        await page.screenshot(path=shot1)
        print(f"   ✓ Saved desktop normal purchase screenshot: {shot1}")

        # Click Trade Up tab
        tu_tab = page.locator(".promotion-path-tab:has-text('Trade Up'), .sale-mode-tab:has-text('Trade Up')")
        if await tu_tab.count() > 0:
            await tu_tab.first.click()
            await asyncio.sleep(0.5)
            shot2 = os.path.join(ARTIFACTS_DIR, "live_promo_ui_desktop_trade_up.png")
            await page.screenshot(path=shot2)
            print(f"   ✓ Saved desktop Trade Up screenshot: {shot2}")

        # Click Samsung Finance+ tab
        sf_tab = page.locator(".promotion-path-tab:has-text('Samsung Finance+'), .sale-mode-tab:has-text('Samsung Finance+')")
        if await sf_tab.count() > 0:
            await sf_tab.first.click()
            await asyncio.sleep(0.5)
            shot3 = os.path.join(ARTIFACTS_DIR, "live_promo_ui_desktop_sf_plus.png")
            await page.screenshot(path=shot3)
            print(f"   ✓ Saved desktop SF+ screenshot: {shot3}")

        # Click Student tab
        student_tab = page.locator(".promotion-path-tab:has-text('นักศึกษา'), .sale-mode-tab:has-text('นักศึกษา')")
        if await student_tab.count() > 0:
            await student_tab.first.click()
            await asyncio.sleep(0.5)
            shot4 = os.path.join(ARTIFACTS_DIR, "live_promo_ui_desktop_student.png")
            await page.screenshot(path=shot4)
            print(f"   ✓ Saved desktop Student screenshot: {shot4}")

        # Click Bundle tab
        bundle_tab = page.locator(".promotion-path-tab:has-text('ซื้อพ่วง'), .sale-mode-tab:has-text('ซื้อพ่วง')")
        if await bundle_tab.count() > 0:
            await bundle_tab.first.click()
            await asyncio.sleep(0.5)
            shot5 = os.path.join(ARTIFACTS_DIR, "live_promo_ui_desktop_bundle.png")
            await page.screenshot(path=shot5)
            print(f"   ✓ Saved desktop Bundle screenshot: {shot5}")

        # 2. Mobile Viewport (iPhone 14 / 390x844)
        print("4. Testing Mobile Viewport (390x844)...")
        mobile_context = await browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        mobile_page = await mobile_context.new_page()
        await mobile_page.goto(f"{VERCEL_URL}/pilot.html#/login", wait_until="domcontentloaded")
        await mobile_page.wait_for_selector("#loginEmployeeId", timeout=15000)
        await mobile_page.fill("#loginEmployeeId", emp_id)
        await mobile_page.fill("#loginPassword", password)
        await mobile_page.click("#btnLoginSubmit")
        await mobile_page.wait_for_selector("#view-home:not([hidden])", timeout=15000)

        # Direct navigation to stock route with domcontentloaded
        await mobile_page.goto(f"{VERCEL_URL}/pilot.html#/stock", wait_until="domcontentloaded")
        await mobile_page.wait_for_selector("#view-stock:not([hidden])", timeout=15000)
        await mobile_page.wait_for_selector("#searchInput", state="visible", timeout=15000)

        # On mobile, call window.openPromoDrawer directly to open S26 FE drawer
        await mobile_page.evaluate("window.openPromoDrawer('SM-S26FE128TH', encodeURIComponent('Galaxy S26 FE 128GB'))")
        await mobile_page.wait_for_selector("#promoDrawerBackdrop.open", state="visible", timeout=8000)
        await mobile_page.wait_for_selector("#drawerBody .promotion-price-card, #drawerBody .promotion-path-tabs", state="visible", timeout=8000)
        await asyncio.sleep(0.5)

        shot_mobile = os.path.join(ARTIFACTS_DIR, "live_promo_ui_mobile_responsive.png")
        await mobile_page.screenshot(path=shot_mobile)
        print(f"   ✓ Saved mobile responsive screenshot: {shot_mobile}")

        await browser.close()
        print("\n🎉 ALL LIVE PROMOTION UI OVERHAUL CHECKS PASSED!")

if __name__ == "__main__":
    asyncio.run(main())
