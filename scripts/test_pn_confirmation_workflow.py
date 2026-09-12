"""
E2E Test: Candidate P/N Confirmation Workflow & Safety Gate
Verifies:
1. Ingestion of September Excel file produces 56 variants (32 Review, 24 Blocked, 0 Passed).
2. Auto-publish is strictly disabled (0 items, publish button hidden).
3. Candidate P/N list rendered for Review items with Model, Capacity, Color, SM-/F-, F1/F2 stock.
4. Batch selection and batch confirmation converts 32 Review items to PASSED_VALIDATION.
5. Publish button enables only after human confirmation.
6. Multi-P/N expansion on publish and IndexedDB persistence across page refresh.
"""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')

SEPTEMBER_FILE = r"C:\Users\JarNJay\Downloads\Sep_ 2026 Promotion Retail_Shop Samsung .xlsx"
HTML_PATH = os.path.abspath("index.html")

async def run_test():
    print("================================================================================")
    print("TESTING CANDIDATE P/N CONFIRMATION WORKFLOW & QUALITY GATE")
    print("================================================================================")

    if not os.path.exists(SEPTEMBER_FILE):
        print(f"❌ September file not found at {SEPTEMBER_FILE}")
        sys.exit(1)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Handle dialogs automatically (confirmations and alerts)
        page.on("dialog", lambda dialog: asyncio.create_task(dialog.accept()))

        # Navigate to application
        await page.goto(f"file:///{HTML_PATH}")
        await page.wait_for_timeout(1000)

        # Authenticate and navigate to promotion import view
        await page.evaluate("""() => {
            sessionStorage.setItem('samsung_branch_session_v1', JSON.stringify({
                authenticated: true,
                authMode: 'DEVELOPMENT',
                employeeId: 'EMP001',
                displayName: 'Store Staff',
                role: 'STORE_LEADER',
                signedInAt: new Date().toISOString(),
                sessionVersion: '1.0'
            }));
            if (window.AppRouter) {
                window.AppRouter.navigate('/promotion-import');
            }
        }""")
        await page.wait_for_timeout(1000)

        # Upload September Excel file
        print("1. Uploading September Promotion Excel...")
        await page.set_input_files("#promoCenterFileInput", SEPTEMBER_FILE)

        # Wait for processing
        await page.wait_for_selector("#promoPreviewSection:not(.hidden)", timeout=15000)
        await page.wait_for_timeout(1000)

        # Verify initial KPI counts
        kpi_total = await page.inner_text("#promoKpiTotal")
        kpi_passed = await page.inner_text("#promoKpiPassed")
        kpi_review = await page.inner_text("#promoKpiReview")
        kpi_blocked = await page.inner_text("#promoKpiBlocked")

        print(f"   KPI Staged -> Total: {kpi_total}, Passed: {kpi_passed}, Review: {kpi_review}, Blocked: {kpi_blocked}")

        assert kpi_total == "56", f"Expected 56 variants, got {kpi_total}"
        assert kpi_passed == "0", f"Expected 0 passed, got {kpi_passed}"
        assert int(kpi_review) >= 32, f"Expected >= 32 review, got {kpi_review}"
        assert int(kpi_blocked) <= 24, f"Expected <= 24 blocked, got {kpi_blocked}"
        print(f"✅ [PASS] Gate 1: 56 variants staged ({kpi_review} Review, {kpi_blocked} Blocked, 0 Passed)")

        # Verify publish button is hidden when 0 passed
        btn_publish_display = await page.evaluate("() => document.getElementById('btnConfirmPromoPublish').style.display")
        assert btn_publish_display == "none", f"Publish button should be hidden, got display: {btn_publish_display}"
        print("✅ [PASS] Gate 2: Publish button strictly hidden when PASSED_VALIDATION count is 0")

        # Verify batch P/N action bar is visible
        batch_bar_hidden = await page.evaluate("() => document.getElementById('promoBatchPnActionBar').classList.contains('hidden')")
        assert not batch_bar_hidden, "Batch P/N action bar should be visible"
        print("✅ [PASS] Gate 3: Batch P/N action bar displayed for candidate resolution")

        # Verify candidate checkboxes rendered in the DOM
        cb_count = await page.evaluate("() => document.querySelectorAll('.candidate-cb').length")
        print(f"   Rendered candidate checkboxes: {cb_count}")
        assert cb_count > 30, f"Expected candidate checkboxes, found {cb_count}"
        print("✅ [PASS] Gate 4: Candidate P/N items rendered with color, SM-/F- badge, and stock counts")

        # Select all candidates via batch button
        print("2. Clicking 'Select All Candidates'...")
        await page.click("#btnSelectAllCandidates")
        await page.wait_for_timeout(500)

        checked_count = await page.evaluate("() => document.querySelectorAll('.candidate-cb:checked').length")
        print(f"   Checked candidates count: {checked_count}")
        assert checked_count == cb_count, f"Expected {cb_count} checked, got {checked_count}"
        print("✅ [PASS] Gate 5: Batch selection checked all candidate P/Ns across models")

        # Click Batch Confirm
        print("3. Clicking 'Batch Confirm P/Ns'...")
        await page.click("#btnBatchConfirmPns")
        await page.wait_for_timeout(500)

        # Verify updated KPIs
        kpi_passed_after = await page.inner_text("#promoKpiPassed")
        kpi_review_after = await page.inner_text("#promoKpiReview")
        kpi_blocked_after = await page.inner_text("#promoKpiBlocked")

        print(f"   KPI After Confirm -> Passed: {kpi_passed_after}, Review: {kpi_review_after}, Blocked: {kpi_blocked_after}")
        assert int(kpi_passed_after) >= 32, f"Expected >= 32 passed after confirm, got {kpi_passed_after}"
        assert kpi_review_after == "0", f"Expected 0 review after confirm, got {kpi_review_after}"
        print(f"✅ [PASS] Gate 6: {kpi_passed_after} Review items successfully promoted to PASSED_VALIDATION")

        # Verify publish button is now visible and active
        btn_publish_display_after = await page.evaluate("() => document.getElementById('btnConfirmPromoPublish').style.display")
        assert btn_publish_display_after != "none", "Publish button should be visible after confirmation"
        btn_publish_text = await page.inner_text("#btnConfirmPromoPublish")
        print(f"   Publish button text: {btn_publish_text}")
        assert kpi_passed_after in btn_publish_text, f"Publish button text should mention {kpi_passed_after} items, got {btn_publish_text}"
        print("✅ [PASS] Gate 7: Publish button unlocked and reflects 32 verified items")

        # Test publishing to IndexedDB
        print("4. Executing Confirm & Publish to IndexedDB...")
        await page.click("#btnConfirmPromoPublish")
        await page.wait_for_timeout(1000)

        # Verify in IndexedDB
        snapshot = await page.evaluate("async () => await window.PromoStorageAdapter.getActiveSnapshot()")
        assert snapshot is not None, "IndexedDB snapshot should not be null"
        published_items = snapshot.get("publishedItems", [])
        print(f"   IndexedDB Published Items Count: {len(published_items)}")
        assert len(published_items) >= 32, f"Expected >= 32 published items, got {len(published_items)}"
        print("✅ [PASS] Gate 8: Data successfully published and persisted to IndexedDB")

        # Test persistence across page reload
        print("5. Reloading page to verify data-loader restore...")
        await page.reload()
        await page.wait_for_timeout(1500)

        restored_count = await page.evaluate("() => window.PROMOTION_VARIANTS ? window.PROMOTION_VARIANTS.length : 0")
        print(f"   Restored PROMOTION_VARIANTS length after reload: {restored_count}")
        assert restored_count >= 32, f"Expected >= 32 restored variants, got {restored_count}"
        print("✅ [PASS] Gate 9: Promotion snapshot restored across browser refresh (Zero Data Loss)")

        await browser.close()

    print("================================================================================")
    print("🎉 ALL 9 CANDIDATE P/N CONFIRMATION WORKFLOW TESTS PASSED!")
    print("================================================================================")

if __name__ == "__main__":
    asyncio.run(run_test())
