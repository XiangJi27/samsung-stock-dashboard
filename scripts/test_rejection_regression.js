/**
 * Samsung Branch Operations - Rejection RPC & API Regression Test Suite
 * Tests both Server API HTTP Status Mapping (422, 409, 404) and PostgreSQL Atomic Guard
 */
const fs = require('fs');
const path = require('path');

async function testRejectionRegressions() {
  console.log('======================================================================');
  console.log('SAMSUNG BRANCH OPERATIONS - REJECTION API & RPC REGRESSION SUITE');
  console.log('======================================================================\n');

  const envPath = path.join(__dirname, '..', '.env.feedback-pilot.server.local');
  const env = fs.readFileSync(envPath, 'utf8');
  const supabaseUrl = env.match(/SUPABASE_URL=(.*)/)[1].trim().replace(/\/+$/, '');
  const secretKey = env.match(/SUPABASE_SECRET_KEY=(.*)/)[1].trim();

  process.env.SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SECRET_KEY = secretKey;

  const campaignHandler = require('../api/promotion-campaigns.js');
  const rejectedCampaignId = '07363cc4-49ed-436e-afea-6ddcfcfa1426';

  async function invokeApiReject(campaignId, body) {
    let statusCode = 500;
    let responseData = null;
    const req = {
      method: 'POST',
      url: `http://localhost/api/promotion-campaigns/${campaignId}/reject`,
      headers: {
        authorization: 'Bearer PILOT_STORE_LEADER_DEV_TOKEN',
        'content-type': 'application/json'
      },
      body
    };
    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
            return data;
          }
        };
      }
    };
    await campaignHandler(req, res);
    return { status: statusCode, data: responseData };
  }

  // 1. Missing Reason Check -> HTTP 422 REJECTION_REASON_REQUIRED
  const t1 = await invokeApiReject(rejectedCampaignId, {
    reason: '   ',
    expectedStatus: null
  });
  console.log('1. REJECTION_REASON_REQUIRED:');
  console.log(`   HTTP Status: ${t1.status} (Expected: 422) | Code: ${t1.data?.code}`);
  const pass1 = t1.status === 422 && t1.data?.code === 'REJECTION_REASON_REQUIRED';
  console.log(`   Result: ${pass1 ? '✅ PASS (HTTP 422 Mapped)' : '❌ FAIL'}\n`);

  // 2. Campaign Already Rejected Check -> HTTP 409 CAMPAIGN_ALREADY_REJECTED
  const t2 = await invokeApiReject(rejectedCampaignId, {
    reason: 'Repeated rejection attempt',
    expectedStatus: 'REJECTED'
  });
  console.log('2. CAMPAIGN_ALREADY_REJECTED:');
  console.log(`   HTTP Status: ${t2.status} (Expected: 409) | Code: ${t2.data?.code}`);
  const pass2 = t2.status === 409 && t2.data?.code === 'CAMPAIGN_ALREADY_REJECTED';
  console.log(`   Result: ${pass2 ? '✅ PASS (HTTP 409 Mapped)' : '❌ FAIL'}\n`);

  // 3. Expected Status Mismatch Check -> HTTP 409 EXPECTED_CAMPAIGN_STATUS_MISMATCH
  const t3 = await invokeApiReject(rejectedCampaignId, {
    reason: 'Optimistic lock testing',
    expectedStatus: 'DRAFT'
  });
  console.log('3. EXPECTED_CAMPAIGN_STATUS_MISMATCH:');
  console.log(`   HTTP Status: ${t3.status} (Expected: 409) | Code: ${t3.data?.code}`);
  const pass3 = t3.status === 409 && t3.data?.code === 'EXPECTED_CAMPAIGN_STATUS_MISMATCH';
  console.log(`   Result: ${pass3 ? '✅ PASS (HTTP 409 Mapped)' : '❌ FAIL'}\n`);

  // 4. Non-Existent Campaign Check -> HTTP 404 CAMPAIGN_NOT_FOUND
  const t4 = await invokeApiReject('00000000-0000-0000-0000-999999999999', {
    reason: 'Non existent campaign',
    expectedStatus: null
  });
  console.log('4. CAMPAIGN_NOT_FOUND:');
  console.log(`   HTTP Status: ${t4.status} (Expected: 404) | Code: ${t4.data?.code}`);
  const pass4 = t4.status === 404 && t4.data?.code === 'CAMPAIGN_NOT_FOUND';
  console.log(`   Result: ${pass4 ? '✅ PASS (HTTP 404 Mapped)' : '❌ FAIL'}\n`);

  // 5. Active Stock Snapshot Immutability (Zero Mutation)
  const sRes = await fetch(`${supabaseUrl}/rest/v1/active_stock_snapshot?branch_code=eq.AYUTTHAYA_CITY_PARK&select=active_batch_id`, {
    headers: { apikey: secretKey, Authorization: 'Bearer ' + secretKey }
  });
  const stockSnapshot = (await sRes.json())[0];
  const pass5 = stockSnapshot?.active_batch_id === '9ea77b41-ae5a-46d6-8340-75b0762c3a1f';
  console.log('5. Active Stock Snapshot Immutability:');
  console.log(`   Active Batch: ${stockSnapshot?.active_batch_id}`);
  console.log(`   Result: ${pass5 ? '✅ PASS (Zero Mutation)' : '❌ FAIL'}\n`);

  const allPass = pass1 && pass2 && pass3 && pass4 && pass5;
  console.log(`======================================================================`);
  console.log(`Regression Test Summary: ${allPass ? '🎉 ALL 5 REGRESSION TESTS PASSED (HTTP 422, 409, 404 VERIFIED)' : '❌ REGRESSION FAILURES'}`);
  console.log(`======================================================================\n`);
}

testRejectionRegressions();
