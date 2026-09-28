'use strict';
/**
 * Security Hardening Regression Suite: C4 (Gate 3) - Stored/Reflected XSS.
 *
 * Primary target: assets/js/issue-list.js
 *
 * Proves every user-controlled / database-controlled value (issue_number,
 * title, description, comment_text, profile display_name) is rendered as DATA
 * (escaped text) and never as executable markup, and that enum values
 * (status / severity) use allow-listed safe defaults so unknown values cannot
 * become HTML/class fragments.
 *
 * Fully offline (Tier A): loads the real issue-list.js in a Node vm with a
 * minimal DOM stub. No browser, no network, no production credentials.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(REPO_ROOT, 'assets', 'js', 'issue-list.js');
const SOURCE = fs.readFileSync(TARGET, 'utf8');

let passed = 0;
let failed = 0;

function makeTest(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log('  PASS  ' + name);
    })
    .catch((err) => {
      failed++;
      console.log('  FAIL  ' + name);
      console.log('        -> ' + err.message);
    });
}

function makeEl(tag, id) {
  const listeners = {};
  return {
    tagName: tag,
    id: id,
    innerHTML: '',
    textContent: '',
    style: {},
    value: '',
    checked: false,
    disabled: false,
    children: [],
    setAttribute() {},
    getAttribute() { return null; },
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    addEventListener(ev, fn) { listeners[ev] = fn; },
    querySelectorAll() { return []; },
    getElementsByClassName() { return []; },
    classList: { add() {}, remove() {}, toggle() {} },
  };
}

function loadIssueListView(issueService) {
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
  const windowStub = { IssueService: issueService };
  const sandbox = {
    window: windowStub,
    document: documentStub,
    console,
    Date,
    Math,
    setTimeout,
    clearTimeout,
    alert() {},
    encodeURIComponent,
  };
  vm.runInNewContext(SOURCE, sandbox, { filename: 'issue-list.js' });
  return { view: windowStub.IssueListView, document: documentStub, elements, window: windowStub };
}

const PAYLOADS = [
  'PAYLOAD_script_alert',
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '</textarea><script>alert(1)</script>',
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  'Thai + <b>bold</b> สวัสดี &amp; ทดสอบ',
  'null',
  'undefined',
  ['array', '<script>alert(3)</script>'],
  { key: '<script>alert(4)</script>' },
];

// Tag openers containing a raw '<' that could create a live DOM element.
// escapeHtml escapes '& < > " '' so these can never survive as live markup,
// while plain-text tokens like 'onerror=' DO legitimately remain visible (they
// are inert text inside &lt;img ...&gt;). Checking for raw tag openers is the
// correct signal for a live XSS.
const FORBIDDEN = ['<script', '<img', '<svg', '<iframe', '<object', '<embed', '<a href="javascript'];

function assertEscapedOnly(fragment, label) {
  for (const bad of FORBIDDEN) {
    if (fragment.includes(bad)) {
      throw new Error(label + ': forbidden raw fragment present: ' + JSON.stringify(bad));
    }
  }
}

function runPayloadCardPairs() {
  const ctx = loadIssueListView();
  const tasks = [];
  for (const payload of PAYLOADS) {
    const label = 'payload: ' + String(payload).slice(0, 40);
    tasks.push(makeTest(label + ' - issue fields rendered as text', () => {
      const cardHtml = ctx.view.renderCard({
        id: 'abc-123', issue_number: 'ISS-' + payload, title: payload, description: payload,
        status: 'NEW', severity: 'P3_MEDIUM', created_at: new Date().toISOString(),
      });
      assertEscapedOnly(cardHtml, 'card');

      const content = ctx.document.getElementById('pilot-detail-content');
      ctx.view.selectIssue({
        id: 'abc-123', issue_number: 'ISS-' + payload, title: payload, description: payload,
        status: 'NEW', severity: 'P4_LOW', created_at: new Date().toISOString(),
      });
      assertEscapedOnly(content.innerHTML, 'detail');
    }));
  }
  return Promise.all(tasks);
}
function runStaticTests() {
  const patterns = [
    '${issue.title}',
    '${issue.description}',
    '${issue.issue_number}',
    '${c.comment_text}',
    '${c.profiles?.display_name}',
    '${statusInfo.text}',
    '${sevInfo.text}',
  ];
  const tasks = [];
  tasks.push(makeTest('STATIC: no user field interpolated unescaped into a template', () => {
    const offenders = patterns.filter((p) => SOURCE.includes(p));
    assert.strictEqual(offenders.length, 0, 'unescaped refs still present: ' + offenders.join(', '));
  }));

  tasks.push(makeTest('STATIC: escapeHtml helper escapes all 5 characters', () => {
    assert.ok(/const\s+escapeHtml\s*=/.test(SOURCE), 'escapeHtml helper missing');
    assert.ok(SOURCE.includes('&amp;') && SOURCE.includes('&lt;') && SOURCE.includes('&gt;') &&
      SOURCE.includes('&quot;') && SOURCE.includes('&#39;'), 'not all 5 entities escaped');
  }));

  tasks.push(makeTest('STATIC: data-id uses safeIdToken normalizer', () => {
    assert.ok(/const\s+safeIdToken\s*=/.test(SOURCE), 'safeIdToken helper missing');
    assert.ok(new RegExp('data-id="\\$\\{safeIdToken\\(issue\\.id\\)\\}"').test(SOURCE),
      'data-id not normalized via safeIdToken');
  }));

  tasks.push(makeTest('STATIC: status/severity enum fallback uses safe default, not raw value', () => {
    assert.ok(SOURCE.includes("{ text: 'ไม่ระบุ', color: '#78909c' }"), 'status fallback not safe');
    assert.ok(SOURCE.includes("{ text: 'ไม่ระบุ', color: '#90a4ae' }"), 'severity fallback not safe');
  }));

  tasks.push(makeTest('STATIC: comments escaped + pre-wrap line breaks', () => {
    assert.ok(/escapeHtml\(c\.profiles\?\.display_name \|\| 'ผู้ใช้'\)/.test(SOURCE), 'display_name not escaped');
    assert.ok(/escapeHtml\(c\.comment_text\)/.test(SOURCE), 'comment_text not escaped');
    assert.ok(/white-space:pre-wrap/.test(SOURCE), 'comment line-break rendering missing');
  }));

  tasks.push(makeTest('STATIC: no untrusted value in an inline event handler', () => {
    const inline = SOURCE.split('\n').filter((l) => /on(click|mouseover|error|load|change)\s*=/.test(l));
    assert.strictEqual(inline.length, 0, 'inline event handler(s) present: ' + inline.length);
  }));

  tasks.push(makeTest('STATIC: no dynamic href/src interpolation of user data', () => {
    const dyn = SOURCE.split('\n').filter((l) => /(href|src)="\$\{/.test(l));
    assert.strictEqual(dyn.length, 0, 'dynamic href/src interpolation found: ' + dyn.length);
  }));

  return Promise.all(tasks);
}
function runRuntimeTests() {
  const ctx = loadIssueListView();
  const tasks = [];

  tasks.push(makeTest('ENUM: unknown status uses allow-listed safe default', () => {
    const html = ctx.view.renderCard({
      id: 'x', issue_number: 'N', title: '"><script>boom</script>', description: '',
      status: '" onmouseover="alert(1)"', severity: 'P3_MEDIUM', created_at: new Date().toISOString(),
    });
    assertEscapedOnly(html, 'unknown status');
    assert.ok(html.includes('ไม่ระบุ'), 'safe default label missing');
  }));

  tasks.push(makeTest('ENUM: unknown severity uses allow-listed safe default', () => {
    const html = ctx.view.renderCard({
      id: 'x', issue_number: 'N', title: 't', description: '', status: 'NEW',
      severity: '"><svg/onload=alert(1)>', created_at: new Date().toISOString(),
    });
    assertEscapedOnly(html, 'unknown severity');
  }));

  tasks.push(makeTest('ID: tainted id normalized in data-id, no attribute breakout', () => {
    const html = ctx.view.renderCard({
      id: 'abc" onmouseover="alert(1)', issue_number: 'N', title: 't', description: '',
      status: 'NEW', severity: 'P3_MEDIUM', created_at: new Date().toISOString(),
    });
    const m = html.match(/data-id="([^"]*)"/);
    assert.ok(m, 'data-id missing');
    assert.ok(/^[A-Za-z0-9_-]*$/.test(m[1]), 'data-id not normalized: ' + JSON.stringify(m[1]));
    assert.ok(!html.includes('onmouseover='), 'attribute breakout via id');
  }));

  tasks.push(makeTest('COMMENT: display_name + comment_text escaped with line breaks', async () => {
    const msgs = [
      { id: 'c1', is_internal: false, comment_text: '<script>alert(1)</script>',
        created_at: new Date().toISOString(), profiles: { display_name: '"><img src=x onerror=alert(1)>' } },
      { id: 'c2', is_internal: true, comment_text: 'Line1\nLine2\nสวัสดี & <b>x</b>',
        created_at: new Date().toISOString(), profiles: { display_name: 'ผู้ใช้' } },
    ];
    const ctx2 = loadIssueListView({ getIssueComments: async () => msgs });
    const container = ctx2.document.getElementById('pilot-comments-list');
    await ctx2.view.loadComments('abc-123');
    const html = container.innerHTML;
    assertEscapedOnly(html, 'comment');
    assert.ok(html.includes('&quot;&gt;&lt;img'), 'display_name not escaped');
    assert.ok(html.includes('&lt;script&gt;'), 'comment_text not escaped');
    assert.ok(html.includes('white-space:pre-wrap'), 'line-break rendering missing');
    assert.ok(html.includes('Line1') && html.includes('Line2'), 'legit lines lost');
  }));

  tasks.push(makeTest('UNEXPECTED: null/undefined/array/object never throw, never markup', () => {
    for (const v of [null, undefined, ['a', '<script>alert(9)</script>'], { x: '<img>' }]) {
      const html = ctx.view.renderCard({
        id: 'x', issue_number: v, title: v, description: v,
        status: 'NEW', severity: 'P3_MEDIUM', created_at: new Date().toISOString(),
      });
      assertEscapedOnly(html, 'unexpected ' + JSON.stringify(v));
    }
  }));

  tasks.push(makeTest('LONG comment text renders fully escaped', async () => {
    const long = '<script>alert(1)</script>'.repeat(2000);
    const ctx3 = loadIssueListView({
      getIssueComments: async () => [
        { id: 'cL', is_internal: false, comment_text: long,
          created_at: new Date().toISOString(), profiles: { display_name: 'ผู้ใช้' } },
      ],
    });
    const container = ctx3.document.getElementById('pilot-comments-list');
    await ctx3.view.loadComments('abc-123');
    assertEscapedOnly(container.innerHTML, 'long comment');
    const count = container.innerHTML.split('&lt;script&gt;').length - 1;
    assert.strictEqual(count, 2000, 'expected all segments escaped');
  }));

  return Promise.all(tasks);
}

Promise.all([runStaticTests(), runPayloadCardPairs(), runRuntimeTests()])
  .then(() => {
    console.log('\n' + '='.repeat(70));
    console.log('RESULT: ' + passed + ' passed, ' + failed + ' failed');
    console.log('='.repeat(70));
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Suite crashed:', err);
    process.exit(1);
  });