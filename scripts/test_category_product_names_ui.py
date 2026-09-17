import asyncio
import os
import sys

# Ensure UTF-8 output on Windows terminal
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
    print(f"=== Running Category Switch Product Names Regression Test on {target_url} ===")
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

        # Step 3: Test Category Navigation Sequence
        # All -> SmartPhone -> Tablet -> Watch -> Buds -> Accessory -> Premium -> SmartPhone
        categories_to_test = [
            ("ALL", "ทั้งหมด"),
            ("SmartPhone", "สมาร์ทโฟน"),
            ("Tablet", "แท็บเล็ต"),
            ("Watch", "สมาร์ทวอทช์"),
            ("Buds", "หูฟังบลูทูธ"),
            ("Accessory", "อุปกรณ์เสริม"),
            ("Premium", "ของพรีเมียม"),
            ("SmartPhone", "สมาร์ทโฟน (รอบที่ 2)"),
        ]

        for cat_id, cat_label in categories_to_test:
            print(f"\n--- Testing Category: {cat_id} ({cat_label}) ---")
            cat_card = page.locator(f'.category-card[data-cat="{cat_id}"]')
            if await cat_card.count() > 0:
                await cat_card.click()
                await page.wait_for_timeout(300)

            # Locate visible stock table rows
            rows = page.locator('#stockTableBody tr[data-stock-row="true"]')
            row_count = await rows.count()
            print(f"  Visible rows count: {row_count}")
            assert row_count > 0, f"Category {cat_id} must have at least 1 visible row"

            # Check product names in all rows
            names = rows.locator('[data-testid="product-name"]')
            name_count = await names.count()
            assert name_count == row_count, f"Mismatch: {name_count} names vs {row_count} rows"

            # Check for any nameless rows
            blank_or_dash = []
            for i in range(min(name_count, 50)):  # Check sample of 50 rows per category
                txt = (await names.nth(i).inner_text()).strip()
                if not txt or txt == "-":
                    pn = await rows.nth(i).get_attribute("data-pn")
                    blank_or_dash.append((i, pn, txt))

            assert len(blank_or_dash) == 0, f"Found nameless rows in category {cat_id}: {blank_or_dash}"
            sample_txt = (await names.first.inner_text()).strip()
            print(f"  ✓ 100% rows have valid product name! First item sample: '{sample_txt}'")

        # Step 4: Verify Search for Soundcore P/N 194644055783
        print("\n--- Testing Search for P/N 194644055783 ---")
        # Reset to ALL
        await page.locator('.category-card[data-cat="ALL"]').click()
        await page.wait_for_timeout(200)

        search_input = page.locator("#searchInput")
        await search_input.fill("194644055783")
        await page.wait_for_timeout(400)

        search_rows = page.locator('#stockTableBody tr[data-stock-row="true"]')
        assert await search_rows.count() >= 1, "Expected at least 1 search result for 194644055783"

        found_name = (await search_rows.first.locator('[data-testid="product-name"]').inner_text()).strip()
        print(f"  Found product name for 194644055783: '{found_name}'")
        assert "Soundcore" in found_name, f"Expected 'Soundcore' in product name, got: '{found_name}'"
        assert found_name != "-", "Product name must not be '-'"

        print("\n🎉 ALL CATEGORY SWITCHING & PRODUCT NAME PERSISTENCE CHECKS PASSED!")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
