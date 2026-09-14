import asyncio
import http.server
import socketserver
import threading
import time
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

PORT = 8124
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

    print(f"Local Server started at http://localhost:{PORT}")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        print("\n=== TEST 1: Login via Root Domain ===")
        await page.goto(f"http://localhost:{PORT}/#/login")
        await page.wait_for_selector("#loginEmployeeId", state="visible")
        await page.fill("#loginEmployeeId", emp_id)
        await page.fill("#loginPassword", password)
        await page.click("#btnLoginSubmit")
        await page.wait_for_selector("#view-home:not([hidden])", timeout=10000)
        print("Logged in successfully!")

        print("\n=== TEST 2: Navigate to #/stock & Assert Single Owner ===")
        await page.goto(f"http://localhost:{PORT}/#/stock")
        await page.wait_for_selector("#categoryGrid", state="visible")

        # 1. Assert only prototype stock is visible, legacy is hidden
        proto_visible = await page.evaluate("Boolean(document.querySelector('.prototype-stock-root'))")
        assert proto_visible is True, "FAIL: PrototypeStock root is not visible"

        # 2. Check metadata bar
        meta_info = await page.evaluate("""() => {
            const meta = window.STOCK_METADATA || {};
            const bar = document.getElementById('prototypeStockProvenanceBar');
            return {
                batchId: meta.stockBatchId || meta.importBatchId || '',
                sourceType: meta.sourceType || '',
                storageScope: meta.storageScope || '',
                barText: bar ? bar.innerText : ''
            };
        }""")
        print(f"Initial Active Batch ID: {meta_info['batchId']}")
        print(f"Initial Source Type: {meta_info['sourceType']}")
        print(f"Provenance Bar Text:\n{meta_info['barText']}")

        assert meta_info['batchId'] != "IMPORT-20260906-002", f"FAIL: Active batch is legacy {meta_info['batchId']}"
        assert "STOCK-" in meta_info['batchId'], f"FAIL: Expected STOCK- batch, got {meta_info['batchId']}"
        assert meta_info['storageScope'] != "Static Assets", "Storage must not be Static Assets"

        # 3. Check F1 counts
        all_stock = await page.evaluate("document.getElementById('countCatAllStock')?.textContent?.trim()")
        phone_stock = await page.evaluate("document.getElementById('countCatPhoneStock')?.textContent?.trim()")
        buds_stock = await page.evaluate("document.getElementById('countCatBudsStock')?.textContent?.trim()")

        print(f"All Stock F1: {all_stock} (Expected 1,701)")
        print(f"Phone Stock F1: {phone_stock} (Expected 230)")
        print(f"Buds Stock F1: {buds_stock} (Expected 49)")

        assert all_stock == "1,701", f"Expected 1,701, got {all_stock}"
        assert phone_stock == "230", f"Expected 230, got {phone_stock}"
        assert buds_stock == "49", f"Expected 49, got {buds_stock}"

        print("\n=== TEST 2.5: Verify S25FE Navy and Focus Premium Bag ===")
        item_checks = await page.evaluate("""() => {
            const data = window.LATEST_STOCK_SNAPSHOT || [];
            const s25fe = data.find(i => i.pn === 'SM-S731BDBCTHL');
            const bag = data.find(i => i.pn === '8859703434269');
            return { s25fe, bag };
        }""")
        s25fe = item_checks.get('s25fe')
        bag = item_checks.get('bag')
        print(f"S25FE: {s25fe}")
        print(f"Bag: {bag}")

        assert s25fe is not None, "FAIL: S25FE (SM-S731BDBCTHL) not found in stock snapshot"
        assert s25fe.get('color') == "Navy", f"FAIL: Expected color 'Navy', got '{s25fe.get('color')}'"
        assert s25fe.get('color') != "ไม่ระบุสี", "FAIL: S25FE is marked as 'ไม่ระบุสี'"

        assert bag is not None, "FAIL: Focus Premium Bag (8859703434269) not found in stock snapshot"
        assert bag.get('category') == "Premium", f"FAIL: Expected category 'Premium', got '{bag.get('category')}'"
        assert bag.get('color') == "Black", f"FAIL: Expected color 'Black', got '{bag.get('color')}'"
        assert bag.get('f1') == 1, f"FAIL: Expected f1=1, got {bag.get('f1')}"
        assert bag.get('f2') == 0, f"FAIL: Expected f2=0, got {bag.get('f2')}"

        print("\n=== TEST 3: Simulate New Excel Batch Import & Persistence ===")
        test_batch_id = "STOCK-20260914-PERSISTENCE-TEST"
        import_result = await page.evaluate(f"""async () => {{
            // Deep copy and simulate item with unextracted color or blank color to test runtime resolution
            const sampleData = JSON.parse(JSON.stringify(window.LATEST_STOCK_SNAPSHOT || []));
            const target = sampleData.find(i => i.pn === 'SM-S731BDBCTHL');
            if (target) {{
                target.color = ''; // Test runtime extraction from description '... -Navy'
            }}
            const record = {{
                batchId: '{test_batch_id}',
                createdAt: new Date().toISOString(),
                meta: {{
                    sourceFilename: 'stock(1).xlsx',
                    sourceFile: 'stock(1).xlsx',
                    importedAt: new Date().toISOString()
                }},
                data: sampleData
            }};
            await window.StockStorageAdapter.saveBatch(record);
            return window.STOCK_METADATA;
        }}""")
        print(f"Saved test batch. New active metadata batchId: {import_result.get('stockBatchId')}")
        assert import_result.get('stockBatchId') == test_batch_id

        # Check provenance bar after import
        bar_text_after = await page.evaluate("document.getElementById('prototypeStockProvenanceBar')?.innerText || ''")
        print(f"Provenance bar after import:\n{bar_text_after}")
        assert test_batch_id in bar_text_after, f"Expected {test_batch_id} in provenance bar"

        print("\n=== TEST 4: Navigate Away to other routes ===")
        await page.goto(f"http://localhost:{PORT}/#/home")
        await page.wait_for_selector("#homeDashboardContent", state="visible")
        await page.goto(f"http://localhost:{PORT}/#/promotions")
        await page.wait_for_timeout(500)

        print("\n=== TEST 5: Return to #/stock & Verify Persistence ===")
        await page.goto(f"http://localhost:{PORT}/#/stock")
        await page.wait_for_selector("#categoryGrid", state="visible")
        persisted_batch = await page.evaluate("window.STOCK_METADATA?.stockBatchId || ''")
        print(f"Batch upon return to #/stock: {persisted_batch}")
        assert persisted_batch == test_batch_id, f"Expected {test_batch_id}, got {persisted_batch}"

        # Verify S25FE color was auto-extracted and persisted as Navy
        s25fe_after_nav = await page.evaluate("""() => {
            const data = window.LATEST_STOCK_SNAPSHOT || [];
            return data.find(i => i.pn === 'SM-S731BDBCTHL');
        }""")
        print(f"S25FE color after import and navigation: {s25fe_after_nav.get('color')}")
        assert s25fe_after_nav.get('color') == "Navy", f"Expected Navy, got {s25fe_after_nav.get('color')}"

        print("\n=== TEST 6: Hard Reload Browser Page & Verify Active Dataset Remains ===")
        await page.reload()
        await page.wait_for_selector("#categoryGrid", state="visible")

        reload_meta = await page.evaluate("""() => {
            const meta = window.STOCK_METADATA || {};
            const bar = document.getElementById('prototypeStockProvenanceBar');
            const data = window.LATEST_STOCK_SNAPSHOT || [];
            const s25fe = data.find(i => i.pn === 'SM-S731BDBCTHL');
            const bag = data.find(i => i.pn === '8859703434269');
            return {
                batchId: meta.stockBatchId || meta.importBatchId || '',
                barText: bar ? bar.innerText : '',
                allStock: document.getElementById('countCatAllStock')?.textContent?.trim() || '',
                s25feColor: s25fe ? s25fe.color : null,
                bagCategory: bag ? bag.category : null,
                bagColor: bag ? bag.color : null
            };
        }""")
        print(f"Batch after page reload: {reload_meta['batchId']}")
        print(f"All Stock after page reload: {reload_meta['allStock']}")
        print(f"S25FE Color after page reload: {reload_meta['s25feColor']}")
        print(f"Bag Category after page reload: {reload_meta['bagCategory']}, Color: {reload_meta['bagColor']}")
        assert reload_meta['batchId'] != "IMPORT-20260906-002", "FAIL: Reverted to legacy batch after reload!"
        assert "STOCK-" in reload_meta['batchId']
        assert reload_meta['allStock'] == "1,701"
        assert reload_meta['s25feColor'] == "Navy", f"Expected Navy after reload, got {reload_meta['s25feColor']}"
        assert reload_meta['bagCategory'] == "Premium", f"Expected Premium, got {reload_meta['bagCategory']}"
        assert reload_meta['bagColor'] == "Black", f"Expected Black, got {reload_meta['bagColor']}"

        print("\n🎉 ALL IMPORT PERSISTENCE, COLOR RESOLUTION & ROUTE ISOLATION TESTS PASSED!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
