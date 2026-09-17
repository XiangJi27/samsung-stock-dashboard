/**
 * Test Suite: Enterprise Promotion Knowledge Base, Guided Learning & Conflict Engine
 * Ayutthaya City Park Branch Operations
 */

const assert = require('assert');
const PromotionKnowledgeBase = require('../assets/js/promotion-knowledge-base.js');
const { validatePromotionOption, validatePromotionGates } = require('../assets/js/promotion-calculator.js');

console.log('🧪 Starting Promotion Knowledge Base & Guided Learning Tests...\n');

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
// 1. MASTER COUPON REGISTRY
// -------------------------------------------------------------
console.log('📌 Test Suite 1: Master Coupon Registry');

it('Coupon 01 is registered as STANDARD_DISCOUNT with STACKABLE_CONDITIONAL', () => {
  const coupon = PromotionKnowledgeBase.getCoupon('COUPON_01');
  assert.ok(coupon, 'COUPON_01 must exist');
  assert.strictEqual(coupon.type, 'STANDARD_DISCOUNT');
  assert.strictEqual(coupon.stackingPolicy, 'STACKABLE_CONDITIONAL');
});

it('Coupon 02 is registered as NON_SF_PLUS_DISCOUNT with MUTUALLY_EXCLUSIVE', () => {
  const coupon = PromotionKnowledgeBase.getCoupon('COUPON_02');
  assert.ok(coupon, 'COUPON_02 must exist');
  assert.strictEqual(coupon.type, 'NON_SF_PLUS_DISCOUNT');
  assert.strictEqual(coupon.stackingPolicy, 'MUTUALLY_EXCLUSIVE');
  assert.strictEqual(coupon.exclusiveGroup, 'S25FE_PAYMENT_PATH');
});

it('Studentcrd is registered as STUDENT_EXCLUSIVE with EXCLUSIVE policy and blocksAllOtherPromotions', () => {
  const coupon = PromotionKnowledgeBase.getCoupon('Studentcrd');
  assert.ok(coupon, 'Studentcrd must exist');
  assert.strictEqual(coupon.type, 'STUDENT_EXCLUSIVE');
  assert.strictEqual(coupon.discountPercent, 15);
  assert.strictEqual(coupon.stackingPolicy, 'EXCLUSIVE');
  assert.strictEqual(coupon.blocksAllOtherPromotions, true);
});

it('T-UP-CO-S is recognized as Trade Up Campaign Code, not regular coupon', () => {
  const coupon = PromotionKnowledgeBase.getCoupon('T-UP-CO-S');
  assert.ok(coupon, 'T-UP-CO-S must exist');
  assert.strictEqual(coupon.type, 'TRADE_UP_CONDITIONAL');
  assert.strictEqual(coupon.requiresTradeIn, true);
});

// -------------------------------------------------------------
// 2. KNOWLEDGE BASE SEMANTIC CORRECTION RULES
// -------------------------------------------------------------
console.log('\n📌 Test Suite 2: Semantic Correction Memory');

it('Corrects "SF+ ดาวน์ไม่เกิน 5%" from standardDiscount to estimatedDownPayment', () => {
  const rawDraft = {
    inventoryPn: 'SM-A576B-512',
    regularPrice: 27999,
    standardDiscount: 1400,
    sourceText: 'Galaxy A57 5G 512GB (SF+ ดาวน์ไม่เกิน 5%)'
  };

  const corrected = PromotionKnowledgeBase.applyKnowledgeBaseCorrections(rawDraft);
  assert.strictEqual(corrected.standardDiscount, 0, 'Discount must be reset to 0');
  assert.strictEqual(corrected.estimatedDownPayment, 1400, 'Down payment must be 1,400');
  assert.strictEqual(corrected.appliedCorrectionRuleId, 'RULE-SEM-001');
});

it('Allows Manager to add new semantic correction rule dynamically', () => {
  PromotionKnowledgeBase.addCorrectionRule({
    correctionType: 'SEMANTIC_MAPPING',
    sourceTextPattern: 'SF+ ดาวน์พิเศษ 3%',
    incorrectField: 'standardDiscount',
    correctField: 'estimatedDownPayment',
    approvedBy: 'STORE_MANAGER'
  });

  const testDraft = {
    inventoryPn: 'SM-A556B',
    regularPrice: 15999,
    standardDiscount: 480,
    sourceText: 'A55 SF+ ดาวน์พิเศษ 3%'
  };

  const corrected = PromotionKnowledgeBase.applyKnowledgeBaseCorrections(testDraft);
  assert.strictEqual(corrected.standardDiscount, 0);
  assert.strictEqual(corrected.estimatedDownPayment, 480);
});

