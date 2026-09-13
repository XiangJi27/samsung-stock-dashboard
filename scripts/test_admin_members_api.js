/**
 * Security & Boundary Unit Test Runner for Serverless Admin Member API
 * Target: api/admin/members.js
 * 
 * Verifies:
 * 1. Method guard: GET -> 405 Method Not Allowed
 * 2. Unauthenticated (Anon): Missing Bearer -> 401 Unauthorized
 * 3. Invalid Token: Rejected Bearer -> 401 Unauthorized
 * 4. Authorization: Member role calling endpoint -> 403 Forbidden
 * 5. Validation: Weak password (< 8 chars) -> 400 WEAK_PASSWORD
 * 6. Validation: Invalid employee code format -> 400 INVALID_EMPLOYEE_CODE
 * 7. Security: Client-supplied role/branch tampering ignored -> Forced to MEMBER & AYUTTHAYA_CITY_PARK
 * 8. Success: Admin creates member -> 201 Created
 * 9. Conflict: Duplicate employee code -> 409 Conflict
 * 10. Sanitized Response: Zero password, token, or secret key leakage in response payload
 * 11. Compensation Logic: Orphan Auth User deleted if profile insert fails -> 500 ROLLED_BACK
 * 12. Rate Limit Protection: Rejection with 429 when threshold exceeded
 */

const handler = require('../api/admin/members');

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, val) { this.headers[key] = val; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  return res;
}

