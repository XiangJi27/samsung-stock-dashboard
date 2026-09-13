/**
 * Safe Environment Loader for Local Feedback Pilot Tests
 * Separates Client/Member environment (.env.feedback-pilot.local)
 * from Server Admin environment (.env.feedback-pilot.server.local).
 * 
 * Security Guard:
 * - Client environment strictly strips any leaked secret/service keys.
 * - Server environment is exclusively loaded by server/admin tests.
 */

const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }

  return env;
}

/**
 * Loads Client Live Test environment (.env.feedback-pilot.local)
 * Sanitizes and strips any accidental secret keys.
 */
function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env.feedback-pilot.local');
  let env = parseEnvFile(envPath);

  if (!env) {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) {
      env = { ...process.env };
    } else {
      return null;
    }
  }

  // Security Guard: Client environment MUST NOT contain Server Secret Keys or Database Passwords
  const restrictedKeys = [
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SERVICE_ROLE_KEY',
    'DATABASE_PASSWORD',
    'DB_PASSWORD',
    'POSTGRES_PASSWORD'
  ];
  let strippedCount = 0;
  for (const key of restrictedKeys) {
    if (env[key]) {
      delete env[key];
      strippedCount++;
    }
  }
  if (strippedCount > 0) {
    console.warn('⚠️ [SECURITY GUARD] Restricted server/database credentials detected in client environment file (.env.feedback-pilot.local). Stripped from client test context.');
  }

  return env;
}

/**
 * Loads Server Admin Live Test environment (.env.feedback-pilot.server.local)
 * Used exclusively for serverless admin backend integration tests.
 */
function loadServerEnv() {
  const envPath = path.resolve(process.cwd(), '.env.feedback-pilot.server.local');
  let env = parseEnvFile(envPath);

  if (!env) {
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      env = { ...process.env };
    } else {
      return null;
    }
  }

  return env;
}

module.exports = { loadLocalEnv, loadServerEnv };
