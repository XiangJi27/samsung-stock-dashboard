'use strict';
/**
 * Security Hardening Regression Suite: C3 (Gate 2) - Vision Proxy.
 *
 * Scope: api/vision-proxy.js only (plus the directly related frontend caller
 * and staging copies). Proves:
 *  - Fail-closed Bearer authentication (mock-/pilot-/DEV token rejection).
 *  - Authorization derived solely from the trusted user_roles table.
 *  - Strict payload validation (MIME, size, field allowlist, malformed data).
 *  - Per-user in-memory rate limiting keyed by user id (not the raw token).
 *  - Sanitized upstream error contract (no raw provider bodies / leaks).
 *  - Upstream is never invoked when authentication or payload validation fails.
 *
 * Fully offline (Tier A): drives the real handler with a scripted fetch
 * transport. No production credentials, no network.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const STUB_URL = 'https://stub.supabase.co';
const STUB_PUBLISHABLE_KEY = 'sb_publishable_STUB_ONLY_NOT_A_REAL_KEY';
const STUB_SECRET_KEY = 'sb_secret_STUB_ONLY_MUST_NEVER_BE_SENT';

process.env.SUPABASE_URL = STUB_URL;
process.env.SUPABASE_PUBLISHABLE_KEY = STUB_PUBLISHABLE_KEY;
process.env.SUPABASE_SECRET_KEY = STUB_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
// Stub upstream key so the handler passes its config gate WITHOUT touching the
// real production key. fetch is fully stubbed before any anthropic call.
process.env.CLAUDE_API_KEY = 'stub-claude-key-not-production';
// A high default so the broader auth/payload/upstream suites never hit 429.
// runRateLimitTests() temporarily lowers it to exercise the limiter.
process.env.VISION_PROXY_MAX_IMAGE_BYTES = '2048';
process.env.VISION_PROXY_RATE_LIMIT_PER_MIN = '10000';

const VISION_HANDLER = require(path.join(REPO_ROOT, 'api', 'vision-proxy.js'));

let passed = 0;
let failed = 0;

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

const realFetch = global.fetch;
let upstreamCalls = [];
let activeRoutes = [];

function route(fragment, status, body) {
  return { fragment, status, body };
}

// routes take precedence by order; a special '__UPSTREAM__' marker lets a test
// supply a bespoke function for the final vision upstream call.
let upstreamStdFn = null;

function installFetchStub(routes, upstreamFn) {
  upstreamCalls = [];
  activeRoutes = routes;
  upstreamStdFn = upstreamFn || null;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    const headers = (options && options.headers) || {};
    upstreamCalls.push({ url: target, headers, options, body: options.body });
    if (target.includes('api.anthropic.com')) {
      if (upstreamStdFn) {
        return upstreamStdFn({ url: target, headers, options });
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: 'text', text: '{"overallConfidence":0.9}' }] }),
        text: async () => '{"ok":true}'
      };
    }
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
    setHeader(k, v) { state.headers[k] = v; },
    status(code) { state.statusCode = code; return res; },
    json(payload) { state.body = payload; return res; }
  };
  return { res, state };
}

function postgrestCalls() {
  return upstreamCalls.filter((c) => c.url.includes('/rest/v1/'));
}

function authFlowCalls() {
  return upstreamCalls.filter((c) => c.url.includes('/auth/v1/'));
}

function anthropicCalls() {
  return upstreamCalls.filter((c) => c.url.includes('api.anthropic.com'));
}

function serializedCalls() {
  return JSON.stringify(upstreamCalls.map((c) => ({ url: c.url, headers: c.headers })));
}
// ----------------------------------------------------------------------------
// Request / route builders
// ----------------------------------------------------------------------------
const BRANCH = 'AYUTTHAYA_CITY_PARK';
const OTHER_BRANCH = 'CHIANG_MAI';
const VALID_TOKEN = 'stub-valid-caller-jwt';
const CALLER_ID = '33333333-4444-5555-6666-777777777777';

function base64OfLength(bytes) {
  // Minimal valid base64 that decodes to >= bytes.
  const chars = Math.ceil((bytes * 4) / 3);
  return 'A'.repeat(Math.max(1, chars));
}

function vReq(overrides = {}) {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${VALID_TOKEN}` },
    body: {
      imageBase64: base64OfLength(128),
      mimeType: 'image/jpeg',
      filename: 'flyer.jpg'
    },
    ...overrides
  };
}

async function callVision(req) {
  const { res, state } = makeRes();
  await VISION_HANDLER(req, res);
  return state;
}

function validRoutes(options = {}) {
  const {
    roles = [{ role: 'STORE_LEADER', branch_id: BRANCH }],
    rolesStatus = 200,
    authOk = true,
    authStatus = 200,
    authDead = false
  } = options;
  const routes = [];
  if (authDead) {
    routes.push(route('/auth/v1/user', 500, { message: 'boom' }));
  } else {
    routes.push(route('/auth/v1/user', authOk ? 200 : authStatus, authOk
      ? { id: CALLER_ID, email: 'stub.caller@ayutthaya.samsung.com', app_metadata: {} }
      : { code: 'INVALID_TOKEN' }));
  }
  routes.push(route('/rest/v1/user_roles?user_id=eq.', rolesStatus,
    rolesStatus === 200 ? roles : { message: 'stub role failure' }));
  return routes;
}
// ============================================================================
// AUTH tests
// ============================================================================
async function runAuthTests() {
  console.log('\n=== C3 AUTH: vision proxy authentication ===');

  await test('missing token -> 401 AUTHENTICATION_REQUIRED, no upstream', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ headers: {} }));
    assert.strictEqual(state.statusCode, 401, `expected 401 got ${state.statusCode}`);
    assert.strictEqual(state.body.error, 'AUTHENTICATION_REQUIRED');
    assert.strictEqual(anthropicCalls().length, 0, 'upstream must not be called');
    assert.strictEqual(postgrestCalls().length, 0, 'no DB read before auth');
  });

  await test('malformed bearer header -> 401 AUTHENTICATION_REQUIRED', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ headers: { authorization: 'Basic abc123' } }));
    assert.strictEqual(state.statusCode, 401);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('empty Authorization value -> 401 AUTHENTICATION_REQUIRED', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ headers: { authorization: 'Bearer   ' } }));
    assert.strictEqual(state.statusCode, 401);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('invalid token (identity 400) -> 401 AUTHENTICATION_REQUIRED', async () => {
    installFetchStub(validRoutes({ authOk: false, authStatus: 400 }));
    const state = await callVision(vReq({ headers: { authorization: 'Bearer definitely-not-a-real-jwt' } }));
    assert.strictEqual(state.statusCode, 401);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('expired token (identity 401) -> 401 AUTHENTICATION_REQUIRED', async () => {
    installFetchStub(validRoutes({ authOk: false, authStatus: 401 }));
    const state = await callVision(vReq({ headers: { authorization: 'Bearer expired-jwt' } }));
    assert.strictEqual(state.statusCode, 401);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('identity endpoint error -> 401 (fail closed, never allow)', async () => {
    installFetchStub(validRoutes({ authDead: true }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 401);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  for (const credential of ['mock-store-leader-token', 'mock-another', 'pilot-store-leader-token', 'pilot-another', 'PILOT_STORE_LEADER_DEV_TOKEN']) {
    await test(`dev/mock bypass token rejected -> 401 (${credential})`, async () => {
      installFetchStub(validRoutes());
      const state = await callVision(vReq({ headers: { authorization: `Bearer ${credential}` } }));
      assert.strictEqual(state.statusCode, 401, `expected 401 got ${state.statusCode}`);
      assert.strictEqual(anthropicCalls().length, 0, 'bypass token must not reach upstream');
    });
  }

  await test('valid unauthorized role (different branch) -> 403 PERMISSION_DENIED', async () => {
    installFetchStub(validRoutes({ roles: [{ role: 'STORE_LEADER', branch_id: OTHER_BRANCH }] }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 403, `expected 403 got ${state.statusCode}`);
    assert.strictEqual(state.body.error, 'PERMISSION_DENIED');
    assert.strictEqual(anthropicCalls().length, 0, 'unauthorized must not reach upstream');
  });

  await test('valid authorized role (same branch) -> proceeds to upstream', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 200, `expected 200 got ${state.statusCode}`);
    assert.strictEqual(anthropicCalls().length, 1, 'upstream should be invoked exactly once');
  });

  await test('role lookup failure -> 403 PERMISSION_DENIED (fail closed, not allow)', async () => {
    installFetchStub(validRoutes({ rolesStatus: 500 }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 403);
    assert.strictEqual(state.body.error, 'PERMISSION_DENIED');
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('empty role result -> 403 PERMISSION_DENIED (fail closed)', async () => {
    installFetchStub(validRoutes({ roles: [] }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 403);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('null-branch role (non-admin) -> 403 PERMISSION_DENIED (null fails closed)', async () => {
    installFetchStub(validRoutes({ roles: [{ role: 'STORE_LEADER', branch_id: null }] }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 403);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('unknown role name -> 403 PERMISSION_DENIED', async () => {
    installFetchStub(validRoutes({ roles: [{ role: 'NINJA', branch_id: BRANCH }] }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 403);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('SYSTEM_ADMIN global role -> allowed', async () => {
    installFetchStub(validRoutes({ roles: [{ role: 'SYSTEM_ADMIN', branch_id: null }] }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 200, `expected 200 got ${state.statusCode}`);
  });

  await test('app_metadata role cannot authorize without user_roles (fail closed)', async () => {
    // Identity returns an app_metadata with an "admin" claim, but user_roles is empty.
    installFetchStub(validRoutes({ roles: [] }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 403, `expected 403 got ${state.statusCode}`);
    assert.strictEqual(anthropicCalls().length, 0);
  });
}

// ============================================================================
// PAYLOAD tests
// ============================================================================
async function runPayloadTests() {
  console.log('\n=== C3 PAYLOAD: vision proxy payload validation ===');

  async function expectClosed(code, status, reqOverrides, routesOpts) {
    installFetchStub(validRoutes(routesOpts || {}));
    const state = await callVision(vReq(reqOverrides));
    assert.strictEqual(state.statusCode, status, `expected ${status} got ${state.statusCode}`);
    assert.strictEqual(state.body.error, code);
    assert.strictEqual(anthropicCalls().length, 0, 'upstream must not be called on invalid payload');
  }

  await test('missing imageBase64 -> 400 INVALID_REQUEST', async () => {
    const { imageBase64, ...rest } = vReq().body;
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ body: rest }));
    assert.strictEqual(state.statusCode, 400);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('empty imageBase64 -> 400 INVALID_REQUEST', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ body: { ...vReq().body, imageBase64: '' } }));
    assert.strictEqual(state.statusCode, 400);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('non-string imageBase64 -> 400 INVALID_REQUEST', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ body: { ...vReq().body, imageBase64: 12345 } }));
    assert.strictEqual(state.statusCode, 400);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('malformed Data URL (data:image/jpeg;base64,...) -> 400 INVALID_REQUEST', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({
      body: { ...vReq().body, imageBase64: 'data:image/jpeg;base64,AAAA' }
    }));
    assert.strictEqual(state.statusCode, 400);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('base64 with whitespace -> 400 INVALID_REQUEST', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ body: { ...vReq().body, imageBase64: 'AB CD' } }));
    assert.strictEqual(state.statusCode, 400);
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('unsupported MIME type -> 415 UNSUPPORTED_IMAGE_TYPE', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ body: { ...vReq().body, mimeType: 'image/gif' } }));
    assert.strictEqual(state.statusCode, 415);
    assert.strictEqual(state.body.error, 'UNSUPPORTED_IMAGE_TYPE');
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('supported MIME png -> proceeds to upstream', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ body: { ...vReq().body, mimeType: 'image/png' } }));
    assert.strictEqual(state.statusCode, 200);
    assert.strictEqual(anthropicCalls().length, 1);
  });

  await test('supported MIME webp -> proceeds to upstream', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ body: { ...vReq().body, mimeType: 'image/webp' } }));
    assert.strictEqual(state.statusCode, 200);
    assert.strictEqual(anthropicCalls().length, 1);
  });

  await test('uppercase MIME normalized -> accepted', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ body: { ...vReq().body, mimeType: 'IMAGE/PNG' } }));
    assert.strictEqual(state.statusCode, 200);
  });

  await test('unexpected field rejected (strict contract)', async () => {
    installFetchStub(validRoutes());
    const state = await callVision(vReq({ body: { ...vReq().body, evil: 'nope' } }));
    assert.strictEqual(state.statusCode, 400);
    assert.strictEqual(state.body.error, 'INVALID_REQUEST');
    assert.strictEqual(anthropicCalls().length, 0);
  });

  await test('valid image payload exactly at limit -> 200', async () => {
    // env VISION_PROXY_MAX_IMAGE_BYTES=2048; craft a payload decoding to exactly 2048 bytes.
    installFetchStub(validRoutes());
    const exactly = base64OfLength(2048);
    const state = await callVision(vReq({ body: { ...vReq().body, imageBase64: exactly } }));
    assert.strictEqual(state.statusCode, 200, `expected 200 got ${state.statusCode}`);
    assert.strictEqual(anthropicCalls().length, 1);
  });

  await test('payload above limit -> 413 IMAGE_TOO_LARGE, upstream not called', async () => {
    installFetchStub(validRoutes());
    const above = base64OfLength(2049);
    const state = await callVision(vReq({ body: { ...vReq().body, imageBase64: above } }));
    assert.strictEqual(state.statusCode, 413, `expected 413 got ${state.statusCode}`);
    assert.strictEqual(state.body.error, 'IMAGE_TOO_LARGE');
    assert.strictEqual(anthropicCalls().length, 0);
  });
}

// ============================================================================
// RATE LIMIT tests
// ============================================================================
// The limiter is keyed by user id and persists for the module lifetime, and the
// window is 60s, so every scenario below uses its own FRESH user id to avoid
// interference from earlier tests (which legitimately consume the default id's
// bucket on 200-returning cases).
async function runRateLimitTests() {
  console.log('\n=== C3 RATE LIMIT: vision proxy per-user limiter ===');
  // Lower the env limit so the limiter actually triggers within this suite.
  process.env.VISION_PROXY_RATE_LIMIT_PER_MIN = '3';

  function freshUser(id) {
    const routes = validRoutes();
    routes[0] = route('/auth/v1/user', 200, { id, email: 'rate@x', app_metadata: {} });
    return routes;
  }

  await test('requests below threshold succeed (3 allowed)', async () => {
    installFetchStub(freshUser('RL-OK-USER-0001'));
    const r = [];
    for (let i = 0; i < 3; i++) r.push((await callVision(vReq())).statusCode);
    assert.strictEqual(r[0], 200, `expected 200 got ${r[0]}`);
    assert.strictEqual(r[2], 200, `expected 200 got ${r[2]}`);
  });

  await test('request above threshold -> 429 RATE_LIMITED (same user)', async () => {
    installFetchStub(freshUser('RL-OVER-USER-0002'));
    const r = [];
    for (let i = 0; i < 5; i++) r.push((await callVision(vReq())).statusCode);
    assert.strictEqual(r[0], 200, `expected 200 got ${r[0]}`);
    assert.strictEqual(r[2], 200, `expected 200 got ${r[2]}`);
    assert.strictEqual(r[3], 429, `expected 429 got ${r[3]}`);
    assert.strictEqual(r[4], 429, `expected 429 got ${r[4]}`);
    // Sanitized stable code on the 429 body.
    installFetchStub(freshUser('RL-OVER-USER-0002'));
    const body = (await callVision(vReq())).body;
    assert.strictEqual(body.error, 'RATE_LIMITED');
  });

  await test('different user ids do not share one local bucket', async () => {
    installFetchStub(freshUser('RL-A-USER-0003'));
    const a = [];
    for (let i = 0; i < 3; i++) a.push((await callVision(vReq())).statusCode);
    assert.strictEqual(a[2], 200, `expected 200 got ${a[2]}`);
    // fresh user B can still do 3 more independently
    installFetchStub(freshUser('RL-B-USER-0004'));
    const b = [];
    for (let i = 0; i < 3; i++) b.push((await callVision(vReq())).statusCode);
    assert.strictEqual(b[2], 200, `expected 200 got ${b[2]}`);
  });

  await test('limiter keyed by user id, not raw Authorization token', async () => {
    // Same user id across rotating tokens must share one bucket.
    const userId = 'RL-SHARED-USER-0005';
    installFetchStub(freshUser(userId));
    const r = [];
    for (let i = 0; i < 3; i++) {
      r.push((await callVision(vReq({ headers: { authorization: `Bearer token-A-${i}` } }))).statusCode);
    }
    assert.strictEqual(r[2], 200, `expected 200 got ${r[2]}`);
    // 4th call, new token text but SAME user id -> shares bucket -> 429.
    const fourth = (await callVision(vReq({ headers: { authorization: 'Bearer token-A-fresh' } }))).statusCode;
    assert.strictEqual(fourth, 429, `expected 429 got ${fourth}`);
  });
}
// ============================================================================
// UPSTREAM tests
// ============================================================================
async function runUpstreamTests() {
  console.log('\n=== C3 UPSTREAM: sanitized upstream contract ===');

  // Use a fresh user per case, and a low-size payload to keep it fast.
  function freshValid(id) {
    const routes = validRoutes();
    routes[0] = route('/auth/v1/user', 200, { id, email: 'up@x', app_metadata: {} });
    return routes;
  }

  function upFail(status, body) {
    return async () => ({
      ok: false,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body)
    });
  }

  await test('upstream success -> sanitized subset (only text content)', async () => {
    installFetchStub(freshValid('UP-SUCC-USER-001'), async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: '{"overallConfidence":0.9}' }],
        id: 'msg_upstream_secret_id',
        usage: { input_tokens: 9999, output_tokens: 99 },
        model: 'secret-model',
        organization_id: 'org_SAMSUNG'
      }),
      text: async () => 'irrelevant'
    }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 200, `expected 200 got ${state.statusCode}`);
    assert.ok(state.body.content && state.body.content[0].text, 'expected text content');
    const str = JSON.stringify(state.body);
    assert.ok(!str.includes('msg_upstream_secret_id'), 'leaked upstream message id');
    assert.ok(!str.includes('org_SAMSUNG'), 'leaked organization id');
    assert.ok(!str.includes('secret-model'), 'leaked upstream model identifier');
    assert.ok(!str.includes('input_tokens'), 'leaked usage');
    assert.ok(!str.includes('output_tokens'), 'leaked usage');
  });

  await test('upstream 4xx mapped to 502 VISION_UPSTREAM_ERROR (no raw body)', async () => {
    installFetchStub(freshValid('UP-4XX-USER-002'), upFail(429, {
      error: { type: 'overloaded_error', message: 'slow down' },
      type: 'rate_limit_error'
    }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 502, `expected 502 got ${state.statusCode}`);
    assert.strictEqual(state.body.error, 'VISION_UPSTREAM_ERROR');
    const str = JSON.stringify(state.body);
    assert.ok(!str.includes('overloaded_error'), 'leaked provider error type');
    assert.ok(!str.includes('rate_limit_error'), 'leaked provider error type');
    assert.ok(!str.includes('slow down'), 'leaked provider message');
  });

  await test('upstream 5xx -> 502 VISION_UPSTREAM_ERROR', async () => {
    installFetchStub(freshValid('UP-5XX-USER-003'), upFail(500, { error: { message: 'internal boom' } }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 502);
    assert.strictEqual(state.body.error, 'VISION_UPSTREAM_ERROR');
    assert.ok(!JSON.stringify(state.body).includes('internal boom'));
  });

  await test('malformed upstream response (no text content) -> 502', async () => {
    installFetchStub(freshValid('UP-MALF-USER-004'), async () => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [] }),
      text: async () => '{}'
    }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 502);
    assert.strictEqual(state.body.error, 'VISION_UPSTREAM_ERROR');
  });

  await test('malformed upstream response (bad json) -> 502', async () => {
    installFetchStub(freshValid('UP-BADJSON-USER-005'), async () => {
      const o = { ok: true, status: 200 };
      o.json = async () => { throw new Error('Unexpected end of JSON input'); };
      o.text = async () => 'not-json';
      return o;
    });
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 502);
    assert.strictEqual(state.body.error, 'VISION_UPSTREAM_ERROR');
  });

  await test('network failure -> 502 VISION_UPSTREAM_ERROR', async () => {
    installFetchStub(freshValid('UP-NET-USER-006'), async () => {
      throw new Error('ECONNREFUSED to api.anthropic.com');
    });
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 502);
    assert.strictEqual(state.body.error, 'VISION_UPSTREAM_ERROR');
    assert.ok(!JSON.stringify(state.body).includes('ECONNREFUSED'), 'leaked network error detail');
  });

  await test('timeout -> 504 VISION_UPSTREAM_TIMEOUT', async () => {
    process.env.VISION_PROXY_TIMEOUT_MS = '5';
    installFetchStub(freshValid('UP-TIMEOUT-USER-007'), async () => new Promise(() => {}));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 504, `expected 504 got ${state.statusCode}`);
    assert.strictEqual(state.body.error, 'VISION_UPSTREAM_TIMEOUT');
    delete process.env.VISION_PROXY_TIMEOUT_MS;
  });

  await test('raw upstream metadata body never appears in client response', async () => {
    const secretBody = JSON.stringify({
      content: [{ type: 'text', text: '{"ok":true}' }],
      id: 'msg_zzz_secret_id',
      usage: { input_tokens: 1, output_tokens: 2 },
      organization_id: 'org_RAW_SECRET_ORG'
    });
    installFetchStub(freshValid('UP-RAW-USER-008'), async () => ({
      ok: true,
      status: 200,
      json: async () => JSON.parse(secretBody),
      text: async () => secretBody
    }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 200);
    const str = JSON.stringify(state.body);
    assert.ok(!str.includes('msg_zzz_secret_id'), 'upstream message id leaked');
    assert.ok(!str.includes('org_RAW_SECRET_ORG'), 'upstream organization leaked');
    assert.ok(!str.includes('input_tokens') && !str.includes('output_tokens'), 'upstream usage leaked');
  });

  await test('secrets never appear in client response', async () => {
    installFetchStub(freshValid('UP-SECRET-USER-009'), upFail(401, {
      error: { type: 'authentication_error', message: 'invalid x-api-key' }
    }));
    const state = await callVision(vReq());
    assert.strictEqual(state.statusCode, 502);
    for (const needle of ['x-api-key', 'apiKey', 'invalid x-api-key', STUB_SECRET_KEY]) {
      assert.ok(!JSON.stringify(state.body).includes(needle), `secret leak: ${needle}`);
    }
  });
}

// ============================================================================
// Source guards (static assertions on the built file)
// ============================================================================
async function runSourceGuards() {
  console.log('\n=== C3 SOURCE GUARDS: statically verified invariants ===');
  const src = fs.readFileSync(path.join(REPO_ROOT, 'api', 'vision-proxy.js'), 'utf8');
  const executable = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  const checks = [
    ['requires Bearer auth', src.includes('AUTHENTICATION_REQUIRED')],
    ['authorization from user_roles', src.includes('user_roles?user_id=eq.')],
    ['no app_metadata authority in executable', !executable.includes('app_metadata')],
    ['payload string check', src.includes("typeof imageBase64 !== 'string'")],
    ['MIME allowlist jpeg', src.includes("'image/jpeg'")],
    ['MIME allowlist png', src.includes("'image/png'")],
    ['MIME allowlist webp', src.includes("'image/webp'")],
    ['413 IMAGE_TOO_LARGE', src.includes('IMAGE_TOO_LARGE')],
    ['429 RATE_LIMITED', src.includes('RATE_LIMITED')],
    ['502 VISION_UPSTREAM_ERROR', src.includes('VISION_UPSTREAM_ERROR')],
    ['504 VISION_UPSTREAM_TIMEOUT', src.includes('VISION_UPSTREAM_TIMEOUT')],
    ['field allowlist', src.includes('ALLOWED_FIELDS')],
    ['unsupported mime 415', src.includes('UNSUPPORTED_IMAGE_TYPE')],
    ['rate limiter active', src.includes('rateLimitCheck(')]
  ];
  for (const [n, ok] of checks) await test(n, () => { assert.strictEqual(ok, true); });
}
// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log('='.repeat(70));
  console.log('SECURITY HARDENING C3 (GATE 2) — VISION PROXY SUITE');
  console.log('='.repeat(70));
  await runAuthTests();
  await runPayloadTests();
  await runRateLimitTests();
  // Restore a permissive limit for the upstream suite (fresh users observed).
  process.env.VISION_PROXY_RATE_LIMIT_PER_MIN = '10000';
  await runUpstreamTests();
  await runSourceGuards();
  restoreFetch();
  console.log('\n' + '='.repeat(70));
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Suite crashed:', err);
  process.exit(1);
});
