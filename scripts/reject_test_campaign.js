/**
 * Samsung Branch Operations - Atomic Campaign Rejection Runner
 * Calls the reject_promotion_campaign RPC on Supabase for campaign 07363cc4-49ed-436e-afea-6ddcfcfa1426
 * and verifies atomic transition of campaign, batch, and offers to REJECTED.
 */

const fs = require('fs');
const path = require('path');

async function rejectTestCampaign() {
  console.log('======================================================================');
  console.log('SAMSUNG BRANCH OPERATIONS - ATOMIC CAMPAIGN REJECTION');
  console.log('======================================================================\n');

  const envPath = path.join(__dirname, '..', '.env.feedback-pilot.server.local');
  const env = fs.readFileSync(envPath, 'utf8');
  const supabaseUrl = env.match(/SUPABASE_URL=(.*)/)[1].trim().replace(/\/+$/, '');
  const secretKey = env.match(/SUPABASE_SECRET_KEY=(.*)/)[1].trim();

  const campaignId = '07363cc4-49ed-436e-afea-6ddcfcfa1426';
  const userId = '00000000-0000-0000-0000-000000000001';
  const reason = 'Technical test campaign contains model mismatches (Galaxy S25 FE mapped to S26FE, Galaxy A57 5G mapped to A07 5G) and must not be activated.';
  const expectedStatus = 'DRAFT';

  console.log(`Target Campaign ID: ${campaignId}`);
  console.log(`Reason: ${reason}\n`);

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/reject_promotion_campaign`, {
      method: 'POST',
      headers: {
        'apikey': secretKey,
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_campaign_id: campaignId,
        p_user_id: userId,
        p_reason: reason,
        p_expected_status: expectedStatus
      })
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('❌ RPC call failed:', res.status, result);
      return { success: false, error: result };
    }

    console.log('✅ reject_promotion_campaign RPC executed successfully:');
    console.log(JSON.stringify(result, null, 2));

    // Verify Campaign status
    const cRes = await fetch(`${supabaseUrl}/rest/v1/promotion_campaigns?id=eq.${campaignId}&select=id,status,approved_by,approved_at`, {
      headers: { apikey: secretKey, Authorization: 'Bearer ' + secretKey }
    });
    const campaign = (await cRes.json())[0];
    console.log(`\n--- Verification ---`);
    console.log(`Campaign Status : ${campaign?.status} (Expected: REJECTED)`);

    // Verify Batch status
    const bRes = await fetch(`${supabaseUrl}/rest/v1/promotion_import_batches?id=eq.${result.importBatchId}&select=id,status,approved_by,activated_at`, {
      headers: { apikey: secretKey, Authorization: 'Bearer ' + secretKey }
    });
    const batch = (await bRes.json())[0];
    console.log(`Batch Status    : ${batch?.status} (Expected: REJECTED)`);

    // Verify Offers status
    const oRes = await fetch(`${supabaseUrl}/rest/v1/promotion_offers?campaign_id=eq.${campaignId}&select=status`, {
      headers: { apikey: secretKey, Authorization: 'Bearer ' + secretKey }
    });
    const offers = await oRes.json();
    const rejectedOffers = offers.filter(o => o.status === 'REJECTED').length;
    console.log(`Rejected Offers : ${rejectedOffers}/${offers.length} (Expected: ${offers.length}/${offers.length})`);

    // Verify Audit Log
    const aRes = await fetch(`${supabaseUrl}/rest/v1/promotion_audit_logs?campaign_id=eq.${campaignId}&action=eq.REJECT&order=performed_at.desc&limit=1`, {
      headers: { apikey: secretKey, Authorization: 'Bearer ' + secretKey }
    });
    const auditLogs = await aRes.json();
    console.log(`Audit Action    : ${auditLogs[0]?.action} (Reason: ${auditLogs[0]?.reason})`);

    const allPassed = campaign?.status === 'REJECTED' &&
                      batch?.status === 'REJECTED' &&
                      rejectedOffers === offers.length &&
                      auditLogs.length > 0;

    console.log(`\nComposite Rejection Status: ${allPassed ? '✅ ATOMIC_REJECTION_SUCCESS' : '❌ VERIFICATION_FAILED'}`);
    return { success: allPassed, result };
  } catch (err) {
    console.error('❌ Error executing rejection:', err.message);
    return { success: false, error: err.message };
  }
}

if (require.main === module) {
  rejectTestCampaign();
}

module.exports = { rejectTestCampaign };
