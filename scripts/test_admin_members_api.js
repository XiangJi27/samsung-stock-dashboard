/**
 * Automated Test Suite for Member Admin Controller
 * 1. Anonymous Access Restrictions (401 Unauthorized)
 * 2. Invalid Token Handling (401)
 * 3. Dedicated Test Admin User Provisioning & Authentication
 * 4. Authorized GET /api/admin/members (200 OK, zero secret leaks)
 * 5. Input Validations (Weak password, confirmation mismatch, invalid code)
 * 6. Self-Suspend Prevention (400 Bad Request)
 * 7. End-to-End Member Lifecycle (Create -> Rename -> Reset Password -> Suspend -> Reactivate)
 * 8. Cleanup of Test Records
 */

const fs = require('fs');
const path = require('path');
const handler = require('../api/admin/members.js');

// Load environment variables
const envServerPath = path.join(__dirname, '..', '.env.feedback-pilot.server.local');
if (fs.existsSync(envServerPath)) {
  const envContent = fs.readFileSync(envServerPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      process.env[m[1]] = (m[2] || '').trim();
    }
  });
}

function createMockRes() {
  return {
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
}

async function runTests() {
  console.log('================================================================');
  console.log('SAMSUNG FEEDBACK PILOT - MEMBER ADMIN COMPREHENSIVE TEST SUITE');
  console.log('================================================================\n');

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

  // 1. Anonymous GET -> 401
  {
    const req = { method: 'GET', url: '/api/admin/members', headers: {} };
    const res = createMockRes();
    await handler(req, res);
    assert('Anonymous GET /api/admin/members returns 401', res.statusCode === 401, `Got ${res.statusCode}`);
  }

  // 2. Anonymous POST -> 401
  {
    const req = { method: 'POST', url: '/api/admin/members', headers: {}, body: {} };
    const res = createMockRes();
    await handler(req, res);
    assert('Anonymous POST /api/admin/members returns 401', res.statusCode === 401, `Got ${res.statusCode}`);
  }

  // 3. Anonymous PATCH -> 401
  {
    const req = { method: 'PATCH', url: '/api/admin/members/dummy-uuid', headers: {}, body: {} };
    const res = createMockRes();
    await handler(req, res);
    assert('Anonymous PATCH /api/admin/members/:id returns 401', res.statusCode === 401, `Got ${res.statusCode}`);
  }

  // 4. Anonymous POST reset-password -> 401
  {
    const req = { method: 'POST', url: '/api/admin/members/dummy-uuid/reset-password', headers: {}, body: {} };
    const res = createMockRes();
    await handler(req, res);
    assert('Anonymous POST reset-password returns 401', res.statusCode === 401, `Got ${res.statusCode}`);
  }

  // 5. Anonymous POST suspend -> 401
  {
    const req = { method: 'POST', url: '/api/admin/members/dummy-uuid/suspend', headers: {}, body: {} };
    const res = createMockRes();
    await handler(req, res);
    assert('Anonymous POST suspend returns 401', res.statusCode === 401, `Got ${res.statusCode}`);
  }

  // 6. Anonymous POST reactivate -> 401
  {
    const req = { method: 'POST', url: '/api/admin/members/dummy-uuid/reactivate', headers: {}, body: {} };
    const res = createMockRes();
    await handler(req, res);
    assert('Anonymous POST reactivate returns 401', res.statusCode === 401, `Got ${res.statusCode}`);
  }

  // 7. Invalid Bearer Token -> 401
  {
    const req = { method: 'GET', url: '/api/admin/members', headers: { authorization: 'Bearer invalid.token' } };
    const res = createMockRes();
    await handler(req, res);
    assert('Invalid Bearer Token returns 401', res.statusCode === 401, `Got ${res.statusCode}`);
  }

  // LIVE AUTHENTICATED TESTS WITH TEMPORARY TEST ADMIN
  console.log('\n--- PROVISIONING TEMPORARY TEST ADMIN ---');
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const testAdminEmail = `test_admin_${Date.now()}@staff.internal`;
  const testAdminPassword = 'TempAdminPassword2026!';
  let testAdminId = null;
  let testAdminToken = null;

  try {
    // 1. Create temporary Auth User
    const createAuth = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey
      },
      body: JSON.stringify({
        email: testAdminEmail,
        password: testAdminPassword,
        email_confirm: true,
        user_metadata: { display_name: 'Automated Test Admin', role: 'SYSTEM_ADMIN', employee_code: 'CPW_AUTO_ADMIN' }
      })
    });
    const authData = await createAuth.json();
    testAdminId = authData.id;

    // 2. Assign SYSTEM_ADMIN role
    await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: testAdminId,
        role: 'SYSTEM_ADMIN',
        branch_id: 'AYUTTHAYA_CITY_PARK'
      })
    });

    // 3. Create profile
    await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id: testAdminId,
        employee_code: 'CPW_AUTO_ADMIN',
        display_name: 'Automated Test Admin',
        branch_id: 'AYUTTHAYA_CITY_PARK',
        status: 'ACTIVE'
      })
    });

    // 4. Log in to get live JWT token
    const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': secretKey
      },
      body: JSON.stringify({
        email: testAdminEmail,
        password: testAdminPassword
      })
    });
    const tokenData = await tokenRes.json();
    testAdminToken = tokenData.access_token;
    console.log(`✅ Temporary test admin provisioned: ${testAdminId}`);
  } catch (err) {
    console.warn('⚠️ Could not provision test admin:', err.message);
  }

  if (testAdminToken) {
    console.log('\n--- RUNNING LIVE AUTHORIZED TESTS ---');

    // 8. Authorized GET /api/admin/members -> 200
    {
      const req = { method: 'GET', url: '/api/admin/members', headers: { authorization: `Bearer ${testAdminToken}` } };
      const res = createMockRes();
      await handler(req, res);
      assert('Authorized GET /api/admin/members returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
      assert('Members list is array', Array.isArray(res.body?.members));
      assert('Zero password exposed in response', !JSON.stringify(res.body).includes('password'));
      assert('Zero secret key exposed in response', !JSON.stringify(res.body).includes('sb_secret_'));
      console.log(`   Registered members retrieved: ${res.body?.members?.length || 0}`);
    }

    // 9. Self-Suspend Prevention -> 400
    {
      const req = {
        method: 'POST',
        url: `/api/admin/members/${testAdminId}/suspend`,
        headers: { authorization: `Bearer ${testAdminToken}` },
        body: { reason: 'Accidental self-suspend attempt' }
      };
      const res = createMockRes();
      await handler(req, res);
      assert('Self-suspend is blocked with 400', res.statusCode === 400, `Got ${res.statusCode}`);
      assert('Error specifies SELF_SUSPEND_PROHIBITED', res.body?.error === 'SELF_SUSPEND_PROHIBITED');
    }

    // 10. Weak Password Rejected -> 400
    {
      const req = {
        method: 'POST',
        url: '/api/admin/members',
        headers: { authorization: `Bearer ${testAdminToken}` },
        body: { employeeCode: 'CPW8888', displayName: 'Staff 8888', temporaryPassword: '123' }
      };
      const res = createMockRes();
      await handler(req, res);
      assert('Weak password rejected with 400', res.statusCode === 400, `Got ${res.statusCode}`);
      assert('Error specifies WEAK_PASSWORD', res.body?.error === 'WEAK_PASSWORD');
    }

    // 11. Password matching employee code -> 400
    {
      const req = {
        method: 'POST',
        url: '/api/admin/members',
        headers: { authorization: `Bearer ${testAdminToken}` },
        body: { employeeCode: 'CPW8888', displayName: 'Staff 8888', temporaryPassword: 'CPW8888' }
      };
      const res = createMockRes();
      await handler(req, res);
      assert('Password matching employee code rejected with 400', res.statusCode === 400, `Got ${res.statusCode}`);
    }

    // 12. Password confirmation mismatch -> 400
    {
      const req = {
        method: 'POST',
        url: '/api/admin/members',
        headers: { authorization: `Bearer ${testAdminToken}` },
        body: {
          employeeCode: 'CPW8888',
          displayName: 'Staff 8888',
          temporaryPassword: 'ValidPass1234!',
          confirmation: 'DifferentPass1234!'
        }
      };
      const res = createMockRes();
      await handler(req, res);
      assert('Confirmation mismatch rejected with 400', res.statusCode === 400, `Got ${res.statusCode}`);
    }

    // 13. Create Member (Valid) -> 201
    const testMemberCode = `CPW${Math.floor(1000 + Math.random() * 9000)}`;
    let createdMemberId = null;
    {
      const req = {
        method: 'POST',
        url: '/api/admin/members',
        headers: { authorization: `Bearer ${testAdminToken}` },
        body: {
          employeeCode: testMemberCode,
          displayName: 'พนักงานทดสอบ สด',
          temporaryPassword: 'TemporaryPass2026!',
          confirmation: 'TemporaryPass2026!'
        }
      };
      const res = createMockRes();
      await handler(req, res);
      assert('Valid member creation returns 201', res.statusCode === 201, `Got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert('Audit event is MEMBER_CREATED', res.body?.audit?.eventType === 'MEMBER_CREATED');
      createdMemberId = res.body?.member?.id;
    }

    if (createdMemberId) {
      // 14. Rename Member -> 200
      {
        const req = {
          method: 'PATCH',
          url: `/api/admin/members/${createdMemberId}`,
          headers: { authorization: `Bearer ${testAdminToken}` },
          body: { displayName: 'พนักงานทดสอบ ชื่อใหม่' }
        };
        const res = createMockRes();
        await handler(req, res);
        assert('Update display name returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
        assert('Audit event is MEMBER_DISPLAY_NAME_UPDATED', res.body?.audit?.eventType === 'MEMBER_DISPLAY_NAME_UPDATED');
      }

      // 15. Reset Password -> 200
      {
        const req = {
          method: 'POST',
          url: `/api/admin/members/${createdMemberId}/reset-password`,
          headers: { authorization: `Bearer ${testAdminToken}` },
          body: { temporaryPassword: 'NewResetPass2026!', confirmation: 'NewResetPass2026!' }
        };
        const res = createMockRes();
        await handler(req, res);
        assert('Reset temporary password returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
        assert('Audit event is MEMBER_PASSWORD_RESET', res.body?.audit?.eventType === 'MEMBER_PASSWORD_RESET');
      }

      // 16. Suspend Member -> 200
      {
        const req = {
          method: 'POST',
          url: `/api/admin/members/${createdMemberId}/suspend`,
          headers: { authorization: `Bearer ${testAdminToken}` },
          body: { reason: 'การทดสอบระงับบัญชีชั่วคราว' }
        };
        const res = createMockRes();
        await handler(req, res);
        assert('Suspend member returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
        assert('Status is SUSPENDED', res.body?.status === 'SUSPENDED');
        assert('Audit event is MEMBER_SUSPENDED', res.body?.audit?.eventType === 'MEMBER_SUSPENDED');
      }

      // 17. Reactivate Member -> 200
      {
        const req = {
          method: 'POST',
          url: `/api/admin/members/${createdMemberId}/reactivate`,
          headers: { authorization: `Bearer ${testAdminToken}` },
          body: {}
        };
        const res = createMockRes();
        await handler(req, res);
        assert('Reactivate member returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
        assert('Status is ACTIVE', res.body?.status === 'ACTIVE');
        assert('Audit event is MEMBER_REACTIVATED', res.body?.audit?.eventType === 'MEMBER_REACTIVATED');
      }

      // Cleanup created test member
      try {
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${createdMemberId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${secretKey}`, 'apikey': secretKey }
        });
      } catch (e) {}
    }

    // Cleanup temporary test admin
    try {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${testAdminId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${secretKey}`, 'apikey': secretKey }
      });
      console.log('🧹 Cleaned up temporary test admin.');
    } catch (e) {}
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
