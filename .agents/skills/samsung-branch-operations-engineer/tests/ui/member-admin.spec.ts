import { test, expect } from '@playwright/test';
import { getAdminCredentials, getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Member Admin Route Isolation & RBAC', () => {
  test('Admin members view must be strictly isolated and never render underneath stock views', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    // 1. Navigate to /#/admin/members
    await page.goto(`${url}/#/admin/members`);
    await page.waitForSelector('#view-admin-members', { state: 'attached', timeout: 10000 });

    // 2. Route isolation checks on /#/admin/members
    const adminVisible = await page.$eval('#view-admin-members', el => !el.hidden && window.getComputedStyle(el).display !== 'none');
    const stockHidden = await page.$eval('#view-stock', el => el.hidden || window.getComputedStyle(el).display === 'none');
    
    expect(adminVisible).toBe(true);
    expect(stockHidden).toBe(true);

    const visibleRoutesCount = await page.$$eval('[data-pilot-route]:not([hidden])', els => {
      return els.filter(el => window.getComputedStyle(el).display !== 'none').length;
    });
    expect(visibleRoutesCount).toBe(1);

    // 3. Navigate back to /#/stock
    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const stockNowVisible = await page.$eval('#view-stock', el => !el.hidden && window.getComputedStyle(el).display !== 'none');
    const adminNowHidden = await page.$eval('#view-admin-members', el => el.hidden || window.getComputedStyle(el).display === 'none');

    expect(stockNowVisible).toBe(true);
    expect(adminNowHidden).toBe(true);

    // 4. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
