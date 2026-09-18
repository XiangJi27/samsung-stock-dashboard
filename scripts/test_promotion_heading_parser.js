"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parsePromotionProductHeading,
  parsePaymentCondition,
  extractStoreScope,
  extractDownPayment,
  validateTradeUpPaymentCode,
  validateTradeUpOffer,
  calculateTradeUpBenefit,
  normalizeSamsungModelFamily,
  normalizeMemoryMatch,
  findPromotionDate,
  containsUnparsedConditionNoise
} = require("../assets/js/promotion-heading-parser.js");

test("แยก Galaxy A37 5G ร่วม SF+ ได้ถูกต้อง", () => {
  const result = parsePromotionProductHeading(
    "Galaxy A37 5G ร่วม SF+ (8/256GB)"
  );

  assert.equal(result.model, "Galaxy A37 5G");
  assert.equal(result.modelFamily, "A37_5G");
  assert.equal(result.ram, "8GB");
  assert.equal(result.capacity, "256GB");
  assert.equal(result.memory, "8/256GB");
  assert.equal(result.paymentCondition, "SF_PLUS");
  assert.equal(result.saleMode, "SF_PLUS");
  assert.equal(result.promotionType, "SF_PLUS_FINANCING");
  assert.equal(result.parsingStatus, "PARSED");
});

test("แยก Galaxy A37 5G ไม่ร่วม SF+ ได้ถูกต้อง", () => {
  const result = parsePromotionProductHeading(
    "Galaxy A37 5G ไม่ร่วม SF+ (8/256GB)"
  );

  assert.equal(result.model, "Galaxy A37 5G");
  assert.equal(result.modelFamily, "A37_5G");
  assert.equal(result.paymentCondition, "NON_SF_PLUS");
  assert.equal(result.saleMode, "NON_SF_PLUS");
  assert.equal(result.promotionType, "NON_SF_PLUS_DISCOUNT");
  assert.equal(result.capacity, "256GB");
});

test("ต้องตรวจไม่ร่วม SF+ ก่อนร่วม SF+", () => {
  const result = parsePaymentCondition(
    "Galaxy A37 5G ไม่ร่วม SF+"
  );

  assert.equal(result.paymentCondition, "NON_SF_PLUS");
  assert.equal(result.modelText, "Galaxy A37 5G");
});

test("แยก A27 5G ร่วม SF+ ในวงเล็บ", () => {
  const result = parsePromotionProductHeading(
    "Galaxy A27 5G (ร่วม SF+) (8/128GB)"
  );

  assert.equal(result.model, "Galaxy A27 5G");
  assert.equal(result.modelFamily, "A27_5G");
  assert.equal(result.ram, "8GB");
  assert.equal(result.capacity, "128GB");
  assert.equal(result.paymentCondition, "SF_PLUS");
  assert.equal(result.promotionType, "SF_PLUS_FINANCING");
  assert.equal(result.parsingStatus, "PARSED");
});

test("แยก A27 5G ไม่ร่วม SF+ ในวงเล็บ", () => {
  const result = parsePromotionProductHeading(
    "Galaxy A27 5G (ไม่ร่วม SF+) (8/128GB)"
  );

  assert.equal(result.model, "Galaxy A27 5G");
  assert.equal(result.modelFamily, "A27_5G");
  assert.equal(result.capacity, "128GB");
  assert.equal(result.paymentCondition, "NON_SF_PLUS");
  assert.equal(result.promotionType, "NON_SF_PLUS_DISCOUNT");
  assert.equal(result.parsingStatus, "PARSED");
});

test("ไม่ร่วม SF+ ในวงเล็บต้องไม่ถูกอ่านเป็นร่วม SF+", () => {
  const result = parsePaymentCondition(
    "Galaxy A27 5G (ไม่ร่วม SF+)"
  );

  assert.equal(result.paymentCondition, "NON_SF_PLUS");
  assert.equal(result.modelText, "Galaxy A27 5G");
});

