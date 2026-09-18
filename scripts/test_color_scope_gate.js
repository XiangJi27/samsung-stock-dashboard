/**
 * Samsung Branch Operations - Color Scope Gate & Evidence Provenance Unit Tests
 * Validates:
 * 1. Tier 5 Color Scope Gate (ALL_COLORS, SPECIFIC_COLOR, REVIEW_REQUIRED)
 * 2. Strict hierarchical gating (Exact P/N -> Product Type -> Model -> Capacity -> Color Scope)
 * 3. Token & color normalization (Canonical SKYBLUE, AWESOMENAVY)
 * 4. Distinct shade collision prevention (Sky Blue != Navy != Blue)
 * 5. Evidence provenance tracking (PARSER_CAPTURED vs LEGACY_BACKFILL)
 */
const {
  validateColorScope,
  detectPromotionColorScope,
  normalizeColor,
  normalizeColorToken,
  evaluatePromotionCompositeGate
} = require('../assets/js/promotion-calculator.js');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

console.log('======================================================================');
console.log('SAMSUNG BRANCH OPERATIONS - COLOR SCOPE GATE TEST SUITE');
console.log('======================================================================\n');

// 1. ALL_COLORS: No color specified in file (Galaxy A57 5G Rows 31-33)
console.log('1. ALL_COLORS Detection & Candidate Matching:');
const a57Detection = detectPromotionColorScope({
  sourceColor: null,
  sourceText: 'Galaxy A57 5G 12/256GB ลด 2,000 บาท'
});
assert(a57Detection.colorScope === 'ALL_COLORS', 'A57 with no color detected as ALL_COLORS');
assert(a57Detection.sourceColor === null, 'A57 sourceColor is null');

const promoA57 = { colorScope: 'ALL_COLORS', sourceColor: null };
const stockA57Gray = { inventoryPn: 'SM-A576BZATTHL', description: 'Galaxy A57 5G 12/256GB Gray', color: 'Gray' };
const stockA57Navy = { inventoryPn: 'SM-A576BDBTTHL', description: 'Galaxy A57 5G 12/256GB Navy', color: 'Navy' };
const stockA57Black = { inventoryPn: 'SM-A576BZKTTHL', description: 'Galaxy A57 5G 12/256GB Black', color: 'Black' };

const resGray = validateColorScope(promoA57, stockA57Gray);
assert(resGray.allowed === true && resGray.code === 'COLOR_SCOPE_ALL_COLORS', 'A57 Gray candidate allowed under ALL_COLORS');

const resNavy = validateColorScope(promoA57, stockA57Navy);
assert(resNavy.allowed === true && resNavy.code === 'COLOR_SCOPE_ALL_COLORS', 'A57 Navy candidate allowed under ALL_COLORS');

const resBlack = validateColorScope(promoA57, stockA57Black);
assert(resBlack.allowed === true && resBlack.code === 'COLOR_SCOPE_ALL_COLORS', 'A57 Black candidate allowed under ALL_COLORS');

// 2. SPECIFIC_COLOR: Explicit color in source file
console.log('\n2. SPECIFIC_COLOR Detection & Matching:');
const s26ExplicitDetection = detectPromotionColorScope({
  sourceColor: 'Sky Blue',
  sourceText: 'Galaxy S26 Ultra 512GB Sky Blue'
});
assert(s26ExplicitDetection.colorScope === 'SPECIFIC_COLOR', 'Explicit color detected as SPECIFIC_COLOR');
assert(s26ExplicitDetection.sourceColor === 'SKY_BLUE', 'sourceColor token normalized to SKY_BLUE');

const promoSkyBlue = { colorScope: 'SPECIFIC_COLOR', sourceColor: 'SKY_BLUE' };
const stockSkyBlue = { inventoryPn: 'SM-S948BLBCTHL', description: 'Galaxy S26 Ultra 512GB Sky-Blue', color: 'Sky Blue' };
const stockBlack = { inventoryPn: 'SM-S948BZKCTHL', description: 'Galaxy S26 Ultra 512GB Black', color: 'Black' };

const resMatch = validateColorScope(promoSkyBlue, stockSkyBlue);
assert(resMatch.allowed === true && resMatch.code === 'SPECIFIC_COLOR_MATCH', 'Sky Blue candidate matches SKY_BLUE');

const resMismatch = validateColorScope(promoSkyBlue, stockBlack);
assert(resMismatch.allowed === false && resMismatch.code === 'COLOR_MISMATCH', 'Black candidate rejected under SKY_BLUE');

