/**
 * Automated Test Suite: Manager JWT End-to-End Resolution & Authority Guard
 * 
 * Matrix of Test Cases:
 * 1. Missing Token                -> 401 AUTHENTICATION_REQUIRED
 * 2. Invalid / Forged Token       -> 401 INVALID_ACCESS_TOKEN
 * 3. Sales Staff / Member Role    -> 403 PROMOTION_MANAGEMENT_PERMISSION_DENIED
 * 4. Store Leader of Other Branch -> 403 BRANCH_SCOPE_MISMATCH
 * 5. Body userId Impersonation    -> Ignored (Resolved by JWT caller ID)
 * 6. Status Conflict / Optimistic -> 409 EXPECTED_STATUS_MISMATCH
 * 7. Verified Store Leader JWT    -> 200 OK + Actor Metadata
 */

const fs = require('fs');
const path = require('path');
const errorController = require('../api/promotion-errors.js');
const campaignController = require('../api/promotion-campaigns.js');
const { loadServerEnv, loadLocalEnv } = require('./lib/load-local-env');

function createMockReqRes(options = {}) {
  const req = {
    method: options.method || 'POST',
    url: options.url || '/api/promotion-errors',
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

async function runSuite() {
  console.log('======================================================================');
  console.log('TEST SUITE: MANAGER JWT END-TO-END RESOLUTION & SECURITY GOVERNANCE');
  console.log('======================================================================\n');

  const serverEnv = loadServerEnv();
  const localEnv = loadLocalEnv();

  if (!serverEnv || !serverEnv.SUPABASE_URL || !serverEnv.SUPABASE_SECRET_KEY) {
    console.error('❌ Server environment missing in .env.feedback-pilot.server.local');
    process.exit(1);
  }

  // Populate process.env so serverless handlers have required environment variables
  for (const [k, v] of Object.entries(serverEnv)) {
    process.env[k] = v;
  }
  for (const [k, v] of Object.entries(localEnv)) {
    if (!process.env[k]) process.env[k] = v;
  }

  const supabaseUrl = serverEnv.SUPABASE_URL.replace(/\/+$/, '');
  const secretKey = serverEnv.SUPABASE_SECRET_KEY;
  const publishableKey = serverEnv.SUPABASE_PUBLISHABLE_KEY || localEnv.SUPABASE_PUBLISHABLE_KEY;

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

  // Known active campaign & resolved errors
  const CAMPAIGN_ID = '780afa93-9101-474d-a188-4c22c3633601';
  const S26_ULTRA_ERROR_ID = '6949d8fa-18f7-4ae2-832d-e7c17e62de2c';

  // Obtain Real Store Leader JWT via password grant
  console.log('--- 1. AUTHENTICATING REAL STORE LEADER ---');
  let storeLeaderToken = null;
  let storeLeaderUser = null;

  try {
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
    if (!authRes.ok) {
      throw new Error(`Auth failed: ${JSON.stringify(authData)}`);
    }

    storeLeaderToken = authData.access_token;
    storeLeaderUser = authData.user;
    console.log(`Authenticated Store Leader: ${storeLeaderUser.id} (${storeLeaderUser.email})`);
  } catch (e) {
    console.error('❌ Failed to authenticate Store Leader:', e.message);
    process.exit(1);
  }

  // Authenticate Existing Sales Staff (Member Role: cpw-staff-01@staff.internal)
  console.log('\n--- 2. AUTHENTICATING SALES STAFF (MEMBER ROLE) ---');
  let tempStaffId = '73e2b042-f6da-4bcd-99fa-9d1516cdf1eb';
  let tempStaffToken = null;

  try {
    const staffLoginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': publishableKey
      },
      body: JSON.stringify({
        email: 'cpw-staff-01@staff.internal',
        password: localEnv.TEST_MEMBER_PASSWORD
      })
    });
    const staffLoginData = await staffLoginRes.json();
    if (!staffLoginRes.ok || !staffLoginData.access_token) {
      throw new Error(`Staff login failed: ${JSON.stringify(staffLoginData)}`);
    }
    tempStaffToken = staffLoginData.access_token;
    console.log(`Authenticated Sales Staff: ${tempStaffId} (Role: MEMBER)`);
  } catch (e) {
    console.error('❌ Failed to authenticate staff user:', e.message);
  }

  // Provision Temporary Other-Branch Leader User (Branch: TEST_BRANCH_B)
  console.log('\n--- 3. PROVISIONING TEMPORARY OTHER-BRANCH LEADER ---');
  const tempOtherEmail = `test_leader_other_${Date.now()}@staff.internal`;
  const tempOtherPassword = require('crypto').randomBytes(24).toString('hex') + 'A1!';
  let tempOtherId = null;
  let tempOtherToken = null;

  try {
    const otherRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey
      },
      body: JSON.stringify({
        email: tempOtherEmail,
        password: tempOtherPassword,
        email_confirm: true,
        user_metadata: { role: 'STORE_LEADER', display_name: 'Test Leader Branch B' }
      })
    });
    const otherData = await otherRes.json();
    tempOtherId = otherData.id;

    // Insert into profiles (Foreign Key to auth.users and branches)
    await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id: tempOtherId,
        employee_code: 'TEST_B_' + Date.now().toString().slice(-4),
        display_name: 'Test Leader Branch B',
        branch_id: 'TEST_BRANCH_B',
        status: 'ACTIVE'
      })
    });

    // Assign STORE_LEADER role with branch_id: TEST_BRANCH_B
    await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: tempOtherId,
        role: 'STORE_LEADER',
        branch_id: 'TEST_BRANCH_B'
      })
    });

    // Obtain token
    const otherLoginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': publishableKey
      },
      body: JSON.stringify({
        email: tempOtherEmail,
        password: tempOtherPassword
      })
    });
    const otherLoginData = await otherLoginRes.json();
    tempOtherToken = otherLoginData.access_token;
    console.log(`Provisioned Other Branch Leader: ${tempOtherId} (Branch: TEST_BRANCH_B)`);
  } catch (e) {
    console.error('❌ Failed to provision test other-branch leader user:', e.message);
  }

  // Create Temporary Test Error Record for testing positive resolve
  console.log('\n--- 4. CREATING TEMPORARY PROMOTION ERROR RECORD ---');
  let testErrorId = null;
  try {
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/promotion_validation_errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        campaign_id: CAMPAIGN_ID,
        import_batch_id: 'ca808ba5-c749-489b-acb7-473cfc886783',
        severity: 'REVIEW_REQUIRED',
        error_code: 'TEST_JWT_RESOLVE_ERROR',
        field_name: 'model',
        source_sheet: 'Promotion',
        source_row: 999,
        inventory_pn: 'SM-TEST-E2E-PN',
        message: 'Temporary validation error for JWT End-to-End Suite',
        resolution_status: 'OPEN'
      })
    });
    const insertData = await insertRes.json();
    if (!insertRes.ok || !insertData[0]?.id) {
      throw new Error(`Insert failed: ${JSON.stringify(insertData)}`);
    }
    testErrorId = insertData[0].id;
    console.log(`Created test error: ${testErrorId}`);
  } catch (e) {
    console.error('❌ Failed to create test error:', e.message);
    process.exit(1);
  }

  console.log('\n--- 5. EXECUTING SECURITY & GOVERNANCE TEST CASES ---');

  // TEST CASE 1: Missing Token -> 401 AUTHENTICATION_REQUIRED
  {
    const { req, res } = createMockReqRes({
      url: `/api/promotion-errors/${testErrorId}/resolve`,
      query: { path: [testErrorId, 'resolve'] },
      headers: {},
      body: {
        resolutionStatus: 'REJECTED',
        resolutionCode: 'REJECTED_FOR_CURRENT_CAMPAIGN',
        resolutionNote: 'Missing token check'
      }
    });
    await errorController(req, res);
    assert(
      'Case 1: Missing Token returns 401 AUTHENTICATION_REQUIRED',
      res.statusCode === 401 && res.body?.code === 'AUTHENTICATION_REQUIRED',
      `Got ${res.statusCode} ${JSON.stringify(res.body)}`
    );
  }

  // TEST CASE 2: Invalid / Forged Token -> 401 INVALID_ACCESS_TOKEN
  {
    const { req, res } = createMockReqRes({
      url: `/api/promotion-errors/${testErrorId}/resolve`,
      query: { path: [testErrorId, 'resolve'] },
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.forged.token' },
      body: {
        resolutionStatus: 'REJECTED',
        resolutionCode: 'REJECTED_FOR_CURRENT_CAMPAIGN',
        resolutionNote: 'Invalid token check'
      }
    });
    await errorController(req, res);
    assert(
      'Case 2: Invalid Token returns 401 INVALID_ACCESS_TOKEN',
      res.statusCode === 401 && res.body?.code === 'INVALID_ACCESS_TOKEN',
      `Got ${res.statusCode} ${JSON.stringify(res.body)}`
    );
  }

  // TEST CASE 3: Sales Staff / Member Role -> 403 PROMOTION_MANAGEMENT_PERMISSION_DENIED
  {
    const { req, res } = createMockReqRes({
      url: `/api/promotion-errors/${testErrorId}/resolve`,
      query: { path: [testErrorId, 'resolve'] },
      headers: { authorization: `Bearer ${tempStaffToken}` },
      body: {
        resolutionStatus: 'REJECTED',
        resolutionCode: 'REJECTED_FOR_CURRENT_CAMPAIGN',
        resolutionNote: 'Staff resolution attempt'
      }
    });
    await errorController(req, res);
    assert(
      'Case 3: Sales Staff Role returns 403 PROMOTION_MANAGEMENT_PERMISSION_DENIED',
      res.statusCode === 403 && res.body?.code === 'PROMOTION_MANAGEMENT_PERMISSION_DENIED',
      `Got ${res.statusCode} ${JSON.stringify(res.body)}`
    );
  }

  // TEST CASE 4: Store Leader of Other Branch -> 403 BRANCH_SCOPE_MISMATCH
  {
    const { req, res } = createMockReqRes({
      url: `/api/promotion-errors/${testErrorId}/resolve`,
      query: { path: [testErrorId, 'resolve'] },
      headers: { authorization: `Bearer ${tempOtherToken}` },
      body: {
        resolutionStatus: 'REJECTED',
        resolutionCode: 'REJECTED_FOR_CURRENT_CAMPAIGN',
        resolutionNote: 'Cross-branch resolution attempt'
      }
    });
    await errorController(req, res);
    assert(
      'Case 4: Store Leader of Other Branch returns 403 BRANCH_SCOPE_MISMATCH',
      res.statusCode === 403 && res.body?.code === 'BRANCH_SCOPE_MISMATCH',
      `Got ${res.statusCode} ${JSON.stringify(res.body)}`
    );
  }

  // TEST CASE 5: Body userId Impersonation Immunity
  // Client attempts to pass a fake target userId in body; server MUST ignore it and use JWT caller.id
  {
    const fakeImpersonatedId = '00000000-0000-0000-0000-000000000099';
    const { req, res } = createMockReqRes({
      url: `/api/promotion-errors/${testErrorId}/resolve`,
      query: { path: [testErrorId, 'resolve'] },
      headers: { authorization: `Bearer ${storeLeaderToken}` },
      body: {
        userId: fakeImpersonatedId,
        p_user_id: fakeImpersonatedId,
        resolutionStatus: 'REJECTED',
        resolutionCode: 'REJECTED_FOR_CURRENT_CAMPAIGN',
        resolutionNote: 'Testing client body userId suppression and verified JWT attribution',
        expectedStatus: 'OPEN'
      }
    });
    await errorController(req, res);
    assert(
      'Case 5: Server ignores body userId and attributes strictly to JWT caller.id',
      res.statusCode === 200 &&
      res.body?.resolvedBy === storeLeaderUser.id &&
      res.body?.actorMetadata?.decisionByUserId === storeLeaderUser.id &&
      res.body?.actorMetadata?.authenticationMethod === 'VERIFIED_USER_JWT',
      `Got resolvedBy=${res.body?.resolvedBy}, expected ${storeLeaderUser.id}`
    );
  }

  // TEST CASE 6: Status Conflict / Optimistic Lock Mismatch (Double Resolve or expectedStatus mismatch)
  // Re-resolving testErrorId with expectedStatus: 'OPEN' should now fail because it is already 'REJECTED'
  {
    const { req, res } = createMockReqRes({
      url: `/api/promotion-errors/${testErrorId}/resolve`,
      query: { path: [testErrorId, 'resolve'] },
      headers: { authorization: `Bearer ${storeLeaderToken}` },
      body: {
        resolutionStatus: 'REJECTED',
        resolutionCode: 'REJECTED_FOR_CURRENT_CAMPAIGN',
        resolutionNote: 'Second concurrent resolve attempt with expectedStatus OPEN',
        expectedStatus: 'OPEN'
      }
    });
    await errorController(req, res);
    assert(
      'Case 6: Concurrent / Status Mismatch returns 409 EXPECTED_STATUS_MISMATCH',
      res.statusCode === 409 && res.body?.code === 'EXPECTED_STATUS_MISMATCH',
      `Got ${res.statusCode} ${JSON.stringify(res.body)}`
    );
  }

  // TEST CASE 7: Verification of Audit Log and Actor Metadata in Database
  {
    const auditRes = await fetch(`${supabaseUrl}/rest/v1/promotion_audit_logs?campaign_id=eq.${encodeURIComponent(CAMPAIGN_ID)}&action=eq.RESOLVE_PROMOTION_ERROR&order=performed_at.desc&limit=5`, {
      headers: {
        'apikey': secretKey,
        'Authorization': `Bearer ${secretKey}`
      }
    });
    const auditRows = await auditRes.json();
    const matchingAudit = Array.isArray(auditRows) ? auditRows.find(a => a.new_value?.errorId === testErrorId) : null;
    const actorMeta = matchingAudit?.new_value?.actorMetadata;

    assert(
      'Case 7: Audit log records verified User UUID and Actor Metadata',
      matchingAudit &&
      matchingAudit.performed_by === storeLeaderUser.id &&
      actorMeta?.decisionByUserId === storeLeaderUser.id &&
      actorMeta?.executedByActor === 'PROMOTION_SERVER_API' &&
      actorMeta?.authenticationMethod === 'VERIFIED_USER_JWT',
      `Audit entry: ${JSON.stringify(matchingAudit)}`
    );
  }

  // Cleanup: Delete temporary test records and users
  console.log('\n--- 6. CLEANING UP TEST ARTIFACTS ---');
  try {
    if (testErrorId) {
      await fetch(`${supabaseUrl}/rest/v1/promotion_validation_errors?id=eq.${encodeURIComponent(testErrorId)}`, {
        method: 'DELETE',
        headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}` }
      });
      console.log(`Cleaned up temporary test error: ${testErrorId}`);
    }

    if (tempOtherId) {
      await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(tempOtherId)}`, {
        method: 'DELETE',
        headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}` }
      });
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(tempOtherId)}`, {
        method: 'DELETE',
        headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}` }
      });
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${tempOtherId}`, {
        method: 'DELETE',
        headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}` }
      });
      console.log(`Cleaned up temporary other-branch leader user: ${tempOtherId}`);
    }
  } catch (cleanErr) {
    console.warn('⚠️ Cleanup warning:', cleanErr.message);
  }

  console.log('\n======================================================================');
  console.log(`TEST SUITE RESULTS: ${passed}/${passed + failed} PASSED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