test("แยก Flip8 ร้านค้าที่ร่วมรายการและเงินดาวน์", () => {
  const result = parsePromotionProductHeading(
    "สำหรับร้านค้าที่ร่วมรายการเท่านั้น Galaxy Z Flip8 ดาวน์ไม่เกิน10% (8/128GB)"
  );

  assert.equal(result.model, "Galaxy Z Flip8");
  assert.equal(result.modelFamily, "FLIP8");
  assert.equal(result.ram, "8GB");
  assert.equal(result.capacity, "128GB");
  assert.equal(result.storeScope, "PARTICIPATING_STORES_ONLY");
  assert.equal(result.downPaymentType, "MAX_PERCENT");
  assert.equal(result.downPaymentPercent, 10);
  assert.equal(result.parsingStatus, "PARSED");
});

test("แยก Flip8 สำหรับทุกหน้าร้าน", () => {
  const result = parsePromotionProductHeading(
    "สำหรับทุกหน้าร้าน Galaxy Z Flip8 (512GB)"
  );

  assert.equal(result.model, "Galaxy Z Flip8");
  assert.equal(result.modelFamily, "FLIP8");
  assert.equal(result.capacity, "512GB");
  assert.equal(result.storeScope, "ALL_STORES");
  assert.equal(result.parsingStatus, "PARSED");
});

test("Store Scope ต้องไม่เหลืออยู่ในชื่อรุ่น", () => {
  const result = parsePromotionProductHeading(
    "สำหรับทุกหน้าร้าน Galaxy Z Flip8 (512GB)"
  );

  assert.equal(result.model.includes("ทุกหน้าร้าน"), false);
});

test("เงื่อนไขเงินดาวน์ต้องไม่เหลือในชื่อรุ่น", () => {
  const result = parsePromotionProductHeading(
    "สำหรับร้านค้าที่ร่วมรายการเท่านั้น Galaxy Z Flip8 ดาวน์ไม่เกิน 10 % (8/128GB)"
  );

  assert.equal(result.model.includes("ดาวน์"), false);
});

test("รองรับช่องว่างและเครื่องหมายบวกหลายรูปแบบ", () => {
  const samples = [
    "Galaxy A37 5G ร่วมSF+ 8/256GB",
    "Galaxy A37 5G ร่วม SF + 8+256GB",
    "Galaxy A37 5G ใช้สิทธิ์ SF+ 8 / 256 GB",
    "Galaxy A37 5G ชำระผ่าน SF+ (8/256GB)"
  ];

  for (const sample of samples) {
    const result = parsePromotionProductHeading(sample);

    assert.equal(result.model, "Galaxy A37 5G", sample);
    assert.equal(result.paymentCondition, "SF_PLUS", sample);
    assert.equal(result.capacity, "256GB", sample);
    assert.equal(result.parsingStatus, "PARSED", sample);
  }
});

test("รองรับ Non-SF+ หลายรูปแบบ รวมถึงข้อความในไฟล์จริง", () => {
  const samples = [
    "Galaxy A37 5G ไม่ร่วมSF+ 8/256GB",
    "Galaxy A37 5G ไม่ ร่วม SF + 8+256GB",
    "Galaxy A37 5G ไม่ใช้ SF+ 8/256GB",
    "Galaxy A37 5G ไม่ใช้สิทธิ์ SF+ 8/256GB",
    "Galaxy A37 5G ชำระแบบไม่ใช้ SF+ 8/256GB",
    "Galaxy A37 5G ไม่สามารถใช้ร่วมกับ SF+ ได้ 8/256GB"
  ];

  for (const sample of samples) {
    const result = parsePromotionProductHeading(sample);

    assert.equal(result.model, "Galaxy A37 5G", sample);
    assert.equal(result.paymentCondition, "NON_SF_PLUS", sample);
    assert.equal(result.capacity, "256GB", sample);
    assert.equal(result.parsingStatus, "PARSED", sample);
  }
});

