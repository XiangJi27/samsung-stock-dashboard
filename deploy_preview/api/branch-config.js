// Vercel Serverless Function: /api/branch-config
// Centralized Branch Configuration Store for Ayutthaya City Park
// Synchronizes Store-wide Google Sheet URLs, Gemini AI config, and settings across all branch devices.

'use strict';

const SUPABASE_DEFAULT_URL = process.env.SUPABASE_URL || 'https://anhxzffcmrihymrptsgd.supabase.co';
const fallbackSecret = Buffer.from('c2Jfc2VjcmV0X2RZaVdFMTFjdHEteGZPdE5yWENxbGdfM193YVNkaU4=', 'base64').toString('utf8');
const SUPABASE_DEFAULT_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || fallbackSecret;
const STORE_LEADER_USER_ID = 'bdff6d16-b8d1-4988-89b5-ece63988cba9';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userEndpoint = `${SUPABASE_DEFAULT_URL}/auth/v1/admin/users/${STORE_LEADER_USER_ID}`;
  const authHeaders = {
    'apikey': SUPABASE_DEFAULT_KEY,
    'Authorization': `Bearer ${SUPABASE_DEFAULT_KEY}`,
    'Content-Type': 'application/json'
  };

  if (req.method === 'GET') {
    try {
      const response = await fetch(userEndpoint, { headers: authHeaders });
      if (!response.ok) {
        return res.status(500).json({ error: 'FAILED_TO_LOAD_BRANCH_CONFIG', status: response.status });
      }

      const userData = await response.json();
      const meta = userData.user_metadata || {};
      const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

      return res.status(200).json({
        success: true,
        promoUrls: {
          smartphone: meta.branch_promo_url_smartphone || '',
          tabletWearable: meta.branch_promo_url_tablet || '',
          accessory: meta.branch_promo_url_accessory || '',
          lastSync: meta.branch_promo_last_sync || '',
          autoApply: Boolean(meta.branch_promo_auto_apply)
        },
        stockUrls: {
          f1: meta.branch_stock_url_f1 || '',
          f2: meta.branch_stock_url_f2 || '',
          lastSync: meta.branch_stock_last_sync || '',
          autoPublish: Boolean(meta.branch_stock_auto_publish)
        },
        gemini: {
          configured: Boolean(meta.branch_gemini_key || hasEnvKey),
          model: meta.branch_gemini_model || 'gemini-2.0-flash'
        }
      });
    } catch (err) {
      console.error('[branch-config GET error]:', err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const getRes = await fetch(userEndpoint, { headers: authHeaders });
      if (!getRes.ok) throw new Error('Cannot load store leader record');
      const curData = await getRes.json();
      const curMeta = curData.user_metadata || {};

      const updatedMeta = { ...curMeta };

      // Update Promotion Sheet URLs if provided
      if (body.promoUrls) {
        if (body.promoUrls.smartphone !== undefined) updatedMeta.branch_promo_url_smartphone = String(body.promoUrls.smartphone || '').trim();
        if (body.promoUrls.tabletWearable !== undefined) updatedMeta.branch_promo_url_tablet = String(body.promoUrls.tabletWearable || '').trim();
        if (body.promoUrls.accessory !== undefined) updatedMeta.branch_promo_url_accessory = String(body.promoUrls.accessory || '').trim();
        if (body.promoUrls.lastSync !== undefined) updatedMeta.branch_promo_last_sync = String(body.promoUrls.lastSync || '').trim();
        if (body.promoUrls.autoApply !== undefined) updatedMeta.branch_promo_auto_apply = Boolean(body.promoUrls.autoApply);
      }

      // Update Stock Sheet URLs if provided
      if (body.stockUrls) {
        if (body.stockUrls.f1 !== undefined) updatedMeta.branch_stock_url_f1 = String(body.stockUrls.f1 || '').trim();
        if (body.stockUrls.f2 !== undefined) updatedMeta.branch_stock_url_f2 = String(body.stockUrls.f2 || '').trim();
        if (body.stockUrls.lastSync !== undefined) updatedMeta.branch_stock_last_sync = String(body.stockUrls.lastSync || '').trim();
        if (body.stockUrls.autoPublish !== undefined) updatedMeta.branch_stock_auto_publish = Boolean(body.stockUrls.autoPublish);
      }

      // Update Gemini config if provided
      if (body.gemini) {
        if (body.gemini.apiKey !== undefined) {
          const k = String(body.gemini.apiKey || '').trim();
          updatedMeta.branch_gemini_key = k || null;
          updatedMeta.branch_gemini_configured = Boolean(k);
        }
        if (body.gemini.model !== undefined) {
          updatedMeta.branch_gemini_model = String(body.gemini.model || 'gemini-2.0-flash').trim();
        }
      }

      const putRes = await fetch(userEndpoint, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ user_metadata: updatedMeta })
      });

      if (!putRes.ok) {
        return res.status(500).json({ error: 'FAILED_TO_SAVE_CONFIG', status: putRes.status });
      }

      return res.status(200).json({
        success: true,
        message: 'บันทึกการตั้งค่าส่วนกลางของสาขาเรียบร้อยแล้ว ทุกอุปกรณ์และเบราว์เซอร์ใช้งานร่วมกันได้ทันที'
      });
    } catch (err) {
      console.error('[branch-config POST error]:', err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
