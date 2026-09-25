const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePromotionPricing: calculate, normalizeSaleMode } = require('../assets/js/promotion-pricing-engine.js');
const { calculateLegacyOffer } = require('../assets/js/promotion-pricing-adapter.js');
const { evaluatePricingRuntime, canSaveCloudDraft } = require('../assets/js/promotion-pricing-runtime.js');
const { assertPricingReadyForCloudDraft, savePromotionDraft } = require('../assets/js/promotion-pricing-runtime.js');
const valid = (input) => { const r = calculate(input); assert.equal(r.valid, true, r.code); return r; };
const fail = (input, code) => { const r = calculate(input); assert.equal(r.valid, false); assert.equal(r.code, code); assert.equal(r.status, 'REVIEW_REQUIRED'); };

test('normalizes legacy sale mode aliases and rejects unknown mode', () => {
  assert.equal(normalizeSaleMode('student').saleMode, 'STUDENT_EXCLUSIVE');
  assert.equal(normalizeSaleMode('ADD_ON_PURCHASE').saleMode, 'BUNDLE_PURCHASE');
  fail({ saleMode: 'CASH_MAGIC', regularPrice: 1 }, 'UNSUPPORTED_SALE_MODE');
});
test('calculates standard, non-SF+, and student-exclusive modes', () => {
  assert.equal(valid({ saleMode: 'STANDARD_PAYMENT', regularPrice: 54900, standardDiscount: 5000 }).calculatedAmounts.primaryNet, 49900);
  assert.equal(valid({ saleMode: 'NON_SF_PLUS', regularPrice: 17999, nonSfPlusDiscount: 2000 }).calculatedAmounts.primaryNet, 15999);
  assert.equal(valid({ saleMode: 'STUDENT', regularPrice: 54900, studentDiscountPercent: 15 }).calculatedAmounts.primaryNet, 46665);
  fail({ saleMode: 'STUDENT', regularPrice: 100, studentDiscountAmount: 1, standardDiscount: 1 }, 'STUDENT_STACKING_CONFLICT');
});
test('fails closed for missing/invalid money and excessive discounts', () => {
  for (const value of [null, 0, NaN, Infinity, 'not-money']) fail({ saleMode: 'STANDARD_PAYMENT', regularPrice: value }, 'REGULAR_PRICE_NOT_AVAILABLE');
  fail({ saleMode: 'STANDARD_PAYMENT', regularPrice: 1, standardDiscount: -1 }, 'INVALID_MONEY_VALUE');
  fail({ saleMode: 'STANDARD_PAYMENT', regularPrice: 1, standardDiscount: 'unknown' }, 'INVALID_MONEY_VALUE');
  fail({ saleMode: 'STANDARD_PAYMENT', regularPrice: 1, standardDiscount: 2 }, 'DISCOUNT_EXCEEDS_RRP');
  fail({ saleMode: 'STANDARD_PAYMENT', regularPrice: 100, selectedSaleModes: ['SF_PLUS', 'NON_SF_PLUS'] }, 'SALE_MODE_STACKING_CONFLICT');
});
test('calculates SF+ and handles bundle eligibility without inferring it', () => {
  let r = valid({ saleMode: 'SF_PLUS', regularPrice: 28900, financeDiscount: 12000, downPayment: 1690 });
  assert.equal(r.calculatedAmounts.financeContractPrice, 16900); assert.equal(r.calculatedAmounts.financePrincipal, 15210);
  const items = [{ inventoryPn: 'ACC-1', regularPrice: 5990, bundleDiscount: 3000 }];
  r = valid({ saleMode: 'SF_PLUS', regularPrice: 28900, financeDiscount: 12000, downPayment: 1690, primaryInventoryPn: 'SM-1', bundleItems: items, bundleFinanceEligibility: 'FINANCE_ELIGIBLE' });
  assert.equal(r.calculatedAmounts.financePrincipal, 18200);
  r = valid({ saleMode: 'SF_PLUS', regularPrice: 28900, financeDiscount: 12000, downPayment: 1690, primaryInventoryPn: 'SM-1', bundleItems: items, bundleFinanceEligibility: 'CASH_ONLY' });
  assert.equal(r.calculatedAmounts.checkoutPaymentToday, 4680);
  fail({ saleMode: 'SF_PLUS', regularPrice: 28900, downPayment: 0, primaryInventoryPn: 'SM-1', bundleItems: items }, 'BUNDLE_FINANCE_ELIGIBILITY_REVIEW_REQUIRED');
});
test('calculates Trade Up only with eligible trade-in and checkout appraisal', () => {
  const r = valid({ saleMode: 'TRADE_UP', regularPrice: 54900, standardDiscount: 5000, tradeUpBonus: 5000, hasEligibleTradeInDevice: true, tradeInAppraisedValue: 1000 });
  assert.equal(r.calculatedAmounts.priceBeforeTradeInAppraisal, 44900); assert.equal(r.calculatedAmounts.finalCheckoutAmount, 43900);
  fail({ saleMode: 'TRADE_UP', regularPrice: 54900, tradeUpBonus: 5000 }, 'TRADE_IN_DEVICE_REQUIRED');
  fail({ saleMode: 'TRADE_UP', regularPrice: 54900, hasEligibleTradeInDevice: true, tradeInAppraisedValue: 1 }, 'TRADE_UP_BONUS_NOT_CONFIGURED');
  fail({ saleMode: 'TRADE_UP', regularPrice: 10, tradeUpBonus: 5, hasEligibleTradeInDevice: true, tradeInAppraisedValue: 9 }, 'FINAL_CHECKOUT_AMOUNT_NEGATIVE');
});
test('calculates bundle and rejects accessory primary product', () => {
  const r = valid({ saleMode: 'BUNDLE_PURCHASE', regularPrice: 49900, standardDiscount: 4000, primaryInventoryPn: 'SM-1', bundleItems: [{ inventoryPn: 'ACC-1', regularPrice: 5990, bundleDiscount: 3000 }] });
  assert.equal(r.calculatedAmounts.bundleCheckoutTotal, 48890);
  fail({ saleMode: 'BUNDLE_PURCHASE', regularPrice: 1, primaryInventoryPn: 'ACC-1', primaryProductType: 'ACCESSORY', bundleItems: [] }, 'ACCESSORY_PRIMARY_PRODUCT_NOT_ALLOWED');
  fail({ saleMode: 'BUNDLE_PURCHASE', regularPrice: 100, primaryInventoryPn: 'SM-1', bundleItems: [{ inventoryPn: 'ACC-1', regularPrice: 1, bundleDiscount: 2 }] }, 'BUNDLE_DISCOUNT_EXCEEDS_ITEM_PRICE');
});
test('legacy aggregate Trade Up discount requires evidence instead of guessing', () => {
  const r = calculateLegacyOffer({ saleMode: 'TRADE_UP', regularPrice: 54900, discount_amount: 10000 });
  assert.equal(r.valid, false); assert.equal(r.code, 'LEGACY_DISCOUNT_BREAKDOWN_REQUIRED');
});

