/**
 * Vercel Serverless Function: Claude Vision API Secure Proxy
 * Endpoint: /api/vision-proxy
 *
 * Security Architecture:
 * - Keeps CLAUDE_API_KEY securely on the server (via Vercel Environment Variables).
 * - Client / browser never sees or stores the API key (zero localStorage / client exposure).
 * - Dispatches server-to-server requests to Anthropic Claude 3.5 Sonnet Vision API.
 * - Enforces zero-hallucination structured JSON extraction for Samsung retail flyers.
 */

module.exports = async function handler(req, res) {
  // 1. Enforce POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are accepted.'
    });
  }

  // 2. Retrieve Claude API Key from Server Environment Variables
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'BLOCKED_NO_API_KEY',
      status: 'BLOCKED_NO_API_KEY',
      variants: [],
      message: '🔒 CLAUDE_API_KEY ยังไม่ได้ตั้งค่าใน Vercel Environment Variables — ระบบความปลอดภัยระงับการสแกนเพื่อป้องกันราคาผิดพลาดหน้าร้าน'
    });
  }

  // 3. Parse and validate request body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({
        error: 'INVALID_JSON_BODY',
        message: 'Request body could not be parsed as JSON.'
      });
    }
  }

  const { imageBase64, mimeType = 'image/jpeg', filename = 'flyer.jpg' } = body || {};

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({
      error: 'MISSING_IMAGE_PAYLOAD',
      message: 'imageBase64 payload is required.'
    });
  }

  // 4. Construct Anthropic Messages Vision API payload
  const modelName = process.env.CLAUDE_VISION_MODEL || 'claude-3-5-sonnet-20241022';
  const anthropicPayload = {
    model: modelName,
    max_tokens: 4096,
    system: "You are an expert Samsung retail promotion parser for Samsung Branch Operations. You analyze official promotional flyers, posters, and marketing leaflets. You must extract structured promotional offers with zero hallucination. If text or numbers are blurred, ambiguous, or cut off, indicate low confidence. You must respond ONLY with a strict JSON object.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBase64
            }
          },
          {
            type: "text",
            text: `Analyze this Samsung promotional flyer image (${filename}). Extract all device models, retail pricing (RRP), discount amounts, final net prices, sale modes (STANDARD or TRADE_UP), coupon codes, and any freebies/gifts.\nRespond strictly with a JSON object following this format:\n{\n  "overallConfidence": 0.95,\n  "isSupplementalOnly": false,\n  "summary": "Short description of the campaign",\n  "offers": [\n    {\n      "model": "Galaxy S26 Ultra",\n      "pn": "SM-S938B",\n      "rrp": 49900,\n      "discount": 4000,\n      "netPrice": 45900,\n      "saleMode": "STANDARD",\n      "coupon": "LAUNCH-S26",\n      "freebies": ["45W Power Adapter"],\n      "conditions": ["Valid until 30 Sept"],\n      "confidence": 0.95,\n      "isPriceEstimated": false\n    }\n  ]\n}\nIf the image does not contain clear pricing or is too blurry/unreadable, set overallConfidence to a value below 0.70.`
          }
        ]
      }
    ]
  };

  // 5. Server-to-server call to Anthropic API (No client key exposure, no dangerous browser bypass header)
  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicPayload)
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      return res.status(anthropicResponse.status).json({
        error: 'ANTHROPIC_API_ERROR',
        message: `Claude API responded with HTTP ${anthropicResponse.status}: ${errText}`
      });
    }

    const data = await anthropicResponse.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({
      error: 'SERVER_GATEWAY_ERROR',
      message: `Failed to connect to Claude Vision API: ${err.message}`
    });
  }
};
