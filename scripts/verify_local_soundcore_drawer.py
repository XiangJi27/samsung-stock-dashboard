import asyncio
import os
import sys
import subprocess
import time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

LOCAL_PORT = 8899

async def main():
    # Start local http server
    server_proc = subprocess.Popen([sys.executable, "-m", "http.server", str(LOCAL_PORT)], cwd=os.getcwd(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await context.new_page()

            url = f"http://localhost:{LOCAL_PORT}/pilot.html#/stock"
            print(f"Opening local page: {url}")
            await page.goto(url)
            await page.wait_for_timeout(1000)

            # Open drawer via JS function
            print("Opening Soundcore Select 4 Go drawer...")
            await page.evaluate("""() => {
                window.openProductSpecsDrawer('194644055783', encodeURIComponent('Soundcore Select 4 Go Black'));
            }""")
            await page.wait_for_selector("#promoDrawerBackdrop.open", timeout=5000)
            await page.wait_for_timeout(500)

            drawer_data = await page.evaluate("""() => {
                const title = document.getElementById('drawerProductTitle')?.textContent?.trim() || '';
                const pn = document.getElementById('drawerProductPn')?.textContent?.trim() || '';
                const body = document.getElementById('drawerBody')?.innerText || '';
                const bodyHtml = document.getElementById('drawerBody')?.innerHTML || '';
                return { title, pn, body, bodyHtml };
            }""")

            print(f"Drawer Title: {drawer_data['title']}")
            print(f"Drawer P/N Header: {drawer_data['pn']}")
            print("\n--- DRAWER BODY TEXT ---")
            print(drawer_data['body'])
            print("------------------------\n")

            # Positive assertions
            assert "Soundcore Select 4 Go" in drawer_data['title'], "Title mismatch"
            assert "194644055783" in drawer_data['pn'], "PN mismatch"
            assert "A31X1" in drawer_data['body'], "Model A31X1 missing"
            assert "PARTIALLY_VERIFIED" in drawer_data['body'], "PARTIALLY_VERIFIED badge missing"
            assert "5W" in drawer_data['body'], "5W missing"
            assert "IP67" in drawer_data['body'], "IP67 missing"
            assert "20 ชั่วโมง" in drawer_data['body'], "20h playtime missing"
            assert "Soundcore" in drawer_data['body'], "Brand Soundcore missing"
            assert "Bluetooth: รองรับ" in drawer_data['body'], "Bluetooth support missing"
            assert "ยังไม่ได้ยืนยัน" in drawer_data['body'], "Unverified status missing"
            assert "ตรวจสอบตามใบรับประกันหรือผู้จัดจำหน่ายของสินค้ารายการนี้" in drawer_data['body'], "Cautionary warranty missing"
            print("✅ All positive assertions passed!")

            # Negative assertions
            negative_terms = ["Galaxy A07", "A07 4G", "Helio G85", "Knox Vault", "6.7 นิ้ว", "6.7\"", "Bluetooth 5.4", "5.4 VERIFIED", "18 เดือน"]
            for term in negative_terms:
                assert term not in drawer_data['body'], f"Violation: '{term}' found in drawer body!"
            print("✅ All negative assertions passed (zero leakage / zero unverified claims)!")

            # Save screenshot
            os.makedirs("scratch", exist_ok=True)
            shot_path = os.path.join(os.getcwd(), "scratch", "soundcore_spec_drawer.png")
            await page.screenshot(path=shot_path, full_page=False)
            
            conv_artifact_dir = r"C:\Users\JarNJay\.gemini\antigravity-ide\brain\fad28cc5-0863-4877-a316-4b1449100798"
            conv_shot_path = os.path.join(conv_artifact_dir, "soundcore_spec_drawer.png")
            await page.screenshot(path=conv_shot_path, full_page=False)
            print(f"📸 Screenshots saved to {shot_path} and {conv_shot_path}")

            await browser.close()
    finally:
        server_proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
