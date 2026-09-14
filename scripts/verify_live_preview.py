import asyncio
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

VERCEL_URL = os.environ.get("VERCEL_PREVIEW_URL", "https://samsung-stock-dashboard-7a7xcm0us-xiangji27.vercel.app")

def get_test_admin_credentials():
    emp_id = os.environ.get("TEST_ADMIN_EMPLOYEE_ID", "CPW3862")
    password = os.environ.get("TEST_ADMIN_PASSWORD")
    if not password:
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.feedback-pilot.local')
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
    print(f"Verifying Live Vercel Preview: {VERCEL_URL}")
    emp_id, password = get_test_admin_credentials()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        print(f"\n=== 1. Login as {emp_id} via ROOT DOMAIN ({VERCEL_URL}/#/login) ===")
        await page.goto(f"{VERCEL_URL}/#/login")
        await page.wait_for_selector("#loginEmployeeId", state="visible")
        await page.fill("#loginEmployeeId", emp_id)
        await page.fill("#loginPassword", password)
        await page.click("#btnLoginSubmit")

        await page.wait_for_selector("#view-home:not([hidden])", timeout=10000)
        print("Logged in successfully!")

        print(f"\n=== 2. Navigate to ROOT DOMAIN #/stock ({VERCEL_URL}/#/stock) ===")
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

        print("\n=== 2.1 Verify Metadata & Provenance Bar (No Legacy Snapshot) ===")
        meta_info = await page.evaluate("""() => {
            const meta = window.STOCK_METADATA || {};
            const bar = document.getElementById('prototypeStockProvenanceBar');
            const legacyBar = document.getElementById('stockSnapshotProvenanceBar');
            return {
                batchId: meta.stockBatchId || meta.importBatchId || '',
                sourceType: meta.sourceType || '',
                storageScope: meta.storageScope || '',
                barVisible: bar ? window.getComputedStyle(bar).display !== 'none' : false,
                barText: bar ? bar.innerText : '',
                legacyBarPresent: legacyBar !== null,
                isLegacyVisible: legacyBar ? window.getComputedStyle(legacyBar).display !== 'none' : false,
                prototypeRootVisible: Boolean(document.querySelector('.prototype-stock-root'))
            };
        }""")
        print(f"  - Active Batch ID: {meta_info['batchId']} (Must NOT be IMPORT-20260906-002)")
        print(f"  - Prototype Stock Root Visible: {meta_info['prototypeRootVisible']}")
        print(f"  - Provenance Bar Text: {meta_info['barText']}")
        
        assert meta_info['prototypeRootVisible'] is True, "Prototype stock root MUST be visible!"
        assert meta_info['batchId'] != "IMPORT-20260906-002", f"FAIL: Active batch is legacy {meta_info['batchId']}"
        assert "STOCK-" in meta_info['batchId'], f"FAIL: Expected STOCK- batch, got {meta_info['batchId']}"
        assert meta_info['storageScope'] != "Static Assets", "Storage must not be Static Assets"
        assert meta_info['isLegacyVisible'] is False, "Legacy provenance bar must not be visible"

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
                accStock: getTxt('countCatAccStock'),
                premModels: getTxt('countCatPremModels'),
                premStock: getTxt('countCatPremStock')
            };
        }""")

        for k, v in card_stats.items():
            print(f"  - {k}: {v}")

        # Assert F1 numbers
        assert card_stats['allStock'] == "1,701", f"Expected allStock 1,701, got {card_stats['allStock']}"
        assert card_stats['phoneStock'] == "230", f"Expected phoneStock 230, got {card_stats['phoneStock']}"
        assert card_stats['tabStock'] == "34", f"Expected tabStock 34, got {card_stats['tabStock']}"
        assert card_stats['watchStock'] == "61", f"Expected watchStock 61, got {card_stats['watchStock']}"
        assert card_stats['budsStock'] == "49", f"Expected budsStock 49, got {card_stats['budsStock']}"
        assert card_stats['accStock'] == "972", f"Expected accStock 972, got {card_stats['accStock']}"
        assert card_stats['premStock'] == "282", f"Expected premStock 282, got {card_stats['premStock']}"

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

        # Category Sum Equation (230 + 34 + 61 + 49 + 972 + 282 + 58 SIM + 15 Other = 1,701)
        visible_sum = (int(card_stats['phoneStock'].replace(',', '')) +
                       int(card_stats['tabStock'].replace(',', '')) +
                       int(card_stats['watchStock'].replace(',', '')) +
                       int(card_stats['budsStock'].replace(',', '')) +
                       int(card_stats['accStock'].replace(',', '')) +
                       int(card_stats['premStock'].replace(',', '')))
        all_stock_num = int(card_stats['allStock'].replace(',', ''))
        assert visible_sum + 58 + 15 == all_stock_num, f"Equation failed: {visible_sum} + 73 != {all_stock_num}"
        print(f"Mathematical Equation Verified: {visible_sum} + 58 (SIM) + 15 (Other) == {all_stock_num}")

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

        print("\n=== 4.1 Verify Golden Case Colors & Swatches ===")
        color_map = await page.evaluate("""() => {
            const rows = Array.from(document.querySelectorAll('#stockTableBody tr'));
            const res = {};
            rows.forEach(r => {
                const pn = r.querySelector('.badge-pn-pill')?.textContent?.trim();
                const color = r.querySelector('.color-name-text')?.textContent?.trim();
                const dot = r.querySelector('.color-swatch-dot')?.style?.backgroundColor;
                if (pn) res[pn] = { color, dot };
            });
            return res;
        }""")

        golden_cases = [
            ('F-N1741BLGCTHL', 'Pistachio', 'rgb(184, 201, 160)'),
            ('F-N1741BZKCTHL', 'Graphite', 'rgb(75, 85, 99)'),
            ('F-N1938BZBBTHL', 'Titanium Silverblue', 'rgb(154, 174, 187)'),
            ('F-N1938BZKBTHL', 'Titanium Black', 'rgb(52, 55, 58)'),
            ('F-NS741BLGCLSV', 'Pistachio', 'rgb(184, 201, 160)'),
            ('F-NS741BZKCLSV', 'Graphite', 'rgb(75, 85, 99)'),
            ('F-NS741BZVCLSV', 'Blueberry', 'rgb(81, 82, 138)'),
            ('SM-A075FLVDTHL', 'Light Violet', 'rgb(201, 184, 255)'),
            ('SM-S731BDBCTHL', 'Navy', 'rgb(30, 58, 138)'),
            ('8859703434269', 'Black', 'rgb(37, 40, 45)')
        ]

        for pn, expected_color, expected_dot in golden_cases:
            info = color_map.get(pn)
            assert info is not None, f"PN {pn} not found in live table"
            assert info['color'] == expected_color, f"PN {pn} expected color '{expected_color}', got '{info['color']}'"
            assert info['dot'] == expected_dot, f"PN {pn} expected swatch '{expected_dot}', got '{info['dot']}'"
            print(f"  ✅ {pn:16} -> {info['color']:20} | swatch: {info['dot']}")

        total_colored = sum(1 for v in color_map.values() if v['color'] != 'ไม่ระบุสี')
        print(f"Live products with explicit color: {total_colored} / {len(color_map)}")
        assert total_colored > 250, f"Expected >250 colored products, got {total_colored}"

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
