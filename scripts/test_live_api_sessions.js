/**
 * Automated Real Data API & Session Isolation Test Runner
 * Verifies PostgREST endpoints, Grants, RLS, and Schema Exposure against live Supabase Preview
 */

const { loadLocalEnv } = require('./lib/load-local-env');
const { TestUserSession } = require('./lib/test-user-session');
const { redactToken, redactUuid, redactEmail } = require('./lib/redact-test-output');

async function runApiTests() {
  console.log('================================================================');
  console.log('SAMSUNG BRANCH OPERATIONS - REAL DATA API SECURITY TEST RUNNER');
  console.log('Target: Supabase Preview Project');
  console.log('================================================================\n');

  const env = loadLocalEnv();
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    console.error('❌ ERROR: .env.feedback-pilot.local not found or missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY');
    console.error('Please configure .env.feedback-pilot.local with your project credentials.');
    process.exit(1);
  }

  const baseUrl = env.SUPABASE_URL;
  const apiKey = env.SUPABASE_PUBLISHABLE_KEY;

  console.log(`Target URL: ${baseUrl}`);
  console.log(`Publishable Key: ${redactToken(apiKey)}\n`);

  const results = [];

  function record(testName, expected, actual, passed, details = '') {
    results.push({ testName, expected, actual, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} | ${testName} (Got HTTP ${actual}, Expected ${expected}) ${details}`);
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 1: ANONYMOUS ACCESS (Least Privilege Verification)
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Anonymous (Unauthenticated) Access ---');
  const anonSession = new TestUserSession(baseUrl, apiKey);

  // 1.1 Anon SELECT on issues table
  const anonSelect = await anonSession.get('/rest/v1/issues?select=id,title');
  // Anon has revoked SELECT, should get 401 or 403 or empty array if filtered
  const anonSelectPass = (anonSelect.status === 401 || anonSelect.status === 403 || (anonSelect.ok && Array.isArray(anonSelect.data) && anonSelect.data.length === 0));
  record('Anon SELECT issues blocked/empty', '401/403/Empty', anonSelect.status, anonSelectPass);

  // 1.2 Anon INSERT on issues table
  const anonInsert = await anonSession.post('/rest/v1/issues', {
    title: 'Anon Unauthorized Issue',
    description: 'Should fail',
    category: 'OTHER',
    severity: 'P4_LOW'
  });
  const anonInsertPass = (anonInsert.status === 401 || anonInsert.status === 403);
  record('Anon INSERT issues blocked', '401/403', anonInsert.status, anonInsertPass);

  // 1.3 Anon EXECUTE on public RPC update_own_display_name
  const anonRpc = await anonSession.post('/rest/v1/rpc/update_own_display_name', {
    new_display_name: 'Anon Hacker'
  });
  const anonRpcPass = (anonRpc.status === 401 || anonRpc.status === 403);
  record('Anon RPC update_own_display_name blocked', '401/403', anonRpc.status, anonRpcPass);

  // --------------------------------------------------------------------------
  // TEST SUITE 2: SCHEMA EXPOSURE & ATTACK SURFACE (Data API Boundary)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Schema Isolation & RPC Attack Surface ---');

  // 2.1 Attempt to call private helper function directly as RPC
  const privateRpc = await anonSession.post('/rest/v1/rpc/has_global_role', {
    required_role: 'SYSTEM_ADMIN'
  });
  // Must return 404 (Not Found) because private schema is NOT exposed via PostgREST!
  const privateRpcPass = (privateRpc.status === 404);
  record('Private schema function NOT exposed via RPC', '404', privateRpc.status, privateRpcPass);

  // 2.2 Attempt to call trigger function directly as RPC
  const triggerRpc = await anonSession.post('/rest/v1/rpc/validate_issue_write', {});
  const triggerRpcPass = (triggerRpc.status === 404 || triggerRpc.status === 401 || triggerRpc.status === 403);
  record('Database Trigger NOT callable via RPC', '404/401/403', triggerRpc.status, triggerRpcPass);

  // 2.3 Attempt to call role enumeration function user_has_role
  const enumRpc = await anonSession.post('/rest/v1/rpc/user_has_role', {
    target_user_id: '00000000-0000-0000-0000-000000000000',
    required_role: 'SYSTEM_ADMIN'
  });
  const enumRpcPass = (enumRpc.status === 404);
  record('Role enumeration user_has_role NOT exposed', '404', enumRpc.status, enumRpcPass);

  // --------------------------------------------------------------------------
  // TEST SUITE 3: AUTHENTICATED MEMBER SESSION (If configured in .env)
  // --------------------------------------------------------------------------
  const memberEmail = env.TEST_MEMBER_EMAIL;
  const memberPassword = env.TEST_MEMBER_PASSWORD;

  if (memberEmail && memberPassword) {
    console.log(`\n--- 3. Testing Authenticated Member Session (${redactEmail(memberEmail)}) ---`);
    const memberSession = new TestUserSession(baseUrl, apiKey);
    try {
      const user = await memberSession.signIn(memberEmail, memberPassword);
      console.log(`Authenticated as User UID: ${redactUuid(user.id)}`);

      // 3.1 Member can query branches
      const branchRes = await memberSession.get('/rest/v1/branches?select=id,name');
      record('Member SELECT branches', '200', branchRes.status, branchRes.ok);

      // 3.2 Member attempts to insert internal comment -> MUST FAIL (RLS 403 / check constraint)
      const fakeInternalComment = await memberSession.post('/rest/v1/issue_comments', {
        issue_id: '22222222-2222-2222-2222-222222222222',
        comment_text: 'Unauthorized internal test',
        is_internal: true
      });
      const internalBlocked = (!fakeInternalComment.ok && (fakeInternalComment.status === 403 || fakeInternalComment.status === 400));
      record('Member INSERT internal comment blocked by RLS', '400/403', fakeInternalComment.status, internalBlocked);

    } catch (err) {
      console.log(`Member Session Test Note: ${err.message}`);
    }
  } else {
    console.log('\n--- 3. Authenticated Session Tests (Skipped: Configure TEST_MEMBER_EMAIL/PASSWORD in .env.feedback-pilot.local to run) ---');
  }

  console.log('\n================================================================');
  console.log('SECURITY TEST SUMMARY');
  console.log('================================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`Total Assertions: ${results.length} | Passed: ${results.filter(r => r.passed).length} | Failed: ${results.filter(r => !r.passed).length}`);
  console.log(`Result: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  console.log('================================================================\n');
}

runApiTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