// 3. REVIEW_REQUIRED: Ambiguous text without specific color name
console.log('\n3. REVIEW_REQUIRED Fail-Closed Gating:');
const ambiguous1 = detectPromotionColorScope({
  sourceColor: null,
  sourceText: 'Galaxy S26 เฉพาะสีที่ร่วมรายการ'
});
assert(ambiguous1.colorScope === 'REVIEW_REQUIRED', 'เฉพาะสีที่ร่วมรายการ detected as REVIEW_REQUIRED');

const ambiguous2 = detectPromotionColorScope({
  sourceColor: null,
  sourceText: 'Galaxy S25 บางสีเท่านั้น'
});
assert(ambiguous2.colorScope === 'REVIEW_REQUIRED', 'บางสีเท่านั้น detected as REVIEW_REQUIRED');

const promoAmbiguous = { colorScope: 'REVIEW_REQUIRED', sourceColor: null };
const resAmbiguous = validateColorScope(promoAmbiguous, stockSkyBlue);
assert(resAmbiguous.allowed === false && resAmbiguous.code === 'COLOR_SCOPE_REVIEW_REQUIRED', 'Candidate blocked under REVIEW_REQUIRED');

// 4. Normalization & Shade Collision Safety
console.log('\n4. Canonical Normalization & Shade Collision Protection:');
assert(normalizeColor('Sky Blue') === 'SKYBLUE', 'Normalizes Sky Blue -> SKYBLUE');
assert(normalizeColor('sky_blue') === 'SKYBLUE', 'Normalizes sky_blue -> SKYBLUE');
assert(normalizeColor('Sky-Blue') === 'SKYBLUE', 'Normalizes Sky-Blue -> SKYBLUE');

// Ensure distinct shades don't mistakenly match
const promoNavy = { colorScope: 'SPECIFIC_COLOR', sourceColor: 'NAVY' };
const resNavyVsSkyBlue = validateColorScope(promoNavy, stockSkyBlue);
assert(resNavyVsSkyBlue.allowed === false, 'Navy promo does NOT match Sky Blue stock item');

// 5. Composite Gate Readiness Decoupling
console.log('\n5. Composite Gate Readiness Decoupling:');
// Stage A: Draft saved, but 2 open reviews exist -> READY_FOR_MANAGER_REVIEW = YES, READY_FOR_APPROVAL = NO
const gateState1 = evaluatePromotionCompositeGate({
  draftSaved: true,
  hasSourceEvidence: true,
  sourceEvidenceFromParser: false,
  exactPnPass: true,
  productTypePass: true,
  modelPass: true,
  capacityPass: true,
  colorScopePass: true,
  sourceFidelityPass: true,
  openBlockers: 0,
  openReviews: 2,
  campaignStatus: 'DRAFT'
});
assert(gateState1.READY_FOR_MANAGER_REVIEW === 'YES', 'Manager review ready with 2 open reviews');
assert(gateState1.READY_FOR_APPROVAL === 'NO', 'Approval blocked while openReviews > 0');
assert(gateState1.READY_TO_ACTIVATE === 'NO', 'Activation blocked while not approved');

// Stage B: 2 reviews resolved to 0 open reviews, parser evidence verified -> READY_FOR_APPROVAL = YES
const gateState2 = evaluatePromotionCompositeGate({
  draftSaved: true,
  hasSourceEvidence: true,
  sourceEvidenceFromParser: true,
  exactPnPass: true,
  productTypePass: true,
  modelPass: true,
  capacityPass: true,
  colorScopePass: true,
  sourceFidelityPass: true,
  openBlockers: 0,
  openReviews: 0,
  campaignStatus: 'DRAFT'
});
assert(gateState2.READY_FOR_MANAGER_REVIEW === 'YES', 'Manager review ready');
assert(gateState2.READY_FOR_APPROVAL === 'YES', 'Approval ready when open reviews = 0');
assert(gateState2.READY_TO_ACTIVATE === 'NO', 'Activation still waiting for campaign approval status');

// Stage C: Campaign status becomes APPROVED -> READY_TO_ACTIVATE = YES
const gateState3 = evaluatePromotionCompositeGate({
  draftSaved: true,
  hasSourceEvidence: true,
  sourceEvidenceFromParser: true,
  exactPnPass: true,
  productTypePass: true,
  modelPass: true,
  capacityPass: true,
  colorScopePass: true,
  sourceFidelityPass: true,
  openBlockers: 0,
  openReviews: 0,
  campaignStatus: 'APPROVED',
  expectedPreviousMatched: true
});
assert(gateState3.READY_TO_ACTIVATE === 'YES', 'Ready to activate once campaign status is APPROVED');

console.log('\n======================================================================');
console.log(`COLOR SCOPE GATE TEST RESULTS: ${passCount} PASSED / ${failCount} FAILED`);
console.log('======================================================================\n');

if (failCount > 0) process.exit(1);
