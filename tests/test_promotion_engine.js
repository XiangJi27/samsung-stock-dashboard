/**
 * Test Suite: Multi-Tier Promotional Pricing, Validation Gates & Mutually Exclusive Options
 * Verifies all formulas, gates, and negative cases requested by the user.
 */

const assert = require('assert');
const {
  calculatePromotionPrices,
  calculateS25FePromotion,
  calculateA57Promotion,
  calculateStudentPromotion,
  validatePromotionGates
} = require('../assets/js/promotion-calculator.js');

console.log('🧪 Starting Multi-Tier Promotion Engine Acceptance Tests...\n');

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
  }
}

// -------------------------------------------------------------
// 1. GALAXY S26 ULTRA FORMULA TESTS
// -------------------------------------------------------------
console.log('📌 Test Suite 1: Galaxy S26 Ultra (Tier 1 vs Tier 2)');

it('S26 Ultra 1TB: RRP 66,900, Std Disc 5,000, Trade Up 5,000 -> Non-TU 61,900, TU 56,900', () => {
  const res = calculatePromotionPrices({
    regularPrice: 66900,
    standardDiscount: 5000,
    tradeUpDiscount: 5000
  });
  assert.strictEqual(res.standardNetPrice, 61900);
  assert.strictEqual(res.tradeUpNetPrice, 56900);
  assert.strictEqual(res.tradeUpEligible, true);
});

it('S26 Ultra 512GB: RRP 54,900, Std Disc 5,000, Trade Up 5,000 -> Non-TU 49,900, TU 44,900', () => {
  const res = calculatePromotionPrices({
    regularPrice: 54900,
    standardDiscount: 5000,
    tradeUpDiscount: 5000
  });
  assert.strictEqual(res.standardNetPrice, 49900);
  assert.strictEqual(res.tradeUpNetPrice, 44900);
});

it('S26 Ultra 256GB: RRP 46,900, Std Disc 5,000, Trade Up 2,000 -> Non-TU 41,900, TU 39,900', () => {
  const res = calculatePromotionPrices({
    regularPrice: 46900,
    standardDiscount: 5000,
    tradeUpDiscount: 2000
  });
  assert.strictEqual(res.standardNetPrice, 41900);
  assert.strictEqual(res.tradeUpNetPrice, 39900);
});

// -------------------------------------------------------------
// 2. GALAXY S26+ & S26 (NO TRADE UP)
// -------------------------------------------------------------
console.log('\n📌 Test Suite 2: Galaxy S26+ & S26 (Tier 1 Only, No Trade Up)');

it('S26+ 512GB: 48,900 - 12,000 = 36,900 (Trade Up Net = Standard Net)', () => {
  const res = calculatePromotionPrices({
    regularPrice: 48900,
    standardDiscount: 12000,
    tradeUpDiscount: 0
  });
  assert.strictEqual(res.standardNetPrice, 36900);
  assert.strictEqual(res.tradeUpNetPrice, 36900);
  assert.strictEqual(res.tradeUpEligible, false);
});

it('S26+ 256GB: 40,900 - 10,000 = 30,900', () => {
  const res = calculatePromotionPrices({
    regularPrice: 40900,
    standardDiscount: 10000,
    tradeUpDiscount: 0
  });
  assert.strictEqual(res.standardNetPrice, 30900);
  assert.strictEqual(res.tradeUpNetPrice, 30900);
});

it('S26 512GB: 41,900 - 12,000 = 29,900', () => {
  const res = calculatePromotionPrices({
    regularPrice: 41900,
    standardDiscount: 12000,
    tradeUpDiscount: 0
  });
  assert.strictEqual(res.standardNetPrice, 29900);
  assert.strictEqual(res.tradeUpNetPrice, 29900);
});

it('S26 256GB: 33,900 - 6,000 = 27,900', () => {
  const res = calculatePromotionPrices({
    regularPrice: 33900,
    standardDiscount: 6000,
    tradeUpDiscount: 0
  });
  assert.strictEqual(res.standardNetPrice, 27900);
  assert.strictEqual(res.tradeUpNetPrice, 27900);
});

// -------------------------------------------------------------
// 3. GALAXY S25 FE MUTUALLY EXCLUSIVE PAYMENT ALTERNATIVE
// -------------------------------------------------------------
console.log('\n📌 Test Suite 3: Galaxy S25 FE Payment Options');

