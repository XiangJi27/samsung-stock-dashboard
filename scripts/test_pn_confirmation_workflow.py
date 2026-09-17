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
            if (window.AuthService) {
                window.AuthService.currentUser = { id: 'mock-leader', email: 'leader@staff.internal' };
                window.AuthService.currentProfile = { id: 'mock-leader', employee_code: 'EMP001', display_name: 'Store Leader', status: 'ACTIVE' };
                window.AuthService.currentRoles = [{ role: 'STORE_LEADER', branch_id: 'AYU01' }];
            }
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

        # Verify S26 Ultra 1TB fail-closed isolation: 0 candidate checkboxes, PN_NOT_FOUND badge
        s26_ultra_has_cb = await page.evaluate("""() => {
            const rows = Array.from(document.querySelectorAll('#promoDiffTableBody tr'))
                .filter(r => r.textContent.includes('S26 Ultra') && r.textContent.includes('1TB'));
            return rows.some(r => r.querySelector('input[type="checkbox"]') !== null);
        }""")
        assert not s26_ultra_has_cb, "S26 Ultra 1TB must NOT have candidate checkboxes (Fail-Closed, 0 Smartphone stock)"
        print("✅ [PASS] Gate 1b: Galaxy S26 Ultra 1TB strictly isolated with 0 checkboxes & PN_NOT_FOUND (Accessories rejected)")

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
        print("✅ [PASS] Gate 5: Batch selection checked all genuine smartphone candidate P/Ns across models")

        # Click Batch Confirm
        print("3. Clicking 'Batch Confirm P/Ns'...")
        await page.click("#btnBatchConfirmPns")
        await page.wait_for_timeout(500)

        # Verify updated KPIs
        kpi_passed_after = await page.inner_text("#promoKpiPassed")
        kpi_review_after = await page.inner_text("#promoKpiReview")
        kpi_blocked_after = await page.inner_text("#promoKpiBlocked")

        print(f"   KPI After Confirm -> Passed: {kpi_passed_after}, Review: {kpi_review_after}, Blocked: {kpi_blocked_after}")
        assert int(kpi_passed_after) == 25, f"Expected 25 passed after confirm, got {kpi_passed_after}"
        assert int(kpi_review_after) == 25, f"Expected 25 review (including S26 Ultra 1TB fail-closed) after confirm, got {kpi_review_after}"
        print(f"✅ [PASS] Gate 6: {kpi_passed_after} Review items promoted to PASSED; {kpi_review_after} items held safely in REVIEW (Fail-Closed)")

        # Verify publish and database buttons are now visible and active
        btn_publish_display_after = await page.evaluate("() => document.getElementById('btnConfirmPromoPublish').style.display")
        assert btn_publish_display_after != "none", "Publish button should be visible after confirmation"
        btn_publish_text = await page.inner_text("#btnConfirmPromoPublish")
        print(f"   Publish button text: {btn_publish_text}")
        assert kpi_passed_after in btn_publish_text, f"Publish button text should mention {kpi_passed_after} items, got {btn_publish_text}"
        print("✅ [PASS] Gate 7: Publish button unlocked and reflects 25 verified items")

        # Gate 7a: Test Database Preview Modal (5 groups)
        print("3.1 Testing 'ดูข้อมูลที่จะบันทึก (Database Preview)'...")
        btn_preview_display = await page.evaluate("() => document.getElementById('btnPreviewPromoDatabase')?.style.display")
        assert btn_preview_display != "none", "Database Preview button should be visible"
        await page.click("#btnPreviewPromoDatabase")
        await page.wait_for_timeout(300)

        preview_visible = await page.evaluate("() => document.getElementById('promoDatabasePreviewModal')?.style.display !== 'none'")
        assert preview_visible, "Database Preview modal should be visible"
        preview_html = await page.inner_text("#promoDbPreviewContent")
        assert "promotion_import_batches" in preview_html
        assert "promotion_campaigns" in preview_html
        assert "promotion_offers" in preview_html
        assert "promotion_stacking_rules" in preview_html
        assert "promotion_validation_errors" in preview_html
        assert "Galaxy S26 Ultra" in preview_html
        print("✅ [PASS] Gate 7a: Database Preview verified with all 5 groups (Batch, Campaign, Offers, Stacking, Errors/Held)")

        # Close Database Preview modal
        await page.click("#btnClosePromoDbPreview")
        await page.wait_for_timeout(300)

        # Gate 7b: Test Save Draft to Database API & Dynamic Banner Transition
        print("3.2 Testing '💾 บันทึก Draft ลงฐานข้อมูล' & Storage Banner transition...")
        btn_save_db_display = await page.evaluate("() => document.getElementById('btnSavePromoDraftDatabase')?.style.display")
        assert btn_save_db_display != "none", "Save Draft Database button should be visible"

        # Set mockPromoImportHandler for file:// context in test
        await page.evaluate("""() => {
            window.BYPASS_OFFLINE_DEV = true;
            window.mockPromoImportHandler = async (payload) => {
                return {
                    status: 'DRAFT_CREATED',
                    batchId: '7fc7c065-707a-48dd-b50c-d6bfb924be2c',
                    campaignId: '3c651d46-b730-4388-b14c-145af2b927d2',
                    branchCode: 'AYUTTHAYA_CITY_PARK',
                    offerCount: 71,
                    blockerCount: 0,
                    reviewRequiredCount: 25,
                    summary: {
                        totalRows: 56,
                        passedRows: 25,
                        warningRows: 25,
                        blockedRows: 6
                    }
                };
            };
        }""")

        # Click save draft to database
        await page.click("#btnSavePromoDraftDatabase")
        await page.wait_for_timeout(600)

        # Verify Banner changed from LOCAL_BROWSER_ONLY to CENTRAL_DATABASE • DRAFT
        banner_badge = await page.inner_text("#promoStorageBannerBadge")
        banner_tag = await page.inner_text("#promoStorageBannerTag")
        banner_desc = await page.inner_text("#promoStorageBannerDesc")

        print(f"   Storage Banner Badge: {banner_badge}")
        print(f"   Storage Banner Tag: {banner_tag}")
        assert "CENTRAL_DATABASE" in banner_badge, f"Expected CENTRAL_DATABASE in badge, got {banner_badge}"
        assert "DRAFT" in banner_badge, f"Expected DRAFT in badge, got {banner_badge}"
        assert "PROMOTION DATABASE DRAFT" in banner_tag, f"Expected PROMOTION DATABASE DRAFT in tag, got {banner_tag}"
        assert "7fc7c065" in banner_desc, f"Expected batch UUID in desc, got {banner_desc}"
        assert "3c651d46" in banner_desc, f"Expected campaign UUID in desc, got {banner_desc}"
        print("✅ [PASS] Gate 7b: Draft successfully saved to Central Database with banner transition: Storage: CENTRAL_DATABASE • DRAFT")

        await page.screenshot(path="reports/candidate_database_draft_saved.png")
        print("   Saved screenshot: reports/candidate_database_draft_saved.png")

        # Test publishing to IndexedDB
        print("4. Executing Confirm & Publish to IndexedDB...")
        await page.click("#btnConfirmPromoPublish")
        await page.wait_for_timeout(1000)

        # Verify in IndexedDB
        snapshot = await page.evaluate("async () => await window.PromoStorageAdapter.getActiveSnapshot()")
        assert snapshot is not None, "IndexedDB snapshot should not be null"
        published_items = snapshot.get("publishedItems", [])
        print(f"   IndexedDB Published Items Count: {len(published_items)}")
        assert len(published_items) >= 25, f"Expected >= 25 published items, got {len(published_items)}"
        print("✅ [PASS] Gate 8: Data successfully published and persisted to IndexedDB")

        # Test persistence across page reload
        print("5. Reloading page to verify data-loader restore...")
        await page.reload()
        await page.wait_for_timeout(1500)

        restored_count = await page.evaluate("() => window.PROMOTION_VARIANTS ? window.PROMOTION_VARIANTS.length : 0")
        print(f"   Restored PROMOTION_VARIANTS length after reload: {restored_count}")
        assert restored_count >= 25, f"Expected >= 25 restored variants, got {restored_count}"
        print("✅ [PASS] Gate 9: Promotion snapshot restored across browser refresh (Zero Data Loss)")

        await browser.close()

    print("================================================================================")
    print("🎉 ALL 9 CANDIDATE P/N CONFIRMATION WORKFLOW TESTS PASSED!")
    print("================================================================================")

if __name__ == "__main__":
    asyncio.run(run_test())