// -------------------------------------------------------------
// 3. AI BOUNDS VALIDATION (Zero Hallucination & Fail-Closed)
// -------------------------------------------------------------
console.log('\n📌 Test Suite 3: AI Bounds Validation');

it('Rejects draft with missing Exact P/N as REVIEW_REQUIRED (Never guess PN)', () => {
  const raw = {
    model: 'Galaxy S26 Ultra',
    capacity: '512GB',
    regularPrice: 54900
  };
  const bounds = PromotionKnowledgeBase.validateDraftBounds(raw);
  assert.strictEqual(bounds.needsReview, true);
  assert.ok(bounds.issues.some(i => i.code === 'EXACT_PN_NOT_FOUND'));
});

it('Rejects draft with empty discount cells when promo is mentioned', () => {
  const raw = {
    inventoryPn: 'SM-S928B-512',
    regularPrice: 54900,
    hasPromoMention: true,
    discountAmount: 0
  };
  const bounds = PromotionKnowledgeBase.validateDraftBounds(raw);
  assert.strictEqual(bounds.needsReview, true);
  assert.ok(bounds.issues.some(i => i.code === 'DISCOUNT_NOT_SPECIFIED'));
});

it('Blocks draft with Trade Up discount if requiresTradeIn is missing', () => {
  const raw = {
    inventoryPn: 'SM-S928B-512',
    regularPrice: 54900,
    tradeUpDiscount: 5000,
    requiresTradeIn: false
  };
  const bounds = PromotionKnowledgeBase.validateDraftBounds(raw);
  assert.strictEqual(bounds.isValid, false);
  assert.ok(bounds.issues.some(i => i.code === 'TRADE_UP_REQUIREMENT_MISSING'));
});

// -------------------------------------------------------------
// 4. CONFIDENCE SCORING
// -------------------------------------------------------------
console.log('\n📌 Test Suite 4: AI Confidence Scoring');

it('High confidence (95-100) for valid master coupon & zero issues', () => {
  const offer = { inventoryPn: 'SM-S938B-512', couponCode: 'COUPON_01', regularPrice: 54900 };
  const conf = PromotionKnowledgeBase.calculateConfidenceScore(offer, []);
  assert.ok(conf.score >= 95, `Score should be >= 95, got ${conf.score}`);
  assert.strictEqual(conf.tier, 'HIGH');
});

it('Medium confidence (60-79) when items require manager review', () => {
  const offer = { model: 'Galaxy S26 Ultra' };
  const issues = [{ severity: 'REVIEW_REQUIRED', message: 'Missing Exact P/N' }];
  const conf = PromotionKnowledgeBase.calculateConfidenceScore(offer, issues);
  assert.ok(conf.score >= 60 && conf.score < 80);
  assert.strictEqual(conf.tier, 'REVIEW_REQUIRED');
});

it('Blocked confidence (<60) when BLOCKER issues are detected', () => {
  const offer = { regularPrice: 0 };
  const issues = [{ severity: 'BLOCKER', message: 'Regular price must be > 0' }];
  const conf = PromotionKnowledgeBase.calculateConfidenceScore(offer, issues);
  assert.ok(conf.score < 60);
  assert.strictEqual(conf.tier, 'BLOCKED');
});

// -------------------------------------------------------------
// 5. MULTI-PATH RESOLUTION & CONFLICT DETECTION
// -------------------------------------------------------------
console.log('\n📌 Test Suite 5: Multi-path Promotion Resolution');

it('S26 Ultra: Resolves 2-tier Stackable path when customer has trade-in', () => {
  const offers = [
    {
      id: 'OFFER-STD-01',
      promotionType: 'STANDARD_DISCOUNT',
      stackingPolicy: 'STACKABLE_CONDITIONAL',
      standardDiscount: 5000,
      requiresTradeIn: false
    },
    {
      id: 'OFFER-TU-01',
      promotionType: 'TRADE_UP_CONDITIONAL',
      stackingPolicy: 'STACKABLE_CONDITIONAL',
      tradeUpDiscount: 5000,
      requiresTradeIn: true
    }
  ];

  // Case A: Customer has NO trade-in
  const resNoTu = PromotionKnowledgeBase.resolvePromotions({
    offers,
    customerSegment: 'GENERAL',
    hasTradeIn: false
  });
  assert.strictEqual(resNoTu.selectedOffers.length, 1);
  assert.strictEqual(resNoTu.selectedOffers[0].id, 'OFFER-STD-01');

  // Case B: Customer HAS trade-in
  const resTu = PromotionKnowledgeBase.resolvePromotions({
    offers,
    customerSegment: 'GENERAL',
    hasTradeIn: true
  });
  assert.strictEqual(resTu.selectedOffers.length, 2);
  assert.strictEqual(resTu.resolution, 'STACKED_PATH');
});

