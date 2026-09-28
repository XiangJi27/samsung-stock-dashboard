'use strict';
/**
 * Vercel Serverless Function: Claude Vision API Secure Proxy
 * Endpoint: /api/vision-proxy
 *
 * Gate 2 (C3) security hardening:
 *  - Mandatory Bearer authentication via the trusted Supabase identity endpoint.
 *  - Authorization derives SOLELY from the trusted user_roles table. The caller's
 *    app_metadata and any mock-/pilot-/hardcoded development token are not an
 *    authorization authority.
 *  - Fail-closed on role-lookup failure, empty role result, or null branch.
 *  - Strict payload validation: string imageBase64, allowlisted MIME types,
 *    configurable decoded-byte size limit -> 413, strict field allowlist.
 *  - Per-user in-memory rate limit with a documented serverless limitation.
 *  - Sanitized error contract: upstream status, request ids, and raw bodies are
 *    never echoed to the client.
 */

const DEFAULT_BRANCH_CODE = 'AYUTTHAYA_CITY_PARK';
const BEARER_TOKEN_PATTERN = /^Bearer\s+(.+)$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_FIELDS = new Set(['imageBase64', 'mimeType', 'filename']);
const ALLOWED_ROLES = ['MEMBER', 'STORE_LEADER', 'STORE_MANAGER', 'SYSTEM_ADMIN', 'ADMIN'];

// Hardcoded development / pilot bypass tokens are never trusted.
const BLOCKED_DEV_TOKENS = new Set([
  'PILOT_STORE_LEADER_DEV_TOKEN',
  'mock-store-leader-token',
  'pilot-store-leader-token'
]);

function isBlockedDevToken(token) {
  if (!token || typeof token !== 'string') return false;
  if (BLOCKED_DEV_TOKENS.has(token)) return true;
  const t = token.toLowerCase();
  return t.startsWith('mock-') || t.startsWith('pilot-');
}

const DEFAULT_MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MiB, mirrors client MAX_SIZE
const DEFAULT_RATE_LIMIT_PER_MIN = 20;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 30000;

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function decodedByteLength(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (Math.floor(base64.length / 4) * 3) - padding;
}

function err(res, status, code) {
  return res.status(status).json({ error: code, message: code });
}

// In-memory per-user limiter. NOT a durable/global store: on Vercel each
// invocation may run in a fresh isolate. Durable distributed rate limiting is
// tracked as a separate deployment prerequisite (no paid dependency added).
const rateBuckets = new Map();
function rateLimitCheck(userId, limitPerMin) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const bucket = rateBuckets.get(userId);
  if (!bucket || (now - bucket.start) >= windowMs) {
    rateBuckets.set(userId, { start: now, count: 1 });
    return { allowed: true };
  }
  if (bucket.count >= limitPerMin) {
    return { allowed: false };
  }
  bucket.count += 1;
  return { allowed: true };
}
module.exports = async function handler(req, res) {
  const requestId = `req_vision_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return err(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const rawUrl = process.env.SUPABASE_URL || 'https://anhxzffcmrihymrptsgd.supabase.co';
  const supabaseUrl = rawUrl.replace(/\/+$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9eXmP6Cgb14AWbk8CrBv3A_l0Clj00v').trim();

  // --------------------------------------------------------------------------
  // Authentication: a verifiable Bearer token is mandatory. Mock-/pilot-/DEV
  // tokens and malformed headers are rejected before any upstream call.
  // --------------------------------------------------------------------------
  const authHeader = req.headers?.authorization || '';
  const tokenMatch = String(authHeader).trim().match(BEARER_TOKEN_PATTERN);
  const token = tokenMatch && tokenMatch[1] ? tokenMatch[1].trim() : '';
  if (!token || isBlockedDevToken(token)) {
    return err(res, 401, 'AUTHENTICATION_REQUIRED');
  }

  let caller = null;
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': publishableKey || secretKey
      }
    });
    if (!userRes.ok) {
      return err(res, 401, 'AUTHENTICATION_REQUIRED');
    }
    caller = await userRes.json();
  } catch (e) {
    console.warn('[VisionProxy] identity verification error:', e.message);
    return err(res, 401, 'AUTHENTICATION_REQUIRED');
  }
  if (!caller || !caller.id) {
    return err(res, 401, 'AUTHENTICATION_REQUIRED');
  }

  // --------------------------------------------------------------------------
  // Authorization: derive solely from user_roles. Fail closed on lookup error,
  // empty role result, or null branch (unless global SYSTEM_ADMIN / ADMIN).
  // --------------------------------------------------------------------------
  let userRoles = [];
  try {
    const roleRes = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(caller.id)}&select=role,branch_id`,
      {
        headers: {
          'apikey': publishableKey,
          'Authorization': `Bearer ${token}`
        }
      }
    );
    if (!roleRes.ok) {
      console.warn('[VisionProxy] role lookup returned:', roleRes.status);
      return err(res, 403, 'PERMISSION_DENIED');
    }
    userRoles = await roleRes.json();
  } catch (e) {
    console.warn('[VisionProxy] role lookup error:', e.message);
    return err(res, 403, 'PERMISSION_DENIED');
  }
  if (!Array.isArray(userRoles) || userRoles.length === 0) {
    return err(res, 403, 'PERMISSION_DENIED');
  }

  const hasAccess = userRoles.some((r) => {
    const name = String(r.role || '').trim().toUpperCase();
    if (!ALLOWED_ROLES.includes(name)) return false;
    if (name === 'SYSTEM_ADMIN' || name === 'ADMIN') return true;
    if (!r.branch_id) return false;
    return String(r.branch_id).trim().toUpperCase() === DEFAULT_BRANCH_CODE;
  });
  if (!hasAccess) {
    return err(res, 403, 'PERMISSION_DENIED');
  }

  // --------------------------------------------------------------------------
  // Rate limit: per authenticated user id (never the raw token as a key).
  // --------------------------------------------------------------------------
  const limitPerMin = parsePositiveInt(process.env.VISION_PROXY_RATE_LIMIT_PER_MIN, DEFAULT_RATE_LIMIT_PER_MIN);
  if (!rateLimitCheck(caller.id, limitPerMin).allowed) {
    return err(res, 429, 'RATE_LIMITED');
  }
