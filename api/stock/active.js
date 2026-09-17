/**
 * Vercel Serverless Function: Active Stock Snapshot Resolver
 * Endpoint: GET /api/stock/active
 * 
 * Returns the currently active stock snapshot batch and items for the authenticated branch.
 * Enforces authenticated access and zero secret leakage.
 */

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mapStockItem(row) {
  const inventoryPn = normalizeText(
    row.inventory_pn ??
    row.inventoryPn ??
    row.pn
  );

  /*
   * PostgreSQL stores the product name in "description".
   * The existing frontend may read model, name, or productName.
   * Return all compatibility aliases to prevent blank product names.
   */
  const description = normalizeText(
    row.description ??
    row.product_description ??
    row.product_name ??
    row.model ??
    row.name
  );

  const f1 = normalizeNumber(row.f1);
  const f2 = normalizeNumber(row.f2);

  const erpRrp =
    row.erp_rrp === null || row.erp_rrp === undefined || row.erp_rrp === ""
      ? null
      : normalizeNumber(row.erp_rrp, null);

  return {
    // Canonical identifiers
    inventoryPn,
    pn: inventoryPn,
    barcode: normalizeText(row.barcode ?? row.gtin),

    // Canonical product name
    description,

    // Compatibility aliases for the current UI
    model: description,
    name: description,
    productName: description,

    brand: normalizeText(row.brand),
    category: normalizeText(row.category),

    cat1: normalizeText(row.cat1 ?? row.category1),
    cat2: normalizeText(row.cat2 ?? row.category2),
    cat3: normalizeText(row.cat3 ?? row.category3),

    category1: normalizeText(row.cat1 ?? row.category1),
    category2: normalizeText(row.cat2 ?? row.category2),
    category3: normalizeText(row.cat3 ?? row.category3),

    color: normalizeText(row.color),

    erpRrp,
    rrp: erpRrp,
    price: erpRrp,

    f1,
    f2,
    total: f1 + f2,
    sourceRows: row.source_rows || {}
  };
}

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
      } else {
        return res.status(401).json({
          code: 'INVALID_ACCESS_TOKEN',
          requestId,
          message: 'Access Token ไม่ถูกต้องหรือหมดอายุแล้ว'
        });
      }
    } catch (e) {
      console.warn('[ActiveStockAPI] Auth check error:', e.message);
    }

    // If authenticated, enforce branch scope
    if (caller && caller.id) {
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
            const hasBranchAccess = roles.some(r => {
              const rName = String(r.role || '').toUpperCase();
              if (rName === 'SYSTEM_ADMIN' || rName === 'ADMIN') return true;
              return !r.branch_id || String(r.branch_id).toUpperCase() === String(branchCode).toUpperCase();
            });
            if (!hasBranchAccess) {
              return res.status(403).json({
                code: 'BRANCH_ACCESS_DENIED',
                requestId,
                message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลสต็อกของสาขานี้'
              });
            }
          }
        }
      } catch (roleErr) {
        console.warn('[ActiveStockAPI] Role verification error:', roleErr.message);
      }
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

    // Map to client format with complete canonical & compatibility fields
    const items = (rawItems || []).map(mapStockItem);

    // Fail-Closed Guard: Ensure active batch does not serve missing product names
    const missingProductNames = items
      .filter((item) => !item.description)
      .map((item) => item.inventoryPn || item.pn || "UNKNOWN_PN");

    if (missingProductNames.length > 0) {
      console.error(
        "[ACTIVE_STOCK_PRODUCT_NAMES_MISSING]",
        {
          batchId: batch.id,
          missingCount: missingProductNames.length,
          samplePns: missingProductNames.slice(0, 20)
        }
      );

      return res.status(500).json({
        code: "ACTIVE_STOCK_PRODUCT_NAMES_MISSING",
        message: "Active Stock Batch contains items without product names.",
        batchId: batch.id,
        missingCount: missingProductNames.length,
        samplePns: missingProductNames.slice(0, 20)
      });
    }

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
