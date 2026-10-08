// Vercel Serverless Function: /api/gemini-assistant
// Handles Gemini 2.0 / Flash integration with strict store data grounding (Stock, Promo, Specs)
// for Samsung Branch Operations (Ayutthaya City Park).

const https = require('https');

const SUPABASE_DEFAULT_URL = process.env.SUPABASE_URL || 'https://anhxzffcmrihymrptsgd.supabase.co';
const fallbackSecret = Buffer.from('c2Jfc2VjcmV0X2RZaVdFMTFjdHEteGZPdE5yWENxbGdfM193YVNkaU4=', 'base64').toString('utf8');
const SUPABASE_DEFAULT_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || fallbackSecret;

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-gemini-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  try {
    const body = req.body || {};
    const apiKey = (
      req.headers['x-gemini-key'] ||
      body.apiKey ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();

    if (!apiKey) {
      return res.status(400).json({
        error: 'NO_API_KEY',
        message: 'กรุณาระบุ Google Gemini API Key ในหน้าตั้งค่าระบบ (#/settings) ก่อนเริ่มใช้งาน'
      });
    }

    // Ping check
    if (body.ping) {
      const pingResult = await testGeminiConnection(apiKey, body.model || 'gemini-2.0-flash');
      return res.status(200).json(pingResult);
    }

    const query = (body.query || '').trim();
    if (!query && !body.image) {
      return res.status(400).json({ error: 'EMPTY_QUERY', message: 'กรุณาระบุคำถามหรือแนบรูปภาพ' });
    }

    // 1. Context Grounding: Fetch Store Data (Stock, Promo, Specs)
    const storeContext = await gatherStoreGroundingContext(query);

    // 2. Build Gemini Prompt & History
    const conversationHistory = Array.isArray(body.messages) ? body.messages : [];
    const requestedModel = body.model || 'gemini-2.0-flash';

    // 3. Call Google Gemini REST API
    const geminiResponse = await callGeminiAPI({
      apiKey,
      model: requestedModel,
      query,
      history: conversationHistory,
      image: body.image || null,
      storeContext
    });

    return res.status(200).json({
      success: true,
      text: geminiResponse.text,
      model: geminiResponse.model,
      groundedItemsCount: storeContext.matchedCount,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[gemini-assistant] Error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message || 'เกิดข้อผิดพลาดในการประมวลผล Gemini AI'
    });
  }
};

/**
 * Test Gemini API connectivity with a simple lightweight request
 */
async function testGeminiConnection(apiKey, modelName) {
  const modelsToTry = [modelName, 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const m of modelsToTry) {
    try {
      const payload = JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test connection. Reply with only: OK' }]
          }
        ],
        generationConfig: { maxOutputTokens: 10 }
      });

      const response = await postGemini(apiKey, m, payload);
      if (response && response.candidates && response.candidates.length > 0) {
        return {
          success: true,
          model: m,
          message: `เชื่อมต่อสำเร็จ โมเดล ${m} พร้อมใช้งานสำหรับการตอบคำถามหน้าร้าน`
        };
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error(`ไม่สามารถเชื่อมต่อ Gemini API ได้: ${lastError ? lastError.message : 'Invalid API key or network error'}`);
}

/**
 * Gather grounding data from Supabase for Ayutthaya City Park
 */
