import { test, expect } from '@playwright/test';
import { getAdminCredentials, getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Stock Table Architecture (F1, F2, Total Display)', () => {
  test('Product table must retain F1, F2, and Total columns with verified row arithmetic', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    // 1. Column header assertions
    const headers = await page.$$eval('.modern-table thead th', ths => ths.map(t => t.textContent?.trim() || ''));
    expect(headers).toContain('ร้านเรา (ชั้น 1)');
    expect(headers).toContain('สาขา (ชั้น 2)');
    expect(headers).toContain('รวมสต็อก');

    // 2. Row arithmetic assertions for all rendered rows
    const rowMetrics = await page.$$eval('#stockTableBody tr', rows => {
      return rows.slice(0, 50).map(r => {
        const f1Str = r.querySelector('.stock-f1')?.textContent?.trim() || '0';
        const f2Str = r.querySelector('.stock-f2')?.textContent?.trim() || '0';
        const totalStr = r.querySelector('.stock-total-badge')?.textContent?.trim() || '0';
        return {
          f1: parseInt(f1Str.replace(/,/g, ''), 10),
          f2: parseInt(f2Str.replace(/,/g, ''), 10),
          total: parseInt(totalStr.replace(/,/g, ''), 10)
        };
      });
    });

    expect(rowMetrics.length).toBeGreaterThan(0);
    for (const r of rowMetrics) {
      expect(r.total).toBe(r.f1 + r.f2);
    }

    // 3. Category filter interaction test
    await page.click('.category-card[data-cat="SmartPhone"]');
    await page.waitForTimeout(400);

    const filteredRows = await page.$$eval('#stockTableBody tr', rows => {
      return rows.map(r => r.querySelector('.badge-category-tag')?.textContent?.trim() || '');
    });
    for (const catTag of filteredRows) {
      if (catTag) {
        expect(catTag.toLowerCase()).toContain('smartphone');
      }
    }

    // 4. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
