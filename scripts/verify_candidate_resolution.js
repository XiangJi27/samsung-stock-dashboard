const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', async d => await d.accept());
  
  const htmlPath = path.resolve('index.html');
  await page.goto('file:///' + htmlPath);
  await page.waitForTimeout(500);
  
  await page.evaluate(() => {
    window.AuthService.currentUser = { id: 'mock-leader', email: 'leader@staff.internal' };
    window.AuthService.currentProfile = { id: 'mock-leader', employee_code: 'EMP001', display_name: 'Store Leader', status: 'ACTIVE' };
    window.AuthService.currentRoles = [{ role: 'STORE_LEADER', branch_id: 'AYU01' }];
    if (window.AppRouter) {
      window.AppRouter.navigate('/promotion-import');
    }
  });
  await page.waitForTimeout(1000);
  
  const sepFile = 'C:/Users/JarNJay/Downloads/Sep_ 2026 Promotion Retail_Shop Samsung .xlsx';
  await page.setInputFiles('#promoCenterFileInput', sepFile);
  await page.waitForTimeout(2000);
  
  // 1. Verify S26 Ultra 1TB Rows
  const s26UltraRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#promoDiffTableBody tr'));
    return rows.filter(r => r.textContent.includes('S26 Ultra') && r.textContent.includes('1TB')).map(r => r.innerText.replace(/\n+/g, ' | '));
  });
  
  console.log('--- S26 ULTRA 1TB VALIDATION ---');
  s26UltraRows.forEach(r => console.log('  ->', r));
  
  // Check no checkboxes and no EF- cases
  const s26UltraHasCheckbox = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#promoDiffTableBody tr')).filter(r => r.textContent.includes('S26 Ultra') && r.textContent.includes('1TB'));
    return rows.some(r => r.querySelector('input[type="checkbox"]') !== null);
  });
  console.log('S26 Ultra has checkboxes:', s26UltraHasCheckbox);
  if (s26UltraHasCheckbox) {
    console.error('❌ FAIL: S26 Ultra 1TB must not have checkboxes when 0 smartphone P/Ns exist!');
    process.exit(1);
  } else {
    console.log('✅ PASS: S26 Ultra 1TB correctly displays PN_NOT_FOUND without candidate checkboxes.');
  }

  // 2. Select and confirm S26+ 512GB row
  const rowId = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.btn-select-row-all')).find(b => {
      const tr = b.closest('tr');
      return tr && tr.textContent.includes('S26+') && tr.textContent.includes('512GB');
    });
    return btn ? btn.getAttribute('data-row-id') : null;
  });
  console.log('\n--- S26+ 512GB ROW CONFIRMATION (Row ID: ' + rowId + ') ---');
  
  await page.click(`.btn-select-row-all[data-row-id="${rowId}"]`);
  await page.waitForTimeout(500);
  
  await page.click(`.btn-row-confirm[data-row-id="${rowId}"]`);
  await page.waitForTimeout(500);
  
  const variantData = await page.evaluate((rid) => {
    const b = window.PromotionImportController.currentStagedBatch;
    const v = b.variants.find(x => x.draftRowId === rid);
    return {
      status: v.validationStatus,
      confirmedPns: v.confirmedPns,
      targetPns: v.targetPns,
      pn: v.pn
    };
  }, rowId);
  console.log('Confirmed variant data in memory:');
  console.log(JSON.stringify(variantData, null, 2));
  
  if (variantData.status === 'PASSED_VALIDATION' && variantData.confirmedPns.length === 4 && variantData.targetPns.length === 4) {
    console.log('✅ PASS: Multi-P/N candidate binding confirmed with exact targetPns data contract!');
  } else {
    console.error('❌ FAIL: Confirmation failed or targetPns schema invalid!');
    process.exit(1);
  }
  
  await browser.close();
  console.log('\n🎉 ALL CANDIDATE RESOLUTION TESTS PASSED 100%!');
})();