test("แยกวันที่ออกจากชื่อรุ่น", () => {
  const result = parsePromotionProductHeading(
    "Galaxy A37 5G ร่วม SF+ 7-13 กันยายน 2569 (8/256GB)"
  );

  assert.equal(result.model, "Galaxy A37 5G");
  assert.equal(result.promotionDateText, "7-13 กันยายน 2569");
  assert.equal(result.promotionDateType, "SAME_MONTH_RANGE");
});

test("รองรับวันที่ข้ามเดือน", () => {
  const result = parsePromotionProductHeading(
    "28 สิงหาคม - 6 กันยายน 2569 | Galaxy A37 5G | ร่วม SF+ | 8/256GB"
  );

  assert.equal(result.model, "Galaxy A37 5G");
  assert.equal(result.paymentCondition, "SF_PLUS");
  assert.equal(result.promotionDateType, "CROSS_MONTH_RANGE");
  assert.equal(result.capacity, "256GB");
});

test("ไม่ลบเครื่องหมายบวกในชื่อ Galaxy S26+", () => {
  const result = parsePromotionProductHeading(
    "Galaxy S26+ ไม่ร่วม SF+ 12+512GB"
  );

  assert.equal(result.model, "Galaxy S26+");
  assert.equal(result.modelFamily, "S26_PLUS");
  assert.equal(result.memory, "12/512GB");
  assert.equal(result.paymentCondition, "NON_SF_PLUS");
});

test("แยก S26 Ultra และความจุ 512GB", () => {
  const result = parsePromotionProductHeading(
    "Samsung Galaxy S26 Ultra 5G ร่วม SF+ 12/512GB"
  );

  assert.equal(result.model, "Samsung Galaxy S26 Ultra 5G");
  assert.equal(result.modelFamily, "S26_ULTRA");
  assert.equal(result.capacity, "512GB");
});

test("แยก S26 FE ที่มีเฉพาะความจุ", () => {
  const result = parsePromotionProductHeading(
    "Galaxy S26 FE NEW ไม่ร่วม SF+ 128GB"
  );

  assert.equal(result.model, "Galaxy S26 FE NEW");
  assert.equal(result.modelFamily, "S26_FE");
  assert.equal(result.ram, null);
  assert.equal(result.capacity, "128GB");
});

test("แยก Fold8 และ Trade Up Only", () => {
  const result = parsePromotionProductHeading(
    "Galaxy Z Fold8 16/1TB Trade Up Only 7 ถึง 13 กันยายน 2569"
  );

  assert.equal(result.model, "Galaxy Z Fold8");
  assert.equal(result.modelFamily, "FOLD8");
  assert.equal(result.ram, "16GB");
  assert.equal(result.capacity, "1TB");
  assert.deepEqual(result.additionalConditions, [
    {
      code: "TRADE_UP_ONLY",
      text: "Trade Up Only"
    }
  ]);
});

test("แยก A07 LTE พร้อมวันที่", () => {
  const result = parsePromotionProductHeading(
    "Galaxy A07 LTE 7 - 13 กันยายน 2569 (4/64GB)"
  );

  assert.equal(result.model, "Galaxy A07 LTE");
  assert.equal(result.modelFamily, "A07_LTE");
  assert.equal(result.ram, "4GB");
  assert.equal(result.capacity, "64GB");
  assert.equal(result.parsingStatus, "PARSED");
});

test("แยก A07 5G ออกจาก A07 LTE", () => {
  assert.equal(normalizeSamsungModelFamily("Galaxy A07 LTE"), "A07_LTE");
  assert.equal(normalizeSamsungModelFamily("Galaxy A07 5G"), "A07_5G");
  assert.notEqual(
    normalizeSamsungModelFamily("Galaxy A07 LTE"),
    normalizeSamsungModelFamily("Galaxy A07 5G")
  );
});

test("แยก A37 5G ออกจาก A37 LTE", () => {
  assert.equal(normalizeSamsungModelFamily("Galaxy A37 5G"), "A37_5G");
  assert.equal(normalizeSamsungModelFamily("Galaxy A37 LTE"), "A37_LTE");
});