it('S25 FE: Resolves mutually exclusive SF+ vs Non-SF+ without mixing', () => {
  const offers = [
    {
      id: 'OFFER-S25-SF',
      promotionType: 'SF_PLUS_FINANCING',
      paymentCondition: 'SF_PLUS',
      stackingPolicy: 'MUTUALLY_EXCLUSIVE',
      exclusiveGroup: 'S25FE_PAYMENT_PATH',
      priority: 100
    },
    {
      id: 'OFFER-S25-NON-SF',
      promotionType: 'NON_SF_PLUS_DISCOUNT',
      paymentCondition: 'NON_SF_PLUS',
      stackingPolicy: 'MUTUALLY_EXCLUSIVE',
      exclusiveGroup: 'S25FE_PAYMENT_PATH',
      priority: 100
    }
  ];

  // Customer chooses SF+
  const resSf = PromotionKnowledgeBase.resolvePromotions({
    offers,
    paymentMethod: 'SF_PLUS'
  });
  assert.strictEqual(resSf.selectedOffers.length, 1);
  assert.strictEqual(resSf.selectedOffers[0].id, 'OFFER-S25-SF');

  // Customer chooses Cash / Non-SF+
  const resNonSf = PromotionKnowledgeBase.resolvePromotions({
    offers,
    paymentMethod: 'CASH'
  });
  assert.strictEqual(resNonSf.selectedOffers.length, 1);
  assert.strictEqual(resNonSf.selectedOffers[0].id, 'OFFER-S25-NON-SF');
});

it('Studentcrd: Strictly exclusive, blocks all standard discounts and trade-in', () => {
  const offers = [
    {
      id: 'OFFER-STD',
      promotionType: 'STANDARD_DISCOUNT',
      couponCode: 'COUPON_01',
      standardDiscount: 5000,
      customerSegment: 'GENERAL',
      priority: 100
    },
    {
      id: 'OFFER-STUDENT',
      promotionType: 'STUDENT_EXCLUSIVE',
      couponCode: 'Studentcrd',
      customerSegment: 'STUDENT',
      stackingPolicy: 'EXCLUSIVE',
      blocksAllOtherPromotions: true,
      priority: 10
    }
  ];

  // Student customer
  const resStudent = PromotionKnowledgeBase.resolvePromotions({
    offers,
    customerSegment: 'STUDENT'
  });
  assert.strictEqual(resStudent.resolution, 'EXCLUSIVE_PATH');
  assert.strictEqual(resStudent.selectedOffers.length, 1);
  assert.strictEqual(resStudent.selectedOffers[0].id, 'OFFER-STUDENT');
  assert.strictEqual(resStudent.blockedOffers.length, 1);
  assert.strictEqual(resStudent.blockedOffers[0].id, 'OFFER-STD');
});

// -------------------------------------------------------------
// 6. VALIDATE PROMOTION OPTION BLOCKER GATES
// -------------------------------------------------------------
console.log('\n📌 Test Suite 6: Option Blocker Gates');

it('Blocks NET_PRICE_MISMATCH if net price does not match formula', () => {
  const option = {
    regularPrice: 54900,
    standardDiscount: 5000,
    tradeUpDiscount: 5000,
    requiresTradeIn: true,
    netPrice: 49900 // incorrect: should be 44900
  };
  const res = validatePromotionOption(option);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some(e => e.code === 'NET_PRICE_MISMATCH'));
});

it('Blocks STUDENT_STACKING_CONFLICT if studentcrd combines with Coupon 01', () => {
  const option = {
    regularPrice: 54900,
    optionType: 'STUDENT_EXCLUSIVE',
    couponCode: 'Studentcrd',
    discountPercent: 15,
    standardDiscount: 5000, // ILLEGAL: combining standard discount with student
    netPrice: 41665
  };
  const res = validatePromotionOption(option);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some(e => e.code === 'STUDENT_STACKING_CONFLICT'));
});

it('Blocks DOWN_PAYMENT_MISCLASSIFIED if SF+ down payment treated as discount', () => {
  const option = {
    regularPrice: 27999,
    paymentCondition: 'SF_PLUS',
    downPaymentAsDiscount: true
  };
  const res = validatePromotionOption(option);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some(e => e.code === 'DOWN_PAYMENT_MISCLASSIFIED'));
});

console.log(`\n🏁 Knowledge Base Test Results: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%)\n`);

if (passed !== total) {
  process.exit(1);
}
