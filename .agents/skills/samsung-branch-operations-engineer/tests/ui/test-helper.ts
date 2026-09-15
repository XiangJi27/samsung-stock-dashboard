import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper to safely load local env file if variables are not in process.env
function loadLocalEnvIfPresent() {
  if (process.env.TEST_ADMIN_PASSWORD && process.env.TEST_ADMIN_EMPLOYEE_ID) {
    return;
  }
  const candidatePaths = [
    path.resolve(process.cwd(), '.env.feedback-pilot.local'),
    path.resolve(__dirname, '../../../../.env.feedback-pilot.local'),
    path.resolve(__dirname, '../../../.env.feedback-pilot.local')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.substring(0, eqIdx).trim();
          const v = trimmed.substring(eqIdx + 1).trim();
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
      break;
    }
  }
}

loadLocalEnvIfPresent();

export interface TestCredentials {
  employeeId: string;
  password: string;
}

export function getAdminCredentials(): TestCredentials {
  const employeeId = process.env.TEST_ADMIN_EMPLOYEE_ID || 
    (process.env.TEST_ADMIN_EMAIL ? process.env.TEST_ADMIN_EMAIL.split('@')[0].toUpperCase() : '');
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!employeeId || !password) {
    throw new Error('Missing test credentials in environment: TEST_ADMIN_EMPLOYEE_ID / TEST_ADMIN_PASSWORD');
  }

  return { employeeId, password };
}

export function getMemberCredentials(): TestCredentials {
  const employeeId = process.env.TEST_MEMBER_EMPLOYEE_ID || 
    (process.env.TEST_MEMBER_EMAIL ? process.env.TEST_MEMBER_EMAIL.split('@')[0].toUpperCase() : '');
  const password = process.env.TEST_MEMBER_PASSWORD;

  if (!employeeId || !password) {
    throw new Error('Missing test credentials in environment: TEST_MEMBER_EMPLOYEE_ID / TEST_MEMBER_PASSWORD');
  }

  return { employeeId, password };
}

export function getTargetUrl(): string {
  return process.env.PREVIEW_URL || 'https://samsung-stock-dashboard-5g9hz2byr-xiangji27.vercel.app';
}

export interface PageDiagnostics {
  consoleErrors: string[];
  notFoundUrls: string[];
}

export function attachDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = {
    consoleErrors: [],
    notFoundUrls: []
  };

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const loc = msg.location ? msg.location() : null;
      if (loc && loc.url && loc.url.includes('favicon.ico')) return;
      if (text.includes('favicon.ico')) return;
      diagnostics.consoleErrors.push(text);
    }
  });

  page.on('response', resp => {
    if (resp.status() === 404) {
      if (!resp.url().includes('favicon.ico')) {
        diagnostics.notFoundUrls.push(resp.url());
      }
    }
  });

  return diagnostics;
}

export async function loginAsAdmin(page: Page) {
  const creds = getAdminCredentials();
  const url = getTargetUrl();
  
  await page.goto(`${url}/#/login`);
  await page.waitForSelector('#loginEmployeeId', { state: 'visible', timeout: 10000 });
  await page.fill('#loginEmployeeId', creds.employeeId);
  await page.fill('#loginPassword', creds.password);
  await page.click('#btnLoginSubmit');
  await page.waitForSelector('#view-home:not([hidden])', { timeout: 10000 });
}