test("แยก A27 5G ออกจาก A27 LTE", () => {
  assert.equal(normalizeSamsungModelFamily("Galaxy A27 5G"), "A27_5G");
  assert.equal(normalizeSamsungModelFamily("Galaxy A27 LTE"), "A27_LTE");
});

test("SF+ ที่ไม่มีคำว่าร่วมหรือไม่ร่วมต้องกักกัน", () => {
  const result = parsePromotionProductHeading(
    "Galaxy A37 5G SF+ (8/256GB)"
  );

  assert.equal(result.parsingStatus, "REVIEW_REQUIRED");
  assert.equal(result.errorCode, "AMBIGUOUS_SF_PLUS_CONDITION");
  assert.equal(result.databaseAction, "DO_NOT_INSERT_OFFER");
});

test("ข้อความว่างต้องกักกัน", () => {
  const result = parsePromotionProductHeading("");

  assert.equal(result.parsingStatus, "REVIEW_REQUIRED");
  assert.equal(result.errorCode, "EMPTY_PRODUCT_HEADING");
});

test("รุ่นไม่รู้จักต้องกักกัน", () => {
  const result = parsePromotionProductHeading(
    "Galaxy Unknown Future Phone ร่วม SF+ 8/256GB"
  );

  assert.equal(result.parsingStatus, "REVIEW_REQUIRED");
  assert.equal(result.errorCode, "UNKNOWN_MODEL_FAMILY");
});

test("Trade Up Payment Code Validation", () => {
  const valid = validateTradeUpPaymentCode("TUP-01");
  assert.equal(valid.valid, true);
  assert.equal(valid.normalizedCode, "TUP-01");

  const invalid = validateTradeUpPaymentCode("");
  assert.equal(invalid.valid, false);
  assert.equal(invalid.code, "TRADE_UP_PAYMENT_CODE_REQUIRED");

  const badFormat = validateTradeUpPaymentCode("?");
  assert.equal(badFormat.valid, false);
  assert.equal(badFormat.code, "INVALID_TRADE_UP_PAYMENT_CODE_FORMAT");
});

test("รองรับ RAM และ Storage ที่ถูกต้อง", () => {
  const validCases = [
    { input: "(4/64GB)", ram: "4GB", capacity: "64GB" },
    { input: "8+256GB", ram: "8GB", capacity: "256GB" },
    { input: "12 / 512 GB", ram: "12GB", capacity: "512GB" },
    { input: "16/1TB", ram: "16GB", capacity: "1TB" }
  ];

  for (const item of validCases) {
    const match = item.input.match(
      /\(?\s*(\d{1,2})\s*[\/+]\s*(32|64|128|256|512|1|2)\s*(GB|TB)\s*\)?/iu
    );
    const result = normalizeMemoryMatch(match);
    assert.equal(result.valid, true);
    assert.equal(result.ram, item.ram);
    assert.equal(result.capacity, item.capacity);
  }
});

test("ปฏิเสธค่าความจุที่หน่วยไม่สัมพันธ์กัน", () => {
  const match = "8/1GB".match(
    /\(?\s*(\d{1,2})\s*[\/+]\s*(32|64|128|256|512|1|2)\s*(GB|TB)\s*\)?/iu
  );
  const result = normalizeMemoryMatch(match);
  assert.equal(result.valid, false);
  assert.equal(result.errorCode, "INVALID_GB_STORAGE_VALUE");
});

test("ตรวจจับ Condition Noise ที่ยังหลงเหลือ", () => {
  assert.equal(containsUnparsedConditionNoise("Galaxy A37 5G ร่วม SF+"), true);
  assert.equal(containsUnparsedConditionNoise("Galaxy Z Flip8 ดาวน์ 10%"), true);
  assert.equal(containsUnparsedConditionNoise("Galaxy Z Flip8 ทุกหน้าร้าน"), true);
  assert.equal(containsUnparsedConditionNoise("Galaxy A37 5G"), false);
});

