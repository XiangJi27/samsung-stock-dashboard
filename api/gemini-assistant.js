// Vercel Serverless Function: /api/gemini-assistant
// Handles Gemini 2.0 / Flash / Flash-Lite integration with dynamic ModelService discovery
// and strict store data grounding (Stock, Promo, Specs) for Samsung Branch Operations (Ayutthaya City Park).

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

    // 1. Dynamic Model Discovery from Google ModelService
    const discovery = await discoverAvailableModels(apiKey);
    if (!discovery.success) {
      return res.status(400).json({
        error: 'INVALID_API_KEY_OR_NETWORK',
        message: `ไม่สามารถเชื่อมต่อ Google Generative Language API ได้: ${discovery.error || 'กรุณาตรวจสอบ API Key'}`
      });
    }

    const availableModels = discovery.models; // Array of model names without 'models/' prefix
    const chosenModel = resolveBestModel(body.model, availableModels);

    // Ping check
    if (body.ping) {
      const pingResult = await verifyModelExecution(apiKey, chosenModel);
      return res.status(200).json({
        success: true,
        model: chosenModel,
        availableModels: availableModels,
        message: `เชื่อมต่อสำเร็จ! ตรวจพบโมเดลที่ใช้งานได้ ${availableModels.length} รุ่น โดยระบบเลือกใช้ "${chosenModel}" (รองรับ Flash/Flash-Lite สำหรับตอบคำถามหน้าร้าน)`
      });
    }

    const query = (body.query || '').trim();
    if (!query && !body.image) {
      return res.status(400).json({ error: 'EMPTY_QUERY', message: 'กรุณาระบุคำถามหรือแนบรูปภาพ' });
    }

    // 2. Context Grounding: Fetch Store Data (Stock, Promo, Specs)
    const storeContext = await gatherStoreGroundingContext(query);

    // 3. Build Gemini Prompt & History
    const conversationHistory = Array.isArray(body.messages) ? body.messages : [];

    // 4. Call Google Gemini REST API using the discovered model
    const geminiResponse = await callGeminiAPI({
      apiKey,
      model: chosenModel,
      query,
      history: conversationHistory,
      image: body.image || null,
      storeContext
    });

    return res.status(200).json({
      success: true,
      text: geminiResponse.text,
      model: chosenModel,
      availableModels: availableModels,
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
 * Discover all available models supporting generateContent for this API Key
 */
async function discoverAvailableModels(apiKey) {
  const versions = ['v1beta', 'v1'];
  let lastError = null;

  for (const v of versions) {
    try {
      const url = `https://generativelanguage.googleapis.com/${v}/models?key=${encodeURIComponent(apiKey)}`;
      const result = await httpGetJson(url);

      if (result && Array.isArray(result.models)) {
        const supported = result.models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(name => Boolean(name));

        if (supported.length > 0) {
          return { success: true, models: supported, version: v };
        }
      }
    } catch (e) {
      lastError = e;
    }
  }

  // If ModelService.ListModels failed or returned 0, return fallback with standard models
  if (lastError) {
    const errMsg = lastError.message || '';
    if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('400') || errMsg.includes('403')) {
      return { success: false, error: errMsg };
    }
  }

  // Default known models fallback
  return {
    success: true,
    models: [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash-lite-preview-02-05',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro'
    ],
    version: 'v1beta'
  };
}

/**
 * Smart Model Selection based on user preference and available models
 */
function resolveBestModel(preferredModel, availableModels) {
  const cleanPref = (preferredModel || '').trim().replace(/^models\//, '');

  // 1. If user explicitly provided a model and it exists in available list
  if (cleanPref && availableModels.includes(cleanPref)) {
    return cleanPref;
  }

  // 2. If user requested "flash-lite" or "3.5-flash lite"
  if (cleanPref && /lite/i.test(cleanPref)) {
    const liteModel = availableModels.find(m => /flash.*lite/i.test(m) || /lite/i.test(m));
    if (liteModel) return liteModel;
  }

  // 3. Priority Order for Samsung Store Assistant:
  // - First choice: Flash-Lite models (fastest, lightest, ideal for store staff)
  const flashLite = availableModels.find(m => /gemini-2\.0-flash-lite/i.test(m) || /flash-lite/i.test(m));
  if (flashLite) return flashLite;

  // - Second choice: Gemini 2.0 Flash
  const flash2 = availableModels.find(m => /gemini-2\.0-flash/i.test(m) && !/lite/i.test(m));
  if (flash2) return flash2;

  // - Third choice: Gemini 1.5 Flash (latest or standard)
  const flash15 = availableModels.find(m => /gemini-1\.5-flash/i.test(m));
  if (flash15) return flash15;

  // - Fourth choice: Any flash model
  const anyFlash = availableModels.find(m => /flash/i.test(m));
  if (anyFlash) return anyFlash;

  // - Fallback: First available model
  return availableModels[0] || 'gemini-2.0-flash';
}

/**
 * Verify model execution with lightweight request
 */
async function verifyModelExecution(apiKey, modelName) {
  const cleanModel = modelName.replace(/^models\//, '');
  const payload = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Test connection. Reply with only: OK' }]
      }
    ],
    generationConfig: { maxOutputTokens: 10 }
  });

  // Try v1beta then v1
  const endpoints = ['v1beta', 'v1'];
  let lastErr = null;

  for (const v of endpoints) {
    try {
      const url = `https://generativelanguage.googleapis.com/${v}/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await postHttps(url, payload);
      if (response && response.candidates && response.candidates.length > 0) {
        return { success: true, model: cleanModel, version: v };
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(`โมเดล ${cleanModel} ขัดข้อง: ${lastErr ? lastErr.message : 'Execution failed'}`);
}

/**
 * Gather grounding data from Supabase for Ayutthaya City Park
 */
async function gatherStoreGroundingContext(query) {
  const result = {
    devices: [],
    accessories: [],
    stock: [],
    promos: [],
    specs: [],
    matchedCount: 0
  };

  try {
    const supabaseUrl = (process.env.SUPABASE_URL || SUPABASE_DEFAULT_URL).replace(/\/+$/, '');
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY || SUPABASE_DEFAULT_KEY).trim();

    // Extract keywords from query
    const cleaned = query.replace(/[^\w\sก-๙]/g, ' ');
    const rawTokens = cleaned.split(/\s+/).filter(t => t.length >= 2);

    // Identify primary model (e.g. S25, S24, A55, A35, A16, Fold6, Flip6, Tab, Watch, etc.)
    const modelToken = rawTokens.find(t => /^(s\d+|a\d+|z\s*fold\d*|z\s*flip\d*|tab|watch|buds|galaxy)/i.test(t)) || rawTokens[0] || 'S25';
    // Identify sub-model modifier (e.g. Ultra, Plus, FE, 5G, LTE, Pro)
    const subToken = rawTokens.find(t => /^(ultra|plus|\+|fe|5g|lte|pro)/i.test(t) && t.toLowerCase() !== modelToken.toLowerCase());

    // 1. Search Stock in Ayutthaya City Park (Up to 50 items with smart filtering)
    let stockEndpoint = '';
    if (modelToken && subToken) {
      stockEndpoint = `stock_snapshot_items?and=(description.ilike.*${encodeURIComponent(modelToken)}*,description.ilike.*${encodeURIComponent(subToken)}*)&select=inventory_pn,description,f1,f2,erp_rrp,category,color&limit=50`;
    } else {
      stockEndpoint = `stock_snapshot_items?description=ilike.*${encodeURIComponent(modelToken)}*&select=inventory_pn,description,f1,f2,erp_rrp,category,color&limit=50`;
    }

    const stockUrl = `${supabaseUrl}/rest/v1/${stockEndpoint}`;
    const stockData = await httpGetJson(stockUrl, {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    });

    if (Array.isArray(stockData)) {
      // Deduplicate by inventory_pn
      const seenPn = new Map();
      for (const item of stockData) {
        const pn = item.inventory_pn;
        if (!pn) continue;
        if (!seenPn.has(pn)) {
          seenPn.set(pn, {
            pn,
            name: item.description,
            f1: Number(item.f1 || 0),
            f2: Number(item.f2 || 0),
            total: Number(item.f1 || 0) + Number(item.f2 || 0),
            price: item.erp_rrp ? Number(item.erp_rrp).toLocaleString() + ' บาท' : 'ไม่มีระบุ',
            category: item.category || '',
            color: item.color || '-'
          });
        }
      }

      const allItems = Array.from(seenPn.values());

      // Separate into Devices (Smartphones/Tablets) vs Accessories
      const isDevice = (desc) => {
        if (/^\[CS\]/i.test(desc)) return false;
        if (/tempered|glass|film|flipsuit|bag|case|cover|adapter/i.test(desc)) return false;
        return true;
      };

      const devices = allItems.filter(item => isDevice(item.name));
      const accessories = allItems.filter(item => !isDevice(item.name));

      result.devices = devices;
      result.accessories = accessories;
      // Prioritize devices first!
      result.stock = [...devices, ...accessories];
    }

    // 2. Search Active Promotions
    const promoSearch = modelToken || 'S25';
    const promoUrl = `${supabaseUrl}/rest/v1/promotion_offers?or=(model_name.ilike.*${encodeURIComponent(promoSearch)}*,campaign_name.ilike.*${encodeURIComponent(promoSearch)}*)&select=model_name,campaign_name,benefit_summary,final_price,conditions&limit=10`;
    const promoData = await httpGetJson(promoUrl, {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    });
    if (Array.isArray(promoData)) {
      result.promos = promoData;
    }

    // 3. Search Product Specs
    const specUrl = `${supabaseUrl}/rest/v1/product_specs?or=(official_name.ilike.*${encodeURIComponent(promoSearch)}*,model_group.ilike.*${encodeURIComponent(promoSearch)}*)&select=official_name,model_group,specs&limit=3`;
    const specData = await httpGetJson(specUrl, {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    });
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
  const cleanModel = model.replace(/^models\//, '');

  let contextText = `\n--- [ข้อมูลภายในสาขา อยุธยา ซิตี้ พาร์ค (ณ เวลาปัจจุบัน)] ---\n`;

  if (storeContext.devices && storeContext.devices.length > 0) {
    contextText += `\n📱 [รายการสมาร์ทโฟน / อุปกรณ์หลักในสต็อกสาขา]:\n`;
    storeContext.devices.forEach(s => {
      contextText += `- รุ่น: ${s.name} (P/N: ${s.pn}) | สี: ${s.color} | ราคาตั้ง SRP: ${s.price} | 📍 ชั้น 1 (หน้าร้าน): ${s.f1} เครื่อง | 📍 ชั้น 2 (สต็อกบน): ${s.f2} เครื่อง (รวม: ${s.total} เครื่อง)\n`;
    });
  } else {
    contextText += `\n📱 [รายการสมาร์ทโฟนตัวเครื่อง]: ไม่พบสมาร์ทโฟนรุ่นนี้ในสต็อกปัจจุบัน\n`;
  }

  if (storeContext.accessories && storeContext.accessories.length > 0) {
    contextText += `\n🛡️ [รายการอุปกรณ์เสริมและฟิล์มกระจกกันรอยตรงรุ่นในสต็อกสาขา]:\n`;
    storeContext.accessories.forEach(s => {
      contextText += `- อุปกรณ์เสริม: ${s.name} (P/N: ${s.pn}) | ราคา: ${s.price} | 📍 ชั้น 1: ${s.f1} ชิ้น | 📍 ชั้น 2: ${s.f2} ชิ้น (รวม: ${s.total} ชิ้น)\n`;
    });
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
3. ลำดับการตอบคำถามเรื่องสต็อกสินค้า:
   - ให้ตรวจสอบส่วน "📱 [รายการสมาร์ทโฟน / อุปกรณ์หลักในสต็อกสาขา]" ก่อนเสมอ
   - หากมีตัวเครื่องในสต็อก ให้แจ้งจำนวนสต็อกตัวเครื่อง (แจกแจงแยกสี, ความจุ, ราคา SRP, และยอด ชั้น 1 (หน้าร้าน) / ชั้น 2 (สต็อกบน)) ให้ครบถ้วนเป็นประเด็นหลัก
   - จากนั้นสามารถแนะนำฟิล์มกระจกหรือเคสกันรอยตรงรุ่นจากส่วน "🛡️ [รายการอุปกรณ์เสริม]" ควบคู่ไปด้วยเพื่อเสนอขายเพิ่มเติม
   - หากตัวเครื่องไม่มีสต็อกจริงๆ ค่อยแจ้งว่าตัวเครื่องหมด และแนะนำอุปกรณ์เสริมแทน
4. หากลูกค้าถามโปรโมชัน หรือการผ่อนชำระ ให้แจกแจงส่วนลด ของแถม หรือการผ่อน Samsung Finance+ ให้เข้าใจง่าย
5. ทุกคำตอบต้องจบด้วยการใส่ข้อมูลอ้างอิงชัดเจน ในรูปแบบ:
📌 ข้อมูลอ้างอิง: สต็อกสาขา อยุธยา ซิตี้ พาร์ค, แคมเปญโปรโมชันหน้าร้าน, ข้อมูลสเปกทางการ Samsung Thailand

${contextText}`;

  // Build payload contents
  const contents = [];

  // Add recent history
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

  const apiVersions = ['v1beta', 'v1'];
  let lastError = null;

  for (const v of apiVersions) {
    try {
      const url = `https://generativelanguage.googleapis.com/${v}/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await postHttps(url, payload);
      if (response && response.candidates && response.candidates[0]?.content?.parts) {
        const textParts = response.candidates[0].content.parts.map(p => p.text).join('\n');
        return {
          text: textParts,
          model: cleanModel
        };
      }
    } catch (e) {
      lastError = e;
      console.warn(`[gemini-assistant] Call with ${v}/${cleanModel} failed:`, e.message);
    }
  }

  throw new Error(`Gemini API Error: ${lastError ? lastError.message : 'Unknown generation error'}`);
}

/**
 * HTTPS GET JSON helper
 */
function httpGetJson(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        } else {
          try {
            const errJson = JSON.parse(data);
            const msg = errJson?.error?.message || `HTTP ${res.statusCode}`;
            reject(new Error(msg));
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          }
        }
      });
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

/**
 * HTTPS POST JSON helper
 */
function postHttps(urlStr, bodyStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers
      },
      timeout: 28000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
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

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out (28s)'));
    });

    req.write(bodyStr);
    req.end();
  });
}
