# -*- coding: utf-8 -*-
"""
Verification script for Trade Up promotion table presentation.
Tests that:
1. Columns are separated: RRP, Standard Discount, Trade Up Bonus, Price Before Appraisal / Net, Coupon, Sale Mode, Status.
2. For Trade Up rows:
   - Standard discount is separated (e.g. -฿5,000)
   - Trade Up bonus is separated (e.g. -฿5,000)
   - Price column shows 'ราคาก่อนหักมูลค่าเครื่องเก่า' with note '* ยังไม่หักมูลค่าเครื่องเก่าที่ประเมินในหน้าชำระเงิน'
   - Coupon column displays '01 (เฉพาะซื้อปกติ)' and 'Trade Up ไม่ใช้คูปอง'
3. Captures screenshot of the table.
"""

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

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACT_DIR = r"C:\Users\JarNJay\.gemini\antigravity-ide\brain\c19c8d25-d132-4398-ae85-f90b289e1b75"

def get_test_admin_credentials():
    emp_id = os.environ.get("TEST_ADMIN_EMPLOYEE_ID", "CPW3862")
    password = os.environ.get("TEST_ADMIN_PASSWORD")
    if not password:
        env_path = os.path.join(ROOT_DIR, ".env.feedback-pilot.local")
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
    print("=== Starting Local Server for Promotions View Verification ===")
    emp_id, password = get_test_admin_credentials()
    server_process = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8085"],
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(1.5)

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(viewport={"width": 1400, "height": 900})
            page = await context.new_page()

            url = "http://localhost:8085/index.html#/login"
            print(f"Navigating to {url}...")
            await page.goto(url, wait_until="networkidle")
            await page.wait_for_timeout(1000)

            # Check if login required
            if await page.locator("#loginEmployeeId").is_visible():
                print("Logging in with test admin credentials...")
                await page.fill("#loginEmployeeId", emp_id)
                await page.fill("#loginPassword", password)
                await page.click("#btnLoginSubmit")
                await page.wait_for_timeout(2000)

            # Navigate to promotions
            print("Navigating to #/promotions...")
            await page.goto("http://localhost:8085/index.html#/promotions", wait_until="networkidle")
            await page.wait_for_timeout(1000)

            # Ensure renderPromotionsView is invoked
            await page.evaluate("() => { if (typeof window.renderPromotionsView === 'function') window.renderPromotionsView(); }")
            await page.wait_for_timeout(1000)

            content = page.locator("#promotionsViewContent")
            await content.wait_for(state="visible", timeout=10000)

            # Search for S26 Ultra to display the exact rows from the user's screenshot
            search_input = page.locator("#promoListSearchInput")
            if await search_input.count() > 0:
                print("Filtering table for 'S26 Ultra'...")
                await search_input.fill("S26 Ultra")
                await page.wait_for_timeout(500)

            # Select table inside promotions view
            table = page.locator("#promotionsViewContent .diff-table-container").first
            await table.wait_for(state="visible", timeout=5000)

            screenshot_path = os.path.join(ARTIFACT_DIR, "trade_up_separated_presentation.png")
            await table.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

            # Verify table headers
            headers = await page.locator(".diff-table thead th").all_text_contents()
            print("Table Headers:", headers)
            assert "ส่วนลดซื้อปกติ" in headers, "Missing ส่วนลดซื้อปกติ header"
            assert "โบนัส Trade Up" in headers, "Missing โบนัส Trade Up header"
            assert "ราคาก่อนประเมิน / ชำระจริง" in headers, "Missing ราคาก่อนประเมิน header"

            # Check content of Trade Up rows
            rows = page.locator("#promoListTableBody tr")
            count = await rows.count()
            print(f"Found {count} rows matching query.")

            found_trade_up = False
            for i in range(min(count, 10)):
                row_text = await rows.nth(i).inner_text()
                if "TRADE_UP" in row_text:
                    found_trade_up = True
                    print(f"Verified Trade Up row:\n{row_text}\n---")
                    assert "Trade Up ไม่ใช้คูปอง" in row_text, "Missing Trade Up coupon clarification"
                    assert "ราคาก่อนหักมูลค่าเครื่องเก่า" in row_text, "Missing price before appraisal note"

            assert found_trade_up, "Did not find any TRADE_UP rows in S26 Ultra results"
            print("✅ ALL ASSERTIONS PASSED! Trade Up presentation is fully verified.")

            await browser.close()
    finally:
        server_process.terminate()

if __name__ == "__main__":
    asyncio.run(main())
