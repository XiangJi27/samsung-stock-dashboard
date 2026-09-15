import { test, expect } from '@playwright/test';
import { getAdminCredentials, getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Product Spec Drawer (Deterministic Identity & Field Verification)', () => {
  test('Soundcore Select 4 Go must show PARTIALLY_VERIFIED and zero Galaxy A07 specs', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    // 1. Open drawer for Soundcore Select 4 Go
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('194644055783', encodeURIComponent('Soundcore Select 4 Go Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    const title = (await page.textContent('#drawerProductTitle'))?.trim() || '';
    const pn = (await page.textContent('#drawerProductPn'))?.trim() || '';
    const bodyText = (await page.innerText('#drawerBody')) || '';

    // 2. Positive assertions
    expect(title).toContain('Soundcore Select 4 Go');
    expect(pn).toContain('194644055783');
    expect(bodyText).toContain('A31X1');
    expect(bodyText).toContain('PARTIALLY_VERIFIED');
    expect(bodyText).toContain('5W');
    expect(bodyText).toContain('IP67');
    expect(bodyText).toMatch(/20 ชั่วโมง|20 Hours/);
    expect(bodyText).toContain('TWS');
    expect(bodyText).toContain('ยังไม่ได้ยืนยัน');
    expect(bodyText).toContain('ตรวจสอบตามใบรับประกันหรือผู้จัดจำหน่ายของสินค้ารายการนี้');

    // 3. Strict negative assertions (Zero Galaxy A07 / Helio / Knox / Unverified Bluetooth 5.4 / 18-month claims)
    const leakageTerms = [
      'Galaxy A07',
      'A07 4G',
      'Helio G85',
      'Knox Vault',
      '6.7 นิ้ว',
      '6.7"',
      'Bluetooth 5.4',
      '5.4 VERIFIED',
      '18 เดือน',
      'Samsung Thailand Official Lab'
    ];
    for (const term of leakageTerms) {
      expect(bodyText).not.toContain(term);
    }

    // Close drawer
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 4. Fail-closed test on unknown product
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('UNKNOWN-TEST-PN-0001', encodeURIComponent('Mystery Gadget Unknown'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    const unknownBody = (await page.innerText('#drawerBody')) || '';
    expect(unknownBody).toContain('SPEC_NOT_VERIFIED');
    expect(unknownBody).toContain('ยังไม่มีข้อมูลสเปกที่ตรวจสอบแล้ว');
    expect(unknownBody).not.toContain('Galaxy A07');

    await page.click('#btnCloseDrawer');

    // 5. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
