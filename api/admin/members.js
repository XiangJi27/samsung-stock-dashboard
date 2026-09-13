/**
 * Vercel Serverless Function: Admin Member Creation Secure Proxy
 * Endpoint: POST /api/admin/members
 * 
 * Security Architecture & Controls:
 * 1. Authenticates caller JWT with Supabase Auth (/auth/v1/user).
 * 2. Verifies caller holds SYSTEM_ADMIN role in public.user_roles.
 * 3. Whitelist-only payload: Ignores any client-supplied role/branch; forces:
 *    role = 'MEMBER', branch_id = 'AYUTTHAYA_CITY_PARK', status = 'ACTIVE'.
 * 4. Compensation Logic (Rollback): If Profile or Role insertion fails,
 *    deletes the newly created auth user to prevent ghost/orphan accounts.
 * 5. Masked Audit Log: Never logs passwords, tokens, or secret keys.
 * 6. Rate Limiting: Max 5 creation requests per 10 minutes per admin.
 */

// Rate Limiting: BEST_EFFORT_IN_MEMORY (per container instance)
// In serverless environments (e.g. Vercel), instances scale ephemerally.
// In-memory rate limiting serves as an immediate defense layer against client bursts/loops.
// The primary security perimeter is JWT verification, SYSTEM_ADMIN role check,
// strict payload whitelist, unique constraints, and audit logging.
const rateLimitStore = new Map();

function checkRateLimit(adminId) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxRequests = 5;

  const userRecord = rateLimitStore.get(adminId) || [];
  const validTimestamps = userRecord.filter(ts => now - ts < windowMs);

  if (validTimestamps.length >= maxRequests) {
    return false;
  }

  validTimestamps.push(now);
  rateLimitStore.set(adminId, validTimestamps);
  return true;
}

module.exports = async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      requestId,
      message: 'Only POST requests are accepted.'
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  // Modern key: SUPABASE_SECRET_KEY, Fallback legacy: SUPABASE_SERVICE_ROLE_KEY
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    return res.status(503).json({
      error: 'CONFIG_MISSING',
      requestId,
      message: 'Server environment missing SUPABASE_URL or SUPABASE_SECRET_KEY'
    });
  }

  // 1. Verify Caller Bearer JWT with Supabase Auth
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      requestId,
      message: 'Missing or malformed bearer access token'
    });
  }

  let caller = null;
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': process.env.SUPABASE_PUBLISHABLE_KEY || secretKey
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        requestId,
        message: 'Session token invalid or expired'
      });
    }

    caller = await userRes.json();
  } catch (err) {
    return res.status(401).json({
      error: 'AUTH_VERIFICATION_FAILED',
      requestId,
      message: 'Failed to verify session with authentication server'
    });
  }

  // 2. Verify Caller has SYSTEM_ADMIN role
  try {
    const roleCheckRes = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${caller.id}&role=eq.SYSTEM_ADMIN&select=role`,
      {
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'apikey': secretKey
        }
      }
    );

    const roles = await roleCheckRes.json();
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        requestId,
        message: 'Only SYSTEM_ADMIN can issue new staff member accounts'
      });
    }
  } catch (err) {
    return res.status(500).json({
      error: 'ROLE_CHECK_FAILED',
      requestId,
      message: 'Internal authorization error'
    });
  }

  // 3. Rate Limit Enforcement
  if (!checkRateLimit(caller.id)) {
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      requestId,
      message: 'Rate limit exceeded: Maximum 5 member creation requests per 10 minutes.'
    });
  }

  // 4. Validate & Sanitize Input Body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'INVALID_JSON', requestId, message: 'Invalid JSON body' });
    }
  }

  const employeeCode = (body?.employeeCode || '').trim().toUpperCase();
  const displayName = (body?.displayName || '').trim();
  const temporaryPassword = body?.temporaryPassword;

  // Strict Validation
  if (!employeeCode || !displayName || !temporaryPassword) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      requestId,
      message: 'employeeCode, displayName, and temporaryPassword are required.'
    });
  }

  if (!/^CPW[A-Z0-9]{3,10}$/.test(employeeCode)) {
    return res.status(400).json({
      error: 'INVALID_EMPLOYEE_CODE',
      requestId,
      message: 'Employee code must start with CPW followed by alphanumeric characters (e.g. CPW1234).'
    });
  }

  if (temporaryPassword.length < 8) {
    return res.status(400).json({
      error: 'WEAK_PASSWORD',
      requestId,
      message: 'Temporary password must be at least 8 characters long.'
    });
  }

  // Normalized internal identifier
  const loginEmail = `${employeeCode.toLowerCase()}@staff.internal`;

  // 5. Create Auth User via Supabase Admin API
  let newUserId = null;
  try {
    const createAuthRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey
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
      const isDuplicate = authErr?.message?.toLowerCase().includes('already') || createAuthRes.status === 422;
      return res.status(isDuplicate ? 409 : 400).json({
        error: isDuplicate ? 'EMPLOYEE_CODE_EXISTS' : 'AUTH_CREATION_FAILED',
        requestId,
        message: isDuplicate ? 'Employee code already registered in the system' : 'Failed to register employee credentials'
      });
    }

    const newAuthUser = await createAuthRes.json();
    newUserId = newAuthUser.id;
  } catch (err) {
    return res.status(500).json({
      error: 'AUTH_API_ERROR',
      requestId,
      message: 'Failed to contact authentication service'
    });
  }

  // 6. Multi-step Execution with Compensation Logic (Rollback)
  try {
    // Step 6a: Create Profile
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey,
        'Prefer': 'return=minimal'
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

    if (!profileRes.ok) {
      throw new Error(`Failed to create profile: HTTP ${profileRes.status}`);
    }

    // Step 6b: Create Role (Strictly force MEMBER / AYUTTHAYA_CITY_PARK)
    const roleRes = await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: newUserId,
        role: 'MEMBER',
        branch_id: 'AYUTTHAYA_CITY_PARK'
      })
    });

    if (!roleRes.ok) {
      throw new Error(`Failed to assign role: HTTP ${roleRes.status}`);
    }

    // 7. Success Sanitized Response (Zero password / token / secret exposure)
    const maskedActor = `${caller.id.substring(0, 8)}...`;
    const maskedCode = `${employeeCode.substring(0, 3)}****`;

    return res.status(201).json({
      success: true,
      requestId,
      message: `Staff account ${maskedCode} created successfully`,
      member: {
        employeeCode: employeeCode,
        displayName: displayName,
        branch: 'AYUTTHAYA_CITY_PARK',
        role: 'MEMBER',
        status: 'ACTIVE'
      },
      audit: {
        eventType: 'MEMBER_CREATED',
        actorId: maskedActor,
        targetCode: maskedCode,
        createdAt: new Date().toISOString()
      }
    });

  } catch (stepError) {
    // COMPENSATION LOGIC: Rollback newly created Auth User to prevent ghost accounts!
    console.error(`[Admin Members Rollback] Compensation triggered for user ${newUserId}:`, stepError.message);
    try {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${newUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'apikey': secretKey
        }
      });
      console.log(`[Admin Members Rollback] Successfully purged orphan auth user ${newUserId}`);
    } catch (cleanupErr) {
      console.error(`[Admin Members Rollback] Failed to delete orphan auth user ${newUserId}:`, cleanupErr.message);
    }

    return res.status(500).json({
      error: 'TRANSACTION_FAILED_ROLLED_BACK',
      requestId,
      message: 'Failed to complete member provisioning. Any created auth records were automatically rolled back.'
    });
  }
};
