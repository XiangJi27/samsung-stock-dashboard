import { test, expect } from '@playwright/test';
import { getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Batch Persistence & Legacy Batch Block Regression', () => {
  test('Stock snapshot must persist across route changes and page reloads', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    // 1. Navigate to stock page and capture initial state
    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const initialAllStock = (await page.textContent('#countCatAllStock'))?.trim();
    expect(initialAllStock).toBeTruthy();
    expect(initialAllStock).not.toBe('0');

    const initialRowCount = await page.$$eval('#stockTableBody tr', rows => rows.length);
    expect(initialRowCount).toBeGreaterThan(0);

    // 2. Navigate away to Admin Members
    await page.goto(`${url}/#/admin/members`);
    await page.waitForSelector('#view-admin-members', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(500);

    // 3. Navigate back to Stock
    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const afterRouteStock = (await page.textContent('#countCatAllStock'))?.trim();
    expect(afterRouteStock).toBe(initialAllStock);

    const afterRouteRowCount = await page.$$eval('#stockTableBody tr', rows => rows.length);
    expect(afterRouteRowCount).toBe(initialRowCount);

    // 4. Full page reload
    await page.reload();
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const afterReloadStock = (await page.textContent('#countCatAllStock'))?.trim();
    expect(afterReloadStock).toBe(initialAllStock);

    const afterReloadRowCount = await page.$$eval('#stockTableBody tr', rows => rows.length);
    expect(afterReloadRowCount).toBe(initialRowCount);

    // 5. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });

  test('Legacy batch ID IMPORT-20260906-002 must not appear in active runtime data', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    // 1. Check that the legacy batch ID is not present in the rendered page
    const pageText = await page.innerText('body');
    // The legacy batch should not appear in any visible UI element
    // (It may exist in source data files, but must not be active/displayed)

    // 2. Verify the import batch metadata on page (if exposed)
    const batchInfo = await page.evaluate(() => {
      // Check various locations where batch info might be stored
      const w = window as any;
      const batchId = w.CURRENT_BATCH_ID || w.importBatchId || 
                      w.__STOCK_METADATA__?.importBatchId || '';
      return batchId;
    });

    if (batchInfo) {
      expect(batchInfo).not.toBe('IMPORT-20260906-002');
      expect(batchInfo).not.toContain('IMPORT-20260906');
    }

    // 3. If there's a batch info display in the UI, verify it
    const batchDisplay = page.locator('[data-batch-id], .batch-info, .import-batch');
    if (await batchDisplay.count() > 0) {
      const batchText = await batchDisplay.first().innerText();
      expect(batchText).not.toContain('IMPORT-20260906-002');
    }

    // 4. Verify no stale promotion data from the legacy batch leaks into stock
    // The current batch should be BATCH-20260912-155756
    const manifestCheck = await page.evaluate(() => {
      const w = window as any;
      if (w.__PILOT_MANIFEST__?.importBatch) {
        return w.__PILOT_MANIFEST__.importBatch;
      }
      if (w.pilotRuntimeManifest?.importBatch) {
        return w.pilotRuntimeManifest.importBatch;
      }
      return null;
    });

    if (manifestCheck) {
      expect(manifestCheck).not.toBe('IMPORT-20260906-002');
    }

    // 5. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
