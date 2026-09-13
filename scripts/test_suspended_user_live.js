/**
 * Suspended Account Real Token Revocation & RLS Gate Test Runner
 * Target: Validates Gate 4 (Database-Level status = 'ACTIVE' Enforcement)
 * 
 * 10-Step Lifecycle:
 * 1. Member signs in successfully -> obtains valid JWT access token.
 * 2. Member queries branches/profile and creates an issue -> succeeds.
 * 3. Member JWT access token is preserved in test process.
 * 4. Admin toggles profiles.status to 'SUSPENDED'.
 * 5. Using the UNEXPIRED original JWT, Member calls Data API.
 * 6. SELECT issues -> returned empty array or 401/403 (RLS private.is_active_user blocked).
 * 7. INSERT issue -> rejected with 401/403.
 * 8. INSERT comment -> rejected with 401/403.
 * 9. RPC update_own_display_name -> rejected with 400/403/P0001.
 * 10. Post-test cleanup: Profile status restored to 'ACTIVE'.
 */

const { loadLocalEnv, loadServerEnv } = require('./lib/load-local-env');
const { TestUserSession } = require('./lib/test-user-session');
const { redactToken, redactUuid, redactEmail, redactUrl } = require('./lib/redact-test-output');

function setupMockSuspendedEngine() {
  let memberStatus = 'ACTIVE';
  let memberToken = 'mock_suspended_test_jwt';
  const memberId = '00000000-0000-0000-0000-000000000001';
  const adminId = '00000000-0000-0000-0000-000000000099';

  const originalFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const urlStr = String(url);
    const u = new URL(urlStr);
    const pathname = u.pathname;
    const authHeader = opts.headers?.Authorization || opts.headers?.authorization || '';
    const method = (opts.method || 'GET').toUpperCase();

    // 1. Auth Sign-in
    if (pathname.includes('/auth/v1/token')) {
      const body = JSON.parse(opts.body || '{}');
      const email = body.email || 'test_m1@store.local';
      const isAdmin = email.includes('admin');
      const targetId = isAdmin ? adminId : memberId;
      const targetToken = isAdmin ? 'mock_admin_jwt' : memberToken;

      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({
          access_token: targetToken,
          user: { id: targetId, email }
        }),
        json: async () => ({
          access_token: targetToken,
          user: { id: targetId, email }
        })
      };
    }

    // 2. Admin Toggle Profile Status
    if (pathname.includes('/rest/v1/profiles') && method === 'PATCH') {
      const body = JSON.parse(opts.body || '{}');
      if (body.status) {
        memberStatus = body.status;
      }
      return { status: 200, ok: true, text: async () => '[]', json: async () => [] };
    }

    // 3. Profiles GET
    if (pathname.includes('/rest/v1/profiles') && method === 'GET') {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify([{ id: memberId, status: memberStatus, branch_id: 'AYUTTHAYA_CITY_PARK' }]),
        json: async () => ([{ id: memberId, status: memberStatus, branch_id: 'AYUTTHAYA_CITY_PARK' }])
      };
    }

    // 4. Issues Endpoints
    if (pathname.includes('/rest/v1/issues')) {
      if (memberStatus === 'SUSPENDED') {
        if (method === 'GET') {
          // RLS with private.is_active_user() returns 0 rows
          return { status: 200, ok: true, text: async () => '[]', json: async () => [] };
        }
        if (method === 'POST') {
          return { status: 403, ok: false, text: async () => '{"message":"Forbidden: User account is suspended or inactive."}', json: async () => ({ message: 'Forbidden' }) };
        }
      } else {
        if (method === 'POST') {
          return {
            status: 201,
            ok: true,
            text: async () => JSON.stringify([{ id: 'iss_001', issue_number: 'ISS-2026-00001', status: 'NEW' }]),
            json: async () => ([{ id: 'iss_001', issue_number: 'ISS-2026-00001', status: 'NEW' }])
          };
        }
        if (method === 'GET') {
          return {
            status: 200,
            ok: true,
            text: async () => JSON.stringify([{ id: 'iss_001', issue_number: 'ISS-2026-00001', status: 'NEW' }]),
            json: async () => ([{ id: 'iss_001', issue_number: 'ISS-2026-00001', status: 'NEW' }])
          };
        }
        if (method === 'DELETE') {
          return { status: 204, ok: true, text: async () => '', json: async () => null };
        }
      }
    }

    // 5. Issue Comments Endpoints
    if (pathname.includes('/rest/v1/issue_comments')) {
      if (memberStatus === 'SUSPENDED') {
        return { status: 403, ok: false, text: async () => '{"message":"Forbidden: inactive"}' };
      }
      return { status: 201, ok: true, text: async () => '[]', json: async () => [] };
    }

    // 6. User Roles Endpoints
    if (pathname.includes('/rest/v1/user_roles')) {
      if (memberStatus === 'SUSPENDED') {
        return { status: 200, ok: true, text: async () => '[]', json: async () => [] };
      }
      return { status: 200, ok: true, text: async () => '[{"role":"MEMBER"}]', json: async () => ([{ role: 'MEMBER' }]) };
    }

    // 7. RPC update_own_display_name
    if (pathname.includes('/rest/v1/rpc/update_own_display_name')) {
      if (memberStatus === 'SUSPENDED') {
        return { status: 403, ok: false, text: async () => '{"message":"Forbidden: User account is suspended or inactive."}' };
      }
      return { status: 200, ok: true, text: async () => '""', json: async () => '' };
    }

    return { status: 404, ok: false, text: async () => '{"message":"Not found"}' };
  };

  return () => { global.fetch = originalFetch; };
}

