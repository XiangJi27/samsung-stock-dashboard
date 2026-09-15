import { test, expect } from '@playwright/test';
import { getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Premium Bag Classification Regression (P/N 8859703434269)', () => {
  test('Focus Premium Bag must be classified as Premium, not Accessory', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    // 1. Click on Premium category card to filter
    const premiumCard = page.locator('.category-card[data-cat="Premium"], .category-card.cat-premium');
    if (await premiumCard.count() > 0) {
      await premiumCard.first().click();
      await page.waitForTimeout(500);

      // 2. Verify P/N 8859703434269 appears in the Premium-filtered table
      const premiumRows = await page.$$eval('#stockTableBody tr', rows => {
        return rows.map(r => r.textContent || '');
      });

      const hasPremiumBag = premiumRows.some(r => r.includes('8859703434269'));
      expect(hasPremiumBag).toBe(true);

      // 3. Get category badge for this specific product
      const bagRow = page.locator('#stockTableBody tr').filter({ hasText: '8859703434269' });
      if (await bagRow.count() > 0) {
        const rowText = await bagRow.first().innerText();
        // Should contain Premium indicator
        const isPremium = rowText.toLowerCase().includes('premium') || rowText.includes('พรีเมียม');
        expect(isPremium).toBe(true);
      }
    }

    // 4. Reset filter and click Accessory card — bag must NOT appear
    const allCard = page.locator('.category-card[data-cat="All"], .category-card.cat-all');
    if (await allCard.count() > 0) {
      await allCard.first().click();
      await page.waitForTimeout(300);
    }

    const accessoryCard = page.locator('.category-card[data-cat="Accessory"], .category-card.cat-accessory');
    if (await accessoryCard.count() > 0) {
      await accessoryCard.first().click();
      await page.waitForTimeout(500);

      // 5. Negative assertion: P/N 8859703434269 must NOT appear in Accessory filter
      const accessoryRows = await page.$$eval('#stockTableBody tr', rows => {
        return rows.map(r => r.textContent || '');
      });

      const hasInAccessory = accessoryRows.some(r => r.includes('8859703434269'));
      expect(hasInAccessory).toBe(false);
    }

    // 6. Verify product data attributes directly
    // Reset to All view first
    if (await allCard.count() > 0) {
      await allCard.first().click();
      await page.waitForTimeout(300);
    }

    const productData = await page.evaluate(() => {
      const w = window as any;
      // Try to find the product in the stock data
      const allData = w.PILOT_STOCK_SNAPSHOT || w.__STOCK_DATA__ || w.stockData || [];
      const bag = allData.find((item: any) => item.pn === '8859703434269');
      if (bag) {
        return {
          pn: bag.pn,
          category: bag.category || bag.canonicalCategory,
          category1: bag.category1,
          category2: bag.category2,
          model: bag.model
        };
      }
      return null;
    });

    if (productData) {
      // Category must be Premium, not Accessory
      expect(productData.category).toBe('Premium');
      expect(productData.category).not.toBe('Accessory');
      // category1 should be OTHER (the Excel's Cat1 for premium items)
      expect(productData.category1).toBe('OTHER');
      // category2 should contain PREMIUM
      expect(productData.category2).toContain('PREMIUM');
    }

    // 7. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
