/**
 * Samsung Branch Operations - Promotional Pricing Engine
 * Pure calculation, validation, and multi-tier pricing engine.
 * Ayutthaya City Park Branch Operations.
 */

(function (global) {
  'use strict';

  /**
   * Tier 1 vs Tier 2 Standard Promotion & Trade Up Calculator
   */
  function calculatePromotionPrices(params) {
    const regularPrice = Number(params.regularPrice || 0);
    const standardDiscount = Number(params.standardDiscount || 0);
    const tradeUpDiscount = Number(params.tradeUpDiscount || 0);

    const standardNetPrice = regularPrice - standardDiscount;
    const tradeUpNetPrice = standardNetPrice - tradeUpDiscount;

    return {
      regularPrice,
      standardDiscount,
      standardNetPrice,
      tradeUpDiscount,
      tradeUpNetPrice,
      tradeUpEligible: tradeUpDiscount > 0
    };
  }

  /**
   * Galaxy S25 FE Mutually Exclusive Payment Option Calculator
   * Option A: SF+ (Coupon 01, 3,000 THB discount, down payment <= 10%, no Trade Up)
   * Option B: NON_SF_PLUS (Coupon 02, 256GB: 6,000 THB, 128GB: 5,000 THB, no Trade Up)
   */
  function calculateS25FePromotion(params) {
    const regularPrice = Number(params.regularPrice || 0);
    const capacity = String(params.capacity || '').trim().toUpperCase();
    const paymentCondition = params.paymentCondition; // "SF_PLUS" or "NON_SF_PLUS"

    let standardDiscount = 0;
    let couponCode = '';
    let remarks = [];

    if (paymentCondition === 'SF_PLUS') {
      standardDiscount = 3000;
      couponCode = 'คูปอง 01';
      remarks = [
        'ชำระผ่านสินเชื่อ Samsung Finance+ (SF+)',
        'เงื่อนไขเงินดาวน์: ดาวน์ไม่เกิน 10%',
        'ไม่ร่วมกับคูปอง 02',
        'ไม่มีส่วนลด Trade Up เพิ่มเติม'
      ];
    } else if (paymentCondition === 'NON_SF_PLUS') {
      couponCode = 'คูปอง 02';
      if (capacity.includes('256')) {
        standardDiscount = 6000;
      } else if (capacity.includes('128')) {
        standardDiscount = 5000;
      } else {
        throw new Error(`UNSUPPORTED_S25_FE_CAPACITY: ${capacity}`);
      }
      remarks = [
        'ไม่ชำระผ่าน SF+ (ชำระด้วยเงินสด / โอน / บัตรเครดิต)',
        'ไม่ร่วมกับคูปอง 01',
        'ไม่มีส่วนลด Trade Up เพิ่มเติม'
      ];
    } else {
      throw new Error(`S25_FE_PAYMENT_CONDITION_REQUIRED: ${paymentCondition}`);
    }

    const netPrice = regularPrice - standardDiscount;

    return {
      model: 'Galaxy S25 FE',
      capacity,
      regularPrice,
      paymentCondition,
      standardDiscount,
      couponCode,
      tradeUpEligible: false,
      tradeUpDiscount: 0,
      additionalDiscount: 0,
      netPrice,
      stackingPolicy: 'MUTUALLY_EXCLUSIVE',
      remarks
    };
  }

  /**
   * Galaxy A57 5G Payment Option Calculator
   * Option A: SF+ (Down payment <= 5% estimate, NO product discount, netPrice = regularPrice)
   * Option B: NON_SF_PLUS (Coupon 01, 2,000 THB discount, netPrice = regularPrice - 2,000)
   */
  function calculateA57Promotion(params) {
    const regularPrice = Number(params.regularPrice || 0);
    const capacity = String(params.capacity || '').trim();
    const paymentCondition = params.paymentCondition; // "SF_PLUS" or "NON_SF_PLUS"

    let standardDiscount = 0;
    let couponCode = null;
    let estimatedDownPayment = null;
    let remarks = [];

    if (paymentCondition === 'SF_PLUS') {
      standardDiscount = 0;
      couponCode = null;
      estimatedDownPayment = Math.round((regularPrice * 0.05) / 10) * 10;
      remarks = [
        'ชำระผ่านสินเชื่อ Samsung Finance+ (SF+)',
        `ดาวน์ไม่เกิน 5% (ประมาณ ฿${estimatedDownPayment.toLocaleString('th-TH')})`,
        'ไม่มีส่วนลดราคาสินค้า (ราคาสินค้าเท่าราคาปกติ RRP)',
        'ยอดที่เหลือผ่อนชำระตามสัญญา SF+'
      ];
    } else if (paymentCondition === 'NON_SF_PLUS') {
      standardDiscount = 2000;
      couponCode = 'คูปอง 01';
      remarks = [
        'ไม่ชำระผ่าน SF+ (ชำระด้วยเงินสด / โอน / บัตรเครดิต)',
        'ส่วนลดคูปอง 01 จำนวน 2,000 บาท',
        'ไม่สามารถใช้ร่วมกับสิทธิ์ผ่อน SF+ ได้',
        'ไม่มีส่วนลด Trade Up เพิ่มเติม'
      ];
    } else {
      throw new Error(`A57_PAYMENT_CONDITION_REQUIRED: ${paymentCondition}`);
    }

    const netPrice = regularPrice - standardDiscount;

    return {
      model: 'Galaxy A57 5G',
      capacity,
      regularPrice,
      paymentCondition,
      standardDiscount,
      couponCode,
      estimatedDownPayment,
      tradeUpEligible: false,
      tradeUpDiscount: 0,
      additionalDiscount: 0,
      netPrice,
      stackingPolicy: 'MUTUALLY_EXCLUSIVE',
      remarks
    };
  }

  /**
   * Student/Education Exclusive Promotion Calculator
   * 15% discount on regular price using coupon 'Studentcrd'
   * Strictly exclusive: cannot combine with Coupon 01, Standard Discount, or Trade Up.
   * Model eligibility: S26 Ultra 512GB and 256GB only. S26 Ultra 1TB is explicitly blocked.
   */
  function calculateStudentPromotion(params) {
    const regularPrice = Number(params.regularPrice || 0);
    const model = String(params.model || '').trim();
    const capacity = String(params.capacity || '').trim().toUpperCase();
    const couponCode = params.couponCode || 'Studentcrd';

    if (couponCode !== 'Studentcrd') {
      throw new Error('STUDENT_COUPON_REQUIRED');
    }

    if (!Number.isFinite(regularPrice) || regularPrice <= 0) {
      throw new Error('INVALID_REGULAR_PRICE');
    }

    // Explicit check for S26 Ultra 1TB
    if (model.includes('S26') && model.includes('Ultra') && capacity.includes('1TB')) {
      return {
        eligible: false,
        reason: 'S26 Ultra 1TB ไม่ร่วมโปรโมชั่นนักเรียน/นักศึกษา ตามประกาศทางการ',
        regularPrice,
        model,
        capacity,
        netPrice: regularPrice
      };
    }

    const discountPercent = 15;
    const discountAmount = Math.round((regularPrice * discountPercent) / 100);
    const netPrice = regularPrice - discountAmount;

    return {
      eligible: true,
      model,
      capacity,
      regularPrice,
      promotionType: 'STUDENT_EXCLUSIVE',
      customerSegment: 'STUDENT',
      couponCode: 'Studentcrd',
      studentDiscountPercent: discountPercent,
      studentDiscountAmount: discountAmount,
      standardDiscount: 0,
      tradeUpEligible: false,
      tradeUpDiscount: 0,
      additionalDiscount: 0,
      netPrice,
      stackingPolicy: 'EXCLUSIVE',
      canCombineWithOtherPromotions: false,
      remarks: [
        'สำหรับนักเรียน/นักศึกษาที่ผ่านเกณฑ์ยืนยันตัวตน',
        'ส่วนลด 15% คำนวณจากราคาปกติ',
        'ไม่ร่วมคูปอง 01',
        'ไม่ร่วมส่วนลด Trade Up',
        'ไม่ร่วมกับโปรโมชั่นอื่นทุกประเภท'
      ]
    };
  }

  /**
   * Validation Gates Engine
   */
  function validatePromotionGates(promo) {
    const errors = [];

    // Gate 1: regularPrice > 0
    if (!promo.regularPrice || promo.regularPrice <= 0) {
      errors.push('GATE_1_REGULAR_PRICE_INVALID');
    }

    // Gate 2: standardDiscount >= 0
    if (promo.standardDiscount !== undefined && promo.standardDiscount < 0) {
      errors.push('GATE_2_NEGATIVE_STANDARD_DISCOUNT');
    }

    // Gate 3: standardNetPrice = regularPrice - standardDiscount
    const expectedStandardNet = Number(promo.regularPrice) - Number(promo.standardDiscount || 0);
    if (promo.standardNetPrice !== undefined && promo.standardNetPrice !== expectedStandardNet) {
      errors.push('GATE_3_STANDARD_NET_PRICE_MISMATCH');
    }

    // Gate 4: tradeUpDiscount >= 0
    if (promo.tradeUpDiscount !== undefined && promo.tradeUpDiscount < 0) {
      errors.push('GATE_4_NEGATIVE_TRADE_UP_DISCOUNT');
    }

    // Gate 5: tradeUpNetPrice = standardNetPrice - tradeUpDiscount
    if (promo.tradeUpNetPrice !== undefined) {
      const expectedTradeUpNet = expectedStandardNet - Number(promo.tradeUpDiscount || 0);
      if (promo.tradeUpNetPrice !== expectedTradeUpNet) {
        errors.push('GATE_5_TRADE_UP_NET_PRICE_MISMATCH');
      }
    }

    // Gate 6: tradeUpDiscount > 0 requires tradeUp eligible / required
    if (promo.tradeUpDiscount > 0 && promo.requiresTradeIn === false) {
      errors.push('GATE_6_TRADE_UP_REQUIREMENT_MISSING');
    }

    // Gate 7: Trade Up discount must never reduce normal purchase route
    if (promo.isNormalRoute && promo.tradeUpDiscount > 0) {
      errors.push('GATE_7_TRADE_UP_IN_NORMAL_ROUTE');
    }

    // Gate 8: Appraisal value must never mix with campaign trade-up discount
    if (promo.appraisalValueIncludedInTradeUpDiscount === true) {
      errors.push('GATE_8_APPRAISAL_VALUE_MIXED_WITH_CAMPAIGN');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Export for browser & node
  const api = {
    calculatePromotionPrices,
    calculateS25FePromotion,
    calculateA57Promotion,
    calculateStudentPromotion,
    validatePromotionGates
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.PromotionCalculator = api;
  }
})(typeof window !== 'undefined' ? window : global);