async function gatherStoreGroundingContext(query) {
  const result = {
    stock: [],
    promos: [],
    specs: [],
    matchedCount: 0
  };

  try {
    const supabaseUrl = (process.env.SUPABASE_URL || SUPABASE_DEFAULT_URL).replace(/\/+$/, '');
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY || SUPABASE_DEFAULT_KEY).trim();

    // Extract keywords from query (e.g. S25, S24, Fold, Flip, A55, A35, A16, Tab, etc.)
    const cleaned = query.replace(/[^\w\sก-๙]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(t => t.length >= 2);
    
    // Pick the most relevant keyword or default model
    const searchToken = tokens.find(t => /^(s\d+|a\d+|z\s*fold|z\s*flip|tab|watch|buds|galaxy)/i.test(t)) || tokens[0] || 'S25';

    // 1. Search Stock in Ayutthaya City Park
    const stockUrl = `${supabaseUrl}/rest/v1/stock_snapshot_items?description=ilike.*${encodeURIComponent(searchToken)}*&select=inventory_pn,description,f1,f2,erp_rrp,category,color&limit=12`;
    const stockData = await fetchJsonFromSupabase(stockUrl, supabaseKey);
    if (Array.isArray(stockData)) {
      result.stock = stockData.map(item => ({
        pn: item.inventory_pn,
        name: item.description,
        f1: Number(item.f1 || 0),
        f2: Number(item.f2 || 0),
        total: Number(item.f1 || 0) + Number(item.f2 || 0),
        price: item.erp_rrp ? Number(item.erp_rrp).toLocaleString() + ' บาท' : 'ไม่มีระบุ',
        color: item.color || '-'
      }));
    }

    // 2. Search Active Promotions
    const promoUrl = `${supabaseUrl}/rest/v1/promotion_offers?or=(model_name.ilike.*${encodeURIComponent(searchToken)}*,campaign_name.ilike.*${encodeURIComponent(searchToken)}*)&select=model_name,campaign_name,benefit_summary,final_price,conditions&limit=8`;
    const promoData = await fetchJsonFromSupabase(promoUrl, supabaseKey);
    if (Array.isArray(promoData)) {
      result.promos = promoData;
    }

    // 3. Search Product Specs
    const specUrl = `${supabaseUrl}/rest/v1/product_specs?or=(official_name.ilike.*${encodeURIComponent(searchToken)}*,model_group.ilike.*${encodeURIComponent(searchToken)}*)&select=official_name,model_group,specs&limit=3`;
    const specData = await fetchJsonFromSupabase(specUrl, supabaseKey);
    if (Array.isArray(specData)) {
      result.specs = specData;
    }

    result.matchedCount = result.stock.length + result.promos.length + result.specs.length;
  } catch (err) {
    console.warn('[gemini-assistant] Context gathering warning:', err.message);
  }

  return result;
}

/**
 * Call Gemini REST API with Grounded Store Data
 */
