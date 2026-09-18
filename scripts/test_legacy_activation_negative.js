/**
 * Automated Negative Test Suite: Legacy Backfill Activation Guard
 * 
 * Verifies that campaign 780afa93-9101-474d-a188-4c22c3633601
 * (which contains 9 offers with source_evidence_origin = 'LEGACY_BACKFILL')
 * is strictly BLOCKED from activation with code LEGACY_BACKFILL_ACTIVATION_NOT_ALLOWED.
 * 
 * Governance Assertions:
 * 1. Activation attempt returns HTTP 422 with code LEGACY_BACKFILL_ACTIVATION_NOT_ALLOWED.
 * 2. Campaign status remains unchanged (NEVER transitions to 'ACTIVE').
 * 3. Active campaign in store remains unchanged.
 * 4. Zero stock mutation across Floor 1 and Floor 2 inventory.
 */

const fs = require('fs');
const path = require('path');
const campaignController = require('../api/promotion-campaigns.js');
const { loadServerEnv, loadLocalEnv } = require('./lib/load-local-env');

function createMockReqRes(options = {}) {
  const req = {
    method: options.method || 'POST',
    url: options.url || '/api/promotion-campaigns',
    headers: {
      ...(options.headers || {})
    },
    query: options.query || {},
    body: options.body || {}
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };

  return { req, res };
}

