import { test, expect } from '@playwright/test';
import { getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Accessory Spec Drawer (Product Accessory Master & Template Architecture)', () => {
  test('All accessory types must render their dedicated template with zero phone leakage and fail closed on unknown', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const forbiddenLeakage = ['Galaxy A07', 'A07 4G', 'Helio G85', 'Knox Vault'];

    // 1. BLUETOOTH_SPEAKER: Soundcore Select 4 Go (194644055783)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('194644055783', encodeURIComponent('Soundcore Select 4 Go Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    let bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('Soundcore Select 4 Go');
    expect(bodyText).toContain('A31X1');
    expect(bodyText).toContain('BLUETOOTH_SPEAKER');
    expect(bodyText).toContain('PARTIALLY_VERIFIED');
    expect(bodyText).toContain('5W');
    expect(bodyText).toContain('IP67');
    expect(bodyText).toMatch(/20 ชั่วโมง|20 Hours/);
    expect(bodyText).toContain('TWS');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 2. WALL_CHARGER: Samsung 25W Adapter (EP-T2510NBEGTH)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('EP-T2510NBEGTH', encodeURIComponent('Samsung Adapter 25W No Cable-Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('Samsung 25W Power Adapter');
    expect(bodyText).toContain('EP-T2510');
    expect(bodyText).toContain('WALL_CHARGER');
    expect(bodyText).toContain('25W');
    expect(bodyText).toContain('อะแดปเตอร์ติดผนัง');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 3. DATA_CABLE: Samsung C to C Cable (SSG-EP-DN975BBEGWW)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('SSG-EP-DN975BBEGWW', encodeURIComponent('Samsung Cable C to C (SIS) - Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('Samsung USB-C to USB-C Cable');
    expect(bodyText).toContain('EP-DN975');
    expect(bodyText).toContain('DATA_CABLE');
    expect(bodyText).toContain('USB-C');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 4. DATA_CABLE: ADAM elements 100W Cable (4710343478157)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('4710343478157', encodeURIComponent('ADAM elements iLinio C to C Cable 100W 2 units 1M- Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('ADAM elements iLinio USB-C to USB-C Cable');
    expect(bodyText).toContain('DATA_CABLE');
    expect(bodyText).toContain('100W');
    expect(bodyText).toContain('1 เมตร');
    expect(bodyText).toContain('2 เส้นต่อแพ็ก');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 5. PREMIUM_GIFT: Focus Premium Bag (8859703434269)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('8859703434269', encodeURIComponent('[CS]Focus Premium Bag For Samsung S25 Series - Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('Focus Premium Bag for Samsung S25 Series');
    expect(bodyText).toContain('PREMIUM_GIFT');
    expect(bodyText).toContain('กระเป๋าของแถม');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 6. FAIL CLOSED: Unknown item (UNKNOWN-001)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('UNKNOWN-001', encodeURIComponent('Mystery Unknown Accessory'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('SPEC_NOT_VERIFIED');
    expect(bodyText).toContain('ยังไม่มีข้อมูลสเปกที่ตรวจสอบแล้วสำหรับสินค้านี้');
    // Section 1 ERP metadata must still render
    expect(bodyText).toContain('ข้อมูลสินค้าจากระบบสต๊อก (ERP Stock Master)');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');

    // 7. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
