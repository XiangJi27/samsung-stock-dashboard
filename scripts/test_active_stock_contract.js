/**
 * Regression Test: Active Stock Contract & Fail-Closed Guard
 * 
 * Verifies:
 * 1. GET /api/stock/active returns full canonical description and UI compatibility fields:
 *    - inventoryPn, pn
 *    - description, model, name, productName (all non-empty and identical)
 *    - total = f1 + f2
 * 2. P/N 194644055783 has non-empty product name matching database description.
 * 3. Zero items across the active batch have missing/blank product names.
 * 4. Fail-closed guard: POST /api/stock-imports with missing product names is rejected with 422.
 */

const assert = require('assert');
const { loadServerEnv } = require('./lib/load-local-env.js');

const sEnv = loadServerEnv();
if (!sEnv) {
  console.error('Missing server test credentials.');
  process.exit(1);
}
Object.assign(process.env, sEnv);

async function runTests() {
  console.log('=== TEST 1: Verify Active Stock API Handler Contract ===');
  const activeStockHandler = require('../api/stock/active.js');

  let statusCode = null;
  let responseData = null;

  const mockReq = {
    method: 'GET',
    query: { branch_code: 'AYUTTHAYA_CITY_PARK' },
    headers: {}
  };

  const mockRes = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  await activeStockHandler(mockReq, mockRes);

  assert.strictEqual(statusCode, 200, `Expected HTTP 200 from active stock API, got ${statusCode}`);
  assert.ok(responseData && Array.isArray(responseData.items), 'Expected items array');
  assert.ok(responseData.items.length > 0, 'Expected non-empty items array');
  console.log(`✓ Active Batch ID: ${responseData.batchId}`);
  console.log(`✓ Total Items in Active Batch: ${responseData.items.length}`);

  // Test every single item in active batch
  let missingNameCount = 0;
  for (const it of responseData.items) {
    const pn = it.inventoryPn || it.pn;
    assert.ok(pn, `Item missing P/N: ${JSON.stringify(it)}`);
    assert.ok(it.description, `Item ${pn} missing description`);
    assert.strictEqual(it.model, it.description, `Item ${pn} model does not match description`);
    assert.strictEqual(it.name, it.description, `Item ${pn} name does not match description`);
    assert.strictEqual(it.productName, it.description, `Item ${pn} productName does not match description`);
    assert.strictEqual(it.total, it.f1 + it.f2, `Item ${pn} total mismatch: ${it.total} != ${it.f1} + ${it.f2}`);
    if (!it.description || !it.model) {
      missingNameCount++;
    }
  }

  assert.strictEqual(missingNameCount, 0, 'Active batch must have 0 items with missing names');
  console.log('✓ Verified 100% of items have description, model, name, productName, and total = f1 + f2');

  // Verify sample P/N 194644055783
  const sample = responseData.items.find(i => i.inventoryPn === '194644055783');
  assert.ok(sample, 'P/N 194644055783 must exist in active batch');
  assert.strictEqual(sample.description, 'Soundcore Select 4 Go Black');
  assert.strictEqual(sample.model, 'Soundcore Select 4 Go Black');
  assert.strictEqual(sample.name, 'Soundcore Select 4 Go Black');
  assert.strictEqual(sample.productName, 'Soundcore Select 4 Go Black');
  console.log(`✓ Verified sample P/N 194644055783 product name: "${sample.model}"`);

  console.log('\n=== TEST 2: Verify Fail-Closed Guard in stock-imports.js ===');
  const { loadLocalEnv } = require('./lib/load-local-env.js');
  const cEnv = loadLocalEnv();

  // Sign in to get admin user token
  const authRes = await fetch(`${sEnv.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': cEnv.SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: cEnv.TEST_ADMIN_EMAIL,
      password: cEnv.TEST_ADMIN_PASSWORD
    })
  });
  const authData = await authRes.json();
  assert.ok(authData.access_token, `Failed to authenticate as test admin: ${JSON.stringify(authData)}`);
  const adminToken = authData.access_token;

  const stockImportsHandler = require('../api/stock-imports.js');

  let importStatusCode = null;
  let importResponseData = null;

  const badImportReq = {
    method: 'POST',
    url: '/api/stock-imports/validate',
    body: {
      branchCode: 'AYUTTHAYA_CITY_PARK',
      items: [
        { inventoryPn: 'VALID_PN_1', description: 'Real Product Name', f1: 1, f2: 0 },
        { inventoryPn: 'BAD_PN_2', description: '', f1: 1, f2: 0 }
      ]
    },
    headers: {
      authorization: `Bearer ${adminToken}`
    }
  };

  const badImportRes = {
    setHeader() {},
    status(code) {
      importStatusCode = code;
      return this;
    },
    json(data) {
      importResponseData = data;
      return this;
    }
  };

  await stockImportsHandler(badImportReq, badImportRes);
  assert.strictEqual(importStatusCode, 422, `Expected 422 PRODUCT_NAME_REQUIRED, got ${importStatusCode}`);
  assert.strictEqual(importResponseData.code, 'PRODUCT_NAME_REQUIRED');
  console.log('✓ Validation blocked payload with missing description (HTTP 422 PRODUCT_NAME_REQUIRED)');

  console.log('\n🎉 ALL ACTIVE STOCK CONTRACT & REGRESSION TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
