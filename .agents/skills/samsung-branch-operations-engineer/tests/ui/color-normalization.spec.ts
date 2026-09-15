import { test, expect } from '@playwright/test';
import { getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Color Normalization Regression (Navy Variants)', () => {
  test('Navy color must normalize from "-Navy", " Navy", and "Navy" to canonical "Navy"', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);

    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    // 1. Search for Galaxy S25FE Navy variant (P/N: SM-S731BDBCTHL)
    //    In Excel/snapshot, model is "Samsung (TSE) Galaxy S25FE 8/256GB -Navy"
    //    The "-Navy" in model name is raw Excel data (acceptable).
    //    The COLOR CELL must resolve to canonical "Navy" (no dash, no leading space).
    const searchInput = page.locator('#search-stock, #searchStockInput, input[type="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('SM-S731BDBCTHL');
      await page.waitForTimeout(500);
    }

    // 2. Find the row matching this P/N
    const targetRow = page.locator('#stockTableBody tr').filter({ hasText: 'SM-S731BDBCTHL' });
    const rowCount = await targetRow.count();

    if (rowCount > 0) {
      // 3. Extract the COLOR CELL specifically (not the entire row text)
      //    The color is rendered in a dedicated cell/element, separate from the model name.
      const colorValue = await targetRow.first().evaluate(row => {
        // Try multiple selectors for the color cell
        const colorEl = row.querySelector('.stock-color') ||
                        row.querySelector('.product-color') ||
                        row.querySelector('[data-field="color"]') ||
                        row.querySelector('.color-badge');
        if (colorEl) return colorEl.textContent?.trim() || '';

        // Fallback: look for color swatch label
        const swatchLabel = row.querySelector('.color-swatch-label, .color-name');
        if (swatchLabel) return swatchLabel.textContent?.trim() || '';

        return '';
      });

      // If we found a dedicated color element, verify it
      if (colorValue) {
        expect(colorValue).toBe('Navy');
        expect(colorValue).not.toMatch(/^-/);   // Must not start with dash
        expect(colorValue).not.toMatch(/^\s/);   // Must not start with whitespace
      }

      // 4. Check color swatch if present (should use navy hex)
      const colorSwatch = targetRow.first().locator('.color-swatch, .stock-color-dot, [data-color]');
      if (await colorSwatch.count() > 0) {
        const bgColor = await colorSwatch.first().evaluate(el => {
          return window.getComputedStyle(el).backgroundColor || el.getAttribute('style') || '';
        });
        // Navy hex #1e3a8a translates to rgb(30, 58, 138)
        const hasNavyColor = bgColor.includes('30, 58, 138') || bgColor.includes('#1e3a8a') || bgColor.includes('1e3a8a');
        expect(hasNavyColor).toBe(true);
      }

      // 5. Verify the row data via JS evaluation for robustness
      const rowData = await targetRow.first().evaluate(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        return cells.map(c => c.textContent?.trim() || '');
      });

      // Find the cell that contains only "Navy" (the color cell, not the model cell)
      const navyCells = rowData.filter(cell => cell === 'Navy');
      expect(navyCells.length).toBeGreaterThanOrEqual(1);

    } else {
      // If search didn't filter, scan all visible rows for P/N
      const navyProduct = await page.$$eval('#stockTableBody tr', rows => {
        const row = rows.find(r => r.textContent?.includes('SM-S731BDBCTHL'));
        if (!row) return null;
        const cells = Array.from(row.querySelectorAll('td'));
        return cells.map(c => c.textContent?.trim() || '');
      });

      expect(navyProduct).not.toBeNull();
      if (navyProduct) {
        // One of the cells must be exactly "Navy" (the color cell)
        const navyCells = navyProduct.filter((cell: string) => cell === 'Navy');
        expect(navyCells.length).toBeGreaterThanOrEqual(1);
      }
    }

    // 6. Broader check: No COLOR CELL in the table should have leading dash or whitespace
    const allColorCellValues = await page.$$eval('#stockTableBody tr', rows => {
      return rows.map(r => {
        const colorEl = r.querySelector('.stock-color') ||
                        r.querySelector('.product-color') ||
                        r.querySelector('[data-field="color"]') ||
                        r.querySelector('.color-badge');
        return colorEl?.textContent?.trim() || '';
      }).filter(c => c.length > 0);
    });

    for (const color of allColorCellValues) {
      expect(color).not.toMatch(/^-/);   // No leading dash in color cells
      expect(color).not.toMatch(/^\s+/); // No leading whitespace in color cells
    }

    // 7. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
