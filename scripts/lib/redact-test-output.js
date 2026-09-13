/**
 * PII & Token Redaction Utility for Security Auditing and Test Reporting
 */

function redactUuid(uuid) {
  if (!uuid || typeof uuid !== 'string') return uuid;
  if (uuid.length < 12) return '***';
  return `${uuid.substring(0, 4)}...${uuid.substring(uuid.length - 4)}`;
}

function redactToken(token) {
  if (!token || typeof token !== 'string') return token;
  if (token.startsWith('sb_publishable_')) {
    return `sb_publishable_***${token.substring(token.length - 4)}`;
  }
  return '***REDACTED_TOKEN***';
}

function redactEmail(email) {
  if (!email || typeof email !== 'string') return email;
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***';
  const name = parts[0];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
  return `${maskedName}@${parts[1]}`;
}

function redactObject(obj) {
  if (!obj) return obj;
  const cloned = JSON.parse(JSON.stringify(obj));

  function walk(node) {
    if (typeof node !== 'object' || node === null) return;
    for (const key of Object.keys(node)) {
      const lower = key.toLowerCase();
      if (lower.includes('token') || lower.includes('secret') || lower.includes('password') || lower.includes('jwt')) {
        node[key] = '***REDACTED***';
      } else if (lower.includes('email')) {
        node[key] = redactEmail(node[key]);
      } else if (lower.includes('id') && typeof node[key] === 'string' && node[key].length === 36) {
        node[key] = redactUuid(node[key]);
      } else if (typeof node[key] === 'object') {
        walk(node[key]);
      }
    }
  }

  walk(cloned);
  return cloned;
}

function redactUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;
  try {
    const u = new URL(urlStr);
    const hostParts = u.hostname.split('.');
    if (hostParts.length >= 3 && hostParts.slice(1).join('.') === 'supabase.co') {
      const proj = hostParts[0];
      const maskedProj = proj.length > 4 ? `${proj.substring(0, 3)}***${proj.substring(proj.length - 2)}` : '***';
      return `${u.protocol}//${maskedProj}.supabase.co`;
    }
    return `${u.protocol}//***.${hostParts.slice(-2).join('.')}`;
  } catch (e) {
    return 'https://***.supabase.co';
  }
}

module.exports = {
  redactUuid,
  redactToken,
  redactEmail,
  redactUrl,
  redactObject
};
