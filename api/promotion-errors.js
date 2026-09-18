/**
 * Vercel Serverless Function: Dedicated Promotion Error Resolution Controller
 * 
 * Endpoints Supported:
 * - POST /api/promotion-errors/:errorId/resolve
 * 
 * Architectural & Security Principles:
 * 1. Client sends "intent" (resolutionStatus, resolutionCode, resolutionNote, expectedStatus).
 * 2. Client NEVER supplies caller identity: req.body.userId is strictly ignored.
 * 3. Server validates JWT with Supabase Auth (/auth/v1/user) to extract verified caller.id.
 * 4. Server verifies caller roles (STORE_LEADER, STORE_MANAGER, SYSTEM_ADMIN) and branch scope.
 * 5. Server invokes transactional RPC resolve_promotion_validation_error with verified caller.id.
 * 6. Audit Trail records comprehensive Actor Metadata distinguishing decision maker from technical executor.
 */

module.exports = async function handler(req, res) {
  const requestId = `req_err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const rawUrl = process.env.SUPABASE_URL || 'https://anhxzffcmrihymrptsgd.supabase.co';
  const supabaseUrl = rawUrl.replace(/\/+$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9eXmP6Cgb14AWbk8CrBv3A_l0Clj00v').trim();

  // Parse path & route
  const parsedUrl = new URL(req.url, 'http://localhost');
  let pathSegments = parsedUrl.pathname
    .replace(/^\/api\/promotion-errors\/?/i, '')
    .split('/')
    .filter(Boolean);

  if (pathSegments.length === 0 && req.query?.path) {
    const qPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    pathSegments = qPath.split('/').filter(Boolean);
  }

  const errorId = pathSegments[0] || (req.query?.errorId || null);
  const action = pathSegments[1] || (req.query?.action || 'resolve');

  // Parse JSON Body
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ status: 'ERROR', code: 'INVALID_JSON', requestId, message: 'Invalid JSON body' });
    }
  }

  // Helper: Query PostgREST with server secret key
  async function queryPostgrest(endpoint, options = {}) {
    const headers = {
      'apikey': secretKey || publishableKey,
      'Authorization': `Bearer ${secretKey || publishableKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    return fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
      ...options,
      headers
    });
  }

  // 1. Authentication: Extract and Verify Bearer Token
  const authHeader = String(req.headers.authorization || '').trim();
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const accessToken = tokenMatch ? tokenMatch[1].trim() : null;

  if (!accessToken) {
    return res.status(401).json({
      status: 'ERROR',
      code: 'AUTHENTICATION_REQUIRED',
      requestId,
      message: 'กรุณาเข้าสู่ระบบใหม่'
    });
  }

  let verifiedUser = null;
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': publishableKey,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    if (userRes.ok) {
      verifiedUser = await userRes.json();
    }
  } catch (err) {
    console.warn('[PromotionErrorsAPI] Auth verification error:', err.message);
  }

  if (!verifiedUser || !verifiedUser.id) {
    return res.status(401).json({
      status: 'ERROR',
      code: 'INVALID_ACCESS_TOKEN',
      requestId,
      message: 'Session ไม่ถูกต้องหรือหมดอายุ'
    });
  }

  // CRITICAL SECURITY INVARIANT: Caller identity is exclusively bound to verified JWT subject.
  // Any client-supplied body.userId or body.p_user_id is strictly ignored.
  const callerUserId = verifiedUser.id;

  if (req.method !== 'POST' || (action !== 'resolve' && action !== '')) {
    return res.status(405).json({
      status: 'ERROR',
      code: 'METHOD_NOT_ALLOWED',
      requestId,
      message: 'Method not allowed. Supported: POST /api/promotion-errors/:errorId/resolve'
    });
  }

  if (!errorId) {
    return res.status(400).json({
      status: 'ERROR',
      code: 'ERROR_ID_REQUIRED',
      requestId,
      message: 'จำเป็นต้องระบุ errorId ใน path'
    });
  }

  try {
    // 2. Load Error Record to verify existence and get associated campaign
    const errorRes = await queryPostgrest(`promotion_validation_errors?id=eq.${encodeURIComponent(errorId)}&select=id,campaign_id,severity,error_code,resolution_status,resolution_code`);
    if (!errorRes.ok) {
      return res.status(500).json({ status: 'ERROR', code: 'DATABASE_QUERY_ERROR', requestId, message: 'Failed to load error record' });
    }
    const errorRows = await errorRes.json();
    if (!Array.isArray(errorRows) || errorRows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'PROMOTION_VALIDATION_ERROR_NOT_FOUND',
        requestId,
        message: 'ไม่พบรายการข้อผิดพลาดที่ระบุ'
      });
    }
    const errorRecord = errorRows[0];

    // 3. Authorization: Check user_roles
    const roleRes = await queryPostgrest(`user_roles?user_id=eq.${encodeURIComponent(callerUserId)}&select=role,branch_id`);
    let roles = [];
    if (roleRes.ok) {
      roles = await roleRes.json();
    }

    const allowedRoles = new Set(['STORE_LEADER', 'STORE_MANAGER', 'SYSTEM_ADMIN', 'ADMIN']);
    const callerRoles = Array.isArray(roles) ? roles.filter(r => allowedRoles.has(String(r.role || '').toUpperCase())) : [];

    const isSystemAdmin = callerRoles.some(r => ['SYSTEM_ADMIN', 'ADMIN'].includes(String(r.role || '').toUpperCase())) ||
      ['SYSTEM_ADMIN', 'ADMIN'].includes(String(verifiedUser.app_metadata?.role || '').toUpperCase());

    if (callerRoles.length === 0 && !isSystemAdmin) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'PROMOTION_MANAGEMENT_PERMISSION_DENIED',
        requestId,
        message: 'บัญชีนี้ไม่มีสิทธิ์จัดการโปรโมชั่น'
      });
    }

    // Check Branch Scope for Store Leader / Store Manager
    if (!isSystemAdmin) {
      const campRes = await queryPostgrest(`promotion_campaigns?id=eq.${encodeURIComponent(errorRecord.campaign_id)}&select=branch_code`);
      if (campRes.ok) {
        const campRows = await campRes.json();
        const campaignBranch = campRows[0]?.branch_code || 'AYUTTHAYA_CITY_PARK';
        const hasMatchingBranch = callerRoles.some(r => {
          if (!r.branch_id) return false;
          const userBranch = String(r.branch_id).trim().toUpperCase();
          const campBranchNorm = String(campaignBranch).trim().toUpperCase();
          return userBranch === campBranchNorm;
        });

        if (!hasMatchingBranch) {
          return res.status(403).json({
            status: 'ERROR',
            code: 'BRANCH_SCOPE_MISMATCH',
            requestId,
            message: 'บัญชีนี้ไม่มีสิทธิ์จัดการโปรโมชั่นของสาขานี้'
          });
        }
      }
    }

    // 4. Validate Resolution Input
    const resolutionStatus = String(body.resolutionStatus || 'REJECTED').trim().toUpperCase();
    const resolutionCode = body.resolutionCode ? String(body.resolutionCode).trim() : null;
    const resolutionNote = String(body.resolutionNote || body.note || '').trim();
    const expectedStatus = String(body.expectedStatus || body.expectedCurrentStatus || 'OPEN').trim().toUpperCase();

    if (!resolutionNote) {
      return res.status(422).json({
        status: 'ERROR',
        code: 'RESOLUTION_NOTE_REQUIRED',
        requestId,
        message: 'จำเป็นต้องระบุเหตุผลในการตัดสินใจ (resolutionNote)'
      });
    }

    // 5. Invoke PostgreSQL Stored Procedure Transactionally
    const rpcRes = await queryPostgrest('rpc/resolve_promotion_validation_error', {
      method: 'POST',
      body: JSON.stringify({
        p_error_id: errorId,
        p_user_id: callerUserId,
        p_resolution_status: resolutionStatus,
        p_resolution_code: resolutionCode,
        p_resolution_note: resolutionNote,
        p_expected_status: expectedStatus
      })
    });

    if (!rpcRes.ok) {
      const errJson = await rpcRes.json().catch(() => ({}));
      const message = errJson.message || errJson.details || 'Resolution failed';

      if (message.includes('RESOLUTION_STATUS_MISMATCH') || message.includes('EXPECTED_STATUS_MISMATCH')) {
        return res.status(409).json({
          status: 'ERROR',
          code: 'EXPECTED_STATUS_MISMATCH',
          requestId,
          message: `สถานะปัจจุบันของรายการไม่ตรงกับที่ระบุ (คาดหวัง ${expectedStatus} แต่อาจถูกตัดสินไปแล้ว)`
        });
      }

      if (message.includes('VALIDATION_ERROR_NOT_FOUND')) {
        return res.status(404).json({
          status: 'ERROR',
          code: 'PROMOTION_VALIDATION_ERROR_NOT_FOUND',
          requestId,
          message: 'ไม่พบรายการข้อผิดพลาดที่ระบุ'
        });
      }

      return res.status(400).json({
        status: 'ERROR',
        code: 'RESOLUTION_RPC_FAILED',
        requestId,
        message
      });
    }

    const rpcResult = await rpcRes.json();

    // 6. Record Actor Metadata in Audit Log
    const actorMetadata = {
      decisionByUserId: callerUserId,
      executedByActor: 'PROMOTION_SERVER_API',
      authenticationMethod: 'VERIFIED_USER_JWT',
      sourceInterface: body.sourceInterface || 'MANAGER_REVIEW_UI',
      requestId
    };

    try {
      await queryPostgrest('promotion_audit_logs', {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: errorRecord.campaign_id,
          action: 'RESOLVE_PROMOTION_ERROR',
          performed_by: callerUserId,
          reason: resolutionNote,
          new_value: {
            errorId,
            status: resolutionStatus,
            resolutionCode: resolutionCode,
            actorMetadata
          }
        })
      });
    } catch (auditErr) {
      console.warn('[PromotionErrorsAPI] Audit log recording warning:', auditErr.message);
    }

    // 7. Success Response
    return res.status(200).json({
      status: 'RESOLVED',
      errorId,
      campaignId: errorRecord.campaign_id,
      resolutionStatus,
      resolutionCode,
      resolvedBy: callerUserId,
      authenticationMethod: 'VERIFIED_USER_JWT',
      executedBy: 'PROMOTION_SERVER_API',
      actorMetadata,
      details: rpcResult,
      message: `บันทึกผลการตัดสินข้อผิดพลาด ${errorId} สำเร็จ (${resolutionStatus}: ${resolutionCode || 'DEFAULT'})`
    });

  } catch (err) {
    console.error('[PromotionErrorsAPI] Unexpected error:', err);
    return res.status(500).json({
      status: 'ERROR',
      code: 'SERVER_ERROR',
      requestId,
      message: err.message
    });
  }
};
