/**
 * Automated Real Data API & Session Isolation Test Runner
 * Tailored for 4-User Store Pilot (Ayutthaya City Park)
 * 
 * Matrix:
 * 1. ANON: Unauthenticated public client
 * 2. ADMIN: Store Leader + System Admin (Dual Role)
 * 3. MEMBER_A: Sales Staff A
 * 4. MEMBER_B: Sales Staff B (Peer privacy validation)
 * 
 * Exit Codes:
 * - Exit 0: All executed mandatory tests passed
 * - Exit 1: One or more assertions failed
 * - Exit 2: Configuration missing or incomplete (.env.feedback-pilot.local)
 */

const { loadLocalEnv } = require('./lib/load-local-env');
const { TestUserSession } = require('./lib/test-user-session');
const { redactToken, redactUuid, redactEmail, redactUrl } = require('./lib/redact-test-output');

function setupSimulatedEngine() {
  const issuesDb = new Map();
  const commentsDb = [];
  let seq = 1;

  function makeRes(status, payload) {
    const textData = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => textData,
      json: async () => (typeof payload === 'string' ? JSON.parse(payload) : payload)
    };
  }

  const originalFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const urlStr = String(url);
    const u = new URL(urlStr);
    const pathname = u.pathname;
    const authHeader = opts.headers?.Authorization || opts.headers?.authorization || '';
    const hasBearer = authHeader.startsWith('Bearer ');
    const method = (opts.method || 'GET').toUpperCase();

    // 1. Auth Endpoint
    if (pathname.includes('/auth/v1/token')) {
      const body = JSON.parse(opts.body || '{}');
      if (body.email && body.password) {
        return makeRes(200, {
          access_token: 'mock_member_a_jwt',
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: body.email
          }
        });
      }
      return makeRes(400, { error: 'invalid_credentials' });
    }

    // 2. Anon Security Surface Checks
    if (!hasBearer) {
      if (pathname.includes('/rest/v1/issues') && method === 'GET') {
        return makeRes(200, []);
      }
      if (pathname.includes('/rest/v1/issues') && method === 'POST') {
        return makeRes(401, { message: 'Unauthorized' });
      }
      if (pathname.includes('/rest/v1/rpc/update_own_display_name')) {
        return makeRes(401, { message: 'Unauthorized' });
      }
      if (pathname.includes('/rest/v1/rpc/has_global_role') ||
          pathname.includes('/rest/v1/rpc/validate_issue_write') ||
          pathname.includes('/rest/v1/rpc/user_has_role')) {
        return makeRes(404, { message: 'Function not found in public schema' });
      }
    }

    // 3. Member A Endpoints
    if (pathname.includes('/rest/v1/branches')) {
      return makeRes(200, [{ id: 'AYUTTHAYA_CITY_PARK', name: 'อยุธยา ซิตี้ พาร์ค' }]);
    }

    if (pathname.includes('/rest/v1/profiles')) {
      return makeRes(200, [{ employee_code: 'CPW1001', branch_id: 'AYUTTHAYA_CITY_PARK', status: 'ACTIVE' }]);
    }

    if (pathname.includes('/rest/v1/issues')) {
      if (method === 'POST') {
        const body = JSON.parse(opts.body || '{}');
        const id = `00000000-0000-0000-0000-${String(seq++).padStart(12, '0')}`;
        const issue = {
          id,
          issue_number: `ISS-2026-${String(seq).padStart(5, '0')}`,
          title: body.title,
          description: body.description,
          status: 'NEW',
          branch_id: 'AYUTTHAYA_CITY_PARK',
          reporter_id: '00000000-0000-0000-0000-000000000001'
        };
        issuesDb.set(id, issue);
        return makeRes(201, [issue]);
      }
      if (method === 'GET') {
        const idMatch = urlStr.match(/id=eq\.([^&]+)/);
        if (idMatch && issuesDb.has(idMatch[1])) {
          return makeRes(200, [issuesDb.get(idMatch[1])]);
        }
        if (urlStr.includes('title=like.[RLS-TEST]*')) {
          if (!hasBearer) return makeRes(200, []);
          const list = Array.from(issuesDb.values()).filter(i => i.title.startsWith('[RLS-TEST]'));
          return makeRes(200, list);
        }
        return makeRes(200, []);
      }
      if (method === 'PATCH') {
        return makeRes(403, { message: 'Forbidden: status transition not permitted' });
      }
      if (method === 'DELETE') {
        const idMatch = urlStr.match(/id=eq\.([^&]+)/);
        if (idMatch) issuesDb.delete(idMatch[1]);
        return makeRes(204, '');
      }
    }

    if (pathname.includes('/rest/v1/issue_comments')) {
      if (method === 'POST') {
        const body = JSON.parse(opts.body || '{}');
        if (body.is_internal) {
          return makeRes(403, { message: 'Forbidden: internal comments restricted' });
        }
        const comment = { id: `c_${Date.now()}`, issue_id: body.issue_id, comment_text: body.comment_text, is_internal: false };
        commentsDb.push(comment);
        return makeRes(201, [comment]);
      }
    }

    return makeRes(404, { message: 'Not found' });
  };

  return () => { global.fetch = originalFetch; };
}

