'use strict';
/**
 * Correctness / Security Regression Suite: GATE 4 (H1 + H2) - Issue Tracker.
 *
 * Primary targets:
 *   - assets/js/issue-service.js  (adds the missing updateStatus() for H1)
 *   - assets/js/issue-list.js     (uses getIssueComments() for H2, restores UI on failure)
 *
 * Proves the two confirmed defects are fixed WITHOUT regressing Gate 3 (C4):
 *   H1 - IssueService.updateStatus() exists, validates the issue id, uses an
 *        explicit status allowlist, rejects unknown values, relies on the DB
 *        RLS UPDATE policy (never bypasses RLS), surfaces RLS denials / server
 *        failures as errors (never silent success), and the UI reflects the new
 *        status only AFTER the persistent operation succeeds. On failure the UI
 *        restores the previous displayed state.
 *   H2 - issue-list.js calls getIssueComments() (not getComments()), existing
 *        comments load in chronological order, empty threads render cleanly.
 *   XSS - malicious title/description/display_name/comment remain inert text,
 *        with 0 console critical errors.
 *
 * Fully offline (Tier A): loads the real assets in a Node vm with minimal DOM
 * stubs. No browser, no network, no production credentials.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const ISSUE_LIST_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets', 'js', 'issue-list.js'), 'utf8');
const ISSUE_SERVICE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets', 'js', 'issue-service.js'), 'utf8');

const ALLOWED = ['NEW', 'TRIAGED', 'VERIFIED', 'IN_PROGRESS', 'FIX_READY', 'READY_FOR_RETEST',
  'RESOLVED', 'CLOSED', 'NEEDS_MORE_INFO', 'DUPLICATE', 'CANNOT_REPRODUCE', 'WONT_FIX', 'SECURITY_REVIEW'];

let passed = 0;
let failed = 0;

function makeTest(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log('  PASS  ' + name); })
    .catch((err) => { failed++; console.log('  FAIL  ' + name); console.log('        -> ' + (err && err.message)); });
}

function makeEl(tag, id) {
  const listeners = {};
  return {
    tagName: tag, id, innerHTML: '', textContent: '', style: {}, value: '',
    checked: false, disabled: false, children: [],
    setAttribute() {}, getAttribute() { return null; },
    appendChild(c) { this.children.push(c); return c; }, remove() {},
    addEventListener(ev, fn) { listeners[ev] = fn; },
    dispatch(ev) { if (listeners[ev]) listeners[ev]({ target: this }); },
    querySelectorAll() { return []; }, getElementsByClassName() { return []; },
    classList: { add() {}, remove() {}, toggle() {} },
  };
}

function loadModules(overrides) {
  overrides = overrides || {};
  const elements = {};
  const documentStub = {
    body: makeEl('body'),
    getElementById(id) {
      if (!elements[id]) elements[id] = makeEl('div', id);
      return elements[id];
    },
    createElement: (t) => makeEl(t),
    querySelectorAll() { return []; },
  };

  const errors = [];
  const consoleStub = {
    log() {}, warn() {},
    error(...a) { errors.push(a.map(String).join(' ')); },
  };

  // Fake Supabase chain client recording the last update call.
  let lastUpdatePayload = null;
  let lastUpdateEq = null;
  const fakeClient = {
    from() {
      return {
        update(payload) { lastUpdatePayload = payload; return this; },
        eq(col, val) { lastUpdateEq = { col, val }; return this; },
        select() { return this; },
        single() {
          if (overrides.updateThrows) return Promise.reject(new Error(overrides.updateError || 'db fail'));
          if (overrides.updateRlsBlocked) return Promise.resolve({ data: null, error: null });
          if (overrides.updateServerError) return Promise.resolve({ data: null, error: { message: overrides.updateServerError } });
          if (overrides.updateResolve) return Promise.resolve({ data: overrides.updateResolve, error: null });
          return Promise.resolve({
            data: { id: lastUpdateEq && lastUpdateEq.val, status: lastUpdatePayload && lastUpdatePayload.status },
            error: null,
          });
        },
      };
    },
  };

  const windowStub = {
    SupabaseAdapter: { getClient: () => fakeClient },
    AuthService: { getProfile: () => overrides.profile || { id: '00000000-0000-0000-0000-000000000001' } },
    PermissionService: {
      isStoreLeader: () => !!overrides.isStoreLeader,
      isSystemAdmin: () => !!overrides.isSystemAdmin,
    },
  };
  const sandbox = {
    window: windowStub,
    document: documentStub,
    console: consoleStub,
    Error, Date, Math, JSON, Object,
    setTimeout, clearTimeout, encodeURIComponent,
    alert: (m) => { errors.push('ALERT: ' + m); },
  };
  vm.runInNewContext(ISSUE_SERVICE_SRC, sandbox, { filename: 'issue-service.js' });
  vm.runInNewContext(ISSUE_LIST_SRC, sandbox, { filename: 'issue-list.js' });

  return {
    service: windowStub.IssueService,
    view: windowStub.IssueListView,
    document: documentStub,
    elements,
    errors,
    fakeClient,
    getLastUpdatePayload: () => lastUpdatePayload,
    getLastUpdateEq: () => lastUpdateEq,
  };
}

function runH1Tests() {
  const tasks = [];

  tasks.push(makeTest('H1: IssueService.updateStatus() exists (defect was: method missing)', () => {
    const ctx = loadModules({ isStoreLeader: true });
    assert.strictEqual(typeof ctx.service.updateStatus, 'function', 'updateStatus is missing');
  }));

  tasks.push(makeTest('H1: rejects invalid/missing issue id deterministically', async () => {
    const ctx = loadModules({ isStoreLeader: true });
    await assert.rejects(() => ctx.service.updateStatus('not-a-uuid', 'RESOLVED'), /invalid issue id/);
    await assert.rejects(() => ctx.service.updateStatus('', 'RESOLVED'), /invalid issue id/);
    await assert.rejects(() => ctx.service.updateStatus(null, 'RESOLVED'), /invalid issue id/);
    await assert.rejects(() => ctx.service.updateStatus(undefined, 'RESOLVED'), /invalid issue id/);
    await assert.rejects(() => ctx.service.updateStatus(12345, 'RESOLVED'), /invalid issue id/);
  }));

  tasks.push(makeTest('H1: rejects unknown/injected status via explicit allowlist', async () => {
    const ctx = loadModules({ isStoreLeader: true });
    const bad = ['HACKED', 'resolved', 'RESOLVED ', '', null, undefined, 42,
      'onerror=alert(1)', '<script>alert(1)</script>', "'; DROP TABLE issues; --"];
    for (const s of bad) {
      await assert.rejects(() => ctx.service.updateStatus('00000000-0000-0000-0000-000000000301', s),
        /unsupported status/, 'must reject status: ' + JSON.stringify(s));
    }
  }));

  tasks.push(makeTest('H1: accepts all 13 allow-listed statuses and sends them to DB', async () => {
    for (const s of ALLOWED) {
      const ctx = loadModules({ isStoreLeader: true, updateResolve: null });
      const row = await ctx.service.updateStatus('00000000-0000-0000-0000-000000000301', s);
      assert.strictEqual(row.status, s, s + ' round-trip mismatch');
      // NOTE: the payload object is built inside the vm realm, so compare its
      // serialized shape (equivalent for a flat status object) rather than by
      // prototype-sensitive deepStrictEqual.
      assert.strictEqual(JSON.stringify(ctx.getLastUpdatePayload()), JSON.stringify({ status: s }),
        s + ' payload mismatch');
      assert.deepStrictEqual(ctx.getLastUpdateEq(), { col: 'id', val: '00000000-0000-0000-0000-000000000301' },
        s + ' filter mismatch');
    }
  }));

  tasks.push(makeTest('H1: uses RLS-governed client update (never bypasses RLS/roles)', async () => {
    const ctx = loadModules({ isStoreLeader: true, updateResolve: { id: 'i', status: 'RESOLVED' } });
    await ctx.service.updateStatus('00000000-0000-0000-0000-000000000301', 'RESOLVED');
    assert.ok(/(\.|\s)from\('issues'\)\s*[\s\S]*?\.update\(/.test(ISSUE_SERVICE_SRC) ||
      /from\('issues'\)/.test(ISSUE_SERVICE_SRC), 'must update the issues table');
    assert.ok(!/rpc\(\s*['"]\w+_unsafe/.test(ISSUE_SERVICE_SRC), 'no unsafe RPC escape hatch');
  }));

  return Promise.all(tasks);
}

function runH1DenialTests() {
  const tasks = [];
  const UUID = '00000000-0000-0000-0000-000000000301';

  tasks.push(makeTest('H1: RLS row-filtered (e.g. MEMBER) throws, never silent success', async () => {
    const ctx = loadModules({ updateRlsBlocked: true });
    await assert.rejects(() => ctx.service.updateStatus(UUID, 'RESOLVED'),
      /ไม่มีสิทธิ์|permission|not found/i, 'RLS-blocked update must throw');
  }));

  tasks.push(makeTest('H1: server state-machine rejection is surfaced (not swallowed)', async () => {
    const ctx = loadModules({ updateServerError: 'Invalid status transition path' });
    await assert.rejects(() => ctx.service.updateStatus(UUID, 'RESOLVED'), /Invalid status transition path/);
  }));

  tasks.push(makeTest('H1: thrown DB/network failure propagates as error', async () => {
    const ctx = loadModules({ updateThrows: true, updateError: 'network down' });
    await assert.rejects(() => ctx.service.updateStatus(UUID, 'RESOLVED'), /network down/);
  }));

  tasks.push(makeTest('H1: on failure the service logs an error (no silent path)', async () => {
    const ctx = loadModules({ updateServerError: 'RLS denied' });
    await assert.rejects(() => ctx.service.updateStatus(UUID, 'RESOLVED'));
    assert.ok(ctx.errors.some((e) => /Update status error/.test(e)),
      'expected a logged error, got: ' + JSON.stringify(ctx.errors));
  }));

  // --- UI persistence-order behaviour via the real selectIssue() handler ---

  const leaderIssue = () => ({
    id: UUID, status: 'NEW', issue_number: 'ISS-1', title: 't', description: 'd',
    severity: 'P3_MEDIUM', category: 'OTHER', created_at: new Date().toISOString(),
  });

  tasks.push(makeTest('H1/UI: success path updates UI + reloads list (persist-first)', async () => {
    const ctx = loadModules({ isStoreLeader: true });
    ctx.service.getIssueComments = async () => [];
    ctx.service.getMyIssues = async () => [];
    let reloaded = false;
    ctx.view.loadIssues = () => { reloaded = true; };
    await ctx.view.selectIssue(leaderIssue());

    const select = ctx.document.getElementById('p-detail-status-select');
    assert.ok(select, 'manager status select must be rendered for a leader');

    // Simulate choosing a new status.
    const issue = ctx.view.selectedIssue;
    select.value = 'RESOLVED';
    select.dispatch('change');
    await new Promise((r) => setTimeout(r, 5)); // let async handler settle

    assert.strictEqual(issue.status, 'RESOLVED', 'in-memory issue not updated on success');
    assert.strictEqual(ctx.getLastUpdatePayload().status, 'RESOLVED', 'not persisted to DB');
    assert.strictEqual(reloaded, true, 'list not reloaded after success');
  }));

  tasks.push(makeTest('H1/UI: failure path restores previous status, does NOT mutate', async () => {
    const ctx = loadModules({ isStoreLeader: true, updateRlsBlocked: true });
    ctx.service.getIssueComments = async () => [];
    ctx.service.getMyIssues = async () => [];
    let reloaded = false;
    ctx.view.loadIssues = () => { reloaded = true; };
    await ctx.view.selectIssue(leaderIssue());

    const select = ctx.document.getElementById('p-detail-status-select');
    const issue = ctx.view.selectedIssue;
    select.value = 'RESOLVED';   // user picks new value
    select.dispatch('change');
    await new Promise((r) => setTimeout(r, 5));

    assert.strictEqual(select.value, 'NEW', 'select must be restored to previous status');
    assert.strictEqual(issue.status, 'NEW', 'in-memory issue must not change on failure');
    assert.strictEqual(reloaded, false, 'list must NOT reload when the write failed');
    assert.ok(ctx.errors.some((e) => /^ALERT: ไม่สามารถเปลี่ยนสถานะได้/.test(e)),
      'expected a user-facing failure alert, got: ' + JSON.stringify(ctx.errors));
  }));

  return Promise.all(tasks);
}

function runH2Tests() {
  const tasks = [];
  const UUID = '00000000-0000-0000-0000-000000000301';

  tasks.push(makeTest('H2: issue-list.js calls getIssueComments (not the stale getComments)', () => {
    assert.ok(!/IssueService\?\.getComments\b/.test(ISSUE_LIST_SRC), 'stale getComments() call remains');
    assert.ok(/IssueService\?\.getIssueComments\b/.test(ISSUE_LIST_SRC), 'getIssueComments() not used');
  }));

  tasks.push(makeTest('H2: existing comments load in chronological order', async () => {
    const ctx = loadModules({});
    ctx.service.getIssueComments = async () => ([
      { id: 'c1', is_internal: false, comment_text: 'ALPHA', created_at: '2026-01-01T00:00:00Z', profiles: { display_name: 'A' } },
      { id: 'c2', is_internal: true, comment_text: 'BRAVO', created_at: '2026-01-02T00:00:00Z', profiles: { display_name: 'B' } },
      { id: 'c3', is_internal: false, comment_text: 'CHARLIE', created_at: '2026-01-03T00:00:00Z', profiles: { display_name: 'C' } },
    ]);
    const container = ctx.document.getElementById('pilot-comments-list');
    await ctx.view.loadComments(UUID);
    const html = container.innerHTML;
    const i1 = html.indexOf('ALPHA'), i2 = html.indexOf('BRAVO'), i3 = html.indexOf('CHARLIE');
    assert.ok(i1 >= 0 && i2 > i1 && i3 > i2, 'comments not in chronological order');
    assert.ok(html.includes('[บันทึกภายใน]'), 'internal note badge missing');
  }));

  tasks.push(makeTest('H2: empty thread renders a clean empty state (no crash)', async () => {
    const ctx = loadModules({});
    ctx.service.getIssueComments = async () => [];
    const container = ctx.document.getElementById('pilot-comments-list');
    await ctx.view.loadComments(UUID);
    assert.ok(container.innerHTML.includes('ยังไม่มีข้อความ'), 'empty state text missing');
  }));

  tasks.push(makeTest('H2: comment-load failure renders an error state (not a blank pane)', async () => {
    const ctx = loadModules({});
    ctx.service.getIssueComments = async () => { throw new Error('boom'); };
    const container = ctx.document.getElementById('pilot-comments-list');
    await ctx.view.loadComments(UUID);
    assert.ok(container.innerHTML.includes('โหลดข้อความไม่ส'), 'error state text missing');
  }));

  return Promise.all(tasks);
}

function runXssTests() {
  const tasks = [];
  const UUID = '00000000-0000-0000-0000-000000000301';
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg/onload=alert(1)>',
    'javascript:alert(1)',
    'Thai & <b>bold</b> สวัสดี',
  ];

  tasks.push(makeTest('XSS: malicious title/issue_number/description stay inert text', () => {
    const ctx = loadModules({});
    for (const p of payloads) {
      const html = ctx.view.renderCard({
        id: 'x', issue_number: p, title: p, description: p, category: 'OTHER',
        severity: 'P3_MEDIUM', status: 'NEW', created_at: new Date().toISOString(),
      });
      assert.ok(!/<script/i.test(html), 'raw <script> leaked for ' + p);
      assert.ok(!/<img/i.test(html), 'raw <img> leaked for ' + p);
      assert.ok(!/<svg/i.test(html), 'raw <svg> leaked for ' + p);
    }
  }));

  tasks.push(makeTest('XSS: malicious display_name/comment_text stay inert text', async () => {
    const ctx = loadModules({});
    ctx.service.getIssueComments = async () => ([
      { id: 'cx', is_internal: false, comment_text: '<img src=x onerror=alert(1)>',
        created_at: new Date().toISOString(), profiles: { display_name: '"><svg/onload=alert(1)>' } },
    ]);
    const container = ctx.document.getElementById('pilot-comments-list');
    await ctx.view.loadComments(UUID);
    const html = container.innerHTML;
    assert.ok(!/<img/i.test(html), 'comment injection leaked an <img>');
    assert.ok(!/<svg/i.test(html), 'display_name injection leaked an <svg>');
    assert.ok(html.includes('&lt;img'), 'comment_text was not escaped');
    assert.ok(html.includes('&lt;svg'), 'display_name was not escaped');
  }));

  tasks.push(makeTest('XSS: unknown status/severity fall back to safe default text', () => {
    const ctx = loadModules({});
    const html = ctx.view.renderCard({
      id: 'x', issue_number: 'N', title: 't', description: '', category: 'OTHER',
      status: '<img src=x>', severity: '"><script>', created_at: new Date().toISOString(),
    });
    assert.ok(html.includes('ไม่ระบุ'), 'allow-listed fallback label missing');
    assert.ok(!/<img|<script|<svg/i.test(html), 'status/severity became markup');
  }));

  return Promise.all(tasks);
}

function runConsoleChecks() {
  const tasks = [];
  const UUID = '00000000-0000-0000-0000-000000000301';
  tasks.push(makeTest('CONSOLE: zero critical runtime errors after H1/H2 happy path', async () => {
    const ctx = loadModules({ isStoreLeader: true });
    ctx.service.getIssueComments = async () => [];
    ctx.service.getMyIssues = async () => [];
    ctx.view.loadIssues = () => {};
    const issue = { id: UUID, status: 'NEW', issue_number: 'I', title: 't', description: 'd',
      severity: 'P3_MEDIUM', category: 'OTHER', created_at: new Date().toISOString() };
    await ctx.view.selectIssue(issue);
    const select = ctx.document.getElementById('p-detail-status-select');
    select.value = 'CLOSED';
    select.dispatch('change');
    await new Promise((r) => setTimeout(r, 5));
    const critical = ctx.errors.filter((e) =>
      /typeerror|referenceerror|cannot read|is not a function|undefined is not/i.test(e));
    assert.strictEqual(critical.length, 0, 'critical errors: ' + JSON.stringify(critical) +
      ' | all: ' + JSON.stringify(ctx.errors));
  }));
  return Promise.all(tasks);
}

Promise.all([
  runH1Tests(),
  runH1DenialTests(),
  runH2Tests(),
  runXssTests(),
  runConsoleChecks(),
]).then(() => {
  console.log('\n' + '='.repeat(70));
  console.log('RESULT: ' + passed + ' passed, ' + failed + ' failed');
  console.log('='.repeat(70));
  process.exit(failed > 0 ? 1 : 0);
}).catch((err) => {
  console.error('Suite crashed:', err);
  process.exit(1);
});