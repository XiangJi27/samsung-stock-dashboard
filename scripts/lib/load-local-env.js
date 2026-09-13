/**
 * Safe Environment Loader for Local Feedback Pilot Tests
 * Loads environment variables from .env.feedback-pilot.local without exposing to Git
 */

const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env.feedback-pilot.local');
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const content = fs.readFileSync(envPath, 'utf-8');
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

module.exports = { loadLocalEnv };
