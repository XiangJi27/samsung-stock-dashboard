/**
 * Samsung Branch Operations - Enterprise Promotion Knowledge Base & Learning System
 * Governs coupon registry, stacking policies, conflict resolution, manager semantic correction rules,
 * and AI draft boundary enforcement (Zero Hallucination / Fail-Closed).
 */

(function (global) {
  'use strict';

  // 1. MASTER PROMOTION TYPES
  const PROMOTION_TYPES = {
    STANDARD_DISCOUNT: 'STANDARD_DISCOUNT',
    TRADE_UP_CONDITIONAL: 'TRADE_UP_CONDITIONAL',
    TRADE_UP_ONLY: 'TRADE_UP_ONLY',
    SF_PLUS_FINANCING: 'SF_PLUS_FINANCING',
    NON_SF_PLUS_DISCOUNT: 'NON_SF_PLUS_DISCOUNT',
    STUDENT_EXCLUSIVE: 'STUDENT_EXCLUSIVE'
  };

  // 2. STACKING POLICIES
  const STACKING_POLICIES = {
    STACKABLE: 'STACKABLE',
    STACKABLE_CONDITIONAL: 'STACKABLE_CONDITIONAL',
    MUTUALLY_EXCLUSIVE: 'MUTUALLY_EXCLUSIVE',
    EXCLUSIVE: 'EXCLUSIVE'
  };

  // 3. MASTER COUPON REGISTRY
  const COUPON_REGISTRY = {
    COUPON_01: {
      code: 'COUPON_01',
      displayName: 'คูปอง 01',
      type: PROMOTION_TYPES.STANDARD_DISCOUNT,
      stackingPolicy: STACKING_POLICIES.STACKABLE_CONDITIONAL,
      description: 'ส่วนลดโปรโมชั่นปกติ ต่อที่ 1 (สามารถรวม Trade Up ต่อที่ 2 ได้)'
    },
    COUPON_02: {
      code: 'COUPON_02',
      displayName: 'คูปอง 02',
      type: PROMOTION_TYPES.NON_SF_PLUS_DISCOUNT,
      stackingPolicy: STACKING_POLICIES.MUTUALLY_EXCLUSIVE,
      exclusiveGroup: 'S25FE_PAYMENT_PATH',
      description: 'โปรโมชั่นสำหรับลูกค้าที่ไม่ใช้ SF+ (ห้ามใช้คู่กับ SF+)'
    },
    Studentcrd: {
      code: 'Studentcrd',
      displayName: 'โปรนักเรียน/นักศึกษา (Studentcrd)',
      type: PROMOTION_TYPES.STUDENT_EXCLUSIVE,
      customerSegment: 'STUDENT',
      discountPercent: 15,
      stackingPolicy: STACKING_POLICIES.EXCLUSIVE,
      blocksAllOtherPromotions: true,
      description: 'ลด 15% จากราคาปกติ ไม่ร่วมคูปอง 01, 02, Trade Up, SF+ หรือโปรอื่นใด'
    },
    'T-UP-CO-S': {
      code: 'T-UP-CO-S',
      displayName: 'ส่วนลด Trade Up (เก่าแลกใหม่)',
      type: PROMOTION_TYPES.TRADE_UP_CONDITIONAL,
      requiresTradeIn: true,
      stackingPolicy: STACKING_POLICIES.STACKABLE_CONDITIONAL,
      description: 'Campaign Code ส่วนลด Trade Up ต่อที่ 2 (ไม่ใช่คูปองส่วนลดปกติ)'
    }
  };

  // 4. BUILT-IN INITIAL CORRECTION RULES (Knowledge Base Baseline)
  const INITIAL_CORRECTION_RULES = [
    {
      id: 'RULE-SEM-001',
      correctionType: 'SEMANTIC_MAPPING',
      sourceTextPattern: 'SF+ ดาวน์ไม่เกิน 5%',
      incorrectField: 'standardDiscount',
      correctField: 'estimatedDownPayment',
      targetDownPaymentPercent: 5,
      approvedBy: 'STORE_LEADER',
      status: 'ACTIVE_RULE'
    },
    {
      id: 'RULE-SEM-002',
      correctionType: 'SEMANTIC_MAPPING',
      sourceTextPattern: 'SF+ ดาวน์ไม่เกิน 10%',
      incorrectField: 'standardDiscount',
      correctField: 'estimatedDownPayment',
      targetDownPaymentPercent: 10,
      approvedBy: 'STORE_LEADER',
      status: 'ACTIVE_RULE'
    },
    {
      id: 'RULE-SEM-003',
      correctionType: 'COUPON_ALIAS',
      sourceTextPattern: 'T-UP-CO-S',
      incorrectField: 'standardDiscountCoupon',
      correctField: 'tradeUpCampaignCode',
      approvedBy: 'STORE_LEADER',
      status: 'ACTIVE_RULE'
    },
    {
      id: 'RULE-SEM-004',
      correctionType: 'EXCLUSIVITY_OVERRIDE',
      sourceTextPattern: 'ไม่สามารถใช้ร่วมกับ SF+ ได้',
      paymentCondition: 'NON_SF_PLUS',
      stackingPolicy: STACKING_POLICIES.MUTUALLY_EXCLUSIVE,
      exclusiveGroup: 'PAYMENT_PATH',
      approvedBy: 'STORE_LEADER',
      status: 'ACTIVE_RULE'
    },
    {
      id: 'RULE-SEM-005',
      correctionType: 'EXCLUSIVITY_OVERRIDE',
      sourceTextPattern: 'โปรนักเรียนไม่ร่วมกับส่วนลดหรือโปรใดๆ',
      promotionType: PROMOTION_TYPES.STUDENT_EXCLUSIVE,
      stackingPolicy: STACKING_POLICIES.EXCLUSIVE,
      blocksAllOtherPromotions: true,
      approvedBy: 'STORE_LEADER',
      status: 'ACTIVE_RULE'
    }
  ];

  // In-memory active correction store (can be extended at runtime by manager actions)
  let activeCorrectionRules = [...INITIAL_CORRECTION_RULES];

  /**
   * Promotion Knowledge Base Service
   */
  const PromotionKnowledgeBase = {
    PROMOTION_TYPES,
    STACKING_POLICIES,
    COUPON_REGISTRY,

    /**
     * Get coupon definition
     */
    getCoupon(code) {
      if (!code) return null;
      const normalized = String(code).trim();
      return COUPON_REGISTRY[normalized] || null;
    },

    /**
     * Validate coupon usage against payment condition
     */
    validateCouponUsage(couponCode, paymentCondition) {
      const coupon = this.getCoupon(couponCode);
      if (!coupon) return { allowed: true };
      if (coupon.code === 'COUPON_02' && paymentCondition === 'SF_PLUS') {
        return { allowed: false, reason: 'คูปอง 02 ไม่สามารถใช้ร่วมกับสัญญา SF+ ได้ (เฉพาะ NON-SF+)' };
      }
      if (coupon.code === 'COUPON_01' && paymentCondition === 'NON_SF_PLUS') {
        return { allowed: false, reason: 'คูปอง 01 ไม่สามารถใช้ร่วมกับสัญญา NON-SF+ ได้' };
      }
      return { allowed: true };
    },

    /**
     * Alias for applyKnowledgeBaseCorrections
     */
    applySemanticCorrections(draftOffer) {
      return this.applyKnowledgeBaseCorrections(draftOffer);
    },

    /**
     * Retrieve active correction rules
     */
    getActiveCorrectionRules() {
      return [...activeCorrectionRules];
    },

    /**
     * Register a new approved correction rule (Learned from Manager)
     */
    addCorrectionRule(rule) {
      if (!rule || !rule.sourceTextPattern) {
        throw new Error('Invalid correction rule: sourceTextPattern is required.');
      }
      const newRule = {
        id: rule.id || `RULE-MGR-${Date.now()}`,
        correctionType: rule.correctionType || 'SEMANTIC_MAPPING',
        sourceTextPattern: rule.sourceTextPattern,
        incorrectField: rule.incorrectField || null,
        correctField: rule.correctField || null,
        targetValue: rule.targetValue || null,
        scope: rule.scope || 'BRANCH_WIDE',
        approvedBy: rule.approvedBy || 'STORE_LEADER',
        approvedAt: new Date().toISOString(),
        status: 'ACTIVE_RULE'
      };
      activeCorrectionRules.push(newRule);
      return newRule;
    },

    /**
     * Apply Knowledge Base Semantic Corrections to an AI Draft Offer
     */
    applyKnowledgeBaseCorrections(draftOffer) {
      if (!draftOffer) return draftOffer;
      const offer = { ...draftOffer };
      const combinedText = [
        offer.sourceText || '',
        offer.remark || '',
        offer.couponCode || '',
        offer.rawNotes || ''
      ].join(' ');

      for (const rule of activeCorrectionRules) {
        if (rule.status !== 'ACTIVE_RULE') continue;

        if (combinedText.includes(rule.sourceTextPattern)) {
          // Rule 1: Reclassify down payment from discount
          if (rule.incorrectField === 'standardDiscount' && rule.correctField === 'estimatedDownPayment') {
            if (offer.standardDiscount > 0 && (!offer.estimatedDownPayment || offer.estimatedDownPayment === 0)) {
              offer.estimatedDownPayment = offer.standardDiscount;
              offer.standardDiscount = 0;
              offer.appliedCorrectionRuleId = rule.id;
              offer.correctionNote = `Reclassified standardDiscount to estimatedDownPayment based on [${rule.sourceTextPattern}]`;
            }
          }

          // Rule 2: Trade Up campaign code distinction
          if (rule.correctionType === 'COUPON_ALIAS' && rule.sourceTextPattern === 'T-UP-CO-S') {
            offer.promotionType = PROMOTION_TYPES.TRADE_UP_CONDITIONAL;
            offer.requiresTradeIn = true;
            offer.appliedCorrectionRuleId = rule.id;
          }

          // Rule 3: Payment path exclusivity
          if (rule.correctionType === 'EXCLUSIVITY_OVERRIDE') {
            if (rule.paymentCondition) offer.paymentCondition = rule.paymentCondition;
            if (rule.stackingPolicy) offer.stackingPolicy = rule.stackingPolicy;
            if (rule.exclusiveGroup) offer.exclusiveGroup = rule.exclusiveGroup;
            if (rule.blocksAllOtherPromotions !== undefined) {
              offer.blocksAllOtherPromotions = rule.blocksAllOtherPromotions;
            }
            offer.appliedCorrectionRuleId = rule.id;
          }
        }
      }

      return offer;
    },

    /**
     * AI Bounds Validator (Strict Zero-Hallucination & Fail-Closed Guard)
     * Checks if draft row has forbidden guesses or missing fields.
     */
    validateDraftBounds(rawRow) {
      const issues = [];

      // 1. Missing Exact P/N
      if (!rawRow.inventoryPn && !rawRow.pn) {
        issues.push({
          code: 'EXACT_PN_NOT_FOUND',
          severity: 'REVIEW_REQUIRED',
          field: 'inventoryPn',
          message: 'ไม่พบ Exact P/N ในแถว ห้าม AI สุ่มจับคู่จากชื่อรุ่น'
        });
      }

      // 2. Missing Regular Price
      const price = Number(rawRow.regularPrice || rawRow.price || 0);
      if (price <= 0 || isNaN(price)) {
        issues.push({
          code: 'REGULAR_PRICE_INVALID',
          severity: 'BLOCKER',
          field: 'regularPrice',
          message: 'ราคาปกติไม่ถูกต้องหรือเป็นศูนย์'
        });
      }

      // 3. Unspecified discount when row mentions promo
      if (rawRow.hasPromoMention && (!rawRow.discountAmount && !rawRow.discountPercent)) {
        issues.push({
          code: 'DISCOUNT_NOT_SPECIFIED',
          severity: 'REVIEW_REQUIRED',
          field: 'discountAmount',
          message: 'เซลล์ส่วนลดว่าง ห้าม AI เดาส่วนลดจากรุ่นใกล้เคียง'
        });
      }

      // 4. Trade Up stated without Trade In requirement
      if ((rawRow.tradeUpDiscount || 0) > 0 && !rawRow.requiresTradeIn) {
        issues.push({
          code: 'TRADE_UP_REQUIREMENT_MISSING',
          severity: 'BLOCKER',
          field: 'requiresTradeIn',
          message: 'ส่วนลด Trade Up ต้องระบุเงื่อนไขนำเครื่องมา Trade Up เสมอ'
        });
      }

      return {
        isValid: issues.filter(i => i.severity === 'BLOCKER').length === 0,
        needsReview: issues.some(i => i.severity === 'REVIEW_REQUIRED'),
        issues
      };
    },

    /**
     * Calculate AI Confidence Score (95-100, 80-94, 60-79, <60)
     */
    calculateConfidenceScore(offer, validationIssues = []) {
      const blockers = validationIssues.filter(i => i.severity === 'BLOCKER');
      const reviews = validationIssues.filter(i => i.severity === 'REVIEW_REQUIRED');
      const warnings = validationIssues.filter(i => i.severity === 'WARNING');

      if (blockers.length > 0) {
        return {
          score: 50,
          tier: 'BLOCKED',
          label: 'ต่ำกว่า 60 (ไม่อนุญาตให้นำเข้า)',
          badgeClass: 'badge-danger',
          reasons: blockers.map(b => b.message)
        };
      }

      if (reviews.length > 0) {
        return {
          score: 75,
          tier: 'REVIEW_REQUIRED',
          label: '60–79 (ต้องให้ผู้จัดการตรวจ)',
          badgeClass: 'badge-warning',
          reasons: reviews.map(r => r.message)
        };
      }

      if (warnings.length > 0 || !offer.inventoryPn) {
        return {
          score: 88,
          tier: 'MEDIUM',
          label: '80–94 (ตีความได้ มีเงื่อนไขใหม่)',
          badgeClass: 'badge-info',
          reasons: warnings.map(w => w.message)
        };
      }

      // Exact match with master coupon and clear formula
      return {
        score: 98,
        tier: 'HIGH',
        label: '95–100 (รูปแบบตรงกับกฎเดิม สูตรถูกต้อง)',
        badgeClass: 'badge-success',
        reasons: ['สูตรและโครงสร้างโปรโมชั่นตรงกับ Master Knowledge Base ครบถ้วน']
      };
    },

    /**
     * Resolve Multi-path Promotion Eligibility for a Customer Context
     * Separates Exclusive paths (Student, Payment Method) from Stackable ones.
     */
    resolvePromotions({ offers, customerSegment = 'GENERAL', paymentMethod = 'ANY', hasTradeIn = false }) {
      if (!Array.isArray(offers) || offers.length === 0) {
        return {
          selectedOffers: [],
          blockedOffers: [],
          resolution: 'NO_OFFERS',
          netPrice: 0
        };
      }

      // 1. Filter strictly eligible offers based on context
      const eligible = offers.filter((offer) => {
        // Customer segment check
        if (offer.customerSegment === 'STUDENT' && customerSegment !== 'STUDENT') {
          return false;
        }

        // Payment condition check
        if (offer.paymentCondition === 'SF_PLUS' && paymentMethod !== 'SF_PLUS') {
          return false;
        }
        if (offer.paymentCondition === 'NON_SF_PLUS' && paymentMethod === 'SF_PLUS') {
          return false;
        }

        // Trade-in requirement check
        if (offer.requiresTradeIn && !hasTradeIn) {
          return false;
        }

        return true;
      });

      // 2. Check for EXCLUSIVE offers (e.g. Studentcrd 15%)
      const exclusiveOffers = eligible.filter(
        (o) => o.stackingPolicy === STACKING_POLICIES.EXCLUSIVE || o.blocksAllOtherPromotions
      );

      if (exclusiveOffers.length > 0) {
        // Highest priority exclusive offer wins (lowest priority number)
        const selectedExclusive = [...exclusiveOffers].sort(
          (a, b) => (a.priority || 100) - (b.priority || 100)
        )[0];

        const blocked = eligible.filter(o => o.id !== selectedExclusive.id);

        return {
          selectedOffers: [selectedExclusive],
          blockedOffers: blocked,
          resolution: 'EXCLUSIVE_PATH',
          policy: 'EXCLUSIVE'
        };
      }

      // 3. Check for MUTUALLY_EXCLUSIVE groups (e.g. SF+ vs Non-SF+)
      const groups = {};
      const standalone = [];

      for (const offer of eligible) {
        if (offer.exclusiveGroup && offer.stackingPolicy === STACKING_POLICIES.MUTUALLY_EXCLUSIVE) {
          if (!groups[offer.exclusiveGroup]) groups[offer.exclusiveGroup] = [];
          groups[offer.exclusiveGroup].push(offer);
        } else {
          standalone.push(offer);
        }
      }

      const selected = [...standalone];
      const blocked = [];

      // Pick at most one offer per exclusive group based on priority
      for (const groupKey in groups) {
        const groupOffers = groups[groupKey];
        groupOffers.sort((a, b) => (a.priority || 100) - (b.priority || 100));
        selected.push(groupOffers[0]);
        for (let i = 1; i < groupOffers.length; i++) {
          blocked.push(groupOffers[i]);
        }
      }

      return {
        selectedOffers: selected,
        blockedOffers: blocked,
        resolution: 'STACKED_PATH',
        policy: 'STACKABLE_CONDITIONAL'
      };
    }
  };

  // Export to browser global and CommonJS for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PromotionKnowledgeBase;
  } else {
    global.PromotionKnowledgeBase = PromotionKnowledgeBase;
  }
})(typeof window !== 'undefined' ? window : globalThis);