// Closing-audit cases intentionally remain one requirement per test.
test('STANDARD_PAYMENT permits no discount', () => assert.equal(valid({ saleMode: 'STANDARD_PAYMENT', regularPrice: 99 }).calculatedAmounts.primaryNet, 99));
test('SF_PLUS rejects down payment above contract price', () => fail({ saleMode: 'SF_PLUS', regularPrice: 100, financeDiscount: 50, downPayment: 51 }, 'DOWN_PAYMENT_EXCEEDS_CONTRACT_PRICE'));
test('SF_PLUS has no implicit finance discount', () => assert.equal(valid({ saleMode: 'SF_PLUS', regularPrice: 100, downPayment: 0 }).calculatedAmounts.financeContractPrice, 100));
test('NON_SF_PLUS ignores finance discount field', () => assert.equal(valid({ saleMode: 'NON_SF_PLUS', regularPrice: 100, nonSfPlusDiscount: 10, financeDiscount: 90 }).calculatedAmounts.primaryNet, 90));
test('STUDENT_EXCLUSIVE accepts amount discount', () => assert.equal(valid({ saleMode: 'STUDENT_EXCLUSIVE', regularPrice: 100, studentDiscountAmount: 15 }).calculatedAmounts.primaryNet, 85));
test('TRADE_UP rejects a coupon of its own', () => fail({ saleMode: 'TRADE_UP', regularPrice: 100, tradeUpBonus: 1, hasEligibleTradeInDevice: true, tradeInAppraisedValue: 0, tradeUpCouponCode: 'TU' }, 'TRADE_UP_CODE_NOT_ALLOWED'));
test('TRADE_UP rejects a payment code of its own', () => fail({ saleMode: 'TRADE_UP', regularPrice: 100, tradeUpBonus: 1, hasEligibleTradeInDevice: true, tradeInAppraisedValue: 0, tradeUpPaymentCode: 'TU' }, 'TRADE_UP_CODE_NOT_ALLOWED'));
test('TRADE_UP rejects bonus above RRP', () => fail({ saleMode: 'TRADE_UP', regularPrice: 100, tradeUpBonus: 101, hasEligibleTradeInDevice: true, tradeInAppraisedValue: 0 }, 'DISCOUNT_EXCEEDS_RRP'));
test('BUNDLE_PURCHASE supports multiple bundle items', () => assert.equal(valid({ saleMode: 'BUNDLE_PURCHASE', regularPrice: 100, primaryInventoryPn: 'SM-1', bundleItems: [{ inventoryPn: 'ACC-1', regularPrice: 10 }, { inventoryPn: 'ACC-2', regularPrice: 20, bundleDiscount: 5 }] }).calculatedAmounts.bundleCheckoutTotal, 125));
test('BUNDLE_PURCHASE permits an accessory bundle item', () => assert.equal(valid({ saleMode: 'BUNDLE_PURCHASE', regularPrice: 100, primaryInventoryPn: 'SM-1', bundleItems: [{ inventoryPn: 'ACC-1', regularPrice: 1, productType: 'ACCESSORY' }] }).valid, true));
test('BUNDLE_PURCHASE requires a primary P/N', () => fail({ saleMode: 'BUNDLE_PURCHASE', regularPrice: 100, bundleItems: [] }, 'PRIMARY_PRODUCT_PN_REQUIRED'));
test('bundle item requires a P/N', () => fail({ saleMode: 'BUNDLE_PURCHASE', regularPrice: 100, primaryInventoryPn: 'SM-1', bundleItems: [{ regularPrice: 1 }] }, 'BUNDLE_ITEM_PN_REQUIRED'));
test('bundle item cannot equal primary P/N', () => fail({ saleMode: 'BUNDLE_PURCHASE', regularPrice: 100, primaryInventoryPn: 'SM-1', bundleItems: [{ inventoryPn: 'SM-1', regularPrice: 1 }] }, 'BUNDLE_PRIMARY_PN_CONFLICT'));
test('TRADE_UP preview leaves final amount unavailable', () => { const r = valid({ saleMode: 'TRADE_UP', regularPrice: 100, tradeUpBonus: 1, hasEligibleTradeInDevice: true, calculationStage: 'PREVIEW' }); assert.equal(r.calculatedAmounts.finalCheckoutAmount, null); assert.deepEqual(r.warnings, ['TRADE_IN_APPRAISAL_REQUIRED_AT_CHECKOUT']); });
test('adapter does not mutate legacy input', () => { const offer = { saleMode: 'STANDARD_PAYMENT', regularPrice: 100, standardDiscount: 1 }; const before = JSON.stringify(offer); calculateLegacyOffer(offer); assert.equal(JSON.stringify(offer), before); });
test('adapter preserves mapped source metadata', () => { const r = calculateLegacyOffer({ saleMode: 'STANDARD_PAYMENT', regularPrice: 100, standardDiscount: 1 }); assert.equal(r.sourceFields.legacy, true); });
test('SF_PLUS supports exact down-payment amount', () => assert.equal(valid({ saleMode: 'SF_PLUS', regularPrice: 100, selectedDownPaymentAmount: 20, downPaymentType: 'EXACT_AMOUNT' }).calculatedAmounts.financePrincipal, 80));
test('SF_PLUS supports exact down-payment percent', () => assert.equal(valid({ saleMode: 'SF_PLUS', regularPrice: 100, selectedDownPaymentPercent: 10, downPaymentType: 'EXACT_PERCENT' }).calculatedAmounts.financePrincipal, 90));
test('MAX_PERCENT permits selection below maximum', () => assert.equal(valid({ saleMode: 'SF_PLUS', regularPrice: 100, downPaymentType: 'MAX_PERCENT', downPaymentPercentMaximum: 10, selectedDownPaymentPercent: 5 }).calculatedAmounts.financePrincipal, 95));
test('MAX_PERCENT permits selection at maximum', () => assert.equal(valid({ saleMode: 'SF_PLUS', regularPrice: 100, downPaymentType: 'MAX_PERCENT', downPaymentPercentMaximum: 10, selectedDownPaymentPercent: 10 }).calculatedAmounts.financePrincipal, 90));
test('MAX_PERCENT rejects selection above maximum', () => fail({ saleMode: 'SF_PLUS', regularPrice: 100, downPaymentType: 'MAX_PERCENT', downPaymentPercentMaximum: 10, selectedDownPaymentPercent: 11 }, 'DOWN_PAYMENT_PERCENT_EXCEEDS_MAXIMUM'));
test('MAX_PERCENT requires selected percent rather than assuming maximum', () => { const r = calculate({ saleMode: 'SF_PLUS', regularPrice: 100, downPaymentType: 'MAX_PERCENT', downPaymentPercentMaximum: 10 }); assert.equal(r.code, 'DOWN_PAYMENT_SELECTION_REQUIRED'); assert.equal(r.status, 'INPUT_REQUIRED'); });
test('pilot uses V2 when engine and adapter exist', () => assert.equal(evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} }).engine, 'V2'));
test('pilot blocks when V2 engine is missing', () => assert.equal(evaluatePricingRuntime({ environment: 'pilot' }, { adapter: {} }).code, 'PRICING_ENGINE_UNAVAILABLE'));
test('development blocks legacy unless explicitly enabled', () => assert.equal(evaluatePricingRuntime({ environment: 'development', allowLegacyPricingEngine: false }, {}).status, 'BLOCKED'));
test('development legacy warning prevents business use', () => { const r = evaluatePricingRuntime({ environment: 'development', allowLegacyPricingEngine: true }, {}); assert.equal(r.warningCode, 'LEGACY_PRICING_ENGINE_ACTIVE'); assert.equal(r.businessUseAllowed, false); });
test('legacy runtime cannot save cloud draft', () => assert.equal(canSaveCloudDraft(evaluatePricingRuntime({ environment: 'development', allowLegacyPricingEngine: true }, {}), { valid: true }).code, 'PRICING_ENGINE_REQUIRED_FOR_CLOUD_DRAFT'));
test('invalid V2 calculation cannot save cloud draft', () => assert.equal(canSaveCloudDraft(evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} }), { valid: false }).allowed, false));
test('blocked runtime does not call save client', () => { let calls = 0; const r = savePromotionDraft({ payload: {}, runtimeDecision: evaluatePricingRuntime({ environment: 'pilot' }, {}), calculationResults: [], saveClient: () => { calls += 1; } }); assert.equal(r.code, 'PRICING_ENGINE_REQUIRED_FOR_CLOUD_DRAFT'); assert.equal(calls, 0); });
test('INPUT_REQUIRED result does not call save client', () => { let calls = 0; const r = savePromotionDraft({ payload: {}, runtimeDecision: evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} }), calculationResults: [{ valid: false, status: 'INPUT_REQUIRED' }], saveClient: () => { calls += 1; } }); assert.equal(r.code, 'PRICING_ENGINE_REQUIRED_FOR_CLOUD_DRAFT'); assert.equal(calls, 0); });

