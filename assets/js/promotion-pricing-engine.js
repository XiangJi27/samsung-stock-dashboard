/* Promotion Pricing Engine V2: deterministic, side-effect-free, browser + CommonJS. */
(function (root) {
  'use strict';
  const MODES = new Set(['STANDARD_PAYMENT', 'SF_PLUS', 'NON_SF_PLUS', 'STUDENT_EXCLUSIVE', 'TRADE_UP', 'BUNDLE_PURCHASE']);
  const ALIASES = { STUDENT: 'STUDENT_EXCLUSIVE', BUNDLE: 'BUNDLE_PURCHASE', ADD_ON_PURCHASE: 'BUNDLE_PURCHASE' };
  const invalid = (code, offendingFields) => ({ valid: false, code, status: 'REVIEW_REQUIRED', message: 'ข้อมูลราคาไม่สมบูรณ์ กรุณาตรวจสอบก่อนเสนอขาย', offendingFields: offendingFields || [] });
  const money = (value, field, { required = false, positive = false } = {}) => {
    if (value === null || value === undefined || value === '') return required ? { error: field } : { value: 0 };
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || (positive && number <= 0)) return { error: field };
    return { value: number };
  };
  function normalizeSaleMode(value) {
    const raw = String(value || '').trim().toUpperCase();
    const saleMode = ALIASES[raw] || raw;
    return MODES.has(saleMode) ? { valid: true, saleMode } : invalid('UNSUPPORTED_SALE_MODE', ['saleMode']);
  }
  function result(saleMode, regularPrice, breakdown, calculatedAmounts, guards, sourceFields, warnings) {
    return { valid: true, engineVersion: '2.0.0-draft', schemaVersion: '2026.09', saleMode, currency: 'THB', regularPrice, breakdown, calculatedAmounts, guards: { priceFormula: 'PASS', ...(guards || {}) }, warnings: warnings || [], sourceFields: sourceFields || {} };
  }
  function bundleSummary(items, primaryPn) {
    if (!Array.isArray(items)) return invalid('BUNDLE_PRICE_DATA_REQUIRED', ['bundleItems']);
    let total = 0, discountTotal = 0; const normalized = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i] || {}; const rrp = money(item.regularPrice, `bundleItems[${i}].regularPrice`, { required: true, positive: true });
      const discount = money(item.bundleDiscount, `bundleItems[${i}].bundleDiscount`);
      if (rrp.error || discount.error) return invalid('INVALID_BUNDLE_ITEM_PRICE', [rrp.error || discount.error]);
      if (discount.value > rrp.value) return invalid('BUNDLE_DISCOUNT_EXCEEDS_ITEM_PRICE', [`bundleItems[${i}].bundleDiscount`]);
      if (!item.inventoryPn) return invalid('BUNDLE_ITEM_PN_REQUIRED', [`bundleItems[${i}].inventoryPn`]);
      if (item.inventoryPn === primaryPn) return invalid('BUNDLE_PRIMARY_PN_CONFLICT', [`bundleItems[${i}].inventoryPn`]);
      total += rrp.value - discount.value; discountTotal += discount.value;
      normalized.push({ inventoryPn: item.inventoryPn, regularPrice: rrp.value, bundleDiscount: discount.value, netPrice: rrp.value - discount.value, financeEligibility: item.financeEligibility || null });
    }
    return { valid: true, netTotal: total, discountTotal, items: normalized };
  }
  function calculate(input) {
    input = input || {}; const normalized = normalizeSaleMode(input.saleMode); if (!normalized.valid) return normalized;
    const saleMode = normalized.saleMode, rrpData = money(input.regularPrice, 'regularPrice', { required: true, positive: true });
    if (rrpData.error) return invalid('REGULAR_PRICE_NOT_AVAILABLE', [rrpData.error]);
    const selectedModes = Array.isArray(input.selectedSaleModes) ? input.selectedSaleModes.map((mode) => normalizeSaleMode(mode).saleMode) : [];
    if (selectedModes.includes('SF_PLUS') && selectedModes.includes('NON_SF_PLUS')) return invalid('SALE_MODE_STACKING_CONFLICT', ['selectedSaleModes']);
    const rrp = rrpData.value, sourceFields = input.sourceFields || {}, guards = { saleMode: 'PASS', regularPrice: 'PASS' };
    const read = (name) => { const value = money(input[name], name); return value.error ? invalid('INVALID_MONEY_VALUE', [name]) : value.value; };
    const fee = read('upfrontFees'); if (fee.valid === false) return fee; const otherFees = read('otherFees'); if (otherFees.valid === false) return otherFees;
    const common = { standardDiscount: 0, financeDiscount: 0, nonSfPlusDiscount: 0, studentDiscount: 0, tradeUpBonus: 0, tradeInAppraisedValue: 0, bundleDiscount: 0, upfrontFees: fee, otherFees };
    const simple = (field, amountName) => { const discount = read(field); if (discount.valid === false) return discount; if (discount > rrp) return invalid('DISCOUNT_EXCEEDS_RRP', [field]); common[amountName] = discount; return result(saleMode, rrp, common, { primaryNet: rrp - discount, finalCheckoutAmount: rrp - discount + otherFees }, guards, sourceFields); };
    if (saleMode === 'STANDARD_PAYMENT') return simple('standardDiscount', 'standardDiscount');
    if (saleMode === 'NON_SF_PLUS') return simple('nonSfPlusDiscount', 'nonSfPlusDiscount');
    if (saleMode === 'STUDENT_EXCLUSIVE') {
      if (input.standardDiscount > 0 || input.tradeUpBonus > 0 || input.financeDiscount > 0 || input.nonSfPlusDiscount > 0) return invalid('STUDENT_STACKING_CONFLICT', ['saleMode']);
      const amount = read('studentDiscountAmount'); if (amount.valid === false) return amount;
      const percent = read('studentDiscountPercent'); if (percent.valid === false || percent > 100) return invalid('INVALID_STUDENT_DISCOUNT', ['studentDiscountPercent']);
      if (amount > 0 && percent > 0) return invalid('STUDENT_DISCOUNT_AMBIGUOUS', ['studentDiscountAmount', 'studentDiscountPercent']);
      const discount = amount || (rrp * percent / 100); if (discount > rrp) return invalid('DISCOUNT_EXCEEDS_RRP', ['studentDiscountAmount']);
      common.studentDiscount = discount; return result(saleMode, rrp, common, { primaryNet: rrp - discount, finalCheckoutAmount: rrp - discount + otherFees }, { ...guards, stackingPolicy: 'EXCLUSIVE' }, sourceFields);
    }
    if (saleMode === 'TRADE_UP') {
      if (input.tradeUpCouponCode || input.tradeUpPaymentCode) return invalid('TRADE_UP_CODE_NOT_ALLOWED', ['tradeUpCouponCode', 'tradeUpPaymentCode']);
      if (input.hasEligibleTradeInDevice !== true) return invalid('TRADE_IN_DEVICE_REQUIRED', ['hasEligibleTradeInDevice']);
      const standard = read('standardDiscount'), bonus = read('tradeUpBonus'), appraisal = money(input.tradeInAppraisedValue, 'tradeInAppraisedValue', { required: input.calculationStage !== 'PREVIEW' });
      if (standard.valid === false || bonus.valid === false || appraisal.error) return standard.valid === false ? standard : bonus.valid === false ? bonus : invalid('TRADE_IN_APPRAISAL_REQUIRED', ['tradeInAppraisedValue']);
      if (bonus <= 0) return invalid('TRADE_UP_BONUS_NOT_CONFIGURED', ['tradeUpBonus']);
      const before = rrp - standard - bonus; if (before < 0) return invalid('DISCOUNT_EXCEEDS_RRP', ['standardDiscount', 'tradeUpBonus']);
      if (input.calculationStage === 'PREVIEW' && (input.tradeInAppraisedValue === null || input.tradeInAppraisedValue === undefined || input.tradeInAppraisedValue === '')) {
        Object.assign(common, { standardDiscount: standard, tradeUpBonus: bonus });
        return result(saleMode, rrp, common, { priceBeforeTradeInAppraisal: before, finalCheckoutAmount: null }, { ...guards, tradeInEligibility: 'PASS', checkoutAppraisal: 'REQUIRED' }, sourceFields, ['TRADE_IN_APPRAISAL_REQUIRED_AT_CHECKOUT']);
      }
      const finalAmount = before - appraisal.value + fee + otherFees; if (finalAmount < 0) return invalid('FINAL_CHECKOUT_AMOUNT_NEGATIVE', ['tradeInAppraisedValue']);
      Object.assign(common, { standardDiscount: standard, tradeUpBonus: bonus, tradeInAppraisedValue: appraisal.value });
      return result(saleMode, rrp, common, { priceBeforeTradeInAppraisal: before, finalCheckoutAmount: finalAmount }, { ...guards, tradeInEligibility: 'PASS' }, sourceFields);
    }
    if (saleMode === 'BUNDLE_PURCHASE') {
      if (String(input.primaryProductType || '').toUpperCase() === 'ACCESSORY') return invalid('ACCESSORY_PRIMARY_PRODUCT_NOT_ALLOWED', ['primaryProductType']);
      if (!input.primaryInventoryPn) return invalid('PRIMARY_PRODUCT_PN_REQUIRED', ['primaryInventoryPn']);
      const standard = read('standardDiscount'); if (standard.valid === false) return standard;
      if (standard > rrp) return invalid('DISCOUNT_EXCEEDS_RRP', ['standardDiscount']);
      const bundle = bundleSummary(input.bundleItems, input.primaryInventoryPn); if (!bundle.valid) return bundle;
      common.standardDiscount = standard; common.bundleDiscount = bundle.discountTotal;
      return result(saleMode, rrp, common, { primaryNet: rrp - standard, bundleItems: bundle.items, bundleCheckoutTotal: rrp - standard + bundle.netTotal + fee + otherFees, finalCheckoutAmount: rrp - standard + bundle.netTotal + fee + otherFees }, { ...guards, primaryProduct: 'PASS', bundleItems: 'PASS' }, sourceFields);
    }
    const financeDiscount = read('financeDiscount'); if (financeDiscount.valid === false) return financeDiscount;
    if (financeDiscount > rrp) return invalid('DISCOUNT_EXCEEDS_RRP', ['financeDiscount']);
    const contract = rrp - financeDiscount;
    const downPaymentType = input.downPaymentType || 'EXACT_AMOUNT';
    let down;
    if (downPaymentType === 'EXACT_AMOUNT') {
      down = money(input.selectedDownPaymentAmount !== undefined ? input.selectedDownPaymentAmount : input.downPayment, 'selectedDownPaymentAmount', { required: true });
      if (down.error || down.value > contract) return invalid('DOWN_PAYMENT_EXCEEDS_CONTRACT_PRICE', ['selectedDownPaymentAmount']);
      down = down.value;
    } else if (downPaymentType === 'EXACT_PERCENT' || downPaymentType === 'MAX_PERCENT') {
      const selected = money(input.selectedDownPaymentPercent, 'selectedDownPaymentPercent', { required: downPaymentType === 'EXACT_PERCENT' });
      if (selected.error || selected.value > 100) return invalid('INVALID_DOWN_PAYMENT_PERCENT', ['selectedDownPaymentPercent']);
      if (downPaymentType === 'MAX_PERCENT') {
        const maximum = money(input.downPaymentPercentMaximum, 'downPaymentPercentMaximum', { required: true });
        if (maximum.error || maximum.value > 100) return invalid('INVALID_DOWN_PAYMENT_PERCENT_MAXIMUM', ['downPaymentPercentMaximum']);
        if (input.selectedDownPaymentPercent === null || input.selectedDownPaymentPercent === undefined || input.selectedDownPaymentPercent === '') return { valid: false, code: 'DOWN_PAYMENT_SELECTION_REQUIRED', status: 'INPUT_REQUIRED', message: 'กรุณาเลือกเงินดาวน์ก่อนคำนวณยอดจัด', offendingFields: ['selectedDownPaymentPercent'], calculatedAmounts: { financeContractPrice: contract, downPayment: null, financePrincipal: null, checkoutPaymentToday: null } };
        if (selected.value > maximum.value) return invalid('DOWN_PAYMENT_PERCENT_EXCEEDS_MAXIMUM', ['selectedDownPaymentPercent']);
      }
      down = contract * selected.value / 100;
    } else return invalid('UNSUPPORTED_DOWN_PAYMENT_TYPE', ['downPaymentType']);
    const bundle = bundleSummary(input.bundleItems || [], input.primaryInventoryPn); if (!bundle.valid) return bundle;
    const eligibility = input.bundleFinanceEligibility || (bundle.netTotal ? 'REVIEW_REQUIRED' : 'NONE');
    if (bundle.netTotal && !['FINANCE_ELIGIBLE', 'CASH_ONLY'].includes(eligibility)) return invalid('BUNDLE_FINANCE_ELIGIBILITY_REVIEW_REQUIRED', ['bundleFinanceEligibility']);
    const financeEligibleTotal = contract + (eligibility === 'FINANCE_ELIGIBLE' ? bundle.netTotal : 0);
    if (down > financeEligibleTotal) return invalid('DOWN_PAYMENT_EXCEEDS_CONTRACT_PRICE', ['downPayment']);
    Object.assign(common, { financeDiscount, bundleDiscount: bundle.discountTotal });
    return result(saleMode, rrp, common, { financeContractPrice: contract, financePrincipal: financeEligibleTotal - down, checkoutPaymentToday: down + (eligibility === 'CASH_ONLY' ? bundle.netTotal : 0) + fee, bundleItems: bundle.items }, { ...guards, bundleFinanceEligibility: eligibility }, sourceFields);
  }
  const api = { ENGINE_VERSION: '2.0.0-draft', normalizeSaleMode, calculatePromotionPricing: calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PromotionPricingEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
