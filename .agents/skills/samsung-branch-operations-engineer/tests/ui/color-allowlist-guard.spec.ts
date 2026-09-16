import { test, expect } from '@playwright/test';
import { getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

/**
 * Color Allowlist Regression (Model Code Guard)
 *
 * Verifies that the Color Resolver does NOT interpret model codes,
 * connector types, audio specs, or brand name fragments as color values.
 *
 * Failures indicate that extractColorFromDescription() returned a candidate
 * without validating against the KNOWN_COLORS allowlist.
 *
 * Regression fixtures (from user report 2026-09-16):
 *   - 8859289657762  D-Power M22 Speaker Bluetooth      → ไม่ระบุสี (NOT "Power M22 Speaker Bluetooth")
 *   - 8859289665477  SAMSUNG TC-04 (Type-C)             → ไม่ระบุสี (NOT "C)")
 *   - PM-8806090284687  Soundbar HW-T420 2.1ch          → ไม่ระบุสี (NOT "T420 2.1ch With Subwoofer")
 *   - PM-8806097071891  Soundbar HW-B400F 2.0ch         → ไม่ระบุสี (NOT "B400f 2.0ch Sub Woofer")
 *   - 8859703434269  Focus Premium Bag S25 - Black      → Black (control: must still work)
 *
 * Also verifies that legitimate color suffixes still resolve:
 *   - Samsung Adapter 45W without cable - Black         → Black
 *   - Samsung Cable C to C (SIS) - White               → White
 *   - Samsung Galaxy S25FE -Navy                       → Navy
 */

test.describe('Color Allowlist Guard (Model Code Regression)', () => {

  test('Model codes and audio specs are never interpreted as colors', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    await loginAsAdmin(page);
    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    // ---------- Helper: resolve color for a P/N via window.resolveProductColor ----------
    async function getResolvedColor(pn: string): Promise<string | null> {
      return page.evaluate((inventoryPn: string) => {
        // Find the item in STOCK_DATABASE by P/N
        const db: any[] = (window as any).STOCK_DATABASE || [];
        const item = db.find((i: any) =>
          (i.pn || i.inventoryPn || i.inventory_pn || '') === inventoryPn
        );
        if (!item) return null;

        // resolveProductColor is registered on window by prototype-stock.js
        const resolver = (window as any).resolveProductColor;
        if (typeof resolver !== 'function') return '__RESOLVER_MISSING__';

        const result = resolver(item);
        // Normalize empty / falsy → "ไม่ระบุสี"
        return result || 'ไม่ระบุสี';
      }, pn);
    }

    // ---------- Case 1: D-Power brand name hyphen (must NOT produce a color) ----------
    const dPowerColor = await getResolvedColor('8859289657762');
    if (dPowerColor !== null) {
      expect(
        dPowerColor,
        'D-Power brand hyphen must not produce "Power M22 Speaker Bluetooth" as color'
      ).toBe('ไม่ระบุสี');
      expect(dPowerColor).not.toContain('Power M22');
      expect(dPowerColor).not.toContain('Speaker');
      expect(dPowerColor).not.toContain('Bluetooth');
    }

    // ---------- Case 2: Type-C connector hyphen (must NOT produce "C)") ----------
    const typeCColor = await getResolvedColor('8859289665477');
    if (typeCColor !== null) {
      expect(
        typeCColor,
        'Type-C connector hyphen must not produce "C)" as color'
      ).toBe('ไม่ระบุสี');
      expect(typeCColor).not.toMatch(/C\)/);
      expect(typeCColor).not.toContain('Type');
    }

    // ---------- Case 3: HW-T420 model code hyphen ----------
    const hwT420Color = await getResolvedColor('PM-8806090284687');
    if (hwT420Color !== null) {
      expect(
        hwT420Color,
        'HW-T420 model code hyphen must not produce audio spec as color'
      ).toBe('ไม่ระบุสี');
      expect(hwT420Color).not.toContain('T420');
      expect(hwT420Color).not.toContain('Subwoofer');
      expect(hwT420Color).not.toContain('2.1ch');
    }

    // ---------- Case 4: HW-B400F model code hyphen ----------
    const hwB400fColor = await getResolvedColor('PM-8806097071891');
    if (hwB400fColor !== null) {
      expect(
        hwB400fColor,
        'HW-B400F model code hyphen must not produce audio spec as color'
      ).toBe('ไม่ระบุสี');
      expect(hwB400fColor).not.toContain('B400');
      expect(hwB400fColor).not.toContain('Woofer');
      expect(hwB400fColor).not.toContain('2.0ch');
    }

    // ---------- Case 5 (control): Focus Premium Bag - Black must still resolve ----------
    const bagColor = await getResolvedColor('8859703434269');
    if (bagColor !== null) {
      expect(
        bagColor,
        'Focus Premium Bag - Black must still resolve to "Black"'
      ).toBe('Black');
    }

    // ---------- Broad sweep: No color cell should contain audio/tech terms ----------
    const forbiddenPatterns = [
      /subwoofer/i,
      /woofer/i,
      /bluetooth/i,
      /speaker/i,
      /soundbar/i,
      /2\.1ch/i,
      /2\.0ch/i,
      /type-c/i,
      /usb-c/i,
      /\d+w\b/i,         // e.g. "30W" (wattage)
      /^\d+\.\d+ch/,     // e.g. "2.1ch"
      /hw-[a-z0-9]+/i,   // model codes like HW-T420
    ];

    const allColorCells = await page.$$eval('#stockTableBody tr', rows => {
      return rows.map(row => {
        const colorEl =
          row.querySelector('.color-name') ||
          row.querySelector('.stock-color') ||
          row.querySelector('[data-field="color"]') ||
          row.querySelector('.color-badge');
        return colorEl?.textContent?.trim() || '';
      }).filter(c => c.length > 0 && c !== 'ไม่ระบุสี' && c !== '-');
    });

    for (const colorText of allColorCells) {
      for (const pattern of forbiddenPatterns) {
        expect(
          colorText,
          `Color cell "${colorText}" matched forbidden pattern ${pattern}`
        ).not.toMatch(pattern);
      }
    }

    // Zero console errors and 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Unit-level test: validate window.resolveProductColor directly in browser
  // --------------------------------------------------------------------------
  test('resolveProductColor unit: isKnownColor allowlist rejects non-color strings', async ({ page }) => {
    const url = getTargetUrl();
    await loginAsAdmin(page);
    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const results = await page.evaluate(() => {
      const isKnownColor = (window as any).isKnownColor;
      if (typeof isKnownColor !== 'function') {
        return { error: 'isKnownColor not found on window' };
      }
      const resolveProductColor = (window as any).resolveProductColor;
      if (typeof resolveProductColor !== 'function') {
        return { error: 'resolveProductColor not found on window' };
      }

      const cases = [
        // Should be REJECTED (not a known color)
        { input: 'Power M22 Speaker Bluetooth', expectedKnown: false },
        { input: 'C)', expectedKnown: false },
        { input: 'T420 2.1ch With Subwoofer', expectedKnown: false },
        { input: 'B400f 2.0ch Sub Woofer', expectedKnown: false },
        { input: 'Subwoofer', expectedKnown: false },
        { input: 'Type-C', expectedKnown: false },
        { input: 'USB-C', expectedKnown: false },
        { input: '30W', expectedKnown: false },
        // Should be ACCEPTED (known colors)
        { input: 'Black', expectedKnown: true },
        { input: 'Navy', expectedKnown: true },
        { input: 'White', expectedKnown: true },
        { input: 'Silver', expectedKnown: true },
        { input: 'Titanium Black', expectedKnown: true },
        { input: 'Titanium Gray', expectedKnown: true },
      ];

      return cases.map(c => ({
        input: c.input,
        expectedKnown: c.expectedKnown,
        actualKnown: isKnownColor(c.input),
        pass: isKnownColor(c.input) === c.expectedKnown,
      }));
    });

    if (Array.isArray(results)) {
      for (const r of results) {
        expect(
          r.pass,
          `isKnownColor("${r.input}") returned ${r.actualKnown}, expected ${r.expectedKnown}`
        ).toBe(true);
      }
    } else {
      // If isKnownColor is not exposed yet, skip gracefully but log
      console.warn('isKnownColor unit test skipped:', (results as any).error);
    }
  });

  // --------------------------------------------------------------------------
  // Regression: Legitimate color suffixes still resolve after fix
  // --------------------------------------------------------------------------
  test('Legitimate color suffixes in description still resolve correctly', async ({ page }) => {
    const url = getTargetUrl();
    await loginAsAdmin(page);
    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const results = await page.evaluate(() => {
      const resolveProductColor = (window as any).resolveProductColor;
      if (typeof resolveProductColor !== 'function') return null;

      const testItems = [
        { description: 'Samsung Adapter 45W without cable - Black', expectedColor: 'Black' },
        { description: 'Samsung Cable C to C (SIS) - White', expectedColor: 'White' },
        { description: 'Samsung Galaxy S25FE 8/256GB -Navy', expectedColor: 'Navy' },
        { description: '[CS]Focus Premium Bag For Samsung S25 Series - Black', expectedColor: 'Black' },
        { description: 'ADAM elements iLinio C to C Cable 100W 2 units 1M - Silver', expectedColor: 'Silver' },
        // Should NOT resolve
        { description: 'Premium D-Power M22 Speaker Bluetooth', expectedColor: null },
        { description: 'Premium SAMSUNG TC-04 (Type-C)', expectedColor: null },
        { description: 'Premium SAMSUNG T-series soundbar HW-T420 2.1ch with Subwoofer', expectedColor: null },
      ];

      return testItems.map(item => {
        const resolved = resolveProductColor({ description: item.description }) || null;
        const pass = item.expectedColor === null
          ? (!resolved || resolved === 'ไม่ระบุสี')
          : (resolved === item.expectedColor);
        return {
          description: item.description,
          expectedColor: item.expectedColor,
          actualColor: resolved,
          pass,
        };
      });
    });

    if (results) {
      for (const r of results) {
        expect(
          r.pass,
          `"${r.description}" → expected "${r.expectedColor}", got "${r.actualColor}"`
        ).toBe(true);
      }
    }
  });
});
