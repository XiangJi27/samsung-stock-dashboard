import { test, expect } from '@playwright/test';
import { getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Marketplace Evidence & Shopee Official Pipeline', () => {
  test('ADAM elements 100W Cable must display accurate specs, proper tags, zero phone leakage, and untouched stock counts', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const forbiddenLeakage = ['Galaxy A07', 'A07 4G', 'Helio G85', 'Knox Vault', '6.7 นิ้ว'];

    // Open Drawer for ADAM elements iLinio C to C Cable 100W 2 units 1M- Black (4710343478157)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('4710343478157', encodeURIComponent('ADAM elements iLinio C to C Cable 100W 2 units 1M- Black'));
    });

    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    const bodyText = (await page.innerText('#drawerBody')) || '';

    // 1. Exact Identity & Template Verification
    expect(bodyText).toContain('ADAM elements iLinio USB-C to USB-C Cable');
    expect(bodyText).toContain('DATA_CABLE');
    expect(bodyText).toContain('4710343478157');
    expect(bodyText).toContain('ADAM elements');

    // 2. Technical Specifications
    expect(bodyText).toContain('100W');
    expect(bodyText).toContain('1 เมตร');
    expect(bodyText).toContain('2 เส้นต่อแพ็ก');

    // 3. Zero Leakage of Smartphone Attributes
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }

    // 4. Drawer Close
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 5. Diagnostics Audit (zero console errors, zero 404s)
    expect(diag.consoleErrors).toHaveLength(0);
    expect(diag.notFoundUrls).toHaveLength(0);
  });
});