async function runSuspendedUserTest() {
  const mode = process.argv.find(a => a.startsWith('--mode='))?.split('=')[1] || (process.argv.includes('--mock') ? 'mock' : 'live');

  console.log('================================================================');
  console.log('SUSPENDED ACCOUNT TOKEN REVOCATION & DATABASE GATE RUNNER');
  console.log('Target: PostgREST API with active JWT tokens');
  console.log(`Execution Mode: ${mode.toUpperCase()} ${mode === 'live' ? '(Real Supabase Instance)' : '(Mock Simulation)'}`);
  console.log('================================================================\n');

  const env = loadLocalEnv();
  const serverEnv = loadServerEnv();

  if (mode === 'live') {
    if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.TEST_MEMBER_EMAIL || !env.TEST_MEMBER_PASSWORD) {
      console.error('❌ CONFIGURATION ERROR (Exit Code 2):');
      console.error('Missing required client environment configuration (.env.feedback-pilot.local).');
      console.error('Required: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TEST_MEMBER_EMAIL, TEST_MEMBER_PASSWORD');
      process.exit(2);
    }
    const hasServerSecret = serverEnv && (serverEnv.SUPABASE_SECRET_KEY || serverEnv.SUPABASE_SERVICE_ROLE_KEY);
    if (!hasServerSecret) {
      console.error('❌ CONFIGURATION ERROR (Exit Code 2):');
      console.error('Missing required server environment configuration (.env.feedback-pilot.server.local).');
      console.error('Step 4 & Step 9 require SUPABASE_SECRET_KEY for admin profile status updates.');
      process.exit(2);
    }
  } else {
    console.log('⚡ [MOCK RUNNER VALIDATION MODE]');
    console.log('Testing 10-step lifecycle logic against mock engine.\n');
    setupMockSuspendedEngine();
  }

  const isSimulated = (mode === 'mock');
  const baseUrl = isSimulated ? 'https://mock.supabase.co' : env.SUPABASE_URL;
  const apiKey = isSimulated ? 'mock_publishable_anon_key' : env.SUPABASE_PUBLISHABLE_KEY;
  const memberEmail = isSimulated ? 'test_m1@store.local' : env.TEST_MEMBER_EMAIL;
  const memberPassword = isSimulated ? 'validPassword123' : env.TEST_MEMBER_PASSWORD;
  const serverSecret = isSimulated ? 'mock_admin_secret_key' : (serverEnv?.SUPABASE_SECRET_KEY || serverEnv?.SUPABASE_SERVICE_ROLE_KEY);

  console.log(`Target URL: ${redactUrl(baseUrl)}`);
  console.log(`Publishable Key: ${redactToken(apiKey)}\n`);

  let passed = 0;
  let failed = 0;

  function assertTest(name, condition, details = '') {
    if (condition) {
      console.log(`✅ PASS | ${name} ${details}`);
      passed++;
    } else {
      console.log(`❌ FAIL | ${name} ${details}`);
      failed++;
    }
  }

  const memberSession = new TestUserSession(baseUrl, apiKey);
  const adminSession = new TestUserSession(baseUrl, serverSecret);

  let createdIssueId = null;
  let user = null;

  try {
    // -------------------------------------------------------------
    // Step 1: Login
    // -------------------------------------------------------------
    user = await memberSession.signIn(memberEmail, memberPassword);
    assertTest('Step 1: Login (Member signs in successfully)', !!user?.id, `(UID: ${redactUuid(user?.id)})`);

    // -------------------------------------------------------------
    // Step 2: Create issue before suspension
    // -------------------------------------------------------------
    const createRes = await memberSession.post('/rest/v1/issues', {
      title: '[RLS-TEST] Active Lifecycle Issue',
      description: 'Pre-suspension issue',
      category: 'APP_BUG',
      severity: 'LOW'
    });
    if (createRes.data && Array.isArray(createRes.data) && createRes.data[0]?.id) {
      createdIssueId = createRes.data[0].id;
    }
    assertTest('Step 2: Create issue before suspension', createRes.ok || createRes.status === 201, `(HTTP ${createRes.status})`);

    // -------------------------------------------------------------
    // Step 3: Retain original access token
    // -------------------------------------------------------------
    const savedToken = memberSession.accessToken;
    assertTest('Step 3: Retain original access token', !!savedToken, `(${redactToken(savedToken)})`);

    // -------------------------------------------------------------
    // Step 4: Suspend profile
    // -------------------------------------------------------------
    const suspendRes = await adminSession.patch(`/rest/v1/profiles?id=eq.${user.id}`, {
      status: 'SUSPENDED'
    });
    assertTest('Step 4: Suspend profile (Admin sets profiles.status to SUSPENDED via Server Key)', suspendRes.ok || suspendRes.status === 200 || suspendRes.status === 204);

    // -------------------------------------------------------------
    // Step 5: SELECT with old token blocked
    // -------------------------------------------------------------
    const selectRes = await memberSession.get('/rest/v1/issues?select=id,title');
    const rolesRes = await memberSession.get('/rest/v1/user_roles?select=role');
    const selectBlocked = (selectRes.status === 401 || selectRes.status === 403 || (selectRes.ok && Array.isArray(selectRes.data) && selectRes.data.length === 0)) &&
                          (rolesRes.status === 401 || rolesRes.status === 403 || (rolesRes.ok && Array.isArray(rolesRes.data) && rolesRes.data.length === 0));
    assertTest('Step 5: SELECT with old token blocked', selectBlocked, `(HTTP ${selectRes.status})`);

    // -------------------------------------------------------------
    // Step 6: INSERT issue blocked
    // -------------------------------------------------------------
    const insertRes = await memberSession.post('/rest/v1/issues', {
      title: '[RLS-TEST] Suspended Illegal Issue',
      description: 'Should be rejected by RLS',
      category: 'APP_BUG',
      severity: 'LOW'
    });
    const insertBlocked = (!insertRes.ok && (insertRes.status === 403 || insertRes.status === 401));
    assertTest('Step 6: INSERT issue blocked', insertBlocked, `(HTTP ${insertRes.status})`);

    // -------------------------------------------------------------
    // Step 7: INSERT comment blocked
    // -------------------------------------------------------------
    const commentRes = await memberSession.post('/rest/v1/issue_comments', {
      issue_id: createdIssueId || '00000000-0000-0000-0000-000000000100',
      comment_text: 'Illegal comment from suspended account'
    });
    const commentBlocked = (!commentRes.ok && (commentRes.status === 403 || commentRes.status === 401));
    assertTest('Step 7: INSERT comment blocked', commentBlocked, `(HTTP ${commentRes.status})`);

    // -------------------------------------------------------------
    // Step 8: RPC blocked
    // -------------------------------------------------------------
    const rpcRes = await memberSession.post('/rest/v1/rpc/update_own_display_name', {
      new_display_name: 'Suspended Hacker Name'
    });
    const rpcBlocked = (!rpcRes.ok && (rpcRes.status === 403 || rpcRes.status === 400 || rpcRes.status === 500));
    assertTest('Step 8: RPC blocked', rpcBlocked, `(HTTP ${rpcRes.status})`);

    // -------------------------------------------------------------
    // Step 9: Reactivate profile
    // -------------------------------------------------------------
    const restoreRes = await adminSession.patch(`/rest/v1/profiles?id=eq.${user.id}`, {
      status: 'ACTIVE'
    });
    assertTest('Step 9: Reactivate profile (Admin sets profiles.status to ACTIVE via Server Key)', restoreRes.ok || restoreRes.status === 200 || restoreRes.status === 204);

    // -------------------------------------------------------------
    // Step 10: Verify same user can sign in/access again
    // -------------------------------------------------------------
    const freshMemberSession = new TestUserSession(baseUrl, apiKey);
    const freshUser = await freshMemberSession.signIn(memberEmail, memberPassword);
    const readProfileRes = await freshMemberSession.get(`/rest/v1/profiles?id=eq.${user.id}&select=id,status`);
    const readIssuesRes = await freshMemberSession.get('/rest/v1/issues?select=id,title&limit=5');
    const accessRestored = !!freshUser?.id &&
      readProfileRes.ok && Array.isArray(readProfileRes.data) && readProfileRes.data[0]?.status === 'ACTIVE' &&
      readIssuesRes.ok;
    assertTest('Step 10: Verify same user can sign in/access again', accessRestored, `(Status: ${readProfileRes.data?.[0]?.status || 'UNKNOWN'})`);

  } catch (err) {
    assertTest('Lifecycle execution', false, err.message);
  } finally {
    // Safety Net: Always attempt to guarantee user profile is restored to ACTIVE
    if (user && user.id && adminSession && adminSession.accessToken) {
      try {
        await adminSession.patch(`/rest/v1/profiles?id=eq.${user.id}`, { status: 'ACTIVE' });
      } catch (_) {}
    }
    // Safety Net: Always attempt to purge any residual test issues
    if (createdIssueId && adminSession && adminSession.accessToken) {
      try {
        await adminSession.delete(`/rest/v1/issues?id=eq.${createdIssueId}`);
      } catch (_) {}
    }
  }

  console.log('\n================================================================');
  console.log('SUSPENDED ACCOUNT LIFECYCLE TEST SUMMARY');
  console.log(`Total Steps: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  const verdict = mode === 'mock' ? 'MOCK_SUSPENDED_LIFECYCLE_PASSED' : 'REAL_SUSPENDED_TOKEN_GATE_PASSED';
  console.log(`Verdict: ${failed === 0 ? '✅ ' + verdict : '❌ TESTS_FAILED'}`);
  console.log('================================================================\n');

  process.exit(failed === 0 ? 0 : 1);
}

runSuspendedUserTest().catch(err => {
  console.error('Fatal Suspended User Test Error:', err);
  process.exit(1);
});
