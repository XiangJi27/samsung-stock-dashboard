/**
 * Samsung Branch Operations - Promotion Database Live Verification Script
 * Checks live Supabase PostgreSQL schema for all 9 promotion engine tables,
 * the activate_promotion_campaign transactional RPC, and table accessibility.
 */

const fs = require('fs');
const path = require('path');

async function verifyPromotionDatabase() {
  console.log('======================================================================');
  console.log('SAMSUNG BRANCH OPERATIONS - PROMOTION DATABASE LIVE VERIFICATION');
  console.log('======================================================================\n');

  const envPath = path.join(__dirname, '..', '.env.feedback-pilot.server.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.feedback-pilot.server.local not found');
    process.exit(1);
  }

  const env = fs.readFileSync(envPath, 'utf8');
  const urlMatch = env.match(/SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SECRET_KEY=(.*)/);

  if (!urlMatch || !keyMatch) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY in server env file');
    process.exit(1);
  }

  const supabaseUrl = urlMatch[1].trim().replace(/\/+$/, '');
  const secretKey = keyMatch[1].trim();

  console.log('Connecting to Supabase:', supabaseUrl);

  const EXPECTED_TABLES = [
    'promotion_import_batches',
    'promotion_campaigns',
    'promotion_offers',
    'promotion_conditions',
    'promotion_stacking_rules',
    'promotion_calculations',
    'promotion_validation_errors',
    'promotion_correction_rules',
    'promotion_audit_logs'
  ];

  const EXPECTED_RPCS = [
    'activate_promotion_campaign',
    'rollback_promotion_campaign'
  ];

  try {
    const specRes = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': secretKey,
        'Authorization': `Bearer ${secretKey}`
      }
    });

    if (!specRes.ok) {
      console.error(`❌ Failed to fetch PostgREST OpenAPI spec: HTTP ${specRes.status}`);
      process.exit(1);
    }

    const spec = await specRes.json();
    const paths = Object.keys(spec.paths || {});
    const existingTables = paths.filter(p => !p.startsWith('/rpc/')).map(p => p.replace(/^\//, ''));
    const existingRpcs = paths.filter(p => p.startsWith('/rpc/')).map(p => p.replace(/^\/rpc\//, ''));

    console.log('--- 1. PROMOTION ENGINE TABLES (Target: 9) ---');
    let tablesFound = 0;
    for (const tbl of EXPECTED_TABLES) {
      if (existingTables.includes(tbl)) {
        console.log(`  ✅ [FOUND] public.${tbl}`);
        tablesFound++;
      } else {
        console.log(`  ❌ [MISSING] public.${tbl}`);
      }
    }

    console.log(`\nTables Status: ${tablesFound}/${EXPECTED_TABLES.length} tables present`);

    console.log('\n--- 2. TRANSACTIONAL RPCS (Target: 2) ---');
    let rpcsFound = 0;
    for (const rpc of EXPECTED_RPCS) {
      if (existingRpcs.includes(rpc)) {
        console.log(`  ✅ [FOUND] public.${rpc}()`);
        rpcsFound++;
      } else {
        console.log(`  ❌ [MISSING] public.${rpc}()`);
      }
    }

    console.log(`\nRPCs Status: ${rpcsFound}/${EXPECTED_RPCS.length} procedures present`);

    console.log('\n--- 3. LIVE ACTIVE STOCK SNAPSHOT POINTER ---');
    try {
      const activeRes = await fetch(`${supabaseUrl}/rest/v1/active_stock_snapshot?branch_code=eq.AYUTTHAYA_CITY_PARK&select=branch_code,active_batch_id,updated_at`, {
        headers: {
          'apikey': secretKey,
          'Authorization': `Bearer ${secretKey}`
        }
      });
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        if (activeData.length > 0) {
          const activeBatchId = activeData[0].active_batch_id;
          const batchRes = await fetch(`${supabaseUrl}/rest/v1/stock_import_batches?id=eq.${activeBatchId}&select=id,status,total_rows,f1_total,f2_total,source_file_name,activated_at`, {
            headers: {
              'apikey': secretKey,
              'Authorization': `Bearer ${secretKey}`
            }
          });
          if (batchRes.ok) {
            const batchData = await batchRes.json();
            const b = batchData[0] || {};
            console.log(`  Branch Code      : AYUTTHAYA_CITY_PARK`);
            console.log(`  Active Batch ID  : ${b.id}`);
            console.log(`  Status           : ${b.status}`);
            console.log(`  Total Rows       : ${b.total_rows}`);
            console.log(`  F1 Total         : ${b.f1_total}`);
            console.log(`  F2 Total         : ${b.f2_total}`);
            console.log(`  Source File      : ${b.source_file_name}`);
            console.log(`  Activated At     : ${b.activated_at}`);
          }
        } else {
          console.log('  ⚠️ No active stock snapshot pointer row found for AYUTTHAYA_CITY_PARK');
        }
      }
    } catch (e) {
      console.log(`  ⚠️ Stock pointer check: ${e.message}`);
    }

    const isFullyApplied = tablesFound === EXPECTED_TABLES.length && rpcsFound === EXPECTED_RPCS.length;

    console.log('\n======================================================================');
    if (isFullyApplied) {
      console.log('VERIFICATION RESULT: ✅ 100% PROMOTION DATABASE SCHEMA LIVE & READY');
    } else {
      console.log('VERIFICATION RESULT: ⚠️ MIGRATION NOT YET APPLIED TO LIVE DATABASE');
      console.log('Action Required: Run supabase/migrations/20260917_promotion_engine_tables.sql in Supabase SQL Editor');
    }
    console.log('======================================================================\n');

    return {
      isFullyApplied,
      tablesFound,
      totalExpectedTables: EXPECTED_TABLES.length,
      rpcsFound,
      totalExpectedRpcs: EXPECTED_RPCS.length
    };
  } catch (err) {
    console.error('❌ Verification error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  verifyPromotionDatabase();
}

module.exports = { verifyPromotionDatabase };