// --- Phase 1.5-C1: 10 Importer Runtime Enforcement Spy Tests ---
const { PromotionImportController } = require('../assets/js/promotion-importer.js');
const PromotionPricingRuntime = require('../assets/js/promotion-pricing-runtime.js');

test('SPY 1: Engine missing blocks preview, payloadBuilder, saveClient, fetch, rpc (all count = 0)', async () => {
  let previewCalls = 0, payloadCalls = 0, saveCalls = 0, fetchCalls = 0, rpcCalls = 0;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, { adapter: {} }); // missing engine
  const ctrl = new PromotionImportController();
  ctrl.currentStagedBatch = {
    sourceFilename: 'test.xlsx',
    fileHash: 'abc',
    stats: { totalVariants: 1 },
    variants: [{ validationStatus: 'PASSED_VALIDATION', pn: 'SM-1', rrp: 100, netPrice: 90 }]
  };

  const previewRes = ctrl.showDatabasePreview({
    runtimeDecision,
    calculationResults: [],
    previewClient: () => { previewCalls += 1; }
  });
  assert.equal(previewRes.allowed, false);
  assert.equal(previewRes.databaseAction, 'DO_NOT_INSERT_OFFER');

  const payload = ctrl.createOffersPayload(ctrl.currentStagedBatch.variants, ctrl.currentStagedBatch, {
    runtimeDecision,
    calculationResults: [],
    payloadBuilder: () => { payloadCalls += 1; return []; }
  });
  assert.deepEqual(payload, []);

  const saveRes = await ctrl.savePromotionDraftToDatabase({
    runtimeDecision,
    calculationResults: [],
    saveClient: () => { saveCalls += 1; }
  });
  assert.equal(saveRes.allowed, false);
  assert.equal(saveRes.databaseAction, 'DO_NOT_INSERT_OFFER');

  assert.equal(previewCalls, 0, 'previewClient must be 0');
  assert.equal(payloadCalls, 0, 'payloadBuilder must be 0');
  assert.equal(saveCalls, 0, 'saveClient must be 0');
  assert.equal(fetchCalls, 0, 'fetch must be 0');
  assert.equal(rpcCalls, 0, 'rpc must be 0');
});