// --------------------------------------------------------------------------
  // Payload validation.
  // --------------------------------------------------------------------------
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return err(res, 400, 'INVALID_REQUEST'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return err(res, 400, 'INVALID_REQUEST');
  }

  const unexpected = Object.keys(body).filter((k) => !ALLOWED_FIELDS.has(k));
  if (unexpected.length > 0) {
    return err(res, 400, 'INVALID_REQUEST');
  }

  const { imageBase64, mimeType = 'image/jpeg', filename = 'flyer.jpg' } = body;

  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return err(res, 400, 'INVALID_REQUEST');
  }
  // Reject malformed payloads (data: URLs, whitespace, non-base64, etc.).
  if (!BASE64_PATTERN.test(imageBase64)) {
    return err(res, 400, 'INVALID_REQUEST');
  }
  if (!ALLOWED_MIME_TYPES.has(String(mimeType).trim().toLowerCase())) {
    return err(res, 415, 'UNSUPPORTED_IMAGE_TYPE');
  }

  const maxBytes = parsePositiveInt(process.env.VISION_PROXY_MAX_IMAGE_BYTES, DEFAULT_MAX_IMAGE_BYTES);
  const imageBytes = decodedByteLength(imageBase64);
  if (imageBytes > maxBytes) {
    return err(res, 413, 'IMAGE_TOO_LARGE');
  }

  // --------------------------------------------------------------------------
  // Server key availability (config error, sanitized; not an upstream leak).
  // --------------------------------------------------------------------------
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'BLOCKED_NO_API_KEY',
      status: 'BLOCKED_NO_API_KEY',
      variants: [],
      message: 'Vision API service is not configured on the server.'
    });
  }
// --------------------------------------------------------------------------
  // Upstream: send only validated data; timeout; sanitized failure mapping.
  // --------------------------------------------------------------------------
  const modelName = process.env.CLAUDE_VISION_MODEL || 'claude-3-5-sonnet-20241022';
  const timeoutMs = parsePositiveInt(process.env.VISION_PROXY_TIMEOUT_MS, DEFAULT_UPSTREAM_TIMEOUT_MS);
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
            source: { type: "base64", media_type: mimeType, data: imageBase64 }
          },
          {
            type: "text",
            text: `Analyze this Samsung promotional flyer image (${filename}). Extract all device models, retail pricing (RRP), discount amounts, final net prices, sale modes (STANDARD or TRADE_UP), coupon codes, and any freebies/gifts.\nRespond strictly with a JSON object following this format:\n{\n  "overallConfidence": 0.95,\n  "isSupplementalOnly": false,\n  "summary": "Short description of the campaign",\n  "offers": [\n    {\n      "model": "Galaxy S26 Ultra",\n      "pn": "SM-S938B",\n      "rrp": 49900,\n      "discount": 4000,\n      "netPrice": 45900,\n      "saleMode": "STANDARD",\n      "coupon": "LAUNCH-S26",\n      "freebies": ["45W Power Adapter"],\n      "conditions": ["Valid until 30 Sept"],\n      "confidence": 0.95,\n      "isPriceEstimated": false\n    }\n  ]\n}\nIf the image does not contain clear pricing or is too blurry/unreadable, set overallConfidence to a value below 0.70.`
          }
        ]
      }
    ]
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicPayload),
      signal: controller.signal
    });

    if (!upRes.ok) {
      // Never echo provider status/body to the client.
      console.error('[VisionProxy] upstream HTTP non-ok:', upRes.status, requestId);
      return err(res, 502, 'VISION_UPSTREAM_ERROR');
    }

    const data = await upRes.json();
    const textBlocks = (data.content || []).filter((b) => b && b.type === 'text');
    const texts = textBlocks.map((b) => (typeof b.text === 'string' ? b.text : '')).filter((t) => t.length > 0);
    if (texts.length === 0) {
      console.error('[VisionProxy] upstream response missing text content', requestId);
      return err(res, 502, 'VISION_UPSTREAM_ERROR');
    }

    // Return only the extracted vision text (sanitized subset). No upstream
    // request ids, usage, urls, or other sensitive fields are echoed.
    return res.status(200).json({ content: [{ type: 'text', text: texts[0] }] });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      console.warn('[VisionProxy] upstream timeout', requestId);
      return err(res, 504, 'VISION_UPSTREAM_TIMEOUT');
    }
    console.warn('[VisionProxy] upstream network error:', e && e.message, requestId);
    return err(res, 502, 'VISION_UPSTREAM_ERROR');
  } finally {
    clearTimeout(timer);
  }
};