test("ตรวจจับช่วงวันที่ได้ถูกต้อง", () => {
  const sameMonth = findPromotionDate("Galaxy A37 5G 7-13 กันยายน 2569");
  assert.equal(sameMonth.type, "SAME_MONTH_RANGE");

  const crossMonth = findPromotionDate("28 สิงหาคม - 6 กันยายน 2569");
  assert.equal(crossMonth.type, "CROSS_MONTH_RANGE");

  const singleDate = findPromotionDate("วันที่ 7 กันยายน 2569");
  assert.equal(singleDate.type, "SINGLE_DATE");
});

test("ข้อความที่ไม่มี SF+ ใช้ Standard Payment", () => {
  const result = parsePromotionProductHeading("Galaxy A37 5G 8/256GB");
  assert.equal(result.paymentCondition, "ANY");
  assert.equal(result.saleMode, "STANDARD_PAYMENT");
  assert.equal(result.promotionType, "STANDARD_DISCOUNT");
});

test("Fold และ Flip ต้องเป็นคนละ Model Family", () => {
  assert.equal(normalizeSamsungModelFamily("Galaxy Z Fold8"), "FOLD8");
  assert.equal(normalizeSamsungModelFamily("Galaxy Z Flip8"), "FLIP8");
});

// Candidate Resolver Stock Target Matching Gate
function validateParsedTarget(promotion, stockItem) {
  if (!stockItem) {
    return { allowed: false, code: "EXACT_PN_NOT_FOUND" };
  }

  const category = String(stockItem.category || stockItem.cat1 || "").toUpperCase();
  if (!category.includes("SMART")) {
    return { allowed: false, code: "PRODUCT_TYPE_MISMATCH" };
  }

  const expectedFamily = normalizeSamsungModelFamily(promotion.model);
  const actualFamily = normalizeSamsungModelFamily(stockItem.description);

  if (!expectedFamily || expectedFamily !== actualFamily) {
    return {
      allowed: false,
      code: "PROMOTION_TARGET_MODEL_MISMATCH",
      expectedFamily,
      actualFamily
    };
  }

  const stockCapacityMatch = String(stockItem.description || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .match(/(?:\d+\/)?(32GB|64GB|128GB|256GB|512GB|1TB|2TB)/);

  const actualCapacity = stockCapacityMatch?.[1] || null;

  if (promotion.capacity !== actualCapacity) {
    return {
      allowed: false,
      code: "PROMOTION_TARGET_CAPACITY_MISMATCH",
      expectedCapacity: promotion.capacity,
      actualCapacity
    };
  }

  return { allowed: true, code: "EXACT_TARGET_PASS" };
}

test("A27 5G ต้องไม่จับคู่ A37 5G", () => {
  const promotion = parsePromotionProductHeading(
    "Galaxy A27 5G (ร่วม SF+) (8/128GB)"
  );

  const stockItem = {
    inventoryPn: "SM-A376B-TEST",
    description: "Samsung Galaxy A37 5G 8/128GB - Black",
    category: "SmartPhone"
  };

  const gate = validateParsedTarget(promotion, stockItem);
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "PROMOTION_TARGET_MODEL_MISMATCH");
});

test("Flip8 128GB ต้องไม่จับคู่ Flip8 512GB", () => {
  const promotion = parsePromotionProductHeading(
    "Galaxy Z Flip8 (8/128GB)"
  );

  const stockItem = {
    inventoryPn: "SM-F761B-512-TEST",
    description: "Samsung Galaxy Z Flip8 12/512GB - Black",
    category: "SmartPhone"
  };

  const gate = validateParsedTarget(promotion, stockItem);
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "PROMOTION_TARGET_CAPACITY_MISMATCH");
});

test("A37 5G ร่วม SF+ จับคู่ Stock รุ่นเดียวกันได้", () => {
  const promotion = parsePromotionProductHeading(
    "Galaxy A37 5G ร่วม SF+ (8/256GB)"
  );
  const stockItem = {
    inventoryPn: "SM-A376B-TEST",
    description: "Samsung Galaxy A37 5G 8/256GB - Black",
    category: "SmartPhone"
  };
  const gate = validateParsedTarget(promotion, stockItem);
  assert.equal(gate.allowed, true);
  assert.equal(gate.code, "EXACT_TARGET_PASS");
});

