import { test, expect } from '@playwright/test';
import { getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Soundcore Identity Guard (Extended Verification)', () => {
  test('Soundcore spec drawer must show only verified Soundcore fields and zero Samsung leakage', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    // =====================================================================
    // PHASE 1: Open Soundcore Select 4 Go drawer
    // =====================================================================
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('194644055783', encodeURIComponent('Soundcore Select 4 Go Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    const soundcoreTitle = (await page.textContent('#drawerProductTitle'))?.trim() || '';
    const soundcorePn = (await page.textContent('#drawerProductPn'))?.trim() || '';
    const soundcoreBody = (await page.innerText('#drawerBody')) || '';

    // 1. Positive identity assertions
    expect(soundcoreTitle).toContain('Soundcore Select 4 Go');
    expect(soundcorePn).toContain('194644055783');
    expect(soundcoreBody).toContain('A31X1');
    expect(soundcoreBody).toContain('PARTIALLY_VERIFIED');

    // 2. Verified field assertions (these fields have confirmed data)
    expect(soundcoreBody).toContain('5W');           // outputPower
    expect(soundcoreBody).toContain('IP67');          // ipRating
    expect(soundcoreBody).toMatch(/20 ชั่วโมง|20 Hours/);  // playTime
    expect(soundcoreBody).toContain('TWS');           // tws capability

    // 3. Pending field assertions (must show unverified status)
    expect(soundcoreBody).toContain('ยังไม่ได้ยืนยัน');
    expect(soundcoreBody).toContain('ตรวจสอบตามใบรับประกันหรือผู้จัดจำหน่ายของสินค้ารายการนี้');

    // 4. Strict negative assertions — ZERO Samsung Galaxy leakage
    const forbiddenTerms = [
      'Galaxy A07',
      'A07 4G',
      'Helio G85',
      'Helio',
      'Knox Vault',
      'Knox',
      '6.7 นิ้ว',
      '6.7"',
      'Bluetooth 5.4',
      '5.4 VERIFIED',
      '18 เดือน',
      '18-month',
      'Samsung Thailand Official Lab',
      'Galaxy S',
      'Galaxy Z',
      'Galaxy Tab',
      'Exynos',
      'Snapdragon',
      'One UI'
    ];
    for (const term of forbiddenTerms) {
      expect(soundcoreBody).not.toContain(term);
    }

    // 5. Close drawer
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(300);

    // =====================================================================
    // PHASE 2: Open a Samsung product drawer to verify NO stale data leakage
    // =====================================================================
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('SM-A176BZKGTHL', encodeURIComponent('Galaxy A17 5G (8/128GB)'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    const samsungTitle = (await page.textContent('#drawerProductTitle'))?.trim() || '';
    const samsungBody = (await page.innerText('#drawerBody')) || '';

    // 6. Samsung drawer must show Samsung data, NOT Soundcore data
    expect(samsungTitle).toContain('Galaxy A17');
    expect(samsungBody).not.toContain('Soundcore');
    expect(samsungBody).not.toContain('A31X1');
    expect(samsungBody).not.toContain('BLUETOOTH_SPEAKER');

    // 7. Close Samsung drawer
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(300);

    // =====================================================================
    // PHASE 3: Re-open Soundcore drawer to verify no stale Samsung data
    // =====================================================================
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('194644055783', encodeURIComponent('Soundcore Select 4 Go Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    const reopenedBody = (await page.innerText('#drawerBody')) || '';

    // 8. After reopening, Soundcore must still show Soundcore data
    expect(reopenedBody).toContain('A31X1');
    expect(reopenedBody).toContain('PARTIALLY_VERIFIED');
    expect(reopenedBody).toContain('5W');

    // 9. And still must NOT show any Samsung leakage
    expect(reopenedBody).not.toContain('Galaxy A07');
    expect(reopenedBody).not.toContain('Galaxy A17');
    expect(reopenedBody).not.toContain('Helio');

    await page.click('#btnCloseDrawer');

    // 10. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
