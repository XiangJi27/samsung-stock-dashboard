import asyncio
import http.server
import socketserver
import threading
import time
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

PORT = 8099
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def log_message(self, format, *args):
        pass

def start_server():
    httpd = socketserver.TCPServer(("", PORT), Handler)
    httpd.serve_forever()

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
    emp_id, password = get_test_admin_credentials()
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(1)

    print(f"Server started at http://localhost:{PORT}")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        # Capture console messages
        page.on("console", lambda msg: print(f"[Browser Console] {msg.type}: {msg.text}") if msg.type in ['error', 'warn'] else None)

        print("\n=== STEP 1: Navigate to pilot.html ===")
        await page.goto(f"http://localhost:{PORT}/pilot.html#/login")
        await page.wait_for_selector("#loginEmployeeId", state="visible")

        print(f"=== STEP 2: Login as Manager {emp_id} ===")
        await page.fill("#loginEmployeeId", emp_id)
        await page.fill("#loginPassword", password)
        await page.click("#btnLoginSubmit")

        await page.wait_for_selector("#view-home:not([hidden])", timeout=10000)
        print("Logged in successfully! On #/home")

        # Check only 1 visible page
        visible_pages = await page.evaluate("document.querySelectorAll('[data-pilot-route]:not([hidden])').length")
        print(f"Active visible pages count: {visible_pages} (Expected: 1)")
        assert visible_pages == 1, f"Expected 1 active page, got {visible_pages}"

        print("\n=== STEP 3: Navigate to #/stock ===")
        await page.goto(f"http://localhost:{PORT}/pilot.html#/stock")
        await page.wait_for_selector("#stockTableBody", state="attached", timeout=10000)
        await page.wait_for_timeout(800)

        # Check route isolation
        visible_pages = await page.evaluate("document.querySelectorAll('[data-pilot-route]:not([hidden])').length")
        admin_hidden = await page.evaluate("document.getElementById('view-admin-members').hidden")
        admin_display = await page.evaluate("window.getComputedStyle(document.getElementById('view-admin-members')).display")
        stock_visible = await page.evaluate("!document.getElementById('view-stock').hidden")

        print(f"On #/stock:")
        print(f"  - Visible pages count: {visible_pages} (Expected: 1)")
        print(f"  - view-stock visible: {stock_visible} (Expected: True)")
        print(f"  - view-admin-members hidden attr: {admin_hidden} (Expected: True)")
        print(f"  - view-admin-members computed display: {admin_display} (Expected: 'none')")

        assert visible_pages == 1
        assert stock_visible is True
        assert admin_hidden is True
        assert admin_display == "none"

        print("\n=== STEP 4: Inspect Stock Category Cards ===")
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

        print("Stock Card Summary:")
        for k, v in card_stats.items():
            print(f"  - {k}: {v}")

        # Floor 1 stock assertions matching stock(1).xlsx
        assert card_stats['allStock'] == "1,701", f"Expected allStock 1,701, got {card_stats['allStock']}"
        assert card_stats['phoneStock'] == "230", f"Expected phoneStock 230, got {card_stats['phoneStock']}"
        assert card_stats['tabStock'] == "34", f"Expected tabStock 34, got {card_stats['tabStock']}"
        assert card_stats['watchStock'] == "61", f"Expected watchStock 61, got {card_stats['watchStock']}"
        assert card_stats['budsStock'] == "49", f"Expected budsStock 49, got {card_stats['budsStock']}"
        assert card_stats['accStock'] == "972", f"Expected accStock 972, got {card_stats['accStock']}"
        assert card_stats['premStock'] == "282", f"Expected premStock 282, got {card_stats['premStock']}"

        # Card P/N / Models assertions
        assert "62" in card_stats['phoneModels'], f"Expected 62 phone models, got {card_stats['phoneModels']}"
        assert "12" in card_stats['tabModels'], f"Expected 12 tab models, got {card_stats['tabModels']}"
        assert "17" in card_stats['watchModels'], f"Expected 17 watch models, got {card_stats['watchModels']}"
        assert "9" in card_stats['budsModels'], f"Expected 9 buds models, got {card_stats['budsModels']}"
        assert "189" in card_stats['accModels'], f"Expected 189 acc models, got {card_stats['accModels']}"
        assert "24" in card_stats['premModels'], f"Expected 24 premium models, got {card_stats['premModels']}"
        assert "333" in card_stats['allModels'], f"Expected 333 total Sheet1 items, got {card_stats['allModels']}"

        # Card Visibility Assertions
        assert card_stats['simDisplay'] == "none", f"SIM card should be hidden, got {card_stats['simDisplay']}"
        assert card_stats['otherDisplay'] == "none", f"Other card should be hidden, got {card_stats['otherDisplay']}"
        assert card_stats['premDisplay'] != "none", f"Premium card should be visible, got {card_stats['premDisplay']}"

        # Card Labels & Scope assertions
        first_card_title = await page.evaluate("document.querySelector('.category-card.cat-all .category-name')?.textContent?.trim()")
        assert "ชั้น 1" in first_card_title, f"First card title should contain 'ชั้น 1', got '{first_card_title}'"

        units_texts = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('.category-card:not([style*=\"display: none\"]) .category-unit')).map(el => el.textContent.trim());
        }""")
        print(f"Card unit labels found: {units_texts}")
        for u in units_texts:
            assert "F1 + F2" not in u, f"Found deprecated '(F1 + F2)' label: {u}"
            assert "ชั้น 1" in u, f"Expected label to contain 'ชั้น 1', got: {u}"

        # Total Sheet1 = Smartphone 230 + Tab 34 + Watch 61 + Buds 49 + Acc 972 + Prem 282 + SIM 58 + Other 15 = 1701
        visible_sum = (int(card_stats['phoneStock'].replace(',', '')) +
                       int(card_stats['tabStock'].replace(',', '')) +
                       int(card_stats['watchStock'].replace(',', '')) +
                       int(card_stats['budsStock'].replace(',', '')) +
                       int(card_stats['accStock'].replace(',', '')) +
                       int(card_stats['premStock'].replace(',', '')))
        assert visible_sum == 1628, f"Visible cards sum ({visible_sum}) != 1,628"
        print(f"Visible cards sum verified: {visible_sum} (Main devices + accessories + premium)")
        print(f"Grand Total F1 verified: {card_stats['allStock']} == 1,701 (including 58 SIM + 15 Other)")

        # Filter by Smartphone and check rows
        print("\n=== STEP 5: Click Smartphone Card & Check Rows ===")
        await page.click(".category-card[data-cat='SmartPhone']")
        await page.wait_for_timeout(500)

        # Ensure no SIM or Stainless Steel in rows
        bad_items = await page.evaluate("""() => {
            const rows = Array.from(document.querySelectorAll('#stockTableBody tr'));
            const bad = [];
            rows.forEach(r => {
                const text = r.textContent.toUpperCase();
                if (text.includes('SIM 3 IN 1') || text.includes('STAINLESS STEEL') || text.includes('GAABOR') || text.includes('ADAPTER') || text.includes('CASE') || text.includes('TEMPEREDGLASS')) {
                    bad.push(text.slice(0, 60));
                }
            });
            return bad;
        }""")
        print(f"Bad non-phone items in Smartphone view: {len(bad_items)}")
        assert len(bad_items) == 0, f"Found non-phone items in Smartphone table: {bad_items}"

        # STEP 5.1: Verify Product Colors & Swatches (Golden Cases)
        print("\n=== STEP 5.1: Verify Product Colors & Swatches ===")
        # Switch back to All category
        await page.click(".category-card.cat-all")
        await page.wait_for_timeout(500)

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
            ('SM-A075FLVDTHL', 'Light Violet', 'rgb(201, 184, 255)')
        ]

        for pn, expected_color, expected_dot in golden_cases:
            info = color_map.get(pn)
            assert info is not None, f"PN {pn} not found in table"
            assert info['color'] == expected_color, f"PN {pn} expected color '{expected_color}', got '{info['color']}'"
            assert info['dot'] == expected_dot, f"PN {pn} expected swatch '{expected_dot}', got '{info['dot']}'"
            print(f"  ✅ {pn:16} -> {info['color']:20} | swatch: {info['dot']}")

        total_colored = sum(1 for v in color_map.values() if v['color'] != 'ไม่ระบุสี')
        print(f"Total products with explicit color in table: {total_colored} / {len(color_map)}")
        assert total_colored > 250, f"Expected >250 colored products, got {total_colored}"

        print("\n=== STEP 6: Navigate to #/admin/members ===")
        await page.goto(f"http://localhost:{PORT}/pilot.html#/admin/members")
        await page.wait_for_selector(".pilot-admin-wrapper", timeout=10000)

        visible_pages = await page.evaluate("document.querySelectorAll('[data-pilot-route]:not([hidden])').length")
        admin_visible = await page.evaluate("!document.getElementById('view-admin-members').hidden")
        admin_display = await page.evaluate("window.getComputedStyle(document.getElementById('view-admin-members')).display")
        stock_hidden = await page.evaluate("document.getElementById('view-stock').hidden")

        print(f"On #/admin/members:")
        print(f"  - Visible pages count: {visible_pages} (Expected: 1)")
        print(f"  - view-admin-members visible: {admin_visible} (Expected: True)")
        print(f"  - view-admin-members computed display: {admin_display} (Expected: 'block')")
        print(f"  - view-stock hidden: {stock_hidden} (Expected: True)")

        assert visible_pages == 1
        assert admin_visible is True
        assert stock_hidden is True

        print("\n=== STEP 7: Navigate back to #/stock and verify unmount ===")
        await page.goto(f"http://localhost:{PORT}/pilot.html#/stock")
        await page.wait_for_selector("#stockTableBody tr", timeout=10000)

        visible_pages = await page.evaluate("document.querySelectorAll('[data-pilot-route]:not([hidden])').length")
        admin_hidden = await page.evaluate("document.getElementById('view-admin-members').hidden")
        admin_display = await page.evaluate("window.getComputedStyle(document.getElementById('view-admin-members')).display")
        admin_children = await page.evaluate("document.getElementById('adminMembersViewContent').children.length")

        print(f"On #/stock after navigating away:")
        print(f"  - Visible pages count: {visible_pages} (Expected: 1)")
        print(f"  - view-admin-members hidden: {admin_hidden} (Expected: True)")
        print(f"  - view-admin-members computed display: {admin_display} (Expected: 'none')")
        print(f"  - view-admin-members child elements: {admin_children} (Expected: 0)")

        assert visible_pages == 1
        assert admin_hidden is True
        assert admin_display == "none"
        assert admin_children == 0

        print("\n=== STEP 8: Navigate to #/promotions and verify isolation ===")
        await page.goto(f"http://localhost:{PORT}/pilot.html#/promotions")
        await page.wait_for_timeout(500)

        visible_pages = await page.evaluate("document.querySelectorAll('[data-pilot-route]:not([hidden])').length")
        admin_hidden = await page.evaluate("document.getElementById('view-admin-members').hidden")
        admin_display = await page.evaluate("window.getComputedStyle(document.getElementById('view-admin-members')).display")

        print(f"On #/promotions:")
        print(f"  - Visible pages count: {visible_pages} (Expected: 1)")
        print(f"  - view-admin-members hidden: {admin_hidden} (Expected: True)")
        print(f"  - view-admin-members computed display: {admin_display} (Expected: 'none')")

        assert visible_pages == 1
        assert admin_hidden is True
        assert admin_display == "none"

        # Capture screenshot of stock page for verification evidence
        await page.goto(f"http://localhost:{PORT}/pilot.html#/stock")
        await page.wait_for_timeout(1000)
        screenshot_path = os.path.join(DIRECTORY, "scratch", "stock_page_fixed.png")
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"\nSaved verification screenshot to {screenshot_path}")

        await browser.close()
        print("\n🎉 ALL LIVE BROWSER RECONCILIATION & ROUTE ISOLATION TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(main())