test("A37 5G ต้องไม่จับคู่ A07 5G", () => {
  const promotion = parsePromotionProductHeading(
    "Galaxy A37 5G ร่วม SF+ (8/256GB)"
  );
  const stockItem = {
    inventoryPn: "SM-A076B-TEST",
    description: "Samsung Galaxy A07 5G 8/256GB - Black",
    category: "SmartPhone"
  };
  const gate = validateParsedTarget(promotion, stockItem);
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "PROMOTION_TARGET_MODEL_MISMATCH");
});

test("A37 5G 256GB ต้องไม่จับคู่รุ่น 128GB", () => {
  const promotion = parsePromotionProductHeading(
    "Galaxy A37 5G ไม่ร่วม SF+ (8/256GB)"
  );
  const stockItem = {
    inventoryPn: "SM-A376B-128-TEST",
    description: "Samsung Galaxy A37 5G 8/128GB - Black",
    category: "SmartPhone"
  };
  const gate = validateParsedTarget(promotion, stockItem);
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "PROMOTION_TARGET_CAPACITY_MISMATCH");
});

test("ห้ามจับคู่เคส A37 แม้ชื่อรุ่นตรง", () => {
  const promotion = parsePromotionProductHeading(
    "Galaxy A37 5G ร่วม SF+ (8/256GB)"
  );
  const stockItem = {
    inventoryPn: "EF-A376-TEST",
    description: "Case for Galaxy A37 5G",
    category: "Accessory"
  };
  const gate = validateParsedTarget(promotion, stockItem);
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "PRODUCT_TYPE_MISMATCH");
});

test("Fold8 Ultra ต้องไม่ถูกจัดเป็น Fold8 รุ่นปกติ", () => {
  assert.equal(
    normalizeSamsungModelFamily("Galaxy Z Fold8 Ultra"),
    "FOLD8_ULTRA"
  );

  assert.equal(
    normalizeSamsungModelFamily("Galaxy Z Fold8"),
    "FOLD8"
  );

  assert.notEqual(
    normalizeSamsungModelFamily("Galaxy Z Fold8 Ultra"),
    normalizeSamsungModelFamily("Galaxy Z Fold8")
  );
});

test("Trade Up ไม่ต้องใช้ Payment Code", () => {
  const offer = {
    promotionType: "TRADE_UP_BONUS",
    tradeUpBonusAmount: 2000,
    requiresTradeIn: true,
    paymentCode: null,
    couponCode: null
  };

  const result = validateTradeUpOffer(offer);

  assert.equal(result.valid, true);
  assert.equal(result.code, "TRADE_UP_OFFER_VALID");
});

test("Trade Up ต้องมี Bonus Amount", () => {
  const offer = {
    promotionType: "TRADE_UP_BONUS",
    tradeUpBonusAmount: 0,
    requiresTradeIn: true
  };

  const result = validateTradeUpOffer(offer);

  assert.equal(result.valid, false);
  assert.equal(result.code, "TRADE_UP_BONUS_NOT_CONFIGURED");
});

test("ไม่มีเครื่องเก่าห้ามใช้ Trade Up Bonus", () => {
  const result = calculateTradeUpBenefit({
    appraisedValue: 0,
    tradeUpBonusAmount: 2000,
    hasEligibleTradeInDevice: false
  });

  assert.equal(result.tradeUpBonusApplied, 0);
  assert.equal(result.totalBenefit, 0);
  assert.equal(result.code, "TRADE_IN_DEVICE_REQUIRED");
});

test("มูลค่าเครื่องเก่าและโบนัสต้องรวมกันถูกต้อง", () => {
  const result = calculateTradeUpBenefit({
    appraisedValue: 1000,
    tradeUpBonusAmount: 2000,
    hasEligibleTradeInDevice: true
  });

  assert.equal(result.appraisedValueApplied, 1000);
  assert.equal(result.tradeUpBonusApplied, 2000);
  assert.equal(result.totalBenefit, 3000);
});

