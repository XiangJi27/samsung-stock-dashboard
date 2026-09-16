/**
 * Vercel Serverless Function: Comprehensive Stock Import Controller
 * 
 * Endpoints Supported:
 * - POST /api/stock-imports/validate              -> Validate stock payload against rules & duplicates
 * - POST /api/stock-imports                       -> Create DRAFT batch & insert snapshot items
 * - POST /api/stock-imports/:id/activate          -> Atomically activate batch via stored procedure
 * - POST /api/stock-imports/:id/rollback          -> Roll back to target batch
 * - GET  /api/stock-imports                       -> List import history for branch
 * 
 * Invariants & Security:
 * 1. Bearer JWT required on mutating operations.
 * 2. Role required: STORE_LEADER, STORE_MANAGER, or SYSTEM_ADMIN.
 * 3. Immutable Snapshot Batches: Never overwrite rows directly.
 * 4. Optimistic Concurrency Lock: EXPECTED_BATCH_MISMATCH protection.
 * 5. Zero secrets leaked to client.
 */

module.exports = async function handler(req, res) {
  const requestId = `req_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const rawUrl = process.env.SUPABASE_URL || 'https://anhxzffcmrihymrptsgd.supabase.co';
  const supabaseUrl = rawUrl.replace(/\/+$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9eXmP6Cgb14AWbk8CrBv3A_l0Clj00v').trim();

  // Parse path & action
  const parsedUrl = new URL(req.url, 'http://localhost');
  let pathSegments = parsedUrl.pathname
    .replace(/^\/api\/stock-imports\/?/i, '')
    .split('/')
    .filter(Boolean);

  if (pathSegments.length === 0 && req.query?.path) {
    const qPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    pathSegments = qPath.split('/').filter(Boolean);
  }

  const subAction = pathSegments[0] || '';
  const batchId = pathSegments[0] && pathSegments[0] !== 'validate' ? pathSegments[0] : (req.query?.batchId || null);
  const actionAfterId = pathSegments[1] || '';

  // Parse JSON Body
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'INVALID_JSON', requestId, message: 'Invalid JSON body' });
    }
  }

  // 1. Authenticate caller
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  let caller = null;
  if (token) {
    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': publishableKey || secretKey
        }
      });
      if (userRes.ok) {
        caller = await userRes.json();
      }
    } catch (e) {
      console.warn('[StockImportAPI] Auth verification error:', e.message);
    }
  }

  const queryKey = secretKey || publishableKey;
  const authHeaderValue = secretKey ? `Bearer ${secretKey}` : (token ? `Bearer ${token}` : `Bearer ${publishableKey}`);

  async function queryPostgrest(path, options = {}) {
    return fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        'apikey': queryKey,
        'Authorization': authHeaderValue,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  async function requireStoreLeader(targetBranchCode) {
    if (!token) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        error: 'UNAUTHORIZED',
        requestId,
        message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ (Authorization header required)'
      });
      return false;
    }

    if (!caller || !caller.id) {
      res.status(401).json({
        code: 'INVALID_ACCESS_TOKEN',
        error: 'INVALID_ACCESS_TOKEN',
        requestId,
        message: 'Access Token ไม่ถูกต้องหรือหมดอายุแล้ว'
      });
      return false;
    }

    // Query user_roles directly from Supabase PostgREST with server authority
    try {
      const roleRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(caller.id)}&select=role,branch_id`, {
        headers: {
          'apikey': secretKey || publishableKey,
          'Authorization': `Bearer ${secretKey || publishableKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (roleRes.ok) {
        const roles = await roleRes.json();
        if (Array.isArray(roles) && roles.length > 0) {
          const matched = roles.some(r => {
            const roleName = String(r.role || '').toUpperCase();
            const isAuthorizedRole = ['STORE_LEADER', 'STORE_MANAGER', 'SYSTEM_ADMIN', 'ADMIN'].includes(roleName);
            if (!isAuthorizedRole) return false;
            // Admins can manage any branch, otherwise branch_id must match targetBranchCode
            if (roleName === 'SYSTEM_ADMIN' || roleName === 'ADMIN') return true;
            if (!r.branch_id || !targetBranchCode) return true;
            return String(r.branch_id).toUpperCase() === String(targetBranchCode).toUpperCase();
          });

          if (matched) {
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('[StockImportAPI] Error querying user_roles:', e.message);
    }

    // Fallback check for system admin in app_metadata
    if (caller.app_metadata?.role === 'SYSTEM_ADMIN' || caller.app_metadata?.role === 'ADMIN') {
      return true;
    }

    res.status(403).json({
      code: 'STOCK_IMPORT_PERMISSION_DENIED',
      error: 'FORBIDDEN',
      requestId,
      message: 'คุณไม่มีสิทธิ์นำเข้าหรือยืนยันสต็อก (เฉพาะ Store Leader / Admin ประจำสาขาเท่านั้น)'
    });
    return false;
  }

  // ROUTE 1: GET /api/stock-imports -> List batch history
  if (req.method === 'GET' && (!subAction || subAction === 'history')) {
    const branchCode = String(req.query?.branch_code || 'AYUTTHAYA_CITY_PARK').trim().toUpperCase();
    try {
      const resDb = await queryPostgrest(
        `stock_import_batches?branch_code=eq.${encodeURIComponent(branchCode)}&order=imported_at.desc&limit=30&select=*`
      );
      if (!resDb.ok) {
        return res.status(500).json({ error: 'QUERY_FAILED', message: 'Failed to fetch batch history' });
      }
      const batches = await resDb.json();
      return res.status(200).json({ status: 'OK', batches });
    } catch (err) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  // ROUTE 2: POST /api/stock-imports/validate -> Validate payload without saving
  if (req.method === 'POST' && subAction === 'validate') {
    const branchCode = String(body.branchCode || 'AYUTTHAYA_CITY_PARK').trim().toUpperCase();
    const sha256 = String(body.sourceFileSha256 || '').trim().toLowerCase();

    // Check duplicate file in DB
    let duplicate = null;
    if (sha256) {
      const dupRes = await queryPostgrest(
        `stock_import_batches?branch_code=eq.${encodeURIComponent(branchCode)}&source_file_sha256=eq.${encodeURIComponent(sha256)}&select=id,status,source_file_name,imported_at`
      );
      if (dupRes.ok) {
        const dupes = await dupRes.json();
        if (Array.isArray(dupes) && dupes.length > 0) {
          duplicate = dupes[0];
        }
      }
    }

    const items = Array.isArray(body.items) ? body.items : [];
    const calculatedF1 = items.reduce((sum, it) => sum + Number(it.f1 || 0), 0);
    const calculatedF2 = items.reduce((sum, it) => sum + Number(it.f2 || 0), 0);

    return res.status(200).json({
      status: duplicate ? 'DUPLICATE_WARNING' : 'VALIDATED',
      duplicateBatch: duplicate,
      branchCode,
      summary: {
        totalRows: items.length,
        f1Total: calculatedF1,
        f2Total: calculatedF2,
        totalQuantity: calculatedF1 + calculatedF2
      },
      valid: true
    });
  }

  // ROUTE 3: POST /api/stock-imports/:batchId/activate -> Atomic activation via Stored Procedure
  if (req.method === 'POST' && batchId && actionAfterId === 'activate') {
    const branchCode = String(body.branchCode || 'AYUTTHAYA_CITY_PARK').trim().toUpperCase();
    if (!(await requireStoreLeader(branchCode))) return;

    const expectedPrev = body.expectedPreviousBatchId || null;
    const userId = caller.id;

    try {
      const rpcRes = await queryPostgrest('rpc/activate_stock_batch', {
        method: 'POST',
        body: JSON.stringify({
          p_branch_code: branchCode,
          p_batch_id: batchId,
          p_expected_previous_batch_id: expectedPrev,
          p_user_id: userId
        })
      });

      if (!rpcRes.ok) {
        const errJson = await rpcRes.json().catch(() => ({}));
        const message = errJson.message || errJson.details || 'Activation failed';
        if (message.includes('EXPECTED_BATCH_MISMATCH')) {
          return res.status(409).json({
            error: 'EXPECTED_BATCH_MISMATCH',
            message: 'Active batch was changed concurrently. Please preview diff again.'
          });
        }
        return res.status(400).json({ error: 'ACTIVATION_ERROR', message });
      }

      const rpcData = await rpcRes.json();
      return res.status(200).json({
        status: 'ACTIVE',
        batchId,
        branchCode,
        details: rpcData
      });
    } catch (err) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  // ROUTE 4: POST /api/stock-imports/:batchId/rollback -> Roll back active snapshot
  if (req.method === 'POST' && batchId && actionAfterId === 'rollback') {
    const branchCode = String(body.branchCode || 'AYUTTHAYA_CITY_PARK').trim().toUpperCase();
    if (!(await requireStoreLeader(branchCode))) return;

    const userId = caller.id;

    try {
      const rpcRes = await queryPostgrest('rpc/rollback_stock_batch', {
        method: 'POST',
        body: JSON.stringify({
          p_branch_code: branchCode,
          p_target_batch_id: batchId,
          p_user_id: userId
        })
      });

      if (!rpcRes.ok) {
        const errJson = await rpcRes.json().catch(() => ({}));
        return res.status(400).json({ error: 'ROLLBACK_FAILED', message: errJson.message || 'Rollback failed' });
      }

      const rpcData = await rpcRes.json();
      return res.status(200).json({ status: 'ROLLED_BACK', details: rpcData });
    } catch (err) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  // ROUTE 5: POST /api/stock-imports -> Create DRAFT batch and insert items
  if (req.method === 'POST') {
    const branchCode = String(body.branchCode || 'AYUTTHAYA_CITY_PARK').trim().toUpperCase();
    if (!(await requireStoreLeader(branchCode))) return;

    const sourceFileName = String(body.sourceFileName || 'Stock.xlsx').trim();
    const sourceFileSha256 = String(body.sourceFileSha256 || '').trim().toLowerCase();
    const items = Array.isArray(body.items) ? body.items : [];
    const summary = body.summary || {};

    if (!sourceFileSha256 || !/^[0-9a-f]{64}$/.test(sourceFileSha256)) {
      return res.status(400).json({ error: 'INVALID_SHA256', message: 'Valid 64-character SHA-256 hash required' });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'EMPTY_ITEMS', message: 'Snapshot items list cannot be empty' });
    }

    // 1. Verify reconciliation totals
    const calculatedF1 = items.reduce((sum, it) => sum + Number(it.f1 || 0), 0);
    const calculatedF2 = items.reduce((sum, it) => sum + Number(it.f2 || 0), 0);
    const totalRows = items.length;

    if (summary.totalRows != null && summary.totalRows !== totalRows) {
      return res.status(422).json({
        error: 'TOTAL_ROWS_MISMATCH',
        message: `Expected ${summary.totalRows} rows, got ${totalRows}`
      });
    }

    // 2. Check for duplicate file hash in branch
    const dupCheck = await queryPostgrest(
      `stock_import_batches?branch_code=eq.${encodeURIComponent(branchCode)}&source_file_sha256=eq.${encodeURIComponent(sourceFileSha256)}&select=id,status`
    );
    if (dupCheck.ok) {
      const dupes = await dupCheck.json();
      if (Array.isArray(dupes) && dupes.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_SOURCE_FILE',
          message: `ไฟล์นี้ (${sourceFileName}) เคยถูกนำเข้าแล้วในระบบ`,
          existingBatchId: dupes[0].id,
          existingStatus: dupes[0].status
        });
      }
    }

    // 3. Create Draft Batch
    const batchPayload = {
      branch_code: branchCode,
      source_type: 'NIMBUS_EXCEL',
      source_file_name: sourceFileName,
      source_file_sha256: sourceFileSha256,
      status: 'DRAFT',
      total_rows: totalRows,
      f1_total: calculatedF1,
      f2_total: calculatedF2,
      imported_by: caller.id,
      validation_summary: {
        totalRows,
        f1Total: calculatedF1,
        f2Total: calculatedF2,
        totalQuantity: calculatedF1 + calculatedF2,
        sourceFilename: sourceFileName,
        sourceFileSha256
      }
    };

    const createBatchRes = await queryPostgrest('stock_import_batches', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(batchPayload)
    });

    if (!createBatchRes.ok) {
      const errText = await createBatchRes.text();
      return res.status(500).json({ error: 'CREATE_BATCH_FAILED', message: errText });
    }

    const createdBatches = await createBatchRes.json();
    const newBatch = createdBatches[0];
    const newBatchId = newBatch.id;

    // 4. Insert Items in Chunks of 100 to avoid payload size limits
    const CHUNK_SIZE = 100;
    const formattedItems = items.map(it => ({
      batch_id: newBatchId,
      branch_code: branchCode,
      inventory_pn: String(it.inventoryPn || it.pn).trim().toUpperCase(),
      barcode: it.barcode ? String(it.barcode).trim() : null,
      description: String(it.description || '').trim(),
      brand: it.brand ? String(it.brand).trim() : null,
      category: it.category ? String(it.category).trim() : null,
      cat1: it.cat1 ? String(it.cat1).trim() : null,
      cat2: it.cat2 ? String(it.cat2).trim() : null,
      cat3: it.cat3 ? String(it.cat3).trim() : null,
      color: it.color ? String(it.color).trim() : null,
      erp_rrp: it.erpRrp != null ? Number(it.erpRrp) : (it.price != null ? Number(it.price) : null),
      f1: Math.max(0, parseInt(it.f1, 10) || 0),
      f2: Math.max(0, parseInt(it.f2, 10) || 0),
      source_rows: it.sourceRows || {}
    }));

    for (let i = 0; i < formattedItems.length; i += CHUNK_SIZE) {
      const chunk = formattedItems.slice(i, i + CHUNK_SIZE);
      const insertChunkRes = await queryPostgrest('stock_snapshot_items', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(chunk)
      });

      if (!insertChunkRes.ok) {
        const errText = await insertChunkRes.text();
        console.error('[StockImportAPI] Chunk insert failed:', errText);
        // Rollback draft batch
        await queryPostgrest(`stock_import_batches?id=eq.${encodeURIComponent(newBatchId)}`, {
          method: 'DELETE'
        });
        return res.status(500).json({
          error: 'ITEMS_INSERT_FAILED',
          message: `Failed to insert snapshot items at chunk ${i / CHUNK_SIZE + 1}`,
          details: errText
        });
      }
    }

    return res.status(201).json({
      status: 'DRAFT_CREATED',
      batchId: newBatchId,
      branchCode,
      sourceFileName,
      sourceFileSha256,
      summary: {
        totalRows,
        f1Total: calculatedF1,
        f2Total: calculatedF2,
        totalQuantity: calculatedF1 + calculatedF2
      }
    });
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
};
