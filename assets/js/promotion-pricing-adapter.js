/* Legacy offer -> Promotion Pricing Engine V2 input. Does not mutate its input. */
(function (root) {
  'use strict';
  const engine = typeof require === 'function' ? require('./promotion-pricing-engine.js') : root.PromotionPricingEngine;
  function adaptLegacyOffer(offer) {
    const source = offer || {}; const normalized = engine.normalizeSaleMode(source.saleMode || source.paymentCondition);
    if (!normalized.valid) return normalized;
    const saleMode = normalized.saleMode;
    if (saleMode === 'TRADE_UP' && source.standardDiscount === undefined && source.standard_discount_amount === undefined && (source.discountAmount !== undefined || source.discount_amount !== undefined)) {
      return { valid: false, code: 'LEGACY_DISCOUNT_BREAKDOWN_REQUIRED', status: 'REVIEW_REQUIRED', message: 'ต้องแยกส่วนลดซื้อปกติและโบนัส Trade Up จากหลักฐานต้นทาง', offendingFields: ['discount_amount'], sourceFields: { discountAmount: 'discount_amount' } };
    }
    const input = { saleMode, regularPrice: source.regularPrice ?? source.rrp ?? source.regular_price, standardDiscount: source.standardDiscount ?? source.standard_discount_amount, financeDiscount: source.financeDiscount ?? source.finance_discount_amount, nonSfPlusDiscount: source.nonSfPlusDiscount ?? source.non_sf_plus_discount_amount, studentDiscountAmount: source.studentDiscountAmount ?? source.student_discount_amount, studentDiscountPercent: source.studentDiscountPercent ?? source.student_discount_percent, tradeUpBonus: source.tradeUpBonusAmount ?? source.trade_up_bonus_amount ?? source.tradeUpDiscount, hasEligibleTradeInDevice: source.hasEligibleTradeInDevice, tradeInAppraisedValue: source.tradeInAppraisedValue, downPayment: source.selectedDownPaymentAmount ?? source.downPayment, upfrontFees: source.upfrontFees, otherFees: source.otherFees, primaryInventoryPn: source.primaryInventoryPn ?? source.pn, bundleItems: source.bundleItems, bundleFinanceEligibility: source.bundleFinanceEligibility, tradeUpCouponCode: source.tradeUpCouponCode, tradeUpPaymentCode: source.tradeUpPaymentCode, sourceFields: { regularPrice: source.regularPrice !== undefined ? 'regularPrice' : 'rrp/regular_price', saleMode: 'saleMode', legacy: true } };
    return { valid: true, input, sourceFields: input.sourceFields };
  }
  function calculateLegacyOffer(offer) { const adapted = adaptLegacyOffer(offer); return adapted.valid ? engine.calculatePromotionPricing(adapted.input) : adapted; }
  const api = { adaptLegacyOffer, calculateLegacyOffer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PromotionPricingAdapter = api;
})(typeof window !== 'undefined' ? window : globalThis);