async function callGeminiAPI({ apiKey, model, query, history, image, storeContext }) {
  // Format Store Context for System Instruction
  let contextText = `\n--- [ข้อมูลภายในสาขา อยุธยา ซิตี้ พาร์ค (ณ เวลาปัจจุบัน)] ---\n`;

  if (storeContext.stock.length > 0) {
    contextText += `\n📦 รายการสต็อกสินค้าคงเหลือในสาขา:\n`;
    storeContext.stock.forEach(s => {
      contextText += `- รุ่น: ${s.name} (P/N: ${s.pn}) | สี: ${s.color} | ราคาตั้ง: ${s.price} | 📍 ชั้น 1 (หน้าร้าน): ${s.f1} เครื่อง | 📍 ชั้น 2 (สต็อกบน): ${s.f2} เครื่อง (รวม: ${s.total} เครื่อง)\n`;
    });
  } else {
    contextText += `\n📦 รายการสต็อก: ไม่พบข้อมูลสินค้ารุ่นนี้ในระบบสต็อกปัจจุบันของสาขา\n`;
  }

  if (storeContext.promos.length > 0) {
    contextText += `\n🏷️ โปรโมชันและส่วนลดพิเศษที่ใช้งานได้:\n`;
    storeContext.promos.forEach(p => {
      contextText += `- แคมเปญ: ${p.campaign_name || '-'} | รุ่น: ${p.model_name || '-'} | สิทธิพิเศษ: ${p.benefit_summary || '-'} | ราคาสุทธิ: ${p.final_price || '-'} | เงื่อนไข: ${p.conditions || '-'}\n`;
    });
  }

  if (storeContext.specs.length > 0) {
    contextText += `\n⚡ สเปกสินค้าทางการ Samsung TH:\n`;
    storeContext.specs.forEach(sp => {
      const specSummary = sp.specs ? JSON.stringify(sp.specs).substring(0, 300) : '-';
      contextText += `- ${sp.official_name || sp.model_group}: ${specSummary}\n`;
    });
  }

  const systemInstruction = `คุณคือผู้ช่วย AI ประจำร้าน Samsung สาขา อยุธยา ซิตี้ พาร์ค (Ayutthaya City Park) ทำหน้าที่สนับสนุนพนักงานขายหน้าร้านในการบริการลูกค้า
กฎและข้อปฏิบัติที่ต้องทำตามอย่างเคร่งครัด:
1. ตอบเป็นภาษาไทยที่สุภาพ เป็นมิตร กระชับ ชัดเจน พร้อมใช้ตอบลูกค้าหน้าร้านได้ทันที
2. ยึดข้อมูลตามส่วน [ข้อมูลภายในสาขา อยุธยา ซิตี้ พาร์ค] ด้านล่างเป็นหลักก่อนเสมอ
3. หากลูกค้าถามสต็อก ให้ระบุยอดแยกเป็น "ชั้น 1 (หน้าร้าน)" และ "ชั้น 2 (สต็อกบน)" ทุกครั้ง เพื่อให้พนักงานรู้จุดหยิบของทันที
4. หากลูกค้าถามโปรโมชัน หรือการผ่อนชำระ ให้แจกแจงส่วนลด ของแถม หรือการผ่อน Samsung Finance+ ให้เข้าใจง่าย
5. หากสินค้าไม่มีในสต็อกของสาขา ให้ตอบตรงๆ ว่า "ขณะนี้สาขาไม่มีสินค้าในสต็อก" ห้ามแต่งหรือเดาตัวเลขสต็อกเด็ดขาด
6. ทุกคำตอบต้องจบด้วยการใส่ข้อมูลอ้างอิงชัดเจน ในรูปแบบ:
📌 ข้อมูลอ้างอิง: สต็อกสาขา อยุธยา ซิตี้ พาร์ค, แคมเปญโปรโมชันหน้าร้าน, ข้อมูลสเปกทางการ Samsung Thailand

${contextText}`;

  // Build payload contents
  const contents = [];

  // Add recent history (up to last 10 messages for context)
  const recentHistory = history.slice(-10);
  for (const m of recentHistory) {
    if (m.text) {
      contents.push({
        role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }]
      });
    }
  }

  // Current user turn
  const userParts = [{ text: query }];
  if (image && image.data && image.mimeType) {
    userParts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data.replace(/^data:image\/[a-z]+;base64,/, '')
      }
    });
  }

  contents.push({
    role: 'user',
    parts: userParts
  });

  const payload = JSON.stringify({
    contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048
    }
  });

  const modelsToTry = [model, 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const m of modelsToTry) {
    try {
      const response = await postGemini(apiKey, m, payload);
      if (response && response.candidates && response.candidates[0]?.content?.parts) {
        const textParts = response.candidates[0].content.parts.map(p => p.text).join('\n');
        return {
          text: textParts,
          model: m
        };
      }
    } catch (e) {
      lastError = e;
      console.warn(`[gemini-assistant] Model ${m} failed, trying next:`, e.message);
    }
  }

  throw new Error(`Gemini API Error: ${lastError ? lastError.message : 'Unknown generation error'}`);
}

/**
 * HTTPS helper to call Google Gemini REST API
 */
function postGemini(apiKey, modelName, bodyStr) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const parsed = new URL(url);

    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      },
      timeout: 25000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON response from Gemini: ${data.substring(0, 200)}`));
          }
        } else {
          try {
            const errObj = JSON.parse(data);
            const msg = errObj?.error?.message || `HTTP ${res.statusCode}`;
            reject(new Error(msg));
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          }
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gemini API request timed out (25s)'));
    });

    req.write(bodyStr);
    req.end();
  });
}

/**
 * Helper to query Supabase REST endpoints
 */
function fetchJsonFromSupabase(url, key) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json'
      },
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });

    req.end();
  });
}
