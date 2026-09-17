/**
 * Vercel Serverless Function: Comprehensive Promotion Import Controller
 * 
 * Endpoints Supported:
 * - POST /api/promotion-imports/validate          -> Validate promotion draft rows against rules, AI bounds & conflicts
 * - POST /api/promotion-imports                  -> Create DRAFT batch, campaign, offers & validation errors
 * - GET  /api/promotion-imports/:batchId         -> Retrieve import batch status and validation error summary
 * 
 * Security & Governance:
 * 1. Bearer JWT required on all mutating operations.
 * 2. Role enforced: STORE_LEADER, STORE_MANAGER, or SYSTEM_ADMIN.
 * 3. Branch scope verified (e.g. AYUTTHAYA_CITY_PARK).
 * 4. Fail-closed: Never auto-publish; saves strictly as DRAFT.
 * 5. Zero credentials or secret keys leaked to response or logs.
 */

const PromotionKnowledgeBase = require('../assets/js/promotion-knowledge-base.js');
const { validatePromotionOption } = require('../assets/js/promotion-calculator.js');

module.exports = async function handler(req, res) {
  const requestId = `req_prm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const rawUrl = process.env.SUPABASE_URL || 'https://anhxzffcmrihymrptsgd.supabase.co';
  const supabaseUrl = rawUrl.replace(/\/+$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9eXmP6Cgb14AWbk8CrBv3A_l0Clj00v').trim();

  // Parse path & route
  const parsedUrl = new URL(req.url, 'http://localhost');
  let pathSegments = parsedUrl.pathname
    .replace(/^\/api\/promotion-imports\/?/i, '')
    .split('/')
    .filter(Boolean);

  if (pathSegments.length === 0 && req.query?.path) {
    const qPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    pathSegments = qPath.split('/').filter(Boolean);
  }

  const subAction = pathSegments[0] || '';
  const batchId = pathSegments[0] && pathSegments[0] !== 'validate' ? pathSegments[0] : (req.query?.batchId || null);

  // Parse JSON Body
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'INVALID_JSON', requestId, message: 'Invalid JSON body' });
    }
  }

  // Helper: Query Supabase PostgREST
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

  // 1. Authenticate caller using Supabase Auth
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  let caller = null;
  if (token) {
    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'apikey': publishableKey,
          'Authorization': `Bearer ${token}`
        }
      });
      if (userRes.ok) {
        caller = await userRes.json();
      }
    } catch (e) {
      console.warn('[PromotionImportAPI] Token verification failed:', e.message);
    }
  }

  // Helper: Authorize Store Leader or System Admin
  async function requireStoreLeader(targetBranchCode) {
    if (!caller) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        code: 'UNAUTHORIZED',
        requestId,
        message: 'Authentication required. Please sign in.'
      });
      return false;
    }

    try {
      const roleRes = await queryPostgrest(`user_roles?user_id=eq.${encodeURIComponent(caller.id)}&select=role,branch_id`);
      if (roleRes.ok) {
        const roles = await roleRes.json();
        if (Array.isArray(roles) && roles.length > 0) {
          const matched = roles.some(r => {
            const roleName = String(r.role || '').toUpperCase();
            const isAuthorized = ['STORE_LEADER', 'STORE_MANAGER', 'SYSTEM_ADMIN', 'ADMIN'].includes(roleName);
            if (!isAuthorized) return false;
            if (roleName === 'SYSTEM_ADMIN' || roleName === 'ADMIN') return true;
            if (!r.branch_id || !targetBranchCode) return true;
            return String(r.branch_id).toUpperCase() === String(targetBranchCode).toUpperCase();
          });
          if (matched) return true;
        }
      }
    } catch (e) {
      console.warn('[PromotionImportAPI] Error querying user_roles:', e.message);
    }

    if (caller.app_metadata?.role === 'SYSTEM_ADMIN' || caller.app_metadata?.role === 'ADMIN') {
      return true;
    }

    res.status(403).json({
      error: 'FORBIDDEN',
      code: 'INSUFFICIENT_PERMISSIONS',
      requestId,
      message: 'Requires STORE_LEADER, STORE_MANAGER, or SYSTEM_ADMIN role.'
    });
    return false;
  }

  // ==========================================================================
  // ROUTE 1: POST /api/promotion-imports/validate -> Validate draft rows
  // ==========================================================================
  if (req.method === 'POST' && subAction === 'validate') {
    const branchCode = String(body.branchCode || 'AYUTTHAYA_CITY_PARK').trim().toUpperCase();
    if (!(await requireStoreLeader(branchCode))) return;

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'EMPTY_ITEMS', message: 'No promotion items provided for validation' });
    }

    const sha256 = String(body.sourceFileSha256 || '').trim().toLowerCase();

    // Check duplicate file in DB
    let duplicate = null;
    if (sha256) {
      const dupRes = await queryPostgrest(
        `promotion_import_batches?branch_code=eq.${encodeURIComponent(branchCode)}&source_file_sha256=eq.${encodeURIComponent(sha256)}&select=id,status,source_file_name,imported_at`
      );
      if (dupRes.ok) {
        const dupes = await dupRes.json();
        if (Array.isArray(dupes) && dupes.length > 0) {
          duplicate = dupes[0];
        }
      }
    }

    let passedCount = 0;
    let warningCount = 0;
    let blockedCount = 0;
    const validatedItems = [];
    const collectedErrors = [];

    for (let idx = 0; idx < items.length; idx++) {
      const raw = items[idx];
      // 1. Apply Knowledge Base Semantic Corrections
      const corrected = PromotionKnowledgeBase.applyKnowledgeBaseCorrections(raw);

      // 2. AI Bounds Validation (Zero Hallucination)
      const bounds = PromotionKnowledgeBase.validateDraftBounds(corrected);

      // 3. Mathematical & Gate Verification
      const mathValidation = validatePromotionOption(corrected);

      // Merge issues
      const rowIssues = [...bounds.issues, ...mathValidation.errors];

      // Calculate confidence score
      const conf = PromotionKnowledgeBase.calculateConfidenceScore(corrected, rowIssues);

      const hasBlocker = rowIssues.some(i => i.severity === 'BLOCKER');
      const hasReview = rowIssues.some(i => i.severity === 'REVIEW_REQUIRED');

      let rowStatus = 'DRAFT';
      if (hasBlocker) {
        rowStatus = 'BLOCKED';
        blockedCount++;
      } else if (hasReview) {
        rowStatus = 'REVIEW_REQUIRED';
        warningCount++;
      } else {
        passedCount++;
      }

      for (const iss of rowIssues) {
        collectedErrors.push({
          sourceRow: corrected.sourceRow || idx + 1,
          inventoryPn: corrected.inventoryPn || null,
          severity: iss.severity || 'WARNING',
          errorCode: iss.code,
          message: iss.message
        });
      }

      validatedItems.push({
        ...corrected,
        rowIndex: idx + 1,
        validationStatus: rowStatus,
        confidenceScore: conf.score,
        confidenceTier: conf.tier,
        confidenceReasons: conf.reasons,
        issues: rowIssues
      });
    }

    return res.status(200).json({
      status: duplicate ? 'DUPLICATE_WARNING' : (blockedCount > 0 ? 'VALIDATION_BLOCKED' : 'VALIDATED'),
      duplicateBatch: duplicate,
      branchCode,
      summary: {
        totalRows: items.length,
        passedRows: passedCount,
        warningRows: warningCount,
        blockedRows: blockedCount
      },
      errors: collectedErrors,
      items: validatedItems,
      valid: blockedCount === 0
    });
  }

  // ==========================================================================
  // ROUTE 2: POST /api/promotion-imports -> Create DRAFT batch and offer records
  // ==========================================================================
  if (req.method === 'POST' && (!subAction || subAction === '')) {
    const branchCode = String(body.branchCode || 'AYUTTHAYA_CITY_PARK').trim().toUpperCase();
    if (!(await requireStoreLeader(branchCode))) return;

    const fileName = String(body.sourceFileName || 'Promotion.xlsx').trim();
    const sha256 = String(body.sourceFileSha256 || '').trim().toLowerCase();
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return res.status(400).json({ error: 'EMPTY_ITEMS', message: 'No promotion items provided' });
    }

    try {
      // 1. Insert promotion_import_batches
      const batchPayload = {
        branch_code: branchCode,
        source_file_name: fileName,
        source_file_sha256: sha256 || `sha_${Date.now()}`,
        status: 'DRAFT',
        total_rows: items.length,
        passed_rows: body.summary?.passedRows || 0,
        warning_rows: body.summary?.warningRows || 0,
        blocked_rows: body.summary?.blockedRows || 0,
        validation_summary: body.summary || {},
        imported_by: caller.id
      };

      const batchRes = await queryPostgrest('promotion_import_batches', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(batchPayload)
      });

      if (!batchRes.ok) {
        const errJson = await batchRes.json().catch(() => ({}));
        return res.status(400).json({ error: 'BATCH_INSERT_FAILED', details: errJson });
      }

      const insertedBatch = (await batchRes.json())[0];
      const newBatchId = insertedBatch.id;

      // 2. Insert promotion_campaigns
      const campaignPayload = {
        import_batch_id: newBatchId,
        branch_code: branchCode,
        campaign_code: body.campaignCode || `CAMP_${Date.now()}`,
        campaign_name: body.campaignName || `Promotion Campaign ${fileName}`,
        start_at: body.startAt || new Date().toISOString(),
        end_at: body.endAt || new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'DRAFT',
        priority: body.priority || 100,
        created_by: caller.id
      };

      const campRes = await queryPostgrest('promotion_campaigns', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(campaignPayload)
      });

      const campaignId = campRes.ok ? (await campRes.json())[0]?.id : null;

      // 3. Insert Validation Errors and Offers
      const errorRecords = [];
      const offerRecords = [];

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const valRes = validatePromotionOption(item);

        if (!valRes.isValid && Array.isArray(valRes.errors)) {
          for (const err of valRes.errors) {
            errorRecords.push({
              import_batch_id: newBatchId,
              campaign_id: campaignId,
              severity: err.severity || 'BLOCKER',
              error_code: err.code || 'VALIDATION_ERROR',
              field_name: err.field || null,
              source_sheet: item.sourceSheet || 'Promotion',
              source_row: item.sourceRow || idx + 1,
              inventory_pn: item.inventoryPn || null,
              message: err.message,
              resolution_status: 'OPEN'
            });
          }
        }

        offerRecords.push({
          campaign_id: campaignId,
          branch_code: branchCode,
          inventory_pn: item.inventoryPn || `UNKNOWN_${idx + 1}`,
          model_name: item.model || item.modelName || null,
          capacity: item.capacity || null,
          offer_code: item.offerCode || `OFFER_${idx + 1}`,
          promotion_type: item.optionType || item.promotionType || 'STANDARD_DISCOUNT',
          coupon_code: item.couponCode || null,
          regular_price: Number(item.regularPrice || 0),
          discount_type: item.discountType || (item.discountPercent ? 'PERCENT' : (item.standardDiscount ? 'FIXED_AMOUNT' : 'NONE')),
          discount_amount: Number(item.standardDiscount || 0),
          discount_percent: Number(item.discountPercent || 0),
          payment_condition: item.paymentCondition || 'ANY',
          customer_segment: item.customerSegment || (item.optionType === 'STUDENT_EXCLUSIVE' ? 'STUDENT' : 'GENERAL'),
          requires_trade_in: item.requiresTradeIn === true,
          down_payment_max_percent: item.downPaymentMaxPercent || null,
          estimated_down_payment: item.estimatedDownPayment || null,
          stacking_policy: item.stackingPolicy || (item.optionType === 'STUDENT_EXCLUSIVE' ? 'EXCLUSIVE' : 'STACKABLE_CONDITIONAL'),
          exclusive_group: item.exclusiveGroup || (item.paymentCondition === 'NON_SF_PLUS' ? 'PAYMENT_PATH' : null),
          blocks_all_other_promotions: item.blocksAllOtherPromotions === true || item.optionType === 'STUDENT_EXCLUSIVE',
          status: valRes.isValid ? 'DRAFT' : 'BLOCKED',
          source_sheet: item.sourceSheet || 'Promotion',
          source_row: item.sourceRow || idx + 1
        });
      }

      if (errorRecords.length > 0) {
        await queryPostgrest('promotion_validation_errors', {
          method: 'POST',
          body: JSON.stringify(errorRecords)
        });
      }

      if (offerRecords.length > 0) {
        await queryPostgrest('promotion_offers', {
          method: 'POST',
          body: JSON.stringify(offerRecords)
        });
      }

      // 4. Write Audit Log
      await queryPostgrest('promotion_audit_logs', {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: campaignId,
          action: 'CREATE_DRAFT_BATCH',
          new_value: { batchId: newBatchId, totalRows: items.length, fileName, errorsCount: errorRecords.length },
          performed_by: caller.id,
          reason: 'Manager uploaded promotion draft'
        })
      });

      return res.status(201).json({
        status: 'DRAFT',
        batchId: newBatchId,
        campaignId,
        branchCode,
        summary: batchPayload.validation_summary,
        message: 'บันทึก Promotion Draft เข้าสู่ระบบเรียบร้อย (สถานะ: DRAFT ต้องผ่านการอนุมัติก่อนใช้งาน)'
      });
    } catch (err) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  // ==========================================================================
  // ROUTE 3: GET /api/promotion-imports/:batchId -> Inspect batch status
  // ==========================================================================
  if (req.method === 'GET' && batchId) {
    try {
      const batchRes = await queryPostgrest(`promotion_import_batches?id=eq.${encodeURIComponent(batchId)}&select=*`);
      if (!batchRes.ok) {
        return res.status(404).json({ error: 'BATCH_NOT_FOUND', batchId });
      }
      const batches = await batchRes.json();
      if (!Array.isArray(batches) || batches.length === 0) {
        return res.status(404).json({ error: 'BATCH_NOT_FOUND', batchId });
      }

      const errorsRes = await queryPostgrest(`promotion_validation_errors?import_batch_id=eq.${encodeURIComponent(batchId)}&select=*`);
      const errors = errorsRes.ok ? await errorsRes.json() : [];

      return res.status(200).json({
        status: 'OK',
        batch: batches[0],
        validationErrors: errors
      });
    } catch (err) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed on this path` });
};
