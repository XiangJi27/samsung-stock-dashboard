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

    // 4. Variant Isolation Test: Samsung 45W No Cable (EP-T4511NBEGTH)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('EP-T4511NBEGTH', encodeURIComponent('Samsung Adapter 45W without cable - Black'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('45W');
    expect(bodyText).toContain('WALL_CHARGER');
    expect(bodyText).toContain('ไม่มีสายชาร์จในกล่อง');
    expect(bodyText).not.toContain('มาพร้อมสาย 5A ในกล่อง');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 5. Batch A Accessory: UGREEN 30W Wall Charger (6941876265732)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('6941876265732', encodeURIComponent('[CS]UGREEN Wall Charer 30W'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('30W');
    expect(bodyText).toContain('WALL_CHARGER');
    expect(bodyText).toContain('UGREEN');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 6. Batch B Home Appliance: Gaabor Air Fryer 4L (PM4897121009793)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('PM4897121009793', encodeURIComponent('[Premium] Gaabor Air Fryer 4L AF-40M01A'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText.toLowerCase()).toContain('gaabor');
    expect(bodyText).toContain('HOME_APPLIANCE');
    expect(bodyText).toContain('หม้อทอดไร้น้ำมัน');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 7. Batch B Soundbar: Samsung Soundbar HW-T420 (PM-8806090284687)
    await page.evaluate(() => {
      // @ts-ignore
      window.openProductSpecsDrawer('PM-8806090284687', encodeURIComponent('Premium SAMSUNG T-series soundbar HW-T420'));
    });
    await page.waitForSelector('#promoDrawerBackdrop.open', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    bodyText = (await page.innerText('#drawerBody')) || '';
    expect(bodyText).toContain('SAMSUNG');
    expect(bodyText).toContain('SOUNDBAR');
    expect(bodyText).toContain('HW-T420');
    expect(bodyText).toContain('2.1ch');
    for (const term of forbiddenLeakage) {
      expect(bodyText).not.toContain(term);
    }
    await page.click('#btnCloseDrawer');
    await page.waitForTimeout(200);

    // 8. Fail-Closed on Unverified Item: (PM6931481215697)
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
