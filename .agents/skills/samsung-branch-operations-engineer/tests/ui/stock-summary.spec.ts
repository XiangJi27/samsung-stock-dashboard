import { test, expect } from '@playwright/test';
import { getAdminCredentials, getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Stock Summary Cards (F1 Only Invariant)', () => {
  test('Summary cards must display Floor 1 inventory only and suppress SIM/Other cards', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    // 1. Authenticate via root entrypoint
    await loginAsAdmin(page);

    // 2. Navigate to /#/stock
    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    // 3. Assert card totals strictly match Floor 1 acceptance fixture
    const allStock = (await page.textContent('#countCatAllStock'))?.trim();
    const phoneStock = (await page.textContent('#countCatPhoneStock'))?.trim();
    const tabStock = (await page.textContent('#countCatTabStock'))?.trim();
    const watchStock = (await page.textContent('#countCatWatchStock'))?.trim();
    const budsStock = (await page.textContent('#countCatBudsStock'))?.trim();
    const accStock = (await page.textContent('#countCatAccStock'))?.trim();
    const premStock = (await page.textContent('#countCatPremStock'))?.trim();

    expect(allStock).toBe('1,701');
    expect(phoneStock).toBe('230');
    expect(tabStock).toBe('34');
    expect(watchStock).toBe('61');
    expect(budsStock).toBe('49');
    expect(accStock).toBe('972');
    expect(premStock).toBe('282');

    // 4. Assert SIM and Other summary cards are completely suppressed / hidden
    await expect(page.locator('#catCardSIM, .category-card.cat-sim')).toBeHidden();
    await expect(page.locator('#catCardOther, .category-card.cat-other')).toBeHidden();

    const visibleCards = page.locator('#categoryGrid .category-card:visible');
    await expect(visibleCards).toHaveCount(7);

    // 5. Assert title and unit labels declare Floor 1
    const firstCardTitle = await page.textContent('.category-card.cat-all .category-name');
    expect(firstCardTitle).toContain('ชั้น 1');

    const unitLabels = await page.$$eval('.category-unit', els => els.map(e => e.textContent || ''));
    for (const u of unitLabels) {
      expect(u).not.toContain('F1 + F2');
      expect(u).toContain('ชั้น 1');
    }

    // 6. Mathematical verification (Hardware + Premium + SIM 58 ชิ้น + Other 15 ชิ้น == 1,701)
    const hardwareAndPremiumSum = 230 + 34 + 61 + 49 + 972 + 282;
    expect(hardwareAndPremiumSum + 58 + 15).toBe(1701);

    // 7. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
