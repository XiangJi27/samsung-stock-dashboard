"""
Playwright automated test for 3-column Promotion Review & Guided Learning Dashboard
Ayutthaya City Park Branch Operations
"""

import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

def test_promotion_review():
    print("🧪 Starting Promotion Review Dashboard UI Test...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # 1. Navigate to promotion_review_dashboard.html
        local_url = "file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/promotion_review_dashboard.html"
        page.goto(local_url)
        page.wait_for_load_state("networkidle")

        # 2. Check title & brand
        title = page.title()
        assert "Promotion Review" in title, f"Unexpected title: {title}"
        print(f"  ✓ Dashboard loaded: '{title}'")

        # 3. Check KPI cards
        kpi_total = page.locator("#kpiTotal").inner_text()
        kpi_passed = page.locator("#kpiPassed").inner_text()
        kpi_review = page.locator("#kpiReview").inner_text()
        kpi_blockers = page.locator("#kpiBlockers").inner_text()
        print(f"  ✓ KPI Counts: Total={kpi_total}, Passed={kpi_passed}, Review={kpi_review}, Blockers={kpi_blockers}")
        assert int(kpi_total) >= 10, "Total drafts should be at least 10"

        # 4. Check rows in table
        rows = page.locator("#promoTableBody tr")
        row_count = rows.count()
        print(f"  ✓ Table rendered {row_count} promotion rows")
        assert row_count >= 10, "Table should render rows"

        # 5. Click on the first row (S26 Ultra 1TB) to open 3-Column Inspection Modal
        rows.first.click()
        page.wait_for_selector("#reviewModal.open", timeout=5000)
        print("  ✓ 3-Column Review Modal opened successfully")

        # 6. Verify Column 1, 2, and 3 content
        col1_text = page.locator("#col1Content").inner_text()
        col2_text = page.locator("#col2Content").inner_text()
        col3_text = page.locator("#col3Content").inner_text()

        title1 = page.locator(".col-1 .col-title").first.inner_text()
        assert "EXCEL" in title1.upper()
        assert "AI" in page.locator(".col-2 .col-title").first.inner_text().upper()
        assert "RULES ENGINE" in page.locator(".col-3 .col-title").first.inner_text().upper()

        print("  ✓ Col 1 (Excel): " + col1_text.splitlines()[0])
        print("  ✓ Col 2 (AI): " + col2_text.splitlines()[0])
        print("  ✓ Col 3 (Rules Engine): " + col3_text.splitlines()[0])

        # 7. Open Manager Teaching Prompt Dialog
        page.click("button:has-text('✏️ แก้ประเภทโปรโมชั่น')")
        page.wait_for_selector("#teachDialog.open", timeout=5000)
        print("  ✓ Teaching Prompt Dialog opened")

        # Check default radio selection is ONE_OFF
        is_default_one_off = page.is_checked("#optOneOff")
        assert is_default_one_off, "Default teaching scope must be ONE_OFF (Fail-closed / Safe)"
        print("  ✓ Verified default option is 'ใช้การแก้นี้เฉพาะรายการนี้ (One-off)'")

        # Select Knowledge Rule
        page.check("#optKnowledgeRule")
        assert page.is_checked("#optKnowledgeRule")
        print("  ✓ Can toggle to 'สร้างกฎความรู้สำหรับรายการรูปแบบเดียวกันในอนาคต'")

        # Close dialog
        page.click("button:has-text('ยกเลิก')")
        page.click("button:has-text('×')")

        # 8. Check console errors
        print(f"  ✓ Console errors: {len(console_errors)}")
        assert len(console_errors) == 0, f"Found console errors: {console_errors}"

        # 9. Screenshot proof
        page.screenshot(path="promotion_review_live_success.png")
        print("  ✓ Saved screenshot proof: promotion_review_live_success.png")

        browser.close()
        print("\n🎉 All 9 Promotion Review UI verification steps passed!\n")

if __name__ == "__main__":
    test_promotion_review()