test('SPY 2: Adapter missing blocks saveClient, fetch, rpc (all count = 0)', async () => {
  let saveCalls = 0, fetchCalls = 0, rpcCalls = 0;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, { engine: {} }); // missing adapter
  const ctrl = new PromotionImportController();
  ctrl.currentStagedBatch = {
    sourceFilename: 'test.xlsx',
    fileHash: 'abc',
    stats: { totalVariants: 1 },
    variants: [{ validationStatus: 'PASSED_VALIDATION', pn: 'SM-1', rrp: 100, netPrice: 90 }]
  };

  const res = await ctrl.savePromotionDraftToDatabase({
    runtimeDecision,
    calculationResults: [],
    saveClient: () => { saveCalls += 1; }
  });
  assert.equal(res.allowed, false);
  assert.equal(res.databaseAction, 'DO_NOT_INSERT_OFFER');
  assert.equal(saveCalls, 0, 'saveClient must be 0');
  assert.equal(fetchCalls, 0, 'fetch must be 0');
  assert.equal(rpcCalls, 0, 'rpc must be 0');
});

test('SPY 3: Invalid V2 result does NOT fallback to legacy calculator and calls = 0', async () => {
  let legacyCalls = 0, saveCalls = 0, fetchCalls = 0, rpcCalls = 0;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} });
  const invalidCalc = { valid: false, code: 'INVALID_MONEY_VALUE', status: 'REVIEW_REQUIRED' };

  const ctrl = new PromotionImportController();
  ctrl.currentStagedBatch = {
    sourceFilename: 'test.xlsx',
    fileHash: 'abc',
    stats: { totalVariants: 1 },
    variants: [{ validationStatus: 'PASSED_VALIDATION', pn: 'SM-1', rrp: 100, pricingResult: invalidCalc }]
  };

  const res = await ctrl.savePromotionDraftToDatabase({
    runtimeDecision,
    calculationResults: [invalidCalc],
    saveClient: () => { saveCalls += 1; }
  });
  assert.equal(res.allowed, false);
  assert.equal(res.databaseAction, 'DO_NOT_INSERT_OFFER');
  assert.equal(legacyCalls, 0, 'legacyCalculator must not be invoked as fallback');
  assert.equal(saveCalls, 0, 'saveClient must be 0');
  assert.equal(fetchCalls, 0, 'fetch must be 0');
  assert.equal(rpcCalls, 0, 'rpc must be 0');
});