it('S25 FE 256GB + SF+: Discount 3,000, Coupon 01, Net 23,900, Trade Up 0', () => {
  const res = calculateS25FePromotion({
    regularPrice: 26900,
    capacity: '256GB',
    paymentCondition: 'SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 3000);
  assert.strictEqual(res.couponCode, 'คูปอง 01');
  assert.strictEqual(res.netPrice, 23900);
  assert.strictEqual(res.tradeUpDiscount, 0);
  assert.strictEqual(res.tradeUpEligible, false);
});

it('S25 FE 128GB + SF+: Discount 3,000, Coupon 01, Net 19,900, Trade Up 0', () => {
  const res = calculateS25FePromotion({
    regularPrice: 22900,
    capacity: '128GB',
    paymentCondition: 'SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 3000);
  assert.strictEqual(res.couponCode, 'คูปอง 01');
  assert.strictEqual(res.netPrice, 19900);
});

it('S25 FE 256GB + NON-SF+: Discount 6,000, Coupon 02, Net 20,900, Trade Up 0', () => {
  const res = calculateS25FePromotion({
    regularPrice: 26900,
    capacity: '256GB',
    paymentCondition: 'NON_SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 6000);
  assert.strictEqual(res.couponCode, 'คูปอง 02');
  assert.strictEqual(res.netPrice, 20900);
  assert.strictEqual(res.tradeUpDiscount, 0);
});

it('S25 FE 128GB + NON-SF+: Discount 5,000, Coupon 02, Net 17,900, Trade Up 0', () => {
  const res = calculateS25FePromotion({
    regularPrice: 22900,
    capacity: '128GB',
    paymentCondition: 'NON_SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 5000);
  assert.strictEqual(res.couponCode, 'คูปอง 02');
  assert.strictEqual(res.netPrice, 17900);
  assert.strictEqual(res.tradeUpDiscount, 0);
});

// -------------------------------------------------------------
// 4. GALAXY A57 5G PAYMENT ALTERNATIVE
// -------------------------------------------------------------
console.log('\n📌 Test Suite 4: Galaxy A57 5G (SF+ 5% Down Payment vs Non-SF+ Discount)');

it('A57 12/512GB + SF+: Discount 0, Net 27,999, Down ~1,400', () => {
  const res = calculateA57Promotion({
    regularPrice: 27999,
    capacity: '12/512GB',
    paymentCondition: 'SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 0);
  assert.strictEqual(res.netPrice, 27999);
  assert.strictEqual(res.estimatedDownPayment, 1400);
});

it('A57 12/256GB + SF+: Discount 0, Net 22,999, Down ~1,150', () => {
  const res = calculateA57Promotion({
    regularPrice: 22999,
    capacity: '12/256GB',
    paymentCondition: 'SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 0);
  assert.strictEqual(res.netPrice, 22999);
  assert.strictEqual(res.estimatedDownPayment, 1150);
});

it('A57 8/256GB + SF+: Discount 0, Net 19,999, Down ~1,000', () => {
  const res = calculateA57Promotion({
    regularPrice: 19999,
    capacity: '8/256GB',
    paymentCondition: 'SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 0);
  assert.strictEqual(res.netPrice, 19999);
  assert.strictEqual(res.estimatedDownPayment, 1000);
});

it('A57 12/512GB + NON-SF+: Discount 2,000, Coupon 01, Net 25,999', () => {
  const res = calculateA57Promotion({
    regularPrice: 27999,
    capacity: '12/512GB',
    paymentCondition: 'NON_SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 2000);
  assert.strictEqual(res.netPrice, 25999);
});

it('A57 12/256GB + NON-SF+: Discount 2,000, Coupon 01, Net 20,999', () => {
  const res = calculateA57Promotion({
    regularPrice: 22999,
    capacity: '12/256GB',
    paymentCondition: 'NON_SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 2000);
  assert.strictEqual(res.netPrice, 20999);
});

it('A57 8/256GB + NON-SF+: Discount 2,000, Coupon 01, Net 17,999', () => {
  const res = calculateA57Promotion({
    regularPrice: 19999,
    capacity: '8/256GB',
    paymentCondition: 'NON_SF_PLUS'
  });
  assert.strictEqual(res.standardDiscount, 2000);
  assert.strictEqual(res.netPrice, 17999);
});

// -------------------------------------------------------------
// 5. STUDENT / EDUCATION PROMOTION (Studentcrd 15%)
// -------------------------------------------------------------
console.log('\n📌 Test Suite 5: Student Promotion 15% (Studentcrd)');

it('S26 Ultra 512GB Student: 54,900 * 15% = 8,235 -> Net 46,665', () => {
  const res = calculateStudentPromotion({
    regularPrice: 54900,
    model: 'Galaxy S26 Ultra',
    capacity: '512GB',
    couponCode: 'Studentcrd'
  });
  assert.strictEqual(res.eligible, true);
  assert.strictEqual(res.studentDiscountAmount, 8235);
  assert.strictEqual(res.netPrice, 46665);
  assert.strictEqual(res.tradeUpEligible, false);
});

it('S26 Ultra 256GB Student: 46,900 * 15% = 7,035 -> Net 39,865', () => {
  const res = calculateStudentPromotion({
    regularPrice: 46900,
    model: 'Galaxy S26 Ultra',
    capacity: '256GB',
    couponCode: 'Studentcrd'
  });
  assert.strictEqual(res.eligible, true);
  assert.strictEqual(res.studentDiscountAmount, 7035);
  assert.strictEqual(res.netPrice, 39865);
});

it('S26 Ultra 1TB Student: Explicitly BLOCKED / Not Eligible', () => {
  const res = calculateStudentPromotion({
    regularPrice: 66900,
    model: 'Galaxy S26 Ultra',
    capacity: '1TB',
    couponCode: 'Studentcrd'
  });
  assert.strictEqual(res.eligible, false);
  assert.strictEqual(res.netPrice, 66900);
  assert(res.reason.includes('ไม่ร่วมโปรโมชั่นนักเรียน/นักศึกษา'));
});

// -------------------------------------------------------------
// 6. VALIDATION GATES & NEGATIVE REGRESSION CHECKS
// -------------------------------------------------------------
console.log('\n📌 Test Suite 6: Promotion Validation Gates (Gates 1-8)');

it('Gate 1-5: Valid full promotion passes all gates', () => {
  const res = validatePromotionGates({
    regularPrice: 66900,
    standardDiscount: 5000,
    standardNetPrice: 61900,
    tradeUpDiscount: 5000,
    tradeUpNetPrice: 56900,
    requiresTradeIn: true
  });
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.errors.length, 0);
});

it('Gate 3: Blocks standardNetPrice arithmetic mismatch', () => {
  const res = validatePromotionGates({
    regularPrice: 66900,
    standardDiscount: 5000,
    standardNetPrice: 60000 // wrong!
  });
  assert.strictEqual(res.isValid, false);
  assert(res.errors.includes('GATE_3_STANDARD_NET_PRICE_MISMATCH'));
});

it('Gate 5: Blocks tradeUpNetPrice arithmetic mismatch', () => {
  const res = validatePromotionGates({
    regularPrice: 66900,
    standardDiscount: 5000,
    standardNetPrice: 61900,
    tradeUpDiscount: 5000,
    tradeUpNetPrice: 58000 // wrong!
  });
  assert.strictEqual(res.isValid, false);
  assert(res.errors.includes('GATE_5_TRADE_UP_NET_PRICE_MISMATCH'));
});

it('Gate 6: Blocks Trade Up discount without trade-in requirement', () => {
  const res = validatePromotionGates({
    regularPrice: 66900,
    standardDiscount: 5000,
    standardNetPrice: 61900,
    tradeUpDiscount: 5000,
    tradeUpNetPrice: 56900,
    requiresTradeIn: false // wrong!
  });
  assert.strictEqual(res.isValid, false);
  assert(res.errors.includes('GATE_6_TRADE_UP_REQUIREMENT_MISSING'));
});

it('Gate 7: Blocks Trade Up discount applied inside normal purchase route', () => {
  const res = validatePromotionGates({
    regularPrice: 66900,
    standardDiscount: 5000,
    tradeUpDiscount: 5000,
    isNormalRoute: true // Trade Up applied on normal walk-in!
  });
  assert.strictEqual(res.isValid, false);
  assert(res.errors.includes('GATE_7_TRADE_UP_IN_NORMAL_ROUTE'));
});

it('Gate 8: Blocks device appraisal value mixed with campaign discount', () => {
  const res = validatePromotionGates({
    regularPrice: 66900,
    standardDiscount: 5000,
    tradeUpDiscount: 13000, // 5000 campaign + 8000 device value mixed!
    appraisalValueIncludedInTradeUpDiscount: true
  });
  assert.strictEqual(res.isValid, false);
  assert(res.errors.includes('GATE_8_APPRAISAL_VALUE_MIXED_WITH_CAMPAIGN'));
});

// -------------------------------------------------------------
// 7. STANDARDIZED SALE MODE & CHECKOUT CALCULATOR TESTS
// -------------------------------------------------------------
console.log('\n📌 Test Suite 7: Standardized Sale Mode Pricing & Checkout');

const { calculateNet, calculateSaleModePrice, calculateCheckout } = require('../assets/js/promotion-calculator.js');

it('calculateNet: 54,900 - 5,000 = 49,900', () => {
  const res = calculateNet(54900, 5000);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.netPrice, 49900);
});

it('calculateSaleModePrice: STANDARD_PAYMENT 54,900 - 5,000 = 49,900', () => {
  const res = calculateSaleModePrice({
    saleMode: 'STANDARD_PAYMENT',
    regularPrice: 54900,
    standardDiscount: 5000
  });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.netPrice, 49900);
});

it('calculateSaleModePrice: SF_PLUS 28,900 - 12,000 = 16,900 contract price, 10% down = 1,690, principal = 15,210', () => {
  const res = calculateSaleModePrice({
    saleMode: 'SF_PLUS',
    regularPrice: 28900,
    financeDiscount: 12000,
    downPaymentPercent: 10
  });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.contractPrice, 16900);
  assert.strictEqual(res.downPayment, 1690);
  assert.strictEqual(res.financePrincipal, 15210);
});

it('calculateSaleModePrice: NON_SF_PLUS 17,999 - 2,000 = 15,999', () => {
  const res = calculateSaleModePrice({
    saleMode: 'NON_SF_PLUS',
    regularPrice: 17999,
    nonSfPlusDiscount: 2000
  });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.netPrice, 15999);
});

it('calculateSaleModePrice: STUDENT_EXCLUSIVE 54,900 with 15% discount = 46,665', () => {
  const res = calculateSaleModePrice({
    saleMode: 'STUDENT_EXCLUSIVE',
    regularPrice: 54900,
    studentDiscountPercent: 15
  });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.netPrice, 46665);
});

it('calculateSaleModePrice: TRADE_UP 54,900 - 5,000 (std) - 5,000 (bonus) = 44,900 before appraisal, checkout with 1,000 trade-in = 43,900', () => {
  const res = calculateSaleModePrice({
    saleMode: 'TRADE_UP',
    regularPrice: 54900,
    standardDiscount: 5000,
    tradeUpBonus: 5000,
    tradeInAppraisedValue: 1000
  });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.priceBeforeAppraisal, 44900);
  assert.strictEqual(res.tradeInAppraisedValue, 1000);
  assert.strictEqual(res.tradeUpBonus, 5000);
  assert.strictEqual(res.totalTradeBenefit, 6000);
  assert.strictEqual(res.finalCheckoutAmount, 43900);
});

it('calculateCheckout: BUNDLE_PURCHASE (49,900 - 4,000) + (5,990 - 3,000) = 48,890', () => {
  const res = calculateCheckout({
    saleMode: 'STANDARD_PAYMENT',
    regularPrice: 49900,
    standardDiscount: 4000,
    bundleItems: [
      { regularPrice: 5990, bundleDiscount: 3000 }
    ]
  });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.primaryNet, 45900);
  assert.strictEqual(res.bundleItemsNet, 2990);
  assert.strictEqual(res.finalCheckoutAmount, 48890);
});

it('calculateSaleModePrice Fail-Closed: negative price or excessive discount returns valid: false', () => {
  const res1 = calculateSaleModePrice({ saleMode: 'STANDARD_PAYMENT', regularPrice: -100 });
  assert.strictEqual(res1.valid, false);

  const res2 = calculateSaleModePrice({ saleMode: 'STANDARD_PAYMENT', regularPrice: 5000, standardDiscount: 6000 });
  assert.strictEqual(res2.valid, false);

  const res3 = calculateSaleModePrice({ saleMode: 'TRADE_UP', regularPrice: 54900, standardDiscount: 5000, tradeUpBonus: 60000 });
  assert.strictEqual(res3.valid, false);
});

console.log(`\n🏁 Test Results: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%)\n`);

if (passed !== total) {
  process.exit(1);
}