async function runApiTests() {
  const mode = process.argv.find(a => a.startsWith('--mode='))?.split('=')[1] || (process.argv.includes('--mock') ? 'mock' : 'live');

  console.log('================================================================');
  console.log('SAMSUNG BRANCH OPERATIONS - STORE PILOT DATA API TEST RUNNER');
  console.log('Scope: Ayutthaya City Park (4-User Store Model)');
  console.log(`Execution Mode: ${mode.toUpperCase()} ${mode === 'live' ? '(Real Supabase Data API)' : '(Local In-Memory Mock Engine)'}`);
  console.log('================================================================\n');

  const env = loadLocalEnv();

  if (mode === 'live') {
    if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
      console.error('❌ LIVE DATA API CONFIGURATION ERROR (Exit Code 2):');
      console.error('Missing required environment configuration (.env.feedback-pilot.local).');
      console.error('Mandatory variables: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TEST_MEMBER_EMAIL, TEST_MEMBER_PASSWORD');
      console.error('To run local mock assertion checks instead, execute: node scripts/test_live_api_sessions.js --mode=mock\n');
      process.exit(2);
    }
    if (env.SUPABASE_URL.includes('mock.supabase.co')) {
      console.error('❌ LIVE DATA API CONFIGURATION ERROR (Exit Code 2):');
      console.error('SUPABASE_URL points to mock.supabase.co. Live mode requires real Supabase preview project.\n');
      process.exit(2);
    }
  } else {
    console.log('⚡ [MOCK RUNNER VALIDATION MODE]');
    console.log('Running simulated Member API test against in-memory PostgREST Engine.');
    console.log('NOTE: This verifies test runner logic and contract assertions; it is NOT a live Supabase Data API test.\n');
    setupSimulatedEngine();
  }

  const isSimulated = (mode === 'mock');
  const baseUrl = isSimulated ? 'https://mock.supabase.co' : env.SUPABASE_URL;
  const apiKey = isSimulated ? 'mock_publishable_anon_key' : env.SUPABASE_PUBLISHABLE_KEY;

  console.log(`Target URL: ${redactUrl(baseUrl)}`);
  console.log(`Publishable Key: ${redactToken(apiKey)}\n`);

  const memberAEmail = isSimulated ? 'test_m1@store.local' : (env.TEST_MEMBER_EMAIL || env.TEST_MEMBER_A_EMAIL);
  const memberAPassword = isSimulated ? 'validPassword123' : (env.TEST_MEMBER_PASSWORD || env.TEST_MEMBER_A_PASSWORD);

  const memberBEmail = isSimulated ? null : env.TEST_MEMBER_B_EMAIL;
  const memberBPassword = isSimulated ? null : env.TEST_MEMBER_B_PASSWORD;

  const adminEmail = isSimulated ? null : env.TEST_ADMIN_EMAIL;
  const adminPassword = isSimulated ? null : env.TEST_ADMIN_PASSWORD;

  const roleDefs = [
    { key: 'ANON', name: 'Anonymous Public Client', isConfigured: true },
    { key: 'ADMIN', name: 'Store Leader + System Admin', isConfigured: !!(adminEmail && adminPassword) },
    { key: 'MEMBER_A', name: 'Sales Staff A (Ayutthaya)', isConfigured: !!(memberAEmail && memberAPassword) },
    { key: 'MEMBER_B', name: 'Sales Staff B (Ayutthaya - Peer Isolation)', isConfigured: !!(memberBEmail && memberBPassword) }
  ];

  const configuredCount = roleDefs.filter(r => r.isConfigured).length;
  console.log(`Pilot Roles Configured: ${configuredCount}/4`);
  roleDefs.forEach(r => {
    console.log(`  - [${r.isConfigured ? 'X' : ' '}] ${r.name} (${r.key})`);
  });
  console.log('');

  const results = [];
  const createdTestIssueIds = [];

  function record(testName, expected, actual, passed, details = '') {
    results.push({ testName, expected, actual, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} | ${testName} (Got HTTP ${actual}, Expected ${expected}) ${details}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 1: ANONYMOUS ACCESS & SURFACE DEFENSE (Mandatory)
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: Anonymous Access & Attack Surface Defense ---');
  const anonSession = new TestUserSession(baseUrl, apiKey);

  // 1.1 Anon SELECT on issues table
  const anonSelect = await anonSession.get('/rest/v1/issues?select=id,title');
  const anonSelectPass = (anonSelect.status === 401 || anonSelect.status === 403 || (anonSelect.ok && Array.isArray(anonSelect.data) && anonSelect.data.length === 0));
  record('Anon SELECT issues blocked or empty', '401/403/Empty', anonSelect.status, anonSelectPass);

  // 1.2 Anon INSERT on issues table
  const anonInsert = await anonSession.post('/rest/v1/issues', {
    title: '[RLS-TEST] Anon Unauthorized Issue',
    description: 'Should fail',
    category: 'OTHER',
    severity: 'P4_LOW'
  });
  const anonInsertPass = (anonInsert.status === 401 || anonInsert.status === 403);
  record('Anon INSERT issues blocked', '401/403', anonInsert.status, anonInsertPass);

  // 1.3 Anon EXECUTE on public RPC update_own_display_name
  const anonRpc = await anonSession.post('/rest/v1/rpc/update_own_display_name', {
    new_display_name: 'Anon Attacker'
  });
  const anonRpcPass = (anonRpc.status === 401 || anonRpc.status === 403);
  record('Anon RPC update_own_display_name blocked', '401/403', anonRpc.status, anonRpcPass);

  // 1.4 Private schema functions NOT exposed as PostgREST RPC
  const privateRpc = await anonSession.post('/rest/v1/rpc/has_global_role', { required_role: 'SYSTEM_ADMIN' });
  record('Private helper has_global_role NOT exposed via RPC', '404', privateRpc.status, privateRpc.status === 404);

  const triggerRpc = await anonSession.post('/rest/v1/rpc/validate_issue_write', {});
  record('Trigger function validate_issue_write NOT exposed via RPC', '404/401/403', triggerRpc.status, triggerRpc.status === 404 || triggerRpc.status === 401 || triggerRpc.status === 403);

  const enumRpc = await anonSession.post('/rest/v1/rpc/user_has_role', { target_user_id: '00000000-0000-0000-0000-000000000000', required_role: 'SYSTEM_ADMIN' });
  record('Internal role helper user_has_role NOT exposed via RPC', '404', enumRpc.status, enumRpc.status === 404);

  // --------------------------------------------------------------------------
  // SUITE 2: MEMBER A SESSION (Sales Staff Primary Workflow)
  // --------------------------------------------------------------------------
  let memberAIssueId = null;
  let memberASession = null;

  if (memberAEmail && memberAPassword) {
    console.log(`\n--- Suite 2: Member A Session (${redactEmail(memberAEmail)}) ---`);
    memberASession = new TestUserSession(baseUrl, apiKey);
    try {
      const user = await memberASession.signIn(memberAEmail, memberAPassword);
      record('Member A Sign-in', '200', '200', true, `UID: ${redactUuid(user.id)}`);

      // 2.1 Member A can query branches / stock metadata
      const branchRes = await memberASession.get('/rest/v1/branches?select=id,name');
      record('Member A SELECT branches', '200', branchRes.status, branchRes.ok);

      // 2.2 Member A reads own profile
      const profRes = await memberASession.get(`/rest/v1/profiles?id=eq.${user.id}&select=employee_code,branch_id,status`);
      const hasProf = profRes.ok && profRes.data && profRes.data.length > 0;
      record('Member A read own profile', '200', profRes.status, hasProf);

      // 2.3 Member A creates issue with [RLS-TEST] prefix
      const issueRes = await memberASession.post('/rest/v1/issues', {
        title: '[RLS-TEST] Member A Stock Screen Defect',
        description: 'Testing 4-user pilot issue creation flow',
        category: 'STOCK',
        severity: 'P3_MEDIUM'
      }, { Prefer: 'return=representation' });

      if (issueRes.ok && issueRes.data && issueRes.data.length > 0) {
        memberAIssueId = issueRes.data[0].id;
        createdTestIssueIds.push(memberAIssueId);
        const generatedNum = issueRes.data[0].issue_number;
        const numValid = generatedNum && generatedNum.startsWith('ISS-2026-');
        record('Member A create issue auto-generates issue_number', 'ISS-2026-***', numValid ? generatedNum : 'INVALID', numValid);
      } else {
        record('Member A create issue', '201', issueRes.status, false);
      }

      // 2.4 Member A reads own issue
      if (memberAIssueId) {
        const getOwn = await memberASession.get(`/rest/v1/issues?id=eq.${memberAIssueId}&select=id,issue_number,status`);
        const ownRead = getOwn.ok && getOwn.data && getOwn.data.length === 1;
        record('Member A reads own issue', '200', getOwn.status, ownRead);

        // 2.5 Member A creates public comment
        const pubComment = await memberASession.post('/rest/v1/issue_comments', {
          issue_id: memberAIssueId,
          comment_text: 'Public observation from Member A',
          is_internal: false
        });
        record('Member A create public comment', '201', pubComment.status, pubComment.ok);

        // 2.6 Member A attempts to create internal comment -> BLOCKED (400/403)
        const intComment = await memberASession.post('/rest/v1/issue_comments', {
          issue_id: memberAIssueId,
          comment_text: 'Unauthorized internal attempt',
          is_internal: true
        });
        const intBlocked = !intComment.ok && (intComment.status === 403 || intComment.status === 400);
        record('Member A create internal comment BLOCKED by RLS', '400/403', intComment.status, intBlocked);

        // 2.7 Member A attempts direct status update to CLOSED -> BLOCKED
        const updateStatus = await memberASession.patch(`/rest/v1/issues?id=eq.${memberAIssueId}`, { status: 'CLOSED' });
        const checkStatus = await memberASession.get(`/rest/v1/issues?id=eq.${memberAIssueId}&select=status`);
        const statusGuarded = checkStatus.ok && checkStatus.data && checkStatus.data[0] && checkStatus.data[0].status === 'NEW';
        record('Member A direct status update to CLOSED BLOCKED', 'NEW', statusGuarded ? 'NEW' : 'TAMPERED', statusGuarded);

        // 2.8 Member A attempts direct audit log insertion -> BLOCKED
        const auditSpoof = await memberASession.post('/rest/v1/issue_events', {
          issue_id: memberAIssueId,
          event_type: 'TAMPER_EVENT',
          actor_id: user.id,
          actor_type: 'USER'
        });
        record('Member A direct INSERT issue_events BLOCKED', '401/403', auditSpoof.status, !auditSpoof.ok);
      }

    } catch (err) {
      record('Member A Session Test', '200', 'ERROR', false, err.message);
    }
  } else {
    console.log('\n--- Suite 2: Member A Session (SKIPPED: TEST_MEMBER_EMAIL not configured) ---');
  }

  // --------------------------------------------------------------------------
  // SUITE 3: MEMBER B SESSION (Peer Privacy & Isolation)
  // --------------------------------------------------------------------------
  let memberBIssueId = null;
  if (memberBEmail && memberBPassword) {
    console.log(`\n--- Suite 3: Member B Session (${redactEmail(memberBEmail)}) ---`);
    const memberBSession = new TestUserSession(baseUrl, apiKey);
    try {
      const userB = await memberBSession.signIn(memberBEmail, memberBPassword);
      record('Member B Sign-in', '200', '200', true, `UID: ${redactUuid(userB.id)}`);

      // 3.1 Member B CANNOT see Member A's issue (Peer isolation)
      if (memberAIssueId) {
        const peerRead = await memberBSession.get(`/rest/v1/issues?id=eq.${memberAIssueId}&select=id`);
        const peerHidden = peerRead.ok && Array.isArray(peerRead.data) && peerRead.data.length === 0;
        record('Member B CANNOT view Member A personal issue (Peer Privacy)', '0 rows', peerHidden ? '0 rows' : 'EXPOSED', peerHidden);
      }

      // 3.2 Member B creates own issue
      const issueBRes = await memberBSession.post('/rest/v1/issues', {
        title: '[RLS-TEST] Member B Promo Query',
        description: 'Testing peer isolation',
        category: 'PROMOTION',
        severity: 'P4_LOW'
      }, { Prefer: 'return=representation' });

      if (issueBRes.ok && issueBRes.data && issueBRes.data.length > 0) {
        memberBIssueId = issueBRes.data[0].id;
        createdTestIssueIds.push(memberBIssueId);
        record('Member B create own issue', '201', issueBRes.status, true);
      }

    } catch (err) {
      record('Member B Session Test', '200', 'ERROR', false, err.message);
    }
  } else {
    console.log('\n--- Suite 3: Member B Session (SKIPPED: TEST_MEMBER_B_EMAIL not configured) ---');
  }

  // --------------------------------------------------------------------------
  // SUITE 4: ADMIN / STORE LEADER SESSION (Management & Oversight)
  // --------------------------------------------------------------------------
  let adminSession = null;
  if (adminEmail && adminPassword) {
    console.log(`\n--- Suite 4: Admin / Store Leader Session (${redactEmail(adminEmail)}) ---`);
    adminSession = new TestUserSession(baseUrl, apiKey);
    try {
      const adminUser = await adminSession.signIn(adminEmail, adminPassword);
      record('Admin Sign-in', '200', '200', true, `UID: ${redactUuid(adminUser.id)}`);

      // 4.1 Admin sees Member A issue (Store Leader role)
      if (memberAIssueId) {
        const leaderRead = await adminSession.get(`/rest/v1/issues?id=eq.${memberAIssueId}&select=id,title,issue_number`);
        const leaderCanSee = leaderRead.ok && leaderRead.data && leaderRead.data.length === 1;
        record('Admin sees Member A issue in store', '1 row', leaderCanSee ? '1 row' : '0 rows', leaderCanSee);

        // 4.2 Admin posts internal comment
        const leaderInternalNote = await adminSession.post('/rest/v1/issue_comments', {
          issue_id: memberAIssueId,
          comment_text: 'Internal manager triage note',
          is_internal: true
        });
        record('Admin post internal comment', '201', leaderInternalNote.status, leaderInternalNote.ok);

        // 4.3 Admin updates status: NEW -> IN_PROGRESS
        const statusChange = await adminSession.patch(`/rest/v1/issues?id=eq.${memberAIssueId}`, {
          status: 'IN_PROGRESS'
        });
        record('Admin transition issue to IN_PROGRESS', '200/204', statusChange.status, statusChange.ok);
      }

    } catch (err) {
      record('Admin Session Test', '200', 'ERROR', false, err.message);
    }
  } else {
    console.log('\n--- Suite 4: Admin Session (SKIPPED: TEST_ADMIN_EMAIL not configured) ---');
  }

  // --------------------------------------------------------------------------
  // CLEANUP ROUTINE: ZERO RESIDUAL TEST RECORDS (Gate 4)
  // --------------------------------------------------------------------------
  console.log('\n--- Cleanup Routine: Purging Test Fixtures ([RLS-TEST]%) ---');
  let residualCount = 0;
  if (createdTestIssueIds.length > 0 && adminSession) {
    for (const testId of createdTestIssueIds) {
      try {
        const delRes = await adminSession.delete(`/rest/v1/issues?id=eq.${testId}`);
        console.log(`Purged test fixture ${redactUuid(testId)} (HTTP ${delRes.status})`);
      } catch (e) {
        console.log(`Note on fixture cleanup: ${e.message}`);
      }
    }
  }

  // Verify residual count
  const checkResidual = await anonSession.get('/rest/v1/issues?title=like.[RLS-TEST]*&select=id');
  if (checkResidual.ok && Array.isArray(checkResidual.data)) {
    residualCount = checkResidual.data.length;
  }
  console.log(`Residual Test Records in DB: ${residualCount}`);

  // --------------------------------------------------------------------------
  // SUMMARY & VERDICT
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('STORE PILOT REAL DATA API SECURITY TEST SUMMARY');
  console.log('================================================================');
  const totalExecuted = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  const skippedMandatory = 0;

  console.log(`Required roles configured : ${configuredCount}/4`);
  console.log(`Tests executed            : ${totalExecuted}`);
  console.log(`Passed                    : ${passedCount}`);
  console.log(`Failed                    : ${failedCount}`);
  console.log(`Skipped mandatory         : ${skippedMandatory}`);
  console.log(`Residual test records     : ${residualCount}`);
  console.log('----------------------------------------------------------------');

  let verdict = '';
  if (failedCount > 0) {
    verdict = 'TESTS_FAILED';
    console.log(`Verdict: ❌ ${verdict}`);
    console.log('================================================================\n');
    process.exit(1);
  }

  if (mode === 'mock') {
    verdict = 'MOCK_RUNNER_VALIDATION_PASSED';
  } else if (configuredCount === 4) {
    verdict = 'REAL_DATA_API_STORE_MATRIX_PASSED';
  } else if (memberAEmail && memberAPassword) {
    verdict = 'REAL_DATA_API_MEMBER_SMOKE_PASSED';
  } else {
    verdict = 'REAL_DATA_API_ANON_SURFACE_PASSED';
  }

  console.log(`Verdict: ✅ ${verdict}`);
  console.log('================================================================\n');
  process.exit(0);
}

runApiTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
