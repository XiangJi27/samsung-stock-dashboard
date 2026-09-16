import { test, expect } from '@playwright/test';
import { getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Sales-Ready Product Spec Drawer & Variant Safety Guard', () => {
  test('Sales-ready items render dedicated templates, verify variant safety, preserve ERP fields, and enforce zero leakage', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const forbiddenLeakage = ['Galaxy A07', 'A07 4G', 'Helio G85', 'Knox Vault', '50MP'];

    // 1. Adapter Variant Safety: Samsung 25W Adapter No Cable (EP-T2510NBEGTH)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('EP-T2510NBEGTH', encodeURIComponent('Samsung Adapter 25W No Cable-Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    let bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('25W');
    expect(bodyText).toContain('WALL_CHARGER');
    expect(bodyText).toContain('EP-T2510');
    // Check variant safety: does not claim cable included
    expect(bodyText).not.toContain('มาพร้อมสายในกล่อง');
    // Anti-leakage guard
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 2. Data Cable: Samsung C to C Cable (SSG-EP-DN975BBEGWW)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('SSG-EP-DN975BBEGWW', encodeURIComponent('Samsung Cable C to C (SIS) - Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('USB-C');
    expect(bodyText).toContain('DATA_CABLE');
    expect(bodyText).toContain('EP-DN975');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 3. Bluetooth Speaker: Soundcore Select 4 Go (194644055783)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('194644055783', encodeURIComponent('Soundcore Select 4 Go Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('Soundcore Select 4 Go');
    expect(bodyText).toContain('BLUETOOTH_SPEAKER');
    expect(bodyText).toContain('5W');
    expect(bodyText).toContain('IP67');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 4. Fail-Closed on Unverified Item: (PM6931481215697)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('PM6931481215697', encodeURIComponent('Premiun Mini YOUMI-SAMSUNG'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('SPEC_NOT_VERIFIED');
    expect(bodyText).toContain('ข้อมูลสินค้าจากระบบสต๊อก (ERP Stock Master)');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');

    // 5. Diagnostics: Zero console errors & zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
