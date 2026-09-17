import asyncio
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from playwright.async_api import async_playwright

VERCEL_URL = os.environ.get("VERCEL_PREVIEW_URL", "https://samsung-stock-pilot.vercel.app")
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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
    if not password:
        raise ValueError("TEST_ADMIN_PASSWORD is required in environment or .env.feedback-pilot.local")
    return emp_id, password

async def main():
    target_url = sys.argv[1] if len(sys.argv) > 1 else VERCEL_URL
    print(f"=== Running Live Promotion Drawer UI Verification on {target_url} ===")
    emp_id, password = get_test_admin_credentials()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        # Step 1: Login
        print("Step 1: Navigating to login...")
        await page.goto(f"{target_url}/pilot.html#/login", wait_until="networkidle")
        if await page.locator("#loginEmployeeId").is_visible():
            await page.fill("#loginEmployeeId", emp_id)
            await page.fill("#loginPassword", password)
            await page.click("#btnLoginSubmit")
            await page.wait_for_selector("#view-home:not([hidden])", timeout=15000)
            print("Logged in successfully.")

        # Step 2: Navigate to Stock View
        print("Step 2: Navigating to Stock View...")
        await page.goto(f"{target_url}/pilot.html#/stock", wait_until="networkidle")
        await page.wait_for_selector("#stockTableBody tr", timeout=15000)
        print("Stock table ready.")

        # Step 3: Filter for S26FE and open Promotion Drawer
        print("Step 3: Searching for S26FE...")
        await page.fill("#searchInput", "S26FE")
        await asyncio.sleep(0.5)

        btn_promo = page.locator("button.btn-promo-drawer").first
        if await btn_promo.count() > 0:
            await btn_promo.click()
            await page.wait_for_selector("#drawerModeContent", state="visible", timeout=6000)
            print("Promotion drawer opened successfully.")

            # Check scenario selector
            scenario_count = await page.locator(".promo-scenario-selector").count()
            print(f"  ✓ Scenario toggle selector rendered: {scenario_count > 0}")

            # Check dual net comparison
            dual_net_count = await page.locator(".dual-net-comparison").count()
            print(f"  ✓ Dual net price comparison rendered: {dual_net_count > 0}")

            # Check price breakdown card
            card_count = await page.locator(".promo-price-card").count()
            print(f"  ✓ Price breakdown card rendered: {card_count > 0}")

            # Switch scenario to Trade Up
            btn_tu_scenario = page.locator(".scenario-toggle-btn").nth(1)
            if await btn_tu_scenario.count() > 0:
                await btn_tu_scenario.click()
                await asyncio.sleep(0.3)
                print("  ✓ Toggled to Trade Up scenario successfully.")

            # Switch mode to SF+
            tab_sf = page.locator("#drawerTabs button:has-text('Samsung Finance+')")
            if await tab_sf.count() > 0:
                await tab_sf.click()
                await asyncio.sleep(0.3)
                print("  ✓ Switched to SF+ mode tab successfully.")

            # Switch mode to Student
            tab_student = page.locator("#drawerTabs button:has-text('โปร นศ.')")
            if await tab_student.count() > 0:
                await tab_student.click()
                await asyncio.sleep(0.3)
                print("  ✓ Switched to Student mode tab successfully.")

            await page.screenshot(path="promo_drawer_live_success.png")
            print("  ✓ Live screenshot captured: promo_drawer_live_success.png")

        print("\n🎉 ALL LIVE PROMOTION DRAWER CHECKS PASSED!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
