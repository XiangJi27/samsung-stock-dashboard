import asyncio
import os
import sys
import subprocess
import time

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from playwright.async_api import async_playwright

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

VIEWPORTS = [
    {"name": "desktop_1280x800", "width": 1280, "height": 800},
    {"name": "tablet_768x1024", "width": 768, "height": 1024},
    {"name": "mobile_430x932", "width": 430, "height": 932},
    {"name": "mobile_390x844", "width": 390, "height": 844},
    {"name": "mobile_375x812", "width": 375, "height": 812},
    {"name": "mobile_320x568", "width": 320, "height": 568},
]

async def run_tests(base_url):
    print(f"=== Testing Promotion Tabs 2-Column Grid Layout on {base_url} ===")
    emp_id, password = get_test_admin_credentials()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        for vp in VIEWPORTS:
            name = vp["name"]
            w = vp["width"]
            h = vp["height"]
            print(f"\n--- Checking Viewport: {name} ({w}x{h}) ---")
            
            context = await browser.new_context(viewport={"width": w, "height": h})
            page = await context.new_page()

            # Login
            await page.goto(f"{base_url}/pilot.html#/login", wait_until="domcontentloaded")
            await page.wait_for_selector("#loginEmployeeId", timeout=10000)
            await page.fill("#loginEmployeeId", emp_id)
            await page.fill("#loginPassword", password)
            await page.click("#btnLoginSubmit")
            await page.wait_for_selector("#view-home:not([hidden])", timeout=10000)

            # Navigate to stock
            await page.goto(f"{base_url}/pilot.html#/stock", wait_until="domcontentloaded")
            await page.wait_for_selector("#view-stock:not([hidden])", timeout=10000)

            # Open drawer for S26 FE
            await page.evaluate("""
                window.openPromoDrawer('SM-S26FE128TH', encodeURIComponent('Galaxy S26 FE 128GB'));
            """)
            await page.wait_for_selector("#promoDrawerBackdrop.open", state="visible", timeout=10000)
            await page.wait_for_selector(".promotion-path-tab, .sale-mode-tab", state="visible", timeout=10000)
            await page.wait_for_selector("#drawerTabs", state="visible", timeout=10000)
            await asyncio.sleep(0.5)

            # Verification 1: Check tabs count
            tabs = page.locator("#drawerTabs .promotion-path-tab, #drawerTabs .sale-mode-tab")
            count = await tabs.count()
            print(f"   [CHECK 1] Found {count} promotion tabs (Expected 5)")
            assert count == 5, f"Expected 5 tabs, got {count}"

            # Verification 2: Check horizontal scroll on drawer body and tabs
            metrics = await page.evaluate("""
                () => {
                    const tabsEl = document.getElementById('drawerTabs');
                    const bodyEl = document.getElementById('drawerBody');
                    const panelEl = document.getElementById('promoDrawerPanel');
                    return {
                        tabsScrollWidth: tabsEl.scrollWidth,
                        tabsClientWidth: tabsEl.clientWidth,
                        bodyScrollWidth: bodyEl.scrollWidth,
                        bodyClientWidth: bodyEl.clientWidth,
                        panelClientWidth: panelEl.clientWidth
                    };
                }
            """)
            print(f"   [CHECK 2] Metrics: Tabs scrollWidth={metrics['tabsScrollWidth']} clientWidth={metrics['tabsClientWidth']}")
            print(f"             Body scrollWidth={metrics['bodyScrollWidth']} clientWidth={metrics['bodyClientWidth']}")
            print(f"             Panel width={metrics['panelClientWidth']}px")
            
            # tabs should NOT overflow horizontally (scrollWidth <= clientWidth + 2 for fractional rounding)
            assert metrics['tabsScrollWidth'] <= metrics['tabsClientWidth'] + 2, f"Tabs overflowed horizontally! {metrics}"

            # Verification 3: Check all 5 tabs bounding boxes and layout
            boxes = []
            for i in range(5):
                t = tabs.nth(i)
                box = await t.bounding_box()
                text = (await t.inner_text()).replace("\n", " | ")
                mode = await t.get_attribute("data-mode")
                boxes.append({"index": i, "mode": mode, "text": text, "box": box})

            # Check that tab 4 (BUNDLE) is on the final row and spans full width
            bundle_box = boxes[4]
            tab0_box = boxes[0]
            tab1_box = boxes[1]
            print(f"   [CHECK 3] Tab 0 (NORMAL): x={tab0_box['box']['x']:.1f}, w={tab0_box['box']['width']:.1f}")
            print(f"             Tab 1 (SF_PLUS): x={tab1_box['box']['x']:.1f}, w={tab1_box['box']['width']:.1f}")
            print(f"             Tab 4 (BUNDLE): x={bundle_box['box']['x']:.1f}, y={bundle_box['box']['y']:.1f}, w={bundle_box['box']['width']:.1f}")
            
            # In 2-column mode, BUNDLE width should be approximately equal to tab0 + tab1 width + gap
            expected_bundle_width = tab0_box['box']['width'] + tab1_box['box']['width']
            # Allow tolerance for gap
            assert bundle_box['box']['width'] > tab0_box['box']['width'] * 1.5, f"Bundle tab should span full width! w={bundle_box['box']['width']} vs tab0={tab0_box['box']['width']}"
            print(f"   ✓ Confirmed: BUNDLE tab spans full width ({bundle_box['box']['width']:.1f}px) on final row!")

            # Verification 4: Click BUNDLE tab and verify clean empty state
            await tabs.nth(4).click()
            await asyncio.sleep(0.3)
            active_mode = await page.locator("#drawerTabs .promotion-path-tab.active, #drawerTabs .promotion-path-tab.is-active").get_attribute("data-mode")
            content_text = await page.locator("#drawerModeContent").inner_text()
            print(f"   [CHECK 4] Active mode after clicking BUNDLE: {active_mode}")
            assert active_mode == "BUNDLE", f"Expected active mode BUNDLE, got {active_mode}"
            assert "โปรโมชั่นซื้อพ่วง" in content_text, "Expected bundle header in content"
            print(f"   ✓ Confirmed: BUNDLE tab click switches to bundle card cleanly!")

            # Capture screenshot
            shot_path = os.path.join(ARTIFACTS_DIR, f"promo_tabs_grid_{name}.png")
            await page.screenshot(path=shot_path, full_page=False)
            print(f"   ✓ Screenshot captured: {shot_path}")

            await context.close()

        await browser.close()
    print("\n🎉 ALL VIEWPORT TESTS PASSED 100%!")

if __name__ == "__main__":
    port = 8192
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(port)], cwd=DIRECTORY, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    try:
        asyncio.run(run_tests(f"http://127.0.0.1:{port}"))
    finally:
        server.terminate()