async function runAdminApiTests() {
  console.log('================================================================');
  console.log('SERVERLESS ADMIN MEMBERS API SECURITY TEST RUNNER');
  console.log('Target: api/admin/members.js (Self-Contained Security Verification)');
  console.log('================================================================\n');

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

  // 1. Method Guard: GET -> 405
  {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();
    await handler(req, res);
    assertTest('GET request rejected with 405', res.statusCode === 405, `(Got ${res.statusCode})`);
  }

  // 2. Unauthenticated Anonymous Call: Missing Bearer -> 401
  {
    const req = { method: 'POST', headers: {}, body: {} };
    const res = createMockRes();
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'mock_secret_key';
    await handler(req, res);
    assertTest('Anonymous POST rejected with 401', res.statusCode === 401, `(Got ${res.statusCode})`);
  }

  // 3. Invalid Token: Bad Bearer -> 401
  {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 401 });

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer invalid_token' },
      body: { employeeCode: 'CPW9999', displayName: 'Hacker', temporaryPassword: 'password123' }
    };
    const res = createMockRes();
    await handler(req, res);
    assertTest('Invalid Bearer token rejected with 401', res.statusCode === 401, `(Got ${res.statusCode})`);

    global.fetch = originalFetch;
  }

  // 4. Authorization: Member role calling POST /api/admin/members -> 403 Forbidden
  {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000010' }) };
      }
      if (url.includes('/rest/v1/user_roles')) {
        // Query asks for role=eq.SYSTEM_ADMIN; regular member has no matching row -> returns []
        return { ok: true, json: async () => ([]) };
      }
      return { ok: false, status: 500 };
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_member_token' },
      body: { employeeCode: 'CPW1234', displayName: 'New Staff', temporaryPassword: 'validPassword123' }
    };
    const res = createMockRes();
    await handler(req, res);
    assertTest('Regular Member calling POST /api/admin/members rejected with 403', res.statusCode === 403 && res.body?.error === 'FORBIDDEN', `(Got ${res.statusCode} ${res.body?.error})`);

    global.fetch = originalFetch;
  }

  // 5. Input Validation: Weak Password (< 8 chars) -> 400
  {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000001' }) };
      }
      if (url.includes('/rest/v1/user_roles')) {
        return { ok: true, json: async () => ([{ role: 'SYSTEM_ADMIN' }]) };
      }
      return { ok: false, status: 500 };
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_mock_token' },
      body: { employeeCode: 'CPW1234', displayName: 'Test Staff', temporaryPassword: 'short' }
    };
    const res = createMockRes();
    await handler(req, res);
    assertTest('Weak password rejected with 400', res.statusCode === 400 && res.body?.error === 'WEAK_PASSWORD', `(Got ${res.statusCode} ${res.body?.error})`);

    global.fetch = originalFetch;
  }

  // 6. Input Validation: Invalid Employee Code -> 400
  {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000002' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'SYSTEM_ADMIN' }]) };
      return { ok: false, status: 500 };
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_mock_token' },
      body: { employeeCode: 'INVALID_CODE', displayName: 'Test Staff', temporaryPassword: 'validPassword123' }
    };
    const res = createMockRes();
    await handler(req, res);
    assertTest('Invalid employee code format rejected with 400', res.statusCode === 400 && res.body?.error === 'INVALID_EMPLOYEE_CODE', `(Got ${res.statusCode} ${res.body?.error})`);

    global.fetch = originalFetch;
  }

  // 7. Security Check: Client-Supplied Role / Branch Tampering Stripped -> Forced to MEMBER
  {
    const originalFetch = global.fetch;
    let profileCreated = null;
    let roleCreated = null;

    global.fetch = async (url, opts = {}) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000003' }) };
      if (url.includes('/rest/v1/user_roles') && opts.method !== 'POST') return { ok: true, json: async () => ([{ role: 'SYSTEM_ADMIN' }]) };
      if (url.includes('/auth/v1/admin/users')) {
        return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000101' }) };
      }
      if (url.includes('/rest/v1/profiles')) {
        profileCreated = JSON.parse(opts.body);
        return { ok: true, json: async () => ({}) };
      }
      if (url.includes('/rest/v1/user_roles') && opts.method === 'POST') {
        roleCreated = JSON.parse(opts.body);
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false, status: 500 };
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_mock_token' },
      body: {
        employeeCode: 'CPW8888',
        displayName: 'Hacked Admin',
        temporaryPassword: 'strongPassword123',
        role: 'SYSTEM_ADMIN',        // CLIENT SPOOF ATTEMPT
        branch_id: 'HACKED_BRANCH',  // CLIENT SPOOF ATTEMPT
        isAdmin: true                // CLIENT SPOOF ATTEMPT
      }
    };
    const res = createMockRes();
    await handler(req, res);

    const roleClean = (roleCreated?.role === 'MEMBER');
    const branchClean = (profileCreated?.branch_id === 'AYUTTHAYA_CITY_PARK' && roleCreated?.branch_id === 'AYUTTHAYA_CITY_PARK');
    const responseZeroSecrets = !res.body?.password && !res.body?.temporaryPassword && !res.body?.token && !res.body?.secretKey;

    assertTest('Client role spoof ignored; forced to MEMBER', roleClean, `(Assigned role: ${roleCreated?.role})`);
    assertTest('Client branch spoof ignored; forced to AYUTTHAYA_CITY_PARK', branchClean, `(Assigned branch: ${profileCreated?.branch_id})`);
    assertTest('Response contains ZERO passwords, tokens, or secret keys', responseZeroSecrets, '(Body sanitized)');

    global.fetch = originalFetch;
  }

  // 8. Admin Successfully Creates Member -> 201 Created
  {
    const originalFetch = global.fetch;
    global.fetch = async (url, opts = {}) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000005' }) };
      if (url.includes('/rest/v1/user_roles') && opts.method !== 'POST') return { ok: true, json: async () => ([{ role: 'SYSTEM_ADMIN' }]) };
      if (url.includes('/auth/v1/admin/users')) {
        return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000202' }) };
      }
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => ({}) };
      if (url.includes('/rest/v1/user_roles') && opts.method === 'POST') return { ok: true, json: async () => ({}) };
      return { ok: false, status: 500 };
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_admin_token' },
      body: { employeeCode: 'CPW2001', displayName: 'Somchai Prasert', temporaryPassword: 'tempPassword123' }
    };
    const res = createMockRes();
    await handler(req, res);

    assertTest('Admin creates member successfully with 201', res.statusCode === 201 && res.body?.success === true, `(Got ${res.statusCode})`);
    assertTest('Admin create member response includes sanitized member payload', res.body?.member?.employeeCode === 'CPW2001' && res.body?.member?.role === 'MEMBER');

    global.fetch = originalFetch;
  }

  // 9. Conflict: Duplicate Employee Code -> 409 Conflict
  {
    const originalFetch = global.fetch;
    global.fetch = async (url, opts = {}) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000006' }) };
      if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => ([{ role: 'SYSTEM_ADMIN' }]) };
      if (url.includes('/auth/v1/admin/users')) {
        // Return duplicate error
        return {
          ok: false,
          status: 422,
          json: async () => ({ message: 'A user with this email address has already been registered' })
        };
      }
      return { ok: false, status: 500 };
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_admin_token' },
      body: { employeeCode: 'CPW2001', displayName: 'Duplicate User', temporaryPassword: 'validPassword123' }
    };
    const res = createMockRes();
    await handler(req, res);

    assertTest('Duplicate employee code rejected with 409', res.statusCode === 409 && res.body?.error === 'EMPLOYEE_CODE_EXISTS', `(Got ${res.statusCode} ${res.body?.error})`);

    global.fetch = originalFetch;
  }

  // 10. Compensation Logic: Purges Auth User if Profile Insertion Fails
  {
    const originalFetch = global.fetch;
    let authPurgedId = null;

    global.fetch = async (url, opts = {}) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000007' }) };
      if (url.includes('/rest/v1/user_roles') && opts.method !== 'POST') return { ok: true, json: async () => ([{ role: 'SYSTEM_ADMIN' }]) };
      if (url.includes('/auth/v1/admin/users') && opts.method === 'POST') {
        return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000999' }) };
      }
      if (url.includes('/rest/v1/profiles')) {
        // Simulate DB Failure on Profile Insert
        return { ok: false, status: 500 };
      }
      if (url.includes('/auth/v1/admin/users/00000000-0000-0000-0000-000000000999') && opts.method === 'DELETE') {
        authPurgedId = '00000000-0000-0000-0000-000000000999';
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false, status: 500 };
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid_mock_token' },
      body: { employeeCode: 'CPW7777', displayName: 'Rollback Test', temporaryPassword: 'password123' }
    };
    const res = createMockRes();
    await handler(req, res);

    assertTest('Compensation logic triggers: orphan auth user purged on failure', authPurgedId === '00000000-0000-0000-0000-000000000999', `(Purged UID: ${authPurgedId})`);
    assertTest('Compensation returns HTTP 500 TRANSACTION_FAILED_ROLLED_BACK', res.statusCode === 500 && res.body?.error === 'TRANSACTION_FAILED_ROLLED_BACK');

    global.fetch = originalFetch;
  }

  // 11. Rate Limiting: Max 5 requests per 10 minutes per admin -> 429
  {
    const originalFetch = global.fetch;
    const adminId = '00000000-0000-0000-0000-000000000088';

    global.fetch = async (url, opts = {}) => {
      if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: adminId }) };
      if (url.includes('/rest/v1/user_roles') && opts.method !== 'POST') return { ok: true, json: async () => ([{ role: 'SYSTEM_ADMIN' }]) };
      if (url.includes('/auth/v1/admin/users')) return { ok: true, json: async () => ({ id: '00000000-0000-0000-0000-000000000089' }) };
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => ({}) };
      if (url.includes('/rest/v1/user_roles') && opts.method === 'POST') return { ok: true, json: async () => ({}) };
      return { ok: false, status: 500 };
    };

    let rateLimited = false;
    // Send 6 requests in rapid succession
    for (let i = 0; i < 6; i++) {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer rate_limit_token' },
        body: { employeeCode: `CPW500${i}`, displayName: `Rate Test ${i}`, temporaryPassword: 'validPassword123' }
      };
      const res = createMockRes();
      await handler(req, res);
      if (res.statusCode === 429 && res.body?.error === 'RATE_LIMIT_EXCEEDED') {
        rateLimited = true;
        break;
      }
    }

    assertTest('Rate limiting triggers on 6th rapid request with 429 RATE_LIMIT_EXCEEDED', rateLimited);

    global.fetch = originalFetch;
  }

  console.log('\n================================================================');
  console.log('ADMIN MEMBERS API SECURITY TEST SUMMARY');
  console.log(`Total Assertions: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Verdict: ${failed === 0 ? '✅ ALL SECURITY CHECKS PASSED' : '❌ TESTS FAILED'}`);
  console.log('================================================================\n');

  process.exit(failed === 0 ? 0 : 1);
}

runAdminApiTests().catch(err => {
  console.error('Fatal Admin API Test Runner Error:', err);
  process.exit(1);
});
