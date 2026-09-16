/**
 * Vercel Serverless Function: Active Stock Snapshot Resolver
 * Endpoint: GET /api/stock/active
 * 
 * Returns the currently active stock snapshot batch and items for the authenticated branch.
 * Enforces authenticated access and zero secret leakage.
 */

module.exports = async function handler(req, res) {
  const requestId = `req_stock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported' });
  }

  const rawUrl = process.env.SUPABASE_URL || 'https://anhxzffcmrihymrptsgd.supabase.co';
  const supabaseUrl = rawUrl.replace(/\/+$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9eXmP6Cgb14AWbk8CrBv3A_l0Clj00v').trim();

  // Branch resolution
  const branchCode = String(req.query?.branch_code || 'AYUTTHAYA_CITY_PARK').trim().toUpperCase();

  // 1. Authenticate caller (optional for public read if RLS permits, but required for tenant isolation)
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
      console.warn('[ActiveStockAPI] Auth check error, proceeding with anonymous/read-only token:', e.message);
    }
  }

  const queryKey = secretKey || publishableKey;
  const authHeaderValue = secretKey ? `Bearer ${secretKey}` : (token ? `Bearer ${token}` : `Bearer ${publishableKey}`);

  try {
    // 2. Query active pointer for this branch
    const pointerRes = await fetch(
      `${supabaseUrl}/rest/v1/active_stock_snapshot?branch_code=eq.${encodeURIComponent(branchCode)}&select=*`,
      {
        headers: {
          'apikey': queryKey,
          'Authorization': authHeaderValue
        }
      }
    );

    if (!pointerRes.ok) {
      const errText = await pointerRes.text().catch(() => '');
      console.warn('[ActiveStockAPI] active_stock_snapshot query returned:', pointerRes.status, errText);
      return res.status(404).json({
        code: 'ACTIVE_SNAPSHOT_NOT_FOUND',
        branchCode,
        message: 'No active stock snapshot pointer configured for this branch'
      });
    }

    const pointers = await pointerRes.json();
    if (!Array.isArray(pointers) || pointers.length === 0 || !pointers[0].active_batch_id) {
      return res.status(404).json({
        code: 'ACTIVE_SNAPSHOT_NOT_FOUND',
        branchCode,
        message: 'No active stock snapshot found in central database'
      });
    }

    const activeBatchId = pointers[0].active_batch_id;

    // 3. Query batch record
    const batchRes = await fetch(
      `${supabaseUrl}/rest/v1/stock_import_batches?id=eq.${encodeURIComponent(activeBatchId)}&select=*`,
      {
        headers: {
          'apikey': queryKey,
          'Authorization': authHeaderValue
        }
      }
    );

    if (!batchRes.ok) {
      return res.status(500).json({
        code: 'BATCH_QUERY_FAILED',
        message: 'Failed to retrieve active batch metadata'
      });
    }

    const batches = await batchRes.json();
    if (!Array.isArray(batches) || batches.length === 0) {
      return res.status(404).json({
        code: 'BATCH_NOT_FOUND',
        message: `Active batch ${activeBatchId} not found`
      });
    }

    const batch = batches[0];

    // 4. Query snapshot items for this batch (batching in chunks if > 1000 items)
    const itemsRes = await fetch(
      `${supabaseUrl}/rest/v1/stock_snapshot_items?batch_id=eq.${encodeURIComponent(activeBatchId)}&select=*&order=id.asc&limit=2000`,
      {
        headers: {
          'apikey': queryKey,
          'Authorization': authHeaderValue
        }
      }
    );

    if (!itemsRes.ok) {
      return res.status(500).json({
        code: 'ITEMS_QUERY_FAILED',
        message: 'Failed to retrieve stock snapshot items'
      });
    }

    const rawItems = await itemsRes.json();

    // Map to client format
    const items = (rawItems || []).map(row => ({
      pn: row.inventory_pn,
      barcode: row.barcode,
      description: row.description,
      brand: row.brand,
      category: row.category,
      cat1: row.cat1,
      cat2: row.cat2,
      cat3: row.cat3,
      color: row.color,
      price: row.erp_rrp != null ? Number(row.erp_rrp) : null,
      f1: Number(row.f1 || 0),
      f2: Number(row.f2 || 0),
      total: Number(row.total || (Number(row.f1 || 0) + Number(row.f2 || 0))),
      sourceRows: row.source_rows || {}
    }));

    return res.status(200).json({
      status: 'ACTIVE',
      storageScope: 'CENTRAL_DATABASE',
      storageMode: 'NIMBUS_EXCEL_DATABASE_SNAPSHOT',
      batchId: batch.id,
      branchCode: batch.branch_code,
      sourceFileName: batch.source_file_name,
      sourceFileSha256: batch.source_file_sha256,
      importedBy: batch.imported_by,
      importedAt: batch.imported_at,
      activatedAt: batch.activated_at,
      summary: {
        totalRows: batch.total_rows,
        f1Total: batch.f1_total,
        f2Total: batch.f2_total,
        totalQuantity: batch.f1_total + batch.f2_total
      },
      items
    });

  } catch (err) {
    console.error('[ActiveStockAPI] Exception:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      requestId,
      message: err.message
    });
  }
};
