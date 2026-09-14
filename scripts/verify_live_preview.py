import asyncio
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

VERCEL_URL = "https://samsung-stock-dashboard-pcifab727-xiangji27.vercel.app"

async def main():
    print(f"Verifying Live Vercel Preview: {VERCEL_URL}")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        print("\n=== 1. Login as CPW3862 ===")
        await page.goto(f"{VERCEL_URL}/#/login")
        await page.wait_for_selector("#loginEmployeeId", state="visible")
        await page.fill("#loginEmployeeId", "CPW3862")
        await page.fill("#loginPassword", "1224")
        await page.click("#btnLoginSubmit")

        await page.wait_for_selector("#view-home:not([hidden])", timeout=10000)
        print("Logged in successfully!")

        print("\n=== 2. Navigate to #/stock ===")
        await page.goto(f"{VERCEL_URL}/#/stock")
        await page.wait_for_selector("#stockTableBody tr", timeout=10000)

        # 1. Route Isolation
        visible_pages = await page.evaluate("document.querySelectorAll('[data-pilot-route]:not([hidden])').length")
        admin_hidden = await page.evaluate("document.getElementById('view-admin-members').hidden")
        admin_display = await page.evaluate("window.getComputedStyle(document.getElementById('view-admin-members')).display")
        stock_visible = await page.evaluate("!document.getElementById('view-stock').hidden")

        print(f"Route Isolation on /#/stock:")
        print(f"  - Visible route count: {visible_pages} (Expected: 1)")
        print(f"  - view-stock visible: {stock_visible} (Expected: True)")
        print(f"  - view-admin-members hidden: {admin_hidden} (Expected: True)")
        print(f"  - view-admin-members display: {admin_display} (Expected: 'none')")

        assert visible_pages == 1, f"Expected 1 visible page, got {visible_pages}"
        assert stock_visible is True
        assert admin_hidden is True
        assert admin_display == "none"

        print("\n=== 3. Verify Stock Category Cards (F1 Only) ===")
        card_stats = await page.evaluate("""() => {
            const getTxt = id => document.getElementById(id)?.textContent?.trim() || '';
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
                accStock: getTxt('countCatAccStock')
            };
        }""")

        for k, v in card_stats.items():
            print(f"  - {k}: {v}")

        # Assert F1 numbers
        assert card_stats['allStock'] == "1,100", f"Expected allStock 1,100, got {card_stats['allStock']}"
        assert card_stats['phoneStock'] == "237", f"Expected phoneStock 237, got {card_stats['phoneStock']}"
        assert card_stats['tabStock'] == "37", f"Expected tabStock 37, got {card_stats['tabStock']}"
        assert card_stats['watchStock'] == "61", f"Expected watchStock 61, got {card_stats['watchStock']}"
        assert card_stats['budsStock'] == "44", f"Expected budsStock 44, got {card_stats['budsStock']}"
        assert card_stats['accStock'] == "721", f"Expected accStock 721, got {card_stats['accStock']}"

        # Card Labels
        first_card_title = await page.evaluate("document.querySelector('.category-card.cat-all .category-name')?.textContent?.trim()")
        print(f"First Card Title: '{first_card_title}'")
        assert "ชั้น 1" in first_card_title

        units_texts = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('.category-unit')).map(el => el.textContent.trim());
        }""")
        print(f"Card Unit Labels: {units_texts}")
        for u in units_texts:
            assert "F1 + F2" not in u, f"Found deprecated (F1 + F2) in: {u}"
            assert "ชั้น 1" in u, f"Expected (ชั้น 1) in: {u}"

        # Category Sum Equation
        cat_sum = (int(card_stats['phoneStock'].replace(',', '')) +
                   int(card_stats['tabStock'].replace(',', '')) +
                   int(card_stats['watchStock'].replace(',', '')) +
                   int(card_stats['budsStock'].replace(',', '')) +
                   int(card_stats['accStock'].replace(',', '')))
        all_stock_num = int(card_stats['allStock'].replace(',', ''))
        assert cat_sum == all_stock_num, f"Equation failed: {cat_sum} != {all_stock_num}"
        print(f"Mathematical Equation Verified: {cat_sum} == {all_stock_num}")

        print("\n=== 4. Verify Table Retains F1, F2, Total ===")
        table_headers = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('.modern-table thead th')).map(th => th.textContent.trim());
        }""")
        print(f"Table Headers: {table_headers}")
        assert 'ร้านเรา (ชั้น 1)' in table_headers, f"Missing 'ร้านเรา (ชั้น 1)' in {table_headers}"
        assert 'สาขา (ชั้น 2)' in table_headers, f"Missing 'สาขา (ชั้น 2)' in {table_headers}"
        assert 'รวมสต็อก' in table_headers, f"Missing 'รวมสต็อก' in {table_headers}"

        row_sample = await page.evaluate("""() => {
            const firstRow = document.querySelector('#stockTableBody tr');
            if (!firstRow) return null;
            return {
                model: firstRow.querySelector('.product-model-name')?.textContent?.trim(),
                f1: firstRow.querySelector('.stock-f1')?.textContent?.trim(),
                f2: firstRow.querySelector('.stock-f2')?.textContent?.trim(),
                total: firstRow.querySelector('.stock-total-badge')?.textContent?.trim()
            };
        }""")
        print(f"Sample Table Row: {row_sample}")
        assert row_sample is not None
        assert row_sample['f1'] is not None
        assert row_sample['f2'] is not None
        assert row_sample['total'] is not None
        assert int(row_sample['total']) == int(row_sample['f1']) + int(row_sample['f2'])
        print(f"Row Arithmetic in Table Verified: {row_sample['total']} = {row_sample['f1']} + {row_sample['f2']}")

        # Save Screenshot
        screenshot_path = os.path.join(os.getcwd(), "scratch", "live_vercel_stock_f1.png")
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"Saved live screenshot to {screenshot_path}")

        # Also copy to artifacts dir
        artifact_path = r"C:\Users\JarNJay\.gemini\antigravity-ide\brain\c9c68153-b0f6-4648-a583-e0ee2c6133a9\live_vercel_stock_f1.png"
        await page.screenshot(path=artifact_path, full_page=False)
        print(f"Saved artifact screenshot to {artifact_path}")

        await browser.close()
        print("\n🎉 ALL LIVE VERCEL PREVIEW ACCEPTANCE CRITERIA VERIFIED!")

if __name__ == "__main__":
    asyncio.run(main())
