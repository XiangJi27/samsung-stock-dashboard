/**
 * Security Hotfix Regression Suite: C1 + C2
 *
 * C1 - Removal of the mock-/pilot-/PILOT_STORE_LEADER_DEV_TOKEN authentication
 *      bypass and the app_metadata role escalation in the promotion APIs.
 * C2 - Fail-closed authentication + branch scoping for GET /api/stock/active
 *      (previously served real stock data to unauthenticated callers).
 *
 * Tier A (default, fully offline):
 *   Drives the REAL handlers with a scripted fetch transport. Asserts the exact
 *   denial matrix, cross-branch leakage prevention, the same-branch success path,
 *   and that no bypass credential ever reaches an upstream PostgREST endpoint.
 *
 * Tier B (opt-in, requires a local child server; never production):
 *   RUN_LIVE_TIER_B=1 TIER_B_BASE_URL=http://127.0.0.1:3099 node scripts/test_security_hotfix_c1_c2.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ============================================================================
// Environment isolation. Must be set BEFORE the handlers are required, since
// they read process.env at request time. The secret key is intentionally set
// so we can prove it is NEVER used to widen read access for GET /api/stock/active.
// ============================================================================
const STUB_URL = 'https://stub.supabase.co';
const STUB_PUBLISHABLE_KEY = 'sb_publishable_STUB_ONLY_NOT_A_REAL_KEY';
const STUB_SECRET_KEY = 'sb_secret_STUB_ONLY_MUST_NEVER_BE_SENT';

process.env.SUPABASE_URL = STUB_URL;
process.env.SUPABASE_PUBLISHABLE_KEY = STUB_PUBLISHABLE_KEY;
process.env.SUPABASE_SECRET_KEY = STUB_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const ACTIVE_STOCK_HANDLER = require(path.join(REPO_ROOT, 'api', 'stock', 'active.js'));
const PROMOTION_IMPORTS_HANDLER = require(path.join(REPO_ROOT, 'api', 'promotion-imports.js'));
const PROMOTION_CAMPAIGNS_HANDLER = require(path.join(REPO_ROOT, 'api', 'promotion-campaigns.js'));

// ============================================================================
// Test harness
// ============================================================================
let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        -> ${err.message}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  SKIP  ${name} :: ${reason}`);
}

function info(message) {
  console.log(`        INFO: ${message}`);
}

// ----------------------------------------------------------------------------
// Scripted fetch transport. Captures every upstream call (URL + headers) so the
// suite can assert both the HTTP outcome and the credentials that were sent.
// ----------------------------------------------------------------------------
const realFetch = global.fetch;
let upstreamCalls = [];
let activeRoutes = [];

function route(fragment, status, body) {
  return { fragment, status, body };
}

function installFetchStub(routes) {
  upstreamCalls = [];
  activeRoutes = routes;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    const headers = (options && options.headers) || {};
    upstreamCalls.push({ url: target, headers });

    const matched = activeRoutes.find((r) => target.includes(r.fragment));
    const status = matched ? matched.status : 404;
    const body = matched ? matched.body : { message: 'NO_STUB_ROUTE' };

    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body)
    };
  };
}

function restoreFetch() {
  global.fetch = realFetch;
}

function makeRes() {
  const state = { statusCode: null, body: null, headers: {} };
  const res = {
    setHeader(key, value) {
      state.headers[key] = value;
    },
    status(code) {
      state.statusCode = code;
      return res;
    },
    json(payload) {
      state.body = payload;
      return res;
    }
  };
  return { res, state };
}

function postgrestCalls() {
  return upstreamCalls.filter((c) => c.url.includes('/rest/v1/'));
}

function authFlowCalls() {
  return upstreamCalls.filter((c) => c.url.includes('/auth/v1/'));
}

function serializedCalls() {
  return JSON.stringify(upstreamCalls.map((c) => ({ url: c.url, headers: c.headers })));
}

// The caller's OWN credential is legitimately forwarded to the identity endpoint for
// verification; an invalid credential is rejected there and never used for data reads.
// So "no leakage" is proven by the ABSENCE of any PostgREST data read, not by the
// absence of the credential on the identity call. The bypass identity (a fabricated
// user id / service account) must never appear anywhere at all.
function assertNoBypassIdentityUpstream(label) {
  const dump = serializedCalls();
  for (const needle of ['SYSTEM_TECHNICAL_TEST_ACTOR', 'system_technical_test_actor@ayutthaya.samsung.com', '00000000-0000-0000-0000-000000000001']) {
    assert.ok(
      !dump.includes(needle),
      `${label}: fabricated bypass identity "${needle}" reached an upstream endpoint`
    );
  }
}

function assertSecretKeyNeverSent(label) {
  const dump = serializedCalls();
  assert.ok(
    !dump.includes(STUB_SECRET_KEY),
    `${label}: service/secret key was sent upstream (read access widened)`
  );
}
// ============================================================================
// C2: GET /api/stock/active fail-closed authentication + branch scoping
// ============================================================================
const C2_BRANCH = 'AYUTTHAYA_CITY_PARK';
const C2_OTHER_BRANCH = 'CHIANG_MAI';
const C2_BATCH_ID = '9ea77b41-ae5a-46d6-8340-75b0762c3a1f';
const C2_VALID_TOKEN = 'stub-valid-caller-jwt';
const C2_VIEWER_ID = '11111111-2222-3333-4444-555555555555';

function c2Req(overrides = {}) {
  return {
    method: 'GET',
    query: { branch_code: C2_BRANCH },
    headers: {},
    ...overrides
  };
}

async function callActiveStock(req) {
  const { res, state } = makeRes();
  await ACTIVE_STOCK_HANDLER(req, res);
  return state;
}

function c2Routes(options = {}) {
  const {
    branchExists = true,
    roles = [{ role: 'STORE_LEADER', branch_id: C2_BRANCH }],
    rolesStatus = 200,
    branchStatus = 200,
    authOk = true,
    authStatus = 200
  } = options;

  return [
    route('/auth/v1/user', authOk ? 200 : authStatus, authOk
      ? { id: C2_VIEWER_ID, email: 'stub.caller@ayutthaya.samsung.com', app_metadata: {} }
      : { code: 'INVALID_TOKEN' }),
    route('/rest/v1/branches?id=eq.', branchStatus,
      branchStatus === 200 ? (branchExists ? [{ id: C2_BRANCH }] : []) : { message: 'stub branch failure' }),
    route('/rest/v1/user_roles?user_id=eq.', rolesStatus,
      rolesStatus === 200 ? roles : { message: 'stub role failure' }),
    route('/rest/v1/active_stock_snapshot', 200,
      [{ active_batch_id: C2_BATCH_ID, branch_code: C2_BRANCH }]),
    route('/rest/v1/stock_import_batches', 200, [{
      id: C2_BATCH_ID,
      branch_code: C2_BRANCH,
      source_file_name: 'stub_stock.xlsx',
      source_file_sha256: 'stub-sha',
      imported_by: C2_VIEWER_ID,
      imported_at: '2026-01-01T00:00:00Z',
      activated_at: '2026-01-01T00:00:00Z',
      total_rows: 1,
      f1_total: 3,
      f2_total: 4
    }]),
    route('/rest/v1/stock_snapshot_items', 200, [{
      inventory_pn: '194644055783',
      description: 'Soundcore Select 4 Go Black',
      f1: 3,
      f2: 4
    }])
  ];
}

function stockDataReads() {
  return postgrestCalls().filter((c) =>
    c.url.includes('active_stock_snapshot') ||
    c.url.includes('stock_snapshot_items') ||
    c.url.includes('stock_import_batches'));
}

async function runC2Tests() {
  console.log('\n=== C2: GET /api/stock/active fail-closed auth & branch scope ===');

  await test('anonymous request (no Authorization header) -> 401 AUTHENTICATION_REQUIRED', async () => {
    installFetchStub(c2Routes());
    const state = await callActiveStock(c2Req());
    assert.strictEqual(state.statusCode, 401, `expected 401, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'AUTHENTICATION_REQUIRED');
    assert.strictEqual(postgrestCalls().length, 0, 'no PostgREST read may occur before authentication');
  });

  await test('anonymous request with branch_code omitted -> 401 (no implicit default-branch leak)', async () => {
    installFetchStub(c2Routes());
    const state = await callActiveStock(c2Req({ query: {} }));
    assert.strictEqual(state.statusCode, 401, `expected 401, got ${state.statusCode}`);
    assert.strictEqual(postgrestCalls().length, 0);
  });

  await test('empty Authorization header -> 401 AUTHENTICATION_REQUIRED', async () => {
    installFetchStub(c2Routes());
    const state = await callActiveStock(c2Req({ headers: { authorization: '' } }));
    assert.strictEqual(state.statusCode, 401, `expected 401, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'AUTHENTICATION_REQUIRED');
  });

  await test('non-Bearer Authorization header -> 401 AUTHENTICATION_REQUIRED', async () => {
    installFetchStub(c2Routes());
    const state = await callActiveStock(c2Req({ headers: { authorization: `Basic ${C2_VALID_TOKEN}` } }));
    assert.strictEqual(state.statusCode, 401, `expected 401, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'AUTHENTICATION_REQUIRED');
  });

  await test('the exact former C1 bypass credentials -> 401, no stock data read', async () => {
    const bypassCredentials = [
      ['mock-store-leader-token', 'mock- prefixed token'],
      ['pilot-store-leader-token', 'pilot- prefixed token'],
      ['PILOT_STORE_LEADER_DEV_TOKEN', 'literal dev bypass token']
    ];
    for (const [credential, label] of bypassCredentials) {
      installFetchStub(c2Routes({ authOk: false, authStatus: 401 }));
      const state = await callActiveStock(c2Req({ headers: { authorization: `Bearer ${credential}` } }));
      assert.strictEqual(state.statusCode, 401, `${label}: expected 401, got ${state.statusCode}`);
      assert.strictEqual(state.body.code, 'INVALID_ACCESS_TOKEN', `${label}: got ${state.body.code}`);
      assert.strictEqual(postgrestCalls().length, 0, `${label}: stock data must not be read`);
      assertNoBypassIdentityUpstream(`C2 credential "${label}"`);
    }
  });

  await test('expired/invalid token (auth/v1/user 401) -> 401 INVALID_ACCESS_TOKEN', async () => {
    installFetchStub(c2Routes({ authOk: false, authStatus: 401 }));
    const state = await callActiveStock(c2Req({ headers: { authorization: 'Bearer expired.stub.jwt' } }));
    assert.strictEqual(state.statusCode, 401, `expected 401, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'INVALID_ACCESS_TOKEN');
    assert.strictEqual(postgrestCalls().length, 0);
  });

  await test('malformed branch_code -> 400 INVALID_BRANCH_CODE before any upstream call', async () => {
    installFetchStub(c2Routes({ roles: [] }));
    const malformed = ['../etc/passwd', 'AYUTTHAYA CITY PARK', "AYUTTHAYA';DROP", 'A', 'X'.repeat(65)];
    for (const bad of malformed) {
      const state = await callActiveStock(c2Req({
        query: { branch_code: bad },
        headers: { authorization: `Bearer ${C2_VALID_TOKEN}` }
      }));
      assert.strictEqual(state.statusCode, 400, `branch_code "${bad}" expected 400, got ${state.statusCode}`);
      assert.strictEqual(state.body.code, 'INVALID_BRANCH_CODE', `branch_code "${bad}"`);
    }
    assert.strictEqual(upstreamCalls.length, 0, 'malformed branch codes must be rejected before any network call');
  });

  await test('unknown/inactive branch (branches lookup empty) -> 403 BRANCH_ACCESS_DENIED', async () => {
    installFetchStub(c2Routes({ branchExists: false }));
    const state = await callActiveStock(c2Req({
      query: { branch_code: C2_OTHER_BRANCH },
      headers: { authorization: `Bearer ${C2_VALID_TOKEN}` }
    }));
    assert.strictEqual(state.statusCode, 403, `expected 403, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'BRANCH_ACCESS_DENIED', `got ${state.body.code}`);
    assert.strictEqual(stockDataReads().length, 0, 'stock data must not be read before branch authorization');
  });

  await test('cross-branch caller (role branch != requested branch) -> 403, no leakage', async () => {
    installFetchStub(c2Routes({ roles: [{ role: 'STORE_LEADER', branch_id: C2_BRANCH }] }));
    const state = await callActiveStock(c2Req({
      query: { branch_code: C2_OTHER_BRANCH },
      headers: { authorization: `Bearer ${C2_VALID_TOKEN}` }
    }));
    assert.strictEqual(state.statusCode, 403, `expected 403, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'BRANCH_ACCESS_DENIED', `got ${state.body.code}`);
    assert.strictEqual(stockDataReads().length, 0, 'cross-branch request must not reach snapshot queries');
    assert.strictEqual(state.body.items, undefined, 'response must not contain stock items');
    assert.strictEqual(state.body.batchId, undefined, 'response must not contain a batch id');
  });

  await test('role row with NULL branch_id (non-admin) fails closed -> 403', async () => {
    installFetchStub(c2Routes({ roles: [{ role: 'STORE_LEADER', branch_id: null }] }));
    const state = await callActiveStock(c2Req({ headers: { authorization: `Bearer ${C2_VALID_TOKEN}` } }));
    assert.strictEqual(state.statusCode, 403, `expected 403, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'BRANCH_ACCESS_DENIED', `got ${state.body.code}`);
  });

  await test('caller with zero user_roles rows -> 403 INSUFFICIENT_PERMISSIONS', async () => {
    installFetchStub(c2Routes({ roles: [] }));
    const state = await callActiveStock(c2Req({ headers: { authorization: `Bearer ${C2_VALID_TOKEN}` } }));
    assert.strictEqual(state.statusCode, 403, `expected 403, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'INSUFFICIENT_PERMISSIONS', `got ${state.body.code}`);
  });

  await test('error reading user_roles -> 503 ROLE_LOOKUP_FAILED (fail closed, not allow)', async () => {
    installFetchStub(c2Routes({ rolesStatus: 500 }));
    const state = await callActiveStock(c2Req({ headers: { authorization: `Bearer ${C2_VALID_TOKEN}` } }));
    assert.strictEqual(state.statusCode, 503, `expected 503, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'ROLE_LOOKUP_FAILED', `got ${state.body.code}`);
    assert.strictEqual(state.body.items, undefined);
  });

  await test('error reading branches -> 503 BRANCH_LOOKUP_FAILED (fail closed, not allow)', async () => {
    installFetchStub(c2Routes({ branchStatus: 500 }));
    const state = await callActiveStock(c2Req({ headers: { authorization: `Bearer ${C2_VALID_TOKEN}` } }));
    assert.strictEqual(state.statusCode, 503, `expected 503, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'BRANCH_LOOKUP_FAILED', `got ${state.body.code}`);
  });

  await test('valid same-branch caller -> 200 with batch data', async () => {
    installFetchStub(c2Routes());
    const state = await callActiveStock(c2Req({ headers: { authorization: `Bearer ${C2_VALID_TOKEN}` } }));
    assert.strictEqual(state.statusCode, 200, `expected 200, got ${state.statusCode} (${JSON.stringify(state.body)})`);
    assert.strictEqual(state.body.batchId, C2_BATCH_ID);
    assert.strictEqual(state.body.branchCode, C2_BRANCH);
    assert.ok(Array.isArray(state.body.items) && state.body.items.length === 1, 'expected exactly 1 item');
    assert.strictEqual(state.body.items[0].description, 'Soundcore Select 4 Go Black');
    assert.strictEqual(state.body.items[0].total, 7);
  });

  await test('SYSTEM_ADMIN global caller may read any branch', async () => {
    installFetchStub(c2Routes({ roles: [{ role: 'SYSTEM_ADMIN', branch_id: null }] }));
    const state = await callActiveStock(c2Req({
      query: { branch_code: C2_OTHER_BRANCH },
      headers: { authorization: `Bearer ${C2_VALID_TOKEN}` }
    }));
    assert.strictEqual(state.statusCode, 200, `expected 200, got ${state.statusCode} (${JSON.stringify(state.body)})`);
  });

  await test('all downstream stock reads use the CALLER token, never the service key', async () => {
    installFetchStub(c2Routes());
    const state = await callActiveStock(c2Req({ headers: { authorization: `Bearer ${C2_VALID_TOKEN}` } }));
    assert.strictEqual(state.statusCode, 200);
    const reads = postgrestCalls();
    assert.ok(reads.length >= 4, `expected at least 4 PostgREST reads, got ${reads.length}`);
    for (const call of reads) {
      assert.strictEqual(
        call.headers.Authorization,
        `Bearer ${C2_VALID_TOKEN}`,
        `read ${call.url} did not use the caller token (got ${call.headers.Authorization})`
      );
      assert.strictEqual(
        call.headers.apikey,
        STUB_PUBLISHABLE_KEY,
        `read ${call.url} used a non-publishable apikey (got ${call.headers.apikey})`
      );
    }
    assertSecretKeyNeverSent('C2 downstream reads');
  });

  await test('identity verification itself never sends the service key', async () => {
    installFetchStub(c2Routes());
    await callActiveStock(c2Req({ headers: { authorization: `Bearer ${C2_VALID_TOKEN}` } }));
    const authCalls = authFlowCalls();
    assert.strictEqual(authCalls.length, 1, `expected 1 identity call, got ${authCalls.length}`);
    assert.ok(
      !String(authCalls[0].headers.Authorization).includes(STUB_SECRET_KEY),
      'identity endpoint must be called with the caller token, not the service key'
    );
  });

  await test('GET /api/stock/active no longer references any bypass token in executable code', async () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'api', 'stock', 'active.js'), 'utf8');
    const executable = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    for (const needle of ['PILOT_STORE_LEADER_DEV_TOKEN', "startsWith('mock-')", "startsWith('pilot-')", 'SYSTEM_TECHNICAL_TEST_ACTOR']) {
      assert.ok(!executable.includes(needle), `executable bypass reference still present: ${needle}`);
    }
  });
}

// ============================================================================
// C1: promotion APIs must reject every bypass credential
// ============================================================================
const C1_KEY = 'stub-jwt-token-for-c1';

function campaignsReq(overrides = {}) {
  return {
    method: 'POST',
    url: '/api/promotion-campaigns/stub-campaign-id/approve',
    body: { branchCode: C2_BRANCH },
    query: {},
    headers: {},
    ...overrides
  };
}

async function callCampaigns(req) {
  const { res, state } = makeRes();
  await PROMOTION_CAMPAIGNS_HANDLER(req, res);
  return state;
}

function importsReq(overrides = {}) {
  return {
    method: 'POST',
    url: '/api/promotion-imports/validate',
    body: {
      branchCode: C2_BRANCH,
      items: [{
        inventoryPn: 'SM-S938B-512',
        model: 'Galaxy S26 Ultra',
        capacity: '512GB',
        regularPrice: 54900,
        standardDiscount: 5000,
        tradeUpDiscount: 5000,
        requiresTradeIn: true,
        couponCode: 'COUPON_01',
        netPrice: 44900
      }]
    },
    query: {},
    headers: {},
    ...overrides
  };
}

async function callImports(req) {
  const { res, state } = makeRes();
  await PROMOTION_IMPORTS_HANDLER(req, res);
  return state;
}

function c1Routes(options = {}) {
  const { authOk = true, roles = [{ role: 'STORE_LEADER', branch_id: C2_BRANCH }] } = options;
  return [
    route('/auth/v1/user', authOk ? 200 : 401, authOk
      ? { id: C2_VIEWER_ID, email: 'stub.caller@ayutthaya.samsung.com', app_metadata: {} }
      : { code: 'INVALID_TOKEN' }),
    route('/rest/v1/user_roles?user_id=eq.', 200, roles),
    route('/rest/v1/promotion_campaigns', 200, [{
      id: 'stub-campaign-id',
      status: 'DRAFT',
      branch_code: C2_BRANCH
    }]),
    route('/rest/v1/promotion_validation_errors', 200, []),
    route('/rest/v1/promotion_import_batches', 200, []),
    route('/rest/v1/active_stock_snapshot', 200, []),
    route('/rest/v1/stock_snapshot_items', 200, []),
    route('/rest/v1/rpc/', 200, {})
  ];
}
async function runC1Tests() {
  console.log('\n=== C1: promotion API bypass removal ===');

  await test('campaigns: no Authorization header -> 401', async () => {
    installFetchStub(c1Routes());
    const state = await callCampaigns(campaignsReq());
    assert.strictEqual(state.statusCode, 401, `expected 401, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'AUTHENTICATION_REQUIRED', `got ${state.body.code}`);
    assert.strictEqual(upstreamCalls.length, 0, 'no upstream call before authentication');
  });

  await test('imports: mock-/pilot-/DEV token -> 401 and zero data reads', async () => {
    const bypassCredentials = [
      'PILOT_STORE_LEADER_DEV_TOKEN',
      'mock-store-leader-token',
      'pilot-store-leader-token'
    ];
    for (const credential of bypassCredentials) {
      installFetchStub(c1Routes({ authOk: false }));
      const state = await callImports(importsReq({
        headers: { authorization: `Bearer ${credential}` }
      }));
      assert.strictEqual(state.statusCode, 401, `"${credential}" expected 401, got ${state.statusCode}`);
      assert.strictEqual(state.body.code, 'UNAUTHORIZED', `"${credential}" got ${state.body.code}`);
      assert.strictEqual(postgrestCalls().length, 0, `"${credential}" must not read any table`);
      assertNoBypassIdentityUpstream(`imports "${credential}"`);
    }
  });

  await test('campaigns: mock-/pilot-/DEV token -> 401 and zero data reads', async () => {
    const bypassCredentials = [
      'PILOT_STORE_LEADER_DEV_TOKEN',
      'mock-store-leader-token',
      'pilot-store-leader-token'
    ];
    for (const credential of bypassCredentials) {
      installFetchStub(c1Routes({ authOk: false }));
      const state = await callCampaigns(campaignsReq({
        headers: { authorization: `Bearer ${credential}` }
      }));
      assert.strictEqual(state.statusCode, 401, `"${credential}" expected 401, got ${state.statusCode}`);
      assert.strictEqual(state.body.code, 'INVALID_ACCESS_TOKEN', `"${credential}" got ${state.body.code}`);
      assert.strictEqual(postgrestCalls().length, 0, `"${credential}" must not read any table`);
      assertNoBypassIdentityUpstream(`campaigns "${credential}"`);
    }
  });

  await test('campaigns: real token with no user_roles row -> 403, no fabricated identity', async () => {
    installFetchStub(c1Routes({ roles: [] }));
    const state = await callCampaigns(campaignsReq({ headers: { authorization: `Bearer ${C1_KEY}` } }));
    assert.strictEqual(state.statusCode, 403, `expected 403, got ${state.statusCode}`);
    assert.strictEqual(state.body.code, 'PROMOTION_MANAGEMENT_PERMISSION_DENIED', `got ${state.body.code}`);
  });

  await test('campaigns: real token + STORE_LEADER role -> passes authorization (200)', async () => {
    installFetchStub(c1Routes());
    const state = await callCampaigns(campaignsReq({ headers: { authorization: `Bearer ${C1_KEY}` } }));
    assert.strictEqual(state.statusCode, 200, `expected 200, got ${state.statusCode} (${JSON.stringify(state.body)})`);
  });

  await test('imports: real token + STORE_LEADER role -> passes authorization (200)', async () => {
    installFetchStub(c1Routes());
    const state = await callImports(importsReq({ headers: { authorization: `Bearer ${C1_KEY}` } }));
    assert.strictEqual(state.statusCode, 200, `expected 200, got ${state.statusCode} (${JSON.stringify(state.body)})`);
  });
}

// ============================================================================
// Source-level guarantee: no executable bypass construct remains anywhere
// ============================================================================
async function runSourceGuards() {
  console.log('\n=== Source guards (executable bypass constructs) ===');

  const files = [
    ['api', 'promotion-imports.js'],
    ['api', 'promotion-campaigns.js'],
    ['api', 'stock', 'active.js']
  ];

  await test('no bypass construct remains in executable code', async () => {
    for (const parts of files) {
      const rel = parts.join('/');
      const src = fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
      const executable = src
        .split('\n')
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .join('\n');
      for (const needle of [
        'PILOT_STORE_LEADER_DEV_TOKEN',
        "startsWith('mock-')",
        "startsWith('pilot-')",
        'SYSTEM_TECHNICAL_TEST_ACTOR',
        '00000000-0000-0000-0000-000000000001'
      ]) {
        assert.ok(!executable.includes(needle), `${rel}: bypass construct still present: ${needle}`);
      }
    }
  });

  await test('promotion-imports.js no longer escalates from unverified app_metadata', async () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'api', 'promotion-imports.js'), 'utf8');
    assert.ok(!src.includes('caller.app_metadata?.role'), 'app_metadata escalation still present');
    assert.ok(src.includes('if (!caller || !caller.id) {'), 'caller.id guard missing');
  });

  await test('api/stock/active.js never widens reads with the service key', async () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'api', 'stock', 'active.js'), 'utf8');
    assert.ok(src.includes('const queryKey = publishableKey;'), 'queryKey must be the publishable key');
    assert.ok(src.includes('const authHeaderValue = `Bearer ${token}`;'), 'reads must use the caller token');
    const executable = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    assert.ok(!executable.includes('Bearer ${publishableKey}'), 'anonymous publishable-key bearer still present');
  });

  await test('API handlers expose no NODE_ENV / VERCEL_ENV / APP_ENV gating', async () => {
    for (const parts of files) {
      const rel = parts.join('/');
      const src = fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
      for (const needle of ['NODE_ENV', 'VERCEL_ENV', 'APP_ENV']) {
        assert.ok(!src.includes(needle), `${rel}: environment gating found: ${needle}`);
      }
    }
  });
}

// ============================================================================
// Tier B (opt-in): live local child server on a non-production port
// ============================================================================
async function runTierB() {
  const baseUrl = process.env.TIER_B_BASE_URL || 'http://127.0.0.1:3099';
  console.log(`\n=== Tier B: live local server at ${baseUrl} ===`);

  if (baseUrl.includes('vercel.app')) {
    console.log('  ABORT  Tier B refuses to run against a remote/production URL.');
    failed++;
    return;
  }

  restoreFetch();

  async function live(pathname, headers) {
    const res = await fetch(`${baseUrl}${pathname}`, { headers: headers || {} });
    let body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    return { status: res.status, body };
  }

  await test('live: anonymous GET /api/stock/active -> 401', async () => {
    const out = await live(`/api/stock/active?branch_code=${C2_BRANCH}`);
    assert.strictEqual(out.status, 401, `expected 401, got ${out.status} (${JSON.stringify(out.body)})`);
    assert.ok(!out.body || !out.body.batchId, 'anonymous response must not contain a batch id');
  });

  await test('live: mock-/pilot-/DEV token -> 401', async () => {
    for (const credential of ['mock-store-leader-token', 'pilot-store-leader-token', 'PILOT_STORE_LEADER_DEV_TOKEN']) {
      const out = await live(`/api/stock/active?branch_code=${C2_BRANCH}`, {
        Authorization: `Bearer ${credential}`
      });
      assert.strictEqual(out.status, 401, `"${credential}" expected 401, got ${out.status}`);
    }
  });

  await test('live: real member token -> 200 with stock data (no regression)', async () => {
    const token = process.env.TIER_B_MEMBER_TOKEN;
    const branch = process.env.TIER_B_MEMBER_BRANCH || C2_BRANCH;
    const out = await live(`/api/stock/active?branch_code=${branch}`, { Authorization: `Bearer ${token}` });
    assert.strictEqual(out.status, 200, `expected 200, got ${out.status} (${JSON.stringify(out.body)})`);
    assert.ok(out.body && out.body.batchId, 'expected an active batch id');
    assert.ok(Array.isArray(out.body.items) && out.body.items.length > 0, 'expected stock items');
  });
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log('='.repeat(70));
  console.log('SECURITY HOTFIX C1 + C2 REGRESSION SUITE');
  console.log('='.repeat(70));

  await runC2Tests();
  await runC1Tests();
  await runSourceGuards();

  if (process.env.RUN_LIVE_TIER_B === '1') {
    if (process.env.TIER_B_MEMBER_TOKEN) {
      await runTierB();
    } else {
      skip('Tier B live verification', 'TIER_B_MEMBER_TOKEN not set');
    }
  } else {
    skip('Tier B live verification', 'set RUN_LIVE_TIER_B=1 to enable');
  }

  restoreFetch();

  console.log('\n' + '='.repeat(70));
  console.log(`RESULT: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Suite crashed:', err);
  process.exit(1);
});