import { test, expect } from '@playwright/test';
import { getAdminCredentials, getTargetUrl, attachDiagnostics, loginAsAdmin } from './test-helper';

test.describe('Session Restore and Authentication Lifecycle', () => {
  test('User authentication session must restore properly across page reloads', async ({ page }) => {
    const url = getTargetUrl();
    const diag = attachDiagnostics(page);

    // 1. Initial Login
    await loginAsAdmin(page);

    // 2. Verify logged-in state
    await page.goto(`${url}/#/stock`);
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    const sessionBeforeReload = await page.evaluate(() => {
      // Check localStorage / sessionStorage
      const keys = Object.keys(localStorage).filter(k => k.includes('auth') || k.includes('session') || k.includes('user'));
      return keys.length > 0 || document.body.innerText.includes('CPW3862') || document.querySelector('.user-badge') !== null;
    });
    expect(sessionBeforeReload).toBe(true);

    // 3. Reload page
    await page.reload();
    await page.waitForSelector('#stockTableBody tr', { state: 'visible', timeout: 15000 });

    // 4. Assert session is cleanly restored without forcing re-login
    const loginModalVisible = await page.locator('#loginModal, #loginForm').isVisible().catch(() => false);
    expect(loginModalVisible).toBe(false);

    // 5. Zero console errors and zero 404s
    expect(diag.consoleErrors).toEqual([]);
    expect(diag.notFoundUrls).toEqual([]);
  });
});