test('SPY 4: REVIEW_REQUIRED blocks payloadBuilder, saveClient, api, rpc (all count = 0)', async () => {
  let payloadCalls = 0, saveCalls = 0, apiCalls = 0, rpcCalls = 0;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} });
  const reviewCalc = { valid: false, status: 'REVIEW_REQUIRED', code: 'TRADE_IN_DEVICE_REQUIRED' };

  const ctrl = new PromotionImportController();
  ctrl.currentStagedBatch = {
    sourceFilename: 'test.xlsx',
    fileHash: 'abc',
    stats: { totalVariants: 1 },
    variants: [{ validationStatus: 'PASSED_VALIDATION', pn: 'SM-1', rrp: 100, pricingResult: reviewCalc }]
  };

  const payload = ctrl.createOffersPayload(ctrl.currentStagedBatch.variants, ctrl.currentStagedBatch, {
    runtimeDecision,
    calculationResults: [reviewCalc],
    payloadBuilder: () => { payloadCalls += 1; return []; }
  });
  assert.deepEqual(payload, []);

  const res = await ctrl.savePromotionDraftToDatabase({
    runtimeDecision,
    calculationResults: [reviewCalc],
    saveClient: () => { saveCalls += 1; }
  });
  assert.equal(res.allowed, false);
  assert.equal(res.databaseAction, 'DO_NOT_INSERT_OFFER');
  assert.equal(payloadCalls, 0, 'payloadBuilder must be 0');
  assert.equal(saveCalls, 0, 'saveClient must be 0');
  assert.equal(apiCalls, 0, 'api must be 0');
  assert.equal(rpcCalls, 0, 'rpc must be 0');
});

