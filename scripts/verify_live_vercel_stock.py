import asyncio
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

VERCEL_URL = os.environ.get("VERCEL_PREVIEW_URL", "https://samsung-stock-dashboard-m8xseg5vu-xiangji27.vercel.app")
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_test_admin_credentials():
    emp_id = os.environ.get("TEST_ADMIN_EMPLOYEE_ID", "CPW3862")
    password = os.environ.get("TEST_ADMIN_PASSWORD")
    if not password:
        env_path = os.path.join(DIRECTORY, '.env.feedback-pilot.local')
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("TEST_ADMIN_PASSWORD=") and '=' in line:
                        password = line.split('=', 1)[1].strip()
                    elif line.startswith("TEST_ADMIN_EMPLOYEE_ID=") and '=' in line:
                        emp_id = line.split('=', 1)[1].strip()
    if not password:
        raise ValueError("TEST_ADMIN_PASSWORD is required in environment or .env.feedback-pilot.local")
    return emp_id, password

async def main():
    print(f"Testing live Vercel preview deployment: {VERCEL_URL}")
    emp_id, password = get_test_admin_credentials()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        print(f"=== STEP 1: Navigate & Login as {emp_id} ===")
        await page.goto(f"{VERCEL_URL}/#/login")
        await page.wait_for_selector("#loginEmployeeId", state="visible")
        await page.fill("#loginEmployeeId", emp_id)
        await page.fill("#loginPassword", password)
        await page.click("#btnLoginSubmit")
        await page.wait_for_selector("#view-home:not([hidden])", timeout=15000)
        print("Logged in successfully!")

        print("=== STEP 2: Navigate to #/stock ===")
        await page.goto(f"{VERCEL_URL}/#/stock")
        await page.wait_for_selector("#stockTableBody tr", timeout=15000)

        card_stats = await page.evaluate("""() => {
            const getTxt = id => document.getElementById(id)?.textContent?.trim() || '';
            const getDisplay = id => {
                const el = document.getElementById(id);
                return el ? window.getComputedStyle(el).display : 'none';
            };
            return {
                allModels: getTxt('countCatAllModels'),
                allStock: getTxt('countCatAllStock'),
                phoneModels: getTxt('countCatPhoneModels'),
                phoneStock: getTxt('countCatPhoneStock'),
                tabModels: getTxt('countCatTabModels'),
                tabStock: getTxt('countCatTabStock'),
                watchModels: getTxt('countCatWatchModels'),
                watchStock: getTxt('countCatWatchStock'),
                budsModels: getTxt('countCatBudsModels'),
                budsStock: getTxt('countCatBudsStock'),
                accModels: getTxt('countCatAccModels'),
                accStock: getTxt('countCatAccStock'),
                premModels: getTxt('countCatPremModels'),
                premStock: getTxt('countCatPremStock'),
                simDisplay: getDisplay('catCardSIM'),
                otherDisplay: getDisplay('catCardOther'),
                premDisplay: getDisplay('catCardPremium')
            };
        }""")

        print("\n=== Live Vercel Stock Card Stats ===")
        for k, v in card_stats.items():
            print(f"  {k}: {v}")

        # Assertions for Acceptance Criteria
        assert card_stats['allStock'] == "1,701", f"Expected allStock 1,701, got {card_stats['allStock']}"
        assert card_stats['phoneStock'] == "230", f"Expected phoneStock 230, got {card_stats['phoneStock']}"
        assert card_stats['tabStock'] == "34", f"Expected tabStock 34, got {card_stats['tabStock']}"
        assert card_stats['watchStock'] == "61", f"Expected watchStock 61, got {card_stats['watchStock']}"
        assert card_stats['budsStock'] == "49", f"Expected budsStock 49, got {card_stats['budsStock']}"
        assert card_stats['accStock'] == "972", f"Expected accStock 972, got {card_stats['accStock']}"
        assert card_stats['premStock'] == "282", f"Expected premStock 282, got {card_stats['premStock']}"

        assert "62" in card_stats['phoneModels'], f"Expected 62 phone models, got {card_stats['phoneModels']}"
        assert "12" in card_stats['tabModels'], f"Expected 12 tab models, got {card_stats['tabModels']}"
        assert "17" in card_stats['watchModels'], f"Expected 17 watch models, got {card_stats['watchModels']}"
        assert "9" in card_stats['budsModels'], f"Expected 9 buds models, got {card_stats['budsModels']}"
        assert "189" in card_stats['accModels'], f"Expected 189 acc models, got {card_stats['accModels']}"
        assert "24" in card_stats['premModels'], f"Expected 24 premium models, got {card_stats['premModels']}"
        assert "333" in card_stats['allModels'], f"Expected 333 all models, got {card_stats['allModels']}"

        assert card_stats['simDisplay'] == "none", "SIM card must be hidden"
        assert card_stats['otherDisplay'] == "none", "Other card must be hidden"
        assert card_stats['premDisplay'] != "none", "Premium card must be visible"

        # Capture screenshot
        screenshot_path = os.path.join(DIRECTORY, "scratch", "live_vercel_stock_f1_fixed.png")
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"\nSaved live screenshot to {screenshot_path}")

        print("\n🎉 ALL LIVE VERCEL ACCEPTANCE CRITERIA VERIFIED AND PASSED!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
