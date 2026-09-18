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

    // Gate 9: Student promotion must be exclusive
    if (promo.promotionType === 'STUDENT_EXCLUSIVE' || promo.couponCode === 'Studentcrd') {
      if (promo.canCombineWithOtherPromotions !== false || promo.stackingPolicy !== 'EXCLUSIVE') {
        errors.push('GATE_9_STUDENT_PROMOTION_MUST_BE_EXCLUSIVE');
      }
      if (promo.standardDiscount > 0 || promo.tradeUpDiscount > 0) {
        errors.push('GATE_9_STUDENT_PROMOTION_CANNOT_COMBINE_DISCOUNTS');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Enterprise Promotion Option Validator (Field-level & Conflict Detection)
   */
  function validatePromotionOption(option) {
    const errors = [];
    const regularPrice = Number(option.regularPrice || 0);
    const standardDiscount = Number(option.standardDiscount || 0);
    const tradeUpDiscount = Number(option.tradeUpDiscount || 0);
    const studentDiscount = Number(option.studentDiscountAmount || (option.discountPercent ? Math.round((regularPrice * option.discountPercent) / 100) : 0));

    // Check 1: Price calculation equation
    const expectedNet = regularPrice - standardDiscount - tradeUpDiscount - studentDiscount;
    if (option.netPrice !== undefined && option.netPrice !== expectedNet) {
      errors.push({
        code: 'NET_PRICE_MISMATCH',
        severity: 'BLOCKER',
        expected: expectedNet,
        actual: option.netPrice,
        message: `ราคาสุทธิไม่ตรงสูตร (คาดหวัง ${expectedNet} แต่ได้ ${option.netPrice})`
      });
    }

    // Check 2: Trade Up requires trade-in
    if (tradeUpDiscount > 0 && option.requiresTradeIn !== true) {
      errors.push({
        code: 'TRADE_UP_REQUIREMENT_MISSING',
        severity: 'BLOCKER',
        field: 'requiresTradeIn',
        message: 'ส่วนลด Trade Up ต้องมีเครื่องมาแลก (requiresTradeIn = true)'
      });
    }

    // Check 3: Student must be exclusive
    if (option.optionType === 'STUDENT_EXCLUSIVE' || option.couponCode === 'Studentcrd') {
      if (option.canCombineWithOtherPromotions !== false || option.stackingPolicy !== 'EXCLUSIVE') {
        errors.push({
          code: 'STUDENT_PROMOTION_MUST_BE_EXCLUSIVE',
          severity: 'BLOCKER',
          field: 'stackingPolicy',
          message: 'โปรนักเรียน/นักศึกษาต้องเป็น Exclusive และไม่ร่วมโปรอื่น'
        });
      }
      if (standardDiscount > 0 || tradeUpDiscount > 0) {
        errors.push({
          code: 'STUDENT_STACKING_CONFLICT',
          severity: 'BLOCKER',
          message: 'Studentcrd ห้ามใช้ร่วมกับคูปอง 01 หรือ Trade Up'
        });
      }
    }

    // Check 4: SF+ down payment vs discount confusion
    if (option.paymentCondition === 'SF_PLUS' && option.downPaymentAsDiscount === true) {
      errors.push({
        code: 'DOWN_PAYMENT_MISCLASSIFIED',
        severity: 'BLOCKER',
        message: 'เงินดาวน์ไม่ใช่ส่วนลดราคาสินค้า ห้ามจัดเข้า standardDiscount'
      });
    }

    // Check 5: Discount cannot exceed regular price
    if (standardDiscount + tradeUpDiscount + studentDiscount > regularPrice) {
      errors.push({
        code: 'DISCOUNT_EXCEEDS_REGULAR_PRICE',
        severity: 'BLOCKER',
        message: 'ยอดส่วนลดรวมเกินราคาปกติของสินค้า'
      });
    }

    return {
      isValid: errors.filter(e => e.severity === 'BLOCKER').length === 0,
      errors
    };
  }

  const THAI_MONTH_PATTERN =
    'มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|' +
    'กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม';

  const CROSS_MONTH_DATE_RANGE_REGEX = new RegExp(
    String.raw`(?:วันที่|ตั้งแต่วันที่|ระหว่างวันที่)?\s*` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(${THAI_MONTH_PATTERN})\s*` +
    String.raw`(?:-|–|—|ถึง)\s*` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(${THAI_MONTH_PATTERN})` +
    String.raw`(?:\s*(?:25\d{2}|20\d{2}))?`,
    'iu'
  );

  const SAME_MONTH_DATE_RANGE_REGEX = new RegExp(
    String.raw`(?:วันที่|ตั้งแต่วันที่|ระหว่างวันที่)?\s*` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(?:-|–|—|ถึง)\s*` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(${THAI_MONTH_PATTERN})` +
    String.raw`(?:\s*(?:25\d{2}|20\d{2}))?`,
    'iu'
  );

  const SINGLE_DATE_REGEX = new RegExp(
    String.raw`(?:วันที่\s*)?` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(${THAI_MONTH_PATTERN})` +
    String.raw`(?:\s*(?:25\d{2}|20\d{2}))?`,
    'iu'
  );

  const MEMORY_PATTERN =
    /\(?\s*(\d{1,2})\s*[\/+]\s*(32|64|128|256|512|1)\s*(GB|TB)\s*\)?/iu;

  const CAPACITY_ONLY_PATTERN =
    /\b(?:32|64|128|256|512)\s*GB\b|\b(?:1|2)\s*TB\b/iu;

  const PROMOTION_CONDITION_PATTERN =
    /\b(?:Trade\s*Up\s*Only|Trade\s*Up|Studentcrd|SF\+|Non-SF\+)\b/giu;

  function findPromotionDate(text) {
    const crossMonth = text.match(CROSS_MONTH_DATE_RANGE_REGEX);
    if (crossMonth) return { type: 'CROSS_MONTH_RANGE', match: crossMonth };

    const sameMonth = text.match(SAME_MONTH_DATE_RANGE_REGEX);
    if (sameMonth) return { type: 'SAME_MONTH_RANGE', match: sameMonth };

    const singleDate = text.match(SINGLE_DATE_REGEX);
    if (singleDate) return { type: 'SINGLE_DATE', match: singleDate };

    return null;
  }

  function normalizeMemoryMatch(match) {
    if (!match) return null;
    const ram = Number(match[1]);
    const storage = Number(match[2]);
    const unit = match[3].toUpperCase();

    if (unit === 'GB' && storage === 1) {
      return { valid: false, code: 'INVALID_STORAGE_UNIT_VALUE' };
    }
    if (unit === 'TB' && storage !== 1) {
      return { valid: false, code: 'UNSUPPORTED_TB_CAPACITY' };
    }
    return {
      valid: true,
      ram: `${ram}GB`,
      capacity: `${storage}${unit}`,
      memory: `${ram}/${storage}${unit}`
    };
  }

  let headingParserModule = null;
  if (typeof require === 'function') {
    try {
      headingParserModule = require('./promotion-heading-parser.js');
    } catch (_) {}
  }

  function getHeadingParser() {
    if (headingParserModule) return headingParserModule;
    if (typeof window !== 'undefined' && window.PromotionHeadingParser) {
      return window.PromotionHeadingParser;
    }
    return null;
  }

  /**
   * Robust Heading Parser: Strips Promotion Dates, RAM/Storage, SF+ Conditions
   */
  function parsePromotionProductHeading(rawValue) {
    const parser = getHeadingParser();
    if (parser && typeof parser.parsePromotionProductHeading === 'function') {
      return parser.parsePromotionProductHeading(rawValue);
    }

    const originalText = String(rawValue || '')
      .normalize('NFC')
      .replace(/\u0e4d\u0e32/g, '\u0e33')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let workingText = originalText;

    const dateResult = findPromotionDate(workingText);
    if (dateResult) {
      workingText = workingText.replace(dateResult.match[0], ' ');
    }

    const memoryMatch = workingText.match(MEMORY_PATTERN);
    let memory = null;
    let ram = null;
    let capacity = null;

    if (memoryMatch) {
      const normalized = normalizeMemoryMatch(memoryMatch);
      if (normalized && normalized.valid) {
        memory = normalized.memory;
        ram = normalized.ram;
        capacity = normalized.capacity;
        workingText = workingText.replace(memoryMatch[0], ' ');
      }
    } else {
      const capacityMatch = workingText.match(CAPACITY_ONLY_PATTERN);
      if (capacityMatch) {
        capacity = capacityMatch[0].replace(/\s+/g, '').toUpperCase();
        workingText = workingText.replace(capacityMatch[0], ' ');
      }
    }

    const conditions = [...workingText.matchAll(PROMOTION_CONDITION_PATTERN)].map(m => m[0]);
    workingText = workingText.replace(PROMOTION_CONDITION_PATTERN, ' ');

    let model = workingText
      .replace(/\b(?:โปรโมชั่น|โปรโมชัน|promotion|promo)\b/giu, ' ')
      .replace(/[()[\]]/g, ' ')
      .replace(/^[\s|:,-]+/, '')
      .replace(/[\s|:,-]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!model) {
      return {
        originalText,
        model: null,
        memory,
        ram,
        capacity,
        conditions,
        parsingStatus: 'REVIEW_REQUIRED',
        errorCode: 'MODEL_NAME_NOT_FOUND'
      };
    }

    if (findPromotionDate(model)) {
      return {
        originalText,
        model,
        memory,
        ram,
        capacity,
        conditions,
        parsingStatus: 'REVIEW_REQUIRED',
        errorCode: 'MODEL_CONTAINS_PROMOTION_DATE_NOISE'
      };
    }

    return {
      originalText,
      model,
      memory,
      ram,
      capacity,
      conditions,
      promotionDateText: dateResult?.match?.[0]?.trim() || null,
      promotionDateType: dateResult?.type || null,
      parsingStatus: 'PARSED',
      errorCode: null
    };
  }

  /**
   * Canonical Model Family Normalizer
   * Evaluates rules in strict order: Ultra -> Plus -> FE -> Base
   */
  function normalizeSamsungModelFamily(value) {
    const text = String(value || '')
      .toUpperCase()
      .replace(/\(TSE\)/g, ' ')
      .replace(/SAMSUNG/g, ' ')
      .replace(/GALAXY/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const rules = [
      [/\bS26\s*ULTRA\b/, 'S26_ULTRA'],
      [/\bS26\s*(?:\+|\bPLUS\b)/, 'S26_PLUS'],
      [/\bS26\s*FE\b|\bS26FE\b/, 'S26_FE'],
      [/\bS26\b/, 'S26_BASE'],

      [/\bS25\s*FE\b|\bS25FE\b/, 'S25_FE'],
      [/\bS25\s*ULTRA\b/, 'S25_ULTRA'],
      [/\bS25\s*(?:\+|\bPLUS\b)/, 'S25_PLUS'],
      [/\bS25\b/, 'S25_BASE'],

      [/\bS24\s*ULTRA\b/, 'S24_ULTRA'],
      [/\bS24\s*(?:\+|\bPLUS\b)/, 'S24_PLUS'],
      [/\bS24\s*FE\b|\bS24FE\b/, 'S24_FE'],
      [/\bS24\b/, 'S24_BASE'],

      [/\bA57\s*5G\b/, 'A57_5G'],
      [/\bA57\b/, 'A57_5G'],

      // Decouple A37 5G / LTE / BASE strictly
      [/\bA37\s*5G\b/, 'A37_5G'],
      [/\bA37\s*(?:LTE|4G)\b/, 'A37_LTE'],
      [/\bA37\b/, 'A37_BASE'],

      // Separate A07 LTE / 4G from A07 5G strictly
      [/\bA07\s*(?:LTE|4G)\b/, 'A07_LTE'],
      [/\bA07\s*5G\b/, 'A07_5G'],
      [/\bA07\b/, 'A07_BASE'],

      [/\bA17\s*5G\b/, 'A17_5G'],
      [/\bA17\b/, 'A17_5G'],
      [/\bA26\s*5G\b/, 'A26_5G'],
      [/\bA26\b/, 'A26_5G'],
      [/\bA36\s*5G\b/, 'A36_5G'],
      [/\bA36\b/, 'A36_5G'],
      [/\bA56\s*5G\b/, 'A56_5G'],
      [/\bA56\b/, 'A56_5G'],

      [/\bZ?\s*FOLD\s*8\s*ULTRA\b/, 'FOLD8_ULTRA'],
      [/\bZ?\s*FOLD\s*8\b/, 'FOLD8'],
      [/\bZ?\s*FLIP\s*8\b/, 'FLIP8'],
      [/\bZ?\s*FOLD\s*7\b/, 'FOLD7'],
      [/\bZ?\s*FLIP\s*7\b/, 'FLIP7'],
      [/\bZ?\s*FOLD\s*6\b/, 'FOLD6'],
      [/\bZ?\s*FLIP\s*6\b/, 'FLIP6'],
    ];

    for (const [pattern, family] of rules) {
      if (pattern.test(text)) {
        return family;
      }
    }

    return null;
  }

  /**
   * Capacity Normalizer
   * Extracts canonical storage (32GB, 64GB, 128GB, 256GB, 512GB, 1TB, 2TB)
   */
  function normalizeCapacity(value) {
    const text = String(value || '')
      .toUpperCase()
      .replace(/\s+/g, '');

    const match = text.match(/(?:\d+\/)?(32GB|64GB|128GB|256GB|512GB|1TB|2TB)\b/);
    return match ? match[1] : null;
  }

  /**
   * 4-Tier Semantic Gate: Validate Promotion Target against Active Stock Item
   * Tier 1: EXACT_PN_EXISTS
   * Tier 2: PRODUCT_TYPE_MATCH
   * Tier 3: MODEL_FAMILY_MATCH
   * Tier 4: CAPACITY_MATCH
   */
  function validatePromotionTarget(promotion, stockItem) {
    if (!stockItem) {
      return {
        allowed: false,
        code: 'EXACT_PN_NOT_FOUND',
        message: 'ไม่พบ P/N นี้ในสต็อก Active ปัจจุบัน',
        gatePassed: false,
        failedTier: 1
      };
    }

    const stockCategory = String(
      stockItem.category ||
      stockItem.cat1 ||
      stockItem.category1 ||
      ''
    ).toUpperCase();

    if (!stockCategory.includes('SMART')) {
      return {
        allowed: false,
        code: 'PRODUCT_TYPE_MISMATCH',
        message: 'สินค้าในสต็อกไม่ใช่ประเภท Smartphone',
        gatePassed: false,
        failedTier: 2
      };
    }

    const promotionModel = normalizeSamsungModelFamily(promotion.model || promotion.modelName || promotion.model_name);
    const stockModel = normalizeSamsungModelFamily(stockItem.description || stockItem.model);

    if (!promotionModel || !stockModel || promotionModel !== stockModel) {
      return {
        allowed: false,
        code: 'PROMOTION_TARGET_MODEL_MISMATCH',
        expectedModel: promotionModel,
        actualModel: stockModel,
        message: `รุ่นสินค้าไม่ตรงกัน: โปรโมชั่นคือ ${promotionModel || 'UNKNOWN'} แต่สต็อกคือ ${stockModel || 'UNKNOWN'}`,
        gatePassed: false,
        failedTier: 3
      };
    }

    const promotionCapacity = normalizeCapacity(promotion.capacity);
    const stockCapacity = normalizeCapacity(stockItem.description || stockItem.capacity);

    if (!promotionCapacity || !stockCapacity || promotionCapacity !== stockCapacity) {
      return {
        allowed: false,
        code: 'PROMOTION_TARGET_CAPACITY_MISMATCH',
        expectedCapacity: promotionCapacity,
        actualCapacity: stockCapacity,
        message: `ความจุไม่ตรงกัน: โปรโมชั่นระบุ ${promotionCapacity || 'UNKNOWN'} แต่สต็อกคือ ${stockCapacity || 'UNKNOWN'}`,
        gatePassed: false,
        failedTier: 4
      };
    }

    return {
      allowed: true,
      code: 'EXACT_TARGET_PASS',
      modelFamily: promotionModel,
      capacity: promotionCapacity,
      gatePassed: true
    };
  }

  /**
   * Source Fidelity Gate: Verifies that Offer strictly matches Excel Source without synthetic renaming
   * Excel Source Model == Offer Model == Stock Canonical Model Family
   * Excel Source Capacity == Offer Capacity == Stock Canonical Capacity
   */
  function validateSourceFidelity(excelSource, offerItem, stockItem) {
    const srcModel = String(excelSource?.model || excelSource?.sourceModelName || offerItem?.sourceModelName || offerItem?.model || '').trim();
    const offerModel = String(offerItem?.model || offerItem?.modelName || '').trim();
    const srcCap = normalizeCapacity(excelSource?.capacity || excelSource?.sourceCapacity || offerItem?.sourceCapacity || offerItem?.capacity);
    const offerCap = normalizeCapacity(offerItem?.capacity);

    const srcFamily = normalizeSamsungModelFamily(srcModel);
    const offerFamily = normalizeSamsungModelFamily(offerModel);
    const stockFamily = stockItem ? normalizeSamsungModelFamily(stockItem.description || stockItem.model) : null;
    const stockCap = stockItem ? normalizeCapacity(stockItem.description || stockItem.capacity) : null;

    if (!srcFamily || !offerFamily || srcFamily !== offerFamily) {
      return {
        allowed: false,
        code: 'SOURCE_MODEL_MUTATION_DETECTED',
        sourceModel: srcModel,
        offerModel: offerModel,
        message: `รุ่นในข้อเสนอไม่ตรงกับไฟล์ Excel ต้นทาง: Excel ระบุ [${srcModel}] แต่ข้อเสนอระบุ [${offerModel}] (ห้ามเปลี่ยนชื่อรุ่นอัตโนมัติ)`
      };
    }

    if (!srcCap || !offerCap || srcCap !== offerCap) {
      return {
        allowed: false,
        code: 'SOURCE_CAPACITY_MUTATION_DETECTED',
        sourceCapacity: srcCap,
        offerCapacity: offerCap,
        message: `ความจุในข้อเสนอไม่ตรงกับไฟล์ Excel ต้นทาง: Excel ระบุ [${srcCap}] แต่ข้อเสนอระบุ [${offerCap}]`
      };
    }

    if (!stockFamily || srcFamily !== stockFamily) {
      return {
        allowed: false,
        code: 'PROMOTION_TARGET_MODEL_NOT_IN_ACTIVE_STOCK',
        sourceModel: srcModel,
        actualStockModel: stockFamily || 'NOT_FOUND',
        message: `รุ่นสินค้า [${srcModel}] ไม่มีอยู่ใน Active Stock ของสาขา (ไม่อนุญาตให้สร้าง Offer เด็ดขาด)`
      };
    }

    if (!stockCap || srcCap !== stockCap) {
      return {
        allowed: false,
        code: 'PROMOTION_TARGET_CAPACITY_NOT_IN_ACTIVE_STOCK',
        sourceCapacity: srcCap,
        actualStockCapacity: stockCap || 'NOT_FOUND',
        message: `ความจุ [${srcCap}] ของรุ่น [${srcModel}] ไม่มีอยู่ใน Active Stock ของสาขา`
      };
    }

    return {
      allowed: true,
      code: 'SOURCE_FIDELITY_PASS',
      canonicalFamily: srcFamily,
      canonicalCapacity: srcCap
    };
  }

  /**
   * Normalize color string for tokenization (e.g. "Awesome Navy" -> "AWESOME_NAVY")
   */
  function normalizeColorToken(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
  }

  /**
   * Normalize color string for fuzzy substring matching (e.g. "Sky-Blue " -> "SKYBLUE")
   */
  function normalizeColor(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[\s_-]+/g, "");
  }

  /**
   * Detect Promotion Color Scope from source row data
   * - SPECIFIC_COLOR: Explicit color given in source file
   * - ALL_COLORS: File states all colors, or no color column/restriction is specified
   * - REVIEW_REQUIRED: Ambiguous text regarding colors without specific color name
   */
  function detectPromotionColorScope({ sourceColor, sourceText }) {
    const explicitColor = String(sourceColor || "").trim();

    if (explicitColor) {
      return {
        colorScope: "SPECIFIC_COLOR",
        sourceColor: normalizeColorToken(explicitColor),
        confidence: 100,
        reason: "สีถูกระบุในช่องสีของไฟล์ต้นทาง"
      };
    }

    const text = String(sourceText || "").trim().toUpperCase();

    const allColorsPatterns = [
      /ทุกสี/,
      /ALL\s*COLORS?/,
      /ANY\s*COLOR/
    ];

    if (allColorsPatterns.some((pattern) => pattern.test(text))) {
      return {
        colorScope: "ALL_COLORS",
        sourceColor: null,
        confidence: 100,
        reason: "ไฟล์ระบุว่าโปรโมชั่นใช้ได้ทุกสี"
      };
    }

    const ambiguousPatterns = [
      /สีที่ร่วมรายการ/,
      /เฉพาะสีที่กำหนด/,
      /บางสีเท่านั้น/,
      /ยกเว้นบางสี/,
      /สีที่กำหนด/
    ];

    if (ambiguousPatterns.some((pattern) => pattern.test(text))) {
      return {
        colorScope: "REVIEW_REQUIRED",
        sourceColor: null,
        confidence: 60,
        reason: "ไฟล์ระบุข้อจำกัดด้านสี แต่ไม่พบชื่อสีที่ชัดเจน"
      };
    }

    /*
     * ถ้าแถวต้นทางไม่มีคอลัมน์สีและไม่มีข้อความจำกัดสี
     * ให้ถือว่าโปรโมชั่นระดับรุ่น/ความจุใช้กับทุกสี
     */
    return {
      colorScope: "ALL_COLORS",
      sourceColor: null,
      confidence: 95,
      reason: "ไฟล์ไม่ได้ระบุสี จึงใช้กับทุกสีของรุ่นและความจุเดียวกัน"
    };
  }

  /**
   * Tier 5: Validate Promotion Color Scope
   * Standard 3 Scopes:
   * - ALL_COLORS: Any color candidate matching model & capacity is allowed
   * - SPECIFIC_COLOR: Candidate stockItem color/description must match sourceColor
   * - REVIEW_REQUIRED: Ambiguous scope, candidate quarantined
   */
  function validateColorScope(promotion, stockItem) {
    if (!stockItem) {
      return {
        allowed: false,
        code: 'STOCK_ITEM_MISSING'
      };
    }

    const scope = String(
      promotion?.colorScope || "REVIEW_REQUIRED"
    ).toUpperCase();

    if (scope === "ALL_COLORS") {
      return {
        allowed: true,
        code: "COLOR_SCOPE_ALL_COLORS",
        expectedColor: null,
        actualColor: stockItem?.color || null
      };
    }

    if (scope === "SPECIFIC_COLOR") {
      const expectedColor = normalizeColor(
        promotion?.sourceColor
      );

      const actualColor = normalizeColor(
        stockItem?.color ||
        stockItem?.description
      );

      if (!expectedColor) {
        return {
          allowed: false,
          code: "SOURCE_COLOR_REQUIRED"
        };
      }

      if (!actualColor.includes(expectedColor)) {
        return {
          allowed: false,
          code: "COLOR_MISMATCH",
          expectedColor: promotion?.sourceColor,
          actualColor: stockItem?.color || null
        };
      }

      return {
        allowed: true,
        code: "SPECIFIC_COLOR_MATCH"
      };
    }

    return {
      allowed: false,
      code: "COLOR_SCOPE_REVIEW_REQUIRED"
    };
  }

  /**
   * Evaluate Composite Promotion Verification Gate
   * Decouples:
   * 1. READY_FOR_MANAGER_REVIEW: Draft is saved and ready for human inspection
   * 2. READY_FOR_APPROVAL: All 5 tiers + source fidelity + parser evidence pass AND openBlockers === 0 AND openReviews === 0
   * 3. READY_TO_ACTIVATE: Approved by manager and expectedPreviousCampaignId matches
   */
  function evaluatePromotionCompositeGate({
    draftSaved = false,
    hasSourceEvidence = true,
    sourceEvidenceFromParser = false,
    exactPnPass = false,
    productTypePass = false,
    modelPass = false,
    capacityPass = false,
    colorScopePass = true,
    sourceFidelityPass = false,
    openBlockers = 0,
    openReviews = 0,
    campaignStatus = 'DRAFT',
    expectedPreviousMatched = true
  }) {
    const exactTargetPass = exactPnPass && productTypePass && modelPass && capacityPass && colorScopePass;
    const sourceEvidencePass = hasSourceEvidence && sourceEvidenceFromParser;
    const readyForManagerReview = draftSaved && hasSourceEvidence;
    const readyForApproval = draftSaved && exactTargetPass && sourceFidelityPass && sourceEvidencePass && openBlockers === 0 && openReviews === 0;
    const readyToActivate = readyForApproval && campaignStatus === 'APPROVED' && expectedPreviousMatched;

    return {
      DRAFT_SAVE_GATE: draftSaved ? 'PASS' : 'FAIL',
      EXACT_PN_GATE: exactPnPass ? 'PASS' : 'FAIL',
      PRODUCT_TYPE_GATE: productTypePass ? 'PASS' : 'FAIL',
      MODEL_GATE: modelPass ? 'PASS' : 'FAIL',
      CAPACITY_GATE: capacityPass ? 'PASS' : 'FAIL',
      COLOR_SCOPE_GATE: colorScopePass ? 'PASS' : 'FAIL',
      SOURCE_FIDELITY_GATE: sourceFidelityPass ? 'PASS' : 'FAIL',
      SOURCE_EVIDENCE_GATE: sourceEvidencePass ? 'PARSER_VERIFIED' : (hasSourceEvidence ? 'MANUALLY_BACKFILLED' : 'MISSING'),
      EXACT_TARGET_GATE: exactTargetPass ? 'EXACT_TARGET_GATE_PASS' : 'EXACT_TARGET_GATE_FAIL',
      OPEN_BLOCKERS: openBlockers,
      OPEN_REVIEWS: openReviews,
      READY_FOR_MANAGER_REVIEW: readyForManagerReview ? 'YES' : 'NO',
      READY_FOR_APPROVAL: readyForApproval ? 'YES' : 'NO',
      READY_TO_ACTIVATE: readyToActivate ? 'YES' : 'NO',
      databaseAction: exactTargetPass && sourceFidelityPass ? 'PERMIT' : 'QUARANTINE'
    };
  }

  // Export for browser & node
  const api = {
    calculatePromotionPrices,
    calculateS25FePromotion,
    calculateA57Promotion,
    calculateStudentPromotion,
    validatePromotionGates,
    validatePromotionOption,
    normalizeSamsungModelFamily,
    normalizeCapacity,
    normalizeColorToken,
    normalizeColor,
    detectPromotionColorScope,
    parsePromotionProductHeading,
    validatePromotionTarget,
    validateSourceFidelity,
    validateColorScope,
    evaluatePromotionCompositeGate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.PromotionCalculator = api;
  }
})(typeof window !== 'undefined' ? window : global);

