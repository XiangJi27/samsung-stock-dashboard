/**
 * Vercel Serverless Function: Active Promotions Catalog Query
 * 
 * Endpoint: GET /api/promotions/active?branchCode=AYUTTHAYA_CITY_PARK
 * Returns currently active campaign, active offers, and pricing breakdown.
 */

module.exports = async function handler(req, res) {
  const requestId = `req_pact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');

  const rawUrl = process.env.SUPABASE_URL || 'https://anhxzffcmrihymrptsgd.supabase.co';
  const supabaseUrl = rawUrl.replace(/\/+$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9eXmP6Cgb14AWbk8CrBv3A_l0Clj00v').trim();

  const branchCode = String(req.query?.branchCode || 'AYUTTHAYA_CITY_PARK').trim().toUpperCase();

  // Helper: Query PostgREST
  async function queryPostgrest(endpoint) {
    return fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
      headers: {
        'apikey': secretKey || publishableKey,
        'Authorization': `Bearer ${secretKey || publishableKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    // 1. Fetch active campaign for branch
    const campRes = await queryPostgrest(
      `promotion_campaigns?branch_code=eq.${encodeURIComponent(branchCode)}&status=eq.ACTIVE&order=priority.asc&limit=1`
    );

    if (!campRes.ok) {
      return res.status(200).json({
        status: 'NO_ACTIVE_CAMPAIGN',
        branchCode,
        campaign: null,
        offers: []
      });
    }

    const campaigns = await campRes.json();
    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      return res.status(200).json({
        status: 'NO_ACTIVE_CAMPAIGN',
        branchCode,
        campaign: null,
        offers: []
      });
    }

    const activeCampaign = campaigns[0];

    // Expiry Automation Gate: Never display campaign past end_at
    if (activeCampaign.end_at && new Date(activeCampaign.end_at).getTime() < Date.now()) {
      return res.status(200).json({
        status: 'EXPIRED',
        branchCode,
        campaign: null,
        offers: [],
        message: `Campaign ${activeCampaign.campaign_code} has expired (end_at: ${activeCampaign.end_at})`
      });
    }

    // 2. Fetch active offers for active campaign
    const offersRes = await queryPostgrest(
      `promotion_offers?campaign_id=eq.${encodeURIComponent(activeCampaign.id)}&status=eq.ACTIVE&order=priority.asc`
    );

    const offers = offersRes.ok ? await offersRes.json() : [];

    return res.status(200).json({
      status: 'ACTIVE',
      branchCode,
      campaign: {
        id: activeCampaign.id,
        campaignCode: activeCampaign.campaign_code,
        campaignName: activeCampaign.campaign_name,
        startAt: activeCampaign.start_at,
        endAt: activeCampaign.end_at,
        priority: activeCampaign.priority
      },
      totalOffers: offers.length,
      offers
    });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message, requestId });
  }
};
