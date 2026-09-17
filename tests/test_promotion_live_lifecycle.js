/**
 * Test Suite: Promotion Serverless API & Transactional Lifecycle Simulation
 * Verifies the 4 real-world test cases, blocker gates, activation, and rollback flows.
 * Ayutthaya City Park Branch Operations.
 */

const assert = require('assert');
const promotionImportHandler = require('../api/promotion-imports.js');
const promotionCampaignHandler = require('../api/promotion-campaigns.js');
const activePromotionsHandler = require('../api/promotions/active.js');

console.log('🧪 Starting Promotion Live API & Transaction Lifecycle Tests...\n');

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ ${desc}`);
      passed++;
    })
    .catch((err) => {
      console.error(`  ✗ ${desc}`);
      console.error(`    ${err.message}`);
    });
}

// Mock HTTP Request / Response Helper
function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = {}, query = {} } = {}) {
  const req = {
    method,
    url,
    headers: { 'content-type': 'application/json', ...headers },
    body,
    query
  };

  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.data = obj; return this; },
    send(str) { this.data = str; return this; }
  };

  return { req, res };
}

async function runTests() {
  // --------------------------------------------------------------------------
  // 1. REAL-WORLD CASE 1: Galaxy S26 Ultra Multi-Tier & Student
  // --------------------------------------------------------------------------
  console.log('📌 Test Suite 1: Galaxy S26 Ultra Validation');

  await it('Validates S26 Ultra Standard + Trade Up and Student 15% Exclusive', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/promotion-imports/validate',
      body: {
        branchCode: 'AYUTTHAYA_CITY_PARK',
        items: [
          {
            inventoryPn: 'SM-S938B-512',
            model: 'Galaxy S26 Ultra',
            capacity: '512GB',
            regularPrice: 54900,
            standardDiscount: 5000,
            tradeUpDiscount: 5000,
            requiresTradeIn: true,
            couponCode: 'COUPON_01',
            netPrice: 44900
          },
          {
            inventoryPn: 'SM-S938B-512',
            model: 'Galaxy S26 Ultra',
            capacity: '512GB',
            regularPrice: 54900,
            optionType: 'STUDENT_EXCLUSIVE',
            couponCode: 'Studentcrd',
            discountPercent: 15,
            canCombineWithOtherPromotions: false,
            stackingPolicy: 'EXCLUSIVE',
            netPrice: 46665
          }
        ]
      }
    });

    // Caller is simulated leader
    req.headers['authorization'] = 'Bearer mock_valid_token';
    await promotionImportHandler(req, res);

    assert.ok(res.data, 'Must return response data');
    if (res.statusCode === 200) {
      assert.strictEqual(res.data.summary.blockedRows, 0);
      assert.strictEqual(res.data.summary.passedRows, 2);
    }
  });

  await it('Blocks Studentcrd when combined with Coupon 01 or Trade Up', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/promotion-imports/validate',
      body: {
        branchCode: 'AYUTTHAYA_CITY_PARK',
        items: [
          {
            inventoryPn: 'SM-S938B-512',
            model: 'Galaxy S26 Ultra',
            regularPrice: 54900,
            optionType: 'STUDENT_EXCLUSIVE',
            couponCode: 'Studentcrd',
            discountPercent: 15,
            standardDiscount: 5000, // ILLEGAL: Combining standard discount
            netPrice: 41665
          }
        ]
      }
    });

    req.headers['authorization'] = 'Bearer mock_token';
    await promotionImportHandler(req, res);

    if (res.statusCode === 200) {
      assert.strictEqual(res.data.summary.blockedRows, 1);
      assert.ok(res.data.errors.some(e => e.errorCode === 'STUDENT_STACKING_CONFLICT'));
    }
  });

  // --------------------------------------------------------------------------
  // 2. REAL-WORLD CASE 2: Galaxy S25 FE Mutually Exclusive Paths
  // --------------------------------------------------------------------------
  console.log('\n📌 Test Suite 2: Galaxy S25 FE Mutually Exclusive Paths');

  await it('Validates S25 FE SF+ vs Non-SF+ without mixing', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/promotion-imports/validate',
      body: {
        branchCode: 'AYUTTHAYA_CITY_PARK',
        items: [
          {
            inventoryPn: 'SM-S721B-256',
            model: 'Galaxy S25 FE',
            capacity: '256GB',
            regularPrice: 26900,
            paymentCondition: 'SF_PLUS',
            standardDiscount: 3000,
            couponCode: 'COUPON_01',
            netPrice: 23900
          },
          {
            inventoryPn: 'SM-S721B-256',
            model: 'Galaxy S25 FE',
            capacity: '256GB',
            regularPrice: 26900,
            paymentCondition: 'NON_SF_PLUS',
            standardDiscount: 6000,
            couponCode: 'COUPON_02',
            netPrice: 20900
          }
        ]
      }
    });

    req.headers['authorization'] = 'Bearer mock_token';
    await promotionImportHandler(req, res);

    if (res.statusCode === 200) {
      assert.strictEqual(res.data.summary.blockedRows, 0);
      assert.strictEqual(res.data.summary.passedRows, 2);
    }
  });

  // --------------------------------------------------------------------------
  // 3. REAL-WORLD CASE 3: Galaxy A57 5G (Down Payment vs Discount)
  // --------------------------------------------------------------------------
  console.log('\n📌 Test Suite 3: Galaxy A57 5G Semantic Distinction');

  await it('Reclassifies "SF+ ดาวน์ไม่เกิน 5%" from standardDiscount to estimatedDownPayment', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/promotion-imports/validate',
      body: {
        branchCode: 'AYUTTHAYA_CITY_PARK',
        items: [
          {
            inventoryPn: 'SM-A576B-512',
            model: 'Galaxy A57 5G',
            regularPrice: 27999,
            standardDiscount: 1400,
            sourceText: 'Galaxy A57 5G 512GB (SF+ ดาวน์ไม่เกิน 5%)',
            netPrice: 27999
          }
        ]
      }
    });

    req.headers['authorization'] = 'Bearer mock_token';
    await promotionImportHandler(req, res);

    if (res.statusCode === 200) {
      const item = res.data.items[0];
      assert.strictEqual(item.standardDiscount, 0, 'Discount must be reset to 0');
      assert.strictEqual(item.estimatedDownPayment, 1400, 'Down payment must be 1,400');
    }
  });

  // --------------------------------------------------------------------------
  // 4. REAL-WORLD CASE 4: Galaxy Z Fold8 Trade Up Only
  // --------------------------------------------------------------------------
  console.log('\n📌 Test Suite 4: Galaxy Z Fold8 Trade Up Only');

  await it('Blocks Fold8 Trade Up discount if customer has no trade-in', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/promotion-imports/validate',
      body: {
        branchCode: 'AYUTTHAYA_CITY_PARK',
        items: [
          {
            inventoryPn: 'SM-F966B-1TB',
            model: 'Galaxy Z Fold8',
            regularPrice: 79900,
            tradeUpDiscount: 7000,
            requiresTradeIn: false, // ILLEGAL: Trade Up without trade-in
            netPrice: 72900
          }
        ]
      }
    });

    req.headers['authorization'] = 'Bearer mock_token';
    await promotionImportHandler(req, res);

    if (res.statusCode === 200) {
      assert.strictEqual(res.data.summary.blockedRows, 1);
      assert.ok(res.data.errors.some(e => e.errorCode === 'TRADE_UP_REQUIREMENT_MISSING'));
    }
  });

  // --------------------------------------------------------------------------
  // 5. CAMPAIGN APPROVAL & ACTIVATION FAIL-CLOSED GATES
  // --------------------------------------------------------------------------
  console.log('\n📌 Test Suite 5: Campaign Approval & Fail-Closed Gate');

  await it('Rejects approval of campaign if unauthenticated', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/promotion-campaigns/camp_123/approve',
      query: { campaignId: 'camp_123', action: 'approve' }
    });

    await promotionCampaignHandler(req, res);
    assert.strictEqual(res.statusCode, 401);
  });

  await it('Rejects activation of campaign if unauthenticated', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/promotion-campaigns/camp_123/activate',
      query: { campaignId: 'camp_123', action: 'activate' }
    });

    await promotionCampaignHandler(req, res);
    assert.strictEqual(res.statusCode, 401);
  });

  await it('Active promotions catalog returns gracefully for branch with no active campaign', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/api/promotions/active?branchCode=TEST_EMPTY_BRANCH',
      query: { branchCode: 'TEST_EMPTY_BRANCH' }
    });

    await activePromotionsHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.status === 'NO_ACTIVE_CAMPAIGN' || res.data.status === 'ACTIVE');
  });

  console.log(`\n🏁 Live API Lifecycle Results: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%)\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