test('SPY 5: INPUT_REQUIRED blocks payloadBuilder, saveClient, api, rpc (all count = 0)', async () => {
  let payloadCalls = 0, saveCalls = 0, apiCalls = 0, rpcCalls = 0;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} });
  const inputCalc = { valid: false, status: 'INPUT_REQUIRED', code: 'DOWN_PAYMENT_SELECTION_REQUIRED' };

  const ctrl = new PromotionImportController();
  ctrl.currentStagedBatch = {
    sourceFilename: 'test.xlsx',
    fileHash: 'abc',
    stats: { totalVariants: 1 },
    variants: [{ validationStatus: 'PASSED_VALIDATION', pn: 'SM-1', rrp: 100, pricingResult: inputCalc }]
  };

  const payload = ctrl.createOffersPayload(ctrl.currentStagedBatch.variants, ctrl.currentStagedBatch, {
    runtimeDecision,
    calculationResults: [inputCalc],
    payloadBuilder: () => { payloadCalls += 1; return []; }
  });
  assert.deepEqual(payload, []);

  const res = await ctrl.savePromotionDraftToDatabase({
    runtimeDecision,
    calculationResults: [inputCalc],
    saveClient: () => { saveCalls += 1; }
  });
  assert.equal(res.allowed, false);
  assert.equal(res.databaseAction, 'DO_NOT_INSERT_OFFER');
  assert.equal(payloadCalls, 0, 'payloadBuilder must be 0');
  assert.equal(saveCalls, 0, 'saveClient must be 0');
  assert.equal(apiCalls, 0, 'api must be 0');
  assert.equal(rpcCalls, 0, 'rpc must be 0');
});

test('SPY 6: Single Save blocked with invalid calc -> saveClient = 0', async () => {
  let saveCalls = 0;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} });
  const ctrl = new PromotionImportController();
  const invalidItem = {
    pn: 'SM-S928B',
    model: 'Galaxy S24 Ultra',
    pricingResult: { valid: false, status: 'REVIEW_REQUIRED' }
  };

  const res = await ctrl.saveSingleOfferDraft(invalidItem, {
    runtimeDecision,
    saveClient: () => { saveCalls += 1; }
  });
  assert.equal(res.allowed, false);
  assert.equal(res.databaseAction, 'DO_NOT_INSERT_OFFER');
  assert.equal(saveCalls, 0, 'saveClient must be 0');
});

test('SPY 7: Batch Save blocked with blocked runtime -> saveClient = 0', async () => {
  let saveCalls = 0;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, {}); // blocked
  const ctrl = new PromotionImportController();
  ctrl.currentStagedBatch = {
    sourceFilename: 'test.xlsx',
    fileHash: 'abc',
    stats: { totalVariants: 1 },
    variants: [{ validationStatus: 'PASSED_VALIDATION', pn: 'SM-1', rrp: 100, netPrice: 90 }]
  };

  const res = await ctrl.savePromotionDraftToDatabase({
    runtimeDecision,
    calculationResults: [],
    saveClient: () => { saveCalls += 1; }
  });
  assert.equal(res.allowed, false);
  assert.equal(res.databaseAction, 'DO_NOT_INSERT_OFFER');
  assert.equal(saveCalls, 0, 'saveClient must be 0');
});

test('SPY 8: Retry Save blocked with invalid calculation -> retryClient = 0', async () => {
  let retryCalls = 0;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} });
  const ctrl = new PromotionImportController();
  const invalidCalc = { valid: false, status: 'INPUT_REQUIRED' };

  const res = await ctrl.retryPromotionDraftSave('BATCH-123', {
    runtimeDecision,
    calculationResults: [invalidCalc],
    retryClient: () => { retryCalls += 1; }
  });
  assert.equal(res.allowed, false);
  assert.equal(res.databaseAction, 'DO_NOT_INSERT_OFFER');
  assert.equal(retryCalls, 0, 'retryClient must be 0');
});

