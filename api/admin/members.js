/**
 * Vercel Serverless Function: Admin Member Creation Secure Proxy
 * Endpoint: POST /api/admin/members
 * 
 * Security Architecture:
 * - Requires caller to be authenticated as SYSTEM_ADMIN.
 * - Uses SUPABASE_SERVICE_ROLE_KEY strictly on the server-side.
 * - Creates Auth User -> Profile -> user_roles (MEMBER / AYUTTHAYA_CITY_PARK).
 * - Never returns password or private service keys to browser.
 */

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are accepted.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({
      error: 'CONFIG_MISSING',
      message: 'Server environment missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    });
  }

  // 1. Verify Caller JWT
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing bearer access token' });
  }

  try {
    // 2. Validate user identity with Supabase Auth
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': process.env.SUPABASE_PUBLISHABLE_KEY || serviceRoleKey
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session token invalid or expired' });
    }

    const caller = await userRes.json();

    // 3. Verify Caller has SYSTEM_ADMIN role in public.user_roles
    const roleCheckRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${caller.id}&role=eq.SYSTEM_ADMIN&select=role`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      }
    });

    const roles = await roleCheckRes.json();
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only SYSTEM_ADMIN can issue new staff member accounts'
      });
    }

    // 4. Parse request payload
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const employeeCode = (body.employeeCode || '').trim().toUpperCase();
    const displayName = (body.displayName || '').trim();
    const temporaryPassword = body.temporaryPassword;

    if (!employeeCode || !displayName || !temporaryPassword) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'employeeCode, displayName, and temporaryPassword are required'
      });
    }

    if (temporaryPassword.length < 8) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Temporary password must be at least 8 characters'
      });
    }

    const loginEmail = `${employeeCode.toLowerCase()}@staff.internal`;

    // 5. Create Auth User via Supabase Admin API
    const createAuthRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        email: loginEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { employee_code: employeeCode, display_name: displayName }
      })
    });

    if (!createAuthRes.ok) {
      const authErr = await createAuthRes.json();
      return res.status(400).json({
        error: 'AUTH_CREATION_FAILED',
        message: authErr.message || 'Failed to create auth user'
      });
    }

    const newAuthUser = await createAuthRes.json();
    const newUserId = newAuthUser.id;

    // 6. Create Profile record
    await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: newUserId,
        employee_code: employeeCode,
        display_name: displayName,
        branch_id: 'AYUTTHAYA_CITY_PARK',
        job_title: 'Sales Staff (พนักงานขาย)',
        status: 'ACTIVE'
      })
    });

    // 7. Grant MEMBER role
    await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        user_id: newUserId,
        role: 'MEMBER',
        branch_id: 'AYUTTHAYA_CITY_PARK'
      })
    });

    return res.status(201).json({
      success: true,
      message: `Staff account ${employeeCode} created successfully`,
      member: {
        id: newUserId,
        employeeCode: employeeCode,
        displayName: displayName,
        branch: 'AYUTTHAYA_CITY_PARK',
        role: 'MEMBER',
        status: 'ACTIVE'
      }
    });

  } catch (err) {
    console.error('[Admin Members API Error]:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
};