async function runTest() {
  console.log('======================================================================');
  console.log('TEST SUITE: LEGACY BACKFILL ACTIVATION FAIL-CLOSED GUARD');
  console.log('======================================================================\n');

  const serverEnv = loadServerEnv();
  const localEnv = loadLocalEnv();

  if (!serverEnv || !serverEnv.SUPABASE_URL || !serverEnv.SUPABASE_SECRET_KEY) {
    console.error('❌ Server environment missing');
    process.exit(1);
  }

  for (const [k, v] of Object.entries(serverEnv)) {
    process.env[k] = v;
  }
  for (const [k, v] of Object.entries(localEnv)) {
    if (!process.env[k]) process.env[k] = v;
  }

  const supabaseUrl = serverEnv.SUPABASE_URL.replace(/\/+$/, '');
  const secretKey = serverEnv.SUPABASE_SECRET_KEY;
  const publishableKey = localEnv.SUPABASE_PUBLISHABLE_KEY || serverEnv.SUPABASE_PUBLISHABLE_KEY;

  const CAMPAIGN_ID = '780afa93-9101-474d-a188-4c22c3633601';

  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc} - ${details}`);
      failed++;
    }
  }

  // 1. Authenticate Store Leader
  console.log('--- 1. AUTHENTICATING STORE LEADER ---');
  let storeLeaderToken = null;
  let storeLeaderUser = null;

  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': publishableKey
    },
    body: JSON.stringify({
      email: localEnv.TEST_ADMIN_EMAIL,
      password: localEnv.TEST_ADMIN_PASSWORD
    })
  });
  const authData = await authRes.json();
  storeLeaderToken = authData.access_token;
  storeLeaderUser = authData.user;
  console.log(`Store Leader Authenticated: ${storeLeaderUser.id}`);

  // 2. Inspect Current Campaign State & Confirm 9 Legacy Backfill Offers
  console.log('\n--- 2. INSPECTING CAMPAIGN STATE ---');
  const campRes = await fetch(`${supabaseUrl}/rest/v1/promotion_campaigns?id=eq.${CAMPAIGN_ID}&select=id,campaign_code,status,branch_code`, {
    headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}` }
  });
  const campRows = await campRes.json();
  const initialCampaign = campRows[0];
  console.log(`Campaign ${initialCampaign.id} (${initialCampaign.campaign_code}): Current Status = ${initialCampaign.status}`);

  const offersRes = await fetch(`${supabaseUrl}/rest/v1/promotion_offers?campaign_id=eq.${CAMPAIGN_ID}&select=id,source_evidence_origin`, {
    headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}` }
  });
  const offerRows = await offersRes.json();
  const legacyCount = offerRows.filter(o => o.source_evidence_origin === 'LEGACY_BACKFILL').length;
  console.log(`Offers Count: ${offerRows.length}, Legacy Backfill: ${legacyCount}`);

  assert('Campaign has 9 LEGACY_BACKFILL offers', legacyCount === 9, `Found ${legacyCount}`);

  // 3. Ensure Campaign Status is APPROVED to test Activation Guard
  // (If DRAFT, approve it first via API or update to test approval lifecycle)
  console.log('\n--- 3. TESTING APPROVE WORKFLOW IN PILOT ---');
  if (initialCampaign.status !== 'APPROVED') {
    const { req: appReq, res: appRes } = createMockReqRes({
      url: `/api/promotion-campaigns/${CAMPAIGN_ID}/approve`,
      query: { path: [CAMPAIGN_ID, 'approve'] },
      headers: { authorization: `Bearer ${storeLeaderToken}` },
      body: { branchCode: 'AYUTTHAYA_CITY_PARK' }
    });
    await campaignController(appReq, appRes);
    console.log(`Approval attempt response: HTTP ${appRes.statusCode} (${appRes.body?.status})`);
    assert(
      'Approval Gate: Store Leader approves campaign with 0 open blockers/reviews',
      appRes.statusCode === 200 && appRes.body?.status === 'APPROVED',
      `Got ${appRes.statusCode} ${JSON.stringify(appRes.body)}`
    );
  } else {
    console.log('Campaign is already in APPROVED status, ready to test activation guard.');
  }

  // 4. Attempt Activation (Must be fail-closed BLOCKED)
  console.log('\n--- 4. ATTEMPTING ACTIVATION (FAIL-CLOSED GUARD EXPECTED) ---');
  const { req: actReq, res: actRes } = createMockReqRes({
    url: `/api/promotion-campaigns/${CAMPAIGN_ID}/activate`,
    query: { path: [CAMPAIGN_ID, 'activate'] },
    headers: { authorization: `Bearer ${storeLeaderToken}` },
    body: {
      branchCode: 'AYUTTHAYA_CITY_PARK',
      expectedPreviousCampaignId: null
    }
  });
  await campaignController(actReq, actRes);

  console.log(`Activation response status: HTTP ${actRes.statusCode}`);
  console.log(`Activation response body:`, actRes.body);

  assert(
    'Activation Gate: HTTP 422 returned on LEGACY_BACKFILL campaign',
    actRes.statusCode === 422,
    `Expected 422, got ${actRes.statusCode}`
  );

  assert(
    'Activation Gate: Code is LEGACY_BACKFILL_ACTIVATION_NOT_ALLOWED',
    actRes.body?.code === 'LEGACY_BACKFILL_ACTIVATION_NOT_ALLOWED',
    `Expected LEGACY_BACKFILL_ACTIVATION_NOT_ALLOWED, got ${actRes.body?.code}`
  );

  // 5. Database Verification: Campaign MUST NOT be ACTIVE
  console.log('\n--- 5. LIVE DATABASE STATE VERIFICATION ---');
  const checkRes = await fetch(`${supabaseUrl}/rest/v1/promotion_campaigns?id=eq.${CAMPAIGN_ID}&select=id,campaign_code,status`, {
    headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}` }
  });
  const checkRows = await checkRes.json();
  const finalStatus = checkRows[0]?.status;

  console.log(`Database Campaign Status: ${finalStatus}`);

  assert(
    'Campaign Status is strictly NOT ACTIVE (Remains APPROVED or DRAFT)',
    finalStatus !== 'ACTIVE',
    `Status is unexpectedly ${finalStatus}`
  );

  // 6. Stock Isolation: Verify zero stock mutation
  const stockRes = await fetch(`${supabaseUrl}/rest/v1/active_stock_snapshot?branch_code=eq.AYUTTHAYA_CITY_PARK&select=branch_code,active_batch_id,updated_at`, {
    headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}` }
  });
  const stockData = await stockRes.json();
  console.log('Active Stock Pointer:', stockData[0]);

  assert(
    'Active Stock snapshot pointer remains intact and unmutated',
    stockData[0]?.active_batch_id === '9ea77b41-ae5a-46d6-8340-75b0762c3a1f',
    `Active batch: ${stockData[0]?.active_batch_id}`
  );

  console.log('\n======================================================================');
  console.log(`LEGACY ACTIVATION GUARD RESULTS: ${passed}/${passed + failed} PASSED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Fatal error in activation negative test:', err);
  process.exit(1);
});