test('SPY 9: Double Submit enforces mutation calls <= 1 during simultaneous execution', async () => {
  let saveCalls = 0;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} });
  const validCalc = calculate({ saleMode: 'STANDARD_PAYMENT', regularPrice: 54900, standardDiscount: 5000 });

  const ctrl = new PromotionImportController();
  ctrl.currentStagedBatch = {
    sourceFilename: 'test.xlsx',
    fileHash: 'abc',
    stats: { totalVariants: 1 },
    variants: [{
      validationStatus: 'PASSED_VALIDATION',
      pn: 'SM-S928B',
      model: 'Galaxy S24 Ultra',
      rrp: 54900,
      discount: 5000,
      netPrice: 49900,
      saleMode: 'STANDARD_PAYMENT',
      pricingResult: validCalc
    }]
  };

  const slowSaveClient = async () => {
    saveCalls += 1;
    await new Promise(r => setTimeout(r, 50));
    return { batchId: 'BATCH-SIMULTANEOUS', campaignId: 'CAMP-1', offerCount: 1 };
  };

  // Dispatch two calls concurrently
  const [res1, res2] = await Promise.all([
    ctrl.savePromotionDraftToDatabase({ runtimeDecision, calculationResults: [validCalc], saveClient: slowSaveClient }),
    ctrl.savePromotionDraftToDatabase({ runtimeDecision, calculationResults: [validCalc], saveClient: slowSaveClient })
  ]);

  assert.ok(saveCalls <= 1, `saveClient called ${saveCalls} times, must be <= 1`);
  assert.equal(saveCalls, 1, 'Exactly one call must succeed');
  const hasBlocked = res1.allowed === false || res2.allowed === false;
  assert.equal(hasBlocked, true, 'One of the concurrent requests must be rejected by double-submit guard');
});

test('SPY 10: Valid V2 Save permits saveClient = 1 and persists complete metadata', async () => {
  let saveCalls = 0;
  let receivedPayload = null;
  const runtimeDecision = evaluatePricingRuntime({ environment: 'pilot' }, { engine: {}, adapter: {} });
  const validCalc = calculate({ saleMode: 'STANDARD_PAYMENT', regularPrice: 54900, standardDiscount: 5000 });

  const ctrl = new PromotionImportController();
  ctrl.currentStagedBatch = {
    sourceFilename: 'test.xlsx',
    fileHash: 'abc',
    stats: { totalVariants: 1 },
    variants: [{
      validationStatus: 'PASSED_VALIDATION',
      pn: 'SM-S928B',
      model: 'Galaxy S24 Ultra',
      capacity: '256GB',
      rrp: 54900,
      discount: 5000,
      netPrice: 49900,
      saleMode: 'STANDARD_PAYMENT',
      pricingResult: validCalc,
      pricingEngineVersion: validCalc.engineVersion,
      pricingSchemaVersion: validCalc.schemaVersion,
      guards: validCalc.guards
    }]
  };

  const mockSave = async (payload) => {
    saveCalls += 1;
    receivedPayload = payload;
    return {
      batchId: 'BATCH-VALID-001',
      campaignId: 'CAMP-VALID-001',
      offerCount: payload.offers.length,
      reviewRequiredCount: 0
    };
  };

  const res = await ctrl.savePromotionDraftToDatabase({
    runtimeDecision,
    calculationResults: [validCalc],
    saveClient: mockSave
  });

  assert.equal(saveCalls, 1, 'saveClient must be called exactly 1 time for valid V2 save');
  assert.equal(res.batchId, 'BATCH-VALID-001');
  assert.ok(receivedPayload, 'Payload must be passed to saveClient');
  assert.equal(receivedPayload.offers.length, 1);
  const offer = receivedPayload.offers[0];
  assert.ok(offer.pricingMetadata, 'Offer must contain pricingMetadata');
  assert.equal(offer.pricingMetadata.engineVersion, '2.0.0-draft');
  assert.equal(offer.pricingMetadata.schemaVersion, '2026.09');
  assert.equal(offer.pricingMetadata.guards.priceFormula, 'PASS');
});
