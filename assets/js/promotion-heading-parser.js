"use strict";

const THAI_MONTH_PATTERN =
  "มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|" +
  "กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม";

const CROSS_MONTH_DATE_RANGE_REGEX = new RegExp(
  String.raw`(?:วันที่|ตั้งแต่วันที่|ระหว่างวันที่)?\s*` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(${THAI_MONTH_PATTERN})\s*` +
    String.raw`(?:-|–|—|ถึง)\s*` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(${THAI_MONTH_PATTERN})` +
    String.raw`(?:\s*(?:25\d{2}|20\d{2}))?`,
  "iu"
);

const SAME_MONTH_DATE_RANGE_REGEX = new RegExp(
  String.raw`(?:วันที่|ตั้งแต่วันที่|ระหว่างวันที่)?\s*` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(?:-|–|—|ถึง)\s*` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(${THAI_MONTH_PATTERN})` +
    String.raw`(?:\s*(?:25\d{2}|20\d{2}))?`,
  "iu"
);

const SINGLE_DATE_REGEX = new RegExp(
  String.raw`(?:วันที่\s*)?` +
    String.raw`(\d{1,2})\s*` +
    String.raw`(${THAI_MONTH_PATTERN})` +
    String.raw`(?:\s*(?:25\d{2}|20\d{2}))?`,
  "iu"
);

const STORE_SCOPE_PATTERNS = [
  {
    pattern: /สำหรับ\s*ร้านค้า(?:ที่)?\s*ร่วมรายการ\s*เท่านั้น/iu,
    storeScope: "PARTICIPATING_STORES_ONLY"
  },
  {
    pattern: /เฉพาะ\s*ร้านค้า(?:ที่)?\s*ร่วมรายการ/iu,
    storeScope: "PARTICIPATING_STORES_ONLY"
  },
  {
    pattern: /สำหรับ\s*ทุก\s*หน้าร้าน/iu,
    storeScope: "ALL_STORES"
  },
  {
    pattern: /ทุก\s*หน้าร้าน/iu,
    storeScope: "ALL_STORES"
  }
];

const DOWN_PAYMENT_MAX_PATTERN =
  /(?:เงิน\s*)?ดาวน์\s*ไม่\s*เกิน\s*(\d{1,3}(?:\.\d+)?)\s*%/iu;

const DOWN_PAYMENT_EXACT_PATTERN =
  /(?:เงิน\s*)?ดาวน์\s*(\d{1,3}(?:\.\d+)?)\s*%/iu;

const MEMORY_PATTERN =
  /\(?\s*(\d{1,2})\s*[\/+]\s*(32|64|128|256|512|1|2)\s*(GB|TB)\s*\)?/iu;

const CAPACITY_ONLY_PATTERN =
  /(?:^|[^\d])(32|64|128|256|512)\s*(GB)(?=$|[^\w])|(?:^|[^\d])(1|2)\s*(TB)(?=$|[^\w])/iu;

const CONDITION_CLEANUP_PATTERNS = [
  // 1. NON_SF_PLUS patterns (Specific / longer phrases FIRST, supports optional surrounding parentheses)
  {
    pattern: /\(?\s*ชำระ(?:เงิน)?\s*แบบ\s*ไม่\s*(?:ใช้|ร่วม)(?:\s*กับ)?\s*SF\s*\+\s*\)?/iu,
    paymentCondition: "NON_SF_PLUS",
    saleMode: "NON_SF_PLUS",
    promotionType: "NON_SF_PLUS_DISCOUNT"
  },
  {
    pattern: /\(?\s*ไม่(?:\s*สามารถ)?\s*(?:ใช้)?\s*ร่วม(?:\s*กับ)?\s*SF\s*\+(?:\s*ได้)?\s*\)?/iu,
    paymentCondition: "NON_SF_PLUS",
    saleMode: "NON_SF_PLUS",
    promotionType: "NON_SF_PLUS_DISCOUNT"
  },
  {
    pattern: /\(?\s*ไม่\s*ร่วม\s*SF\s*\+\s*\)?/iu,
    paymentCondition: "NON_SF_PLUS",
    saleMode: "NON_SF_PLUS",
    promotionType: "NON_SF_PLUS_DISCOUNT"
  },
  {
    pattern: /\(?\s*ไม่\s*ใช้(?:\s*สิทธิ์)?\s*SF\s*\+\s*\)?/iu,
    paymentCondition: "NON_SF_PLUS",
    saleMode: "NON_SF_PLUS",
    promotionType: "NON_SF_PLUS_DISCOUNT"
  },

  // 2. SF_PLUS patterns (Specific / longer phrases FIRST, supports optional surrounding parentheses)
  {
    pattern: /\(?\s*ชำระ(?:เงิน)?\s*ผ่าน\s*SF\s*\+\s*\)?/iu,
    paymentCondition: "SF_PLUS",
    saleMode: "SF_PLUS",
    promotionType: "SF_PLUS_FINANCING"
  },
  {
    pattern: /\(?\s*ใช้\s*สิทธิ์\s*SF\s*\+\s*\)?/iu,
    paymentCondition: "SF_PLUS",
    saleMode: "SF_PLUS",
    promotionType: "SF_PLUS_FINANCING"
  },
  {
    pattern: /(?<!ไม่\s*)\(?\s*(?:สามารถ\s*)?(?:ใช้\s*)?ร่วม(?:\s*กับ)?\s*SF\s*\+(?:\s*ได้)?\s*\)?/iu,
    paymentCondition: "SF_PLUS",
    saleMode: "SF_PLUS",
    promotionType: "SF_PLUS_FINANCING"
  },
  {
    pattern: /\(?\s*ร่วม\s*SF\s*\+\s*\)?/iu,
    paymentCondition: "SF_PLUS",
    saleMode: "SF_PLUS",
    promotionType: "SF_PLUS_FINANCING"
  }
];

const STANDALONE_SF_PLUS_PATTERN =
  /(?:^|\s|\()SF\s*\+(?:\)|\s|$)/iu;

const REMOVABLE_PROMOTION_CONDITIONS = [
  {
    pattern: /\(?\s*Trade\s*Up\s*Only\s*\)?/iu,
    code: "TRADE_UP_ONLY"
  },
  {
    pattern: /\(?\s*Trade\s*Up\s*\)?/iu,
    code: "TRADE_UP"
  },
  {
    pattern: /\(?\s*Studentcrd\s*\)?/iu,
    code: "STUDENT_EXCLUSIVE"
  },
  {
    pattern: /\(?\s*โปร(?:โมชั่น|โมชัน)?พิเศษ\s*\)?/iu,
    code: "SPECIAL_PROMOTION"
  }
];

function cleanInput(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\u0e4d\u0e32/g, "\u0e33")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupEmptyBrackets(value) {
  return cleanInput(value)
    .replace(/\(\s*\)/g, " ")
    .replace(/\[\s*\]/g, " ")
    .replace(/^[\s|:;,–—-]+/, "")
    .replace(/[\s|:;,–—-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findPromotionDate(text) {
  const patterns = [
    {
      type: "CROSS_MONTH_RANGE",
      regex: CROSS_MONTH_DATE_RANGE_REGEX
    },
    {
      type: "SAME_MONTH_RANGE",
      regex: SAME_MONTH_DATE_RANGE_REGEX
    },
    {
      type: "SINGLE_DATE",
      regex: SINGLE_DATE_REGEX
    }
  ];

  for (const item of patterns) {
    const match = text.match(item.regex);

    if (match) {
      return {
        type: item.type,
        match,
        text: match[0].trim()
      };
    }
  }

  return null;
}

function extractStoreScope(rawText) {
  const originalText = cleanInput(rawText);

  for (const rule of STORE_SCOPE_PATTERNS) {
    const match = originalText.match(rule.pattern);
    if (!match) continue;

    return {
      cleanedText: cleanupEmptyBrackets(originalText.replace(match[0], " ")),
      storeScope: rule.storeScope,
      scopeText: match[0].trim(),
      status: "PARSED"
    };
  }

  return {
    cleanedText: originalText,
    storeScope: "UNSPECIFIED",
    scopeText: null,
    status: "PARSED"
  };
}

function extractDownPayment(rawText) {
  const originalText = cleanInput(rawText);

  const maxMatch = originalText.match(DOWN_PAYMENT_MAX_PATTERN);
  if (maxMatch) {
    const percent = Number(maxMatch[1]);
    if (percent < 0 || percent > 100) {
      return {
        cleanedText: originalText,
        downPaymentType: null,
        downPaymentPercent: percent,
        conditionText: maxMatch[0].trim(),
        status: "REVIEW_REQUIRED",
        errorCode: "INVALID_DOWN_PAYMENT_PERCENT"
      };
    }
    return {
      cleanedText: cleanupEmptyBrackets(originalText.replace(maxMatch[0], " ")),
      downPaymentType: "MAX_PERCENT",
      downPaymentPercent: percent,
      conditionText: maxMatch[0].trim(),
      status: "PARSED"
    };
  }

  const exactMatch = originalText.match(DOWN_PAYMENT_EXACT_PATTERN);
  if (exactMatch) {
    const percent = Number(exactMatch[1]);
    if (percent < 0 || percent > 100) {
      return {
        cleanedText: originalText,
        downPaymentType: null,
        downPaymentPercent: percent,
        conditionText: exactMatch[0].trim(),
        status: "REVIEW_REQUIRED",
        errorCode: "INVALID_DOWN_PAYMENT_PERCENT"
      };
    }
    return {
      cleanedText: cleanupEmptyBrackets(originalText.replace(exactMatch[0], " ")),
      downPaymentType: "EXACT_PERCENT",
      downPaymentPercent: percent,
      conditionText: exactMatch[0].trim(),
      status: "PARSED"
    };
  }

  return {
    cleanedText: originalText,
    downPaymentType: null,
    downPaymentPercent: null,
    conditionText: null,
    status: "PARSED"
  };
}

function parsePaymentCondition(text) {
  const normalized = cleanInput(text);

  for (const condition of CONDITION_CLEANUP_PATTERNS) {
    const match = normalized.match(condition.pattern);

    if (!match) {
      continue;
    }

    return {
      modelText: cleanupEmptyBrackets(normalized.replace(match[0], " ")),
      conditionText: match[0].trim(),
      paymentCondition: condition.paymentCondition,
      saleMode: condition.saleMode,
      promotionType: condition.promotionType,
      ambiguous: false
    };
  }

  if (STANDALONE_SF_PLUS_PATTERN.test(normalized)) {
    return {
      modelText: normalized,
      conditionText: "SF+",
      paymentCondition: null,
      saleMode: null,
      promotionType: null,
      ambiguous: true,
      errorCode: "AMBIGUOUS_SF_PLUS_CONDITION"
    };
  }

  return {
    modelText: normalized,
    conditionText: null,
    paymentCondition: "ANY",
    saleMode: "STANDARD_PAYMENT",
    promotionType: "STANDARD_DISCOUNT",
    ambiguous: false
  };
}

function extractPromotionConditions(text) {
  let workingText = text;
  const conditions = [];

  for (const item of REMOVABLE_PROMOTION_CONDITIONS) {
    const match = workingText.match(item.pattern);

    if (!match) {
      continue;
    }

    conditions.push({
      code: item.code,
      text: match[0].trim()
    });

    workingText = workingText.replace(match[0], " ");
  }

  return {
    modelText: cleanupEmptyBrackets(workingText),
    conditions
  };
}

function normalizeMemoryMatch(match) {
  if (!match) {
    return null;
  }

  const ramValue = Number(match[1]);
  const storageValue = Number(match[2]);
  const storageUnit = match[3].toUpperCase();

  const supportedRam = new Set([
    2, 3, 4, 6, 8, 12, 16, 24, 32
  ]);

  if (!supportedRam.has(ramValue)) {
    return {
      valid: false,
      errorCode: "UNSUPPORTED_RAM_VALUE"
    };
  }

  if (
    storageUnit === "GB" &&
    ![32, 64, 128, 256, 512].includes(storageValue)
  ) {
    return {
      valid: false,
      errorCode: "INVALID_GB_STORAGE_VALUE"
    };
  }

  if (
    storageUnit === "TB" &&
    ![1, 2].includes(storageValue)
  ) {
    return {
      valid: false,
      errorCode: "INVALID_TB_STORAGE_VALUE"
    };
  }

  return {
    valid: true,
    ram: `${ramValue}GB`,
    capacity: `${storageValue}${storageUnit}`,
    memory: `${ramValue}/${storageValue}${storageUnit}`
  };
}

function extractCapacityOnly(text) {
  const match = text.match(CAPACITY_ONLY_PATTERN);

  if (!match) {
    return {
      modelText: text,
      capacity: null
    };
  }

  const rawCapacity = match[0]
    .replace(/^[^\d]+/, "")
    .trim();

  return {
    modelText: cleanupEmptyBrackets(text.replace(match[0], " ")),
    capacity: rawCapacity
      .replace(/\s+/g, "")
      .toUpperCase()
  };
}

function normalizeSamsungModelFamily(value) {
  const text = cleanInput(value)
    .toUpperCase()
    .replace(/\(TSE\)/g, " ")
    .replace(/\bSAMSUNG\b/g, " ")
    .replace(/\bGALAXY\b/g, " ")
    .replace(/\bNEW\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const rules = [
    [/\bS26\s*ULTRA\b/, "S26_ULTRA"],
    [/\bS26\s*(?:\+|\bPLUS\b)/, "S26_PLUS"],
    [/\bS26\s*FE\b|\bS26FE\b/, "S26_FE"],
    [/\bS26\b/, "S26_BASE"],

    [/\bS25\s*FE\b|\bS25FE\b/, "S25_FE"],
    [/\bS25\s*ULTRA\b/, "S25_ULTRA"],
    [/\bS25\s*(?:\+|\bPLUS\b)/, "S25_PLUS"],
    [/\bS25\b/, "S25_BASE"],

    [/\bS24\s*ULTRA\b/, "S24_ULTRA"],
    [/\bS24\s*(?:\+|\bPLUS\b)/, "S24_PLUS"],
    [/\bS24\s*FE\b|\bS24FE\b/, "S24_FE"],
    [/\bS24\b/, "S24_BASE"],

    [/\bA57\s*5G\b/, "A57_5G"],
    [/\bA57\b/, "A57_5G"],

    // Decouple A37 5G / LTE / BASE
    [/\bA37\s*5G\b/, "A37_5G"],
    [/\bA37\s*(?:LTE|4G)\b/, "A37_LTE"],
    [/\bA37\b/, "A37_BASE"],

    // Decouple A27 5G / LTE / BASE
    [/\bA27\s*5G\b/, "A27_5G"],
    [/\bA27\s*(?:LTE|4G)\b/, "A27_LTE"],
    [/\bA27\b/, "A27_BASE"],

    // Decouple A07 5G / LTE / BASE
    [/\bA07\s*(?:LTE|4G)\b/, "A07_LTE"],
    [/\bA07\s*5G\b/, "A07_5G"],
    [/\bA07\b/, "A07_BASE"],

    [/\bA17\s*5G\b/, "A17_5G"],
    [/\bA17\b/, "A17_5G"],
    [/\bA26\s*5G\b/, "A26_5G"],
    [/\bA26\b/, "A26_5G"],
    [/\bA36\s*5G\b/, "A36_5G"],
    [/\bA36\b/, "A36_5G"],
    [/\bA56\s*5G\b/, "A56_5G"],
    [/\bA56\b/, "A56_5G"],

    [/\bZ?\s*FOLD\s*8\s*ULTRA\b/, "FOLD8_ULTRA"],
    [/\bZ?\s*FOLD\s*8\b/, "FOLD8"],
    [/\bZ?\s*FLIP\s*8\b/, "FLIP8"],
    [/\bZ?\s*FOLD\s*7\b/, "FOLD7"],
    [/\bZ?\s*FLIP\s*7\b/, "FLIP7"],
    [/\bZ?\s*FOLD\s*6\b/, "FOLD6"],
    [/\bZ?\s*FLIP\s*6\b/, "FLIP6"],

    [/\bTAB\s*S11\s*ULTRA\b/, "TAB_S11_ULTRA"],
    [/\bTAB\s*S11\b/, "TAB_S11"],
    [/\bTAB\s*S10\s*ULTRA\b/, "TAB_S10_ULTRA"],
    [/\bTAB\s*S10\s*(?:\+|\bPLUS\b)/, "TAB_S10_PLUS"],
    [/\bTAB\s*S10\b/, "TAB_S10"]
  ];

  for (const [pattern, family] of rules) {
    if (pattern.test(text)) {
      return family;
    }
  }

  return null;
}

function containsUnparsedConditionNoise(model) {
  const noisePatterns = [
    /(?:ไม่\s*ร่วม|ร่วม)\s*SF\s*\+/iu,
    /ไม่(?:\s*สามารถ)?\s*(?:ใช้)?\s*ร่วม(?:\s*กับ)?\s*SF\s*\+(?:\s*ได้)?/iu,
    /ไม่\s*ใช้(?:\s*สิทธิ์)?\s*SF\s*\+/iu,
    /ใช้\s*สิทธิ์\s*SF\s*\+/iu,
    /Trade\s*Up/iu,
    /Studentcrd/iu,
    /เงินดาวน์|ดาวน์/iu,
    /ผ่อน/iu,
    /สำหรับทุกหน้าร้าน|ทุกหน้าร้าน/iu,
    /ร้านค้า(?:ที่)?\s*ร่วมรายการ/iu,
    /คูปอง|ส่วนลด/iu
  ];

  return noisePatterns.some(
    (pattern) => pattern.test(model)
  );
}

function validateTradeUpPaymentCode(value) {
  const code = String(value || "").trim().toUpperCase();

  if (!code) {
    return {
      valid: false,
      code: "TRADE_UP_PAYMENT_CODE_REQUIRED"
    };
  }

  if (!/^[A-Z0-9][A-Z0-9_-]{2,30}$/.test(code)) {
    return {
      valid: false,
      code: "INVALID_TRADE_UP_PAYMENT_CODE_FORMAT"
    };
  }

  return {
    valid: true,
    normalizedCode: code
  };
}

function validateTradeUpOffer(offer) {
  if (!offer || typeof offer !== "object") {
    return { valid: false, code: "INVALID_OFFER_OBJECT" };
  }
  const bonus = Number(
    offer.tradeUpBonusAmount !== undefined
      ? offer.tradeUpBonusAmount
      : offer.tradeUpDiscount || 0
  );
  if (bonus <= 0) {
    return { valid: false, code: "TRADE_UP_BONUS_NOT_CONFIGURED" };
  }
  return { valid: true, code: "TRADE_UP_OFFER_VALID" };
}

function calculateTradeUpBenefit(params) {
  const { appraisedValue = 0, tradeUpBonusAmount = 0, hasEligibleTradeInDevice = false } = params || {};
  const appraised = Number(appraisedValue || 0);
  const bonus = Number(tradeUpBonusAmount || 0);

  if (!hasEligibleTradeInDevice) {
    return {
      tradeUpBonusApplied: 0,
      appraisedValueApplied: 0,
      totalBenefit: 0,
      code: "TRADE_IN_DEVICE_REQUIRED"
    };
  }

  return {
    appraisedValueApplied: appraised,
    tradeUpBonusApplied: bonus,
    totalBenefit: appraised + bonus,
    code: "TRADE_IN_BENEFIT_CALCULATED"
  };
}

function parsePromotionProductHeading(rawValue) {
  const originalText = cleanInput(rawValue);

  if (!originalText) {
    return {
      originalText,
      model: null,
      modelFamily: null,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode: "EMPTY_PRODUCT_HEADING",
      databaseAction: "DO_NOT_INSERT_OFFER"
    };
  }

  let workingText = originalText;

  // 1. Date range extraction
  const dateResult = findPromotionDate(workingText);
  if (dateResult) {
    workingText = workingText.replace(dateResult.match[0], " ");
  }

  // 2. Store scope extraction
  const storeResult = extractStoreScope(workingText);
  workingText = storeResult.cleanedText;

  // 3. Payment condition extraction (SF+ / NON_SF_PLUS)
  const paymentResult = parsePaymentCondition(workingText);
  if (paymentResult.ambiguous) {
    return {
      originalText,
      model: null,
      modelFamily: null,
      storeScope: storeResult.storeScope,
      promotionDateText: dateResult?.text || null,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode: paymentResult.errorCode,
      databaseAction: "DO_NOT_INSERT_OFFER"
    };
  }
  workingText = paymentResult.modelText;

  // 4. Down payment extraction
  const downPaymentResult = extractDownPayment(workingText);
  if (downPaymentResult.status === "REVIEW_REQUIRED") {
    return {
      originalText,
      model: null,
      modelFamily: null,
      storeScope: storeResult.storeScope,
      downPaymentPercent: downPaymentResult.downPaymentPercent,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode: downPaymentResult.errorCode,
      databaseAction: "DO_NOT_INSERT_OFFER"
    };
  }
  workingText = downPaymentResult.cleanedText;

  // 5. Additional promotion conditions extraction (Trade Up, Studentcrd, etc.)
  const conditionResult = extractPromotionConditions(workingText);
  workingText = conditionResult.modelText;

  // 6. Memory and capacity extraction
  const memoryMatch = workingText.match(MEMORY_PATTERN);
  let memory = null;
  let ram = null;
  let capacity = null;

  if (memoryMatch) {
    const normalizedMemory = normalizeMemoryMatch(memoryMatch);
    if (!normalizedMemory.valid) {
      return {
        originalText,
        model: null,
        modelFamily: null,
        parsingStatus: "REVIEW_REQUIRED",
        errorCode: normalizedMemory.errorCode,
        databaseAction: "DO_NOT_INSERT_OFFER"
      };
    }

    memory = normalizedMemory.memory;
    ram = normalizedMemory.ram;
    capacity = normalizedMemory.capacity;
    workingText = workingText.replace(memoryMatch[0], " ");
  } else {
    const capacityResult = extractCapacityOnly(workingText);
    workingText = capacityResult.modelText;
    capacity = capacityResult.capacity;
  }

  // 7. Cleanup remaining model string
  let model = cleanupEmptyBrackets(
    workingText
      .replace(/\b(?:โปรโมชั่น|โปรโมชัน|promotion|promo)\b/giu, " ")
      .replace(/[()[\]]/g, " ")
  );

  if (!model) {
    return {
      originalText,
      model: null,
      modelFamily: null,
      memory,
      ram,
      capacity,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode: "MODEL_NAME_NOT_FOUND",
      databaseAction: "DO_NOT_INSERT_OFFER"
    };
  }

  // 8. Fail-closed noise checks
  if (findPromotionDate(model)) {
    return {
      originalText,
      model,
      modelFamily: null,
      memory,
      ram,
      capacity,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode: "MODEL_CONTAINS_PROMOTION_DATE_NOISE",
      databaseAction: "DO_NOT_INSERT_OFFER"
    };
  }

  if (containsUnparsedConditionNoise(model)) {
    return {
      originalText,
      model,
      modelFamily: null,
      memory,
      ram,
      capacity,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode: "MODEL_CONTAINS_PROMOTION_CONDITION_NOISE",
      databaseAction: "DO_NOT_INSERT_OFFER"
    };
  }

  const modelFamily = normalizeSamsungModelFamily(model);
  if (!modelFamily) {
    return {
      originalText,
      model,
      modelFamily: null,
      memory,
      ram,
      capacity,
      paymentCondition: paymentResult.paymentCondition,
      saleMode: paymentResult.saleMode,
      promotionType: paymentResult.promotionType,
      storeScope: storeResult.storeScope,
      downPaymentType: downPaymentResult.downPaymentType,
      downPaymentPercent: downPaymentResult.downPaymentPercent,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode: "UNKNOWN_MODEL_FAMILY",
      databaseAction: "DO_NOT_INSERT_OFFER"
    };
  }

  return {
    originalText,
    model,
    modelFamily,
    memory,
    ram,
    capacity,
    paymentCondition: paymentResult.paymentCondition,
    saleMode: paymentResult.saleMode,
    promotionType: paymentResult.promotionType,
    storeScope: storeResult.storeScope,
    downPaymentType: downPaymentResult.downPaymentType,
    downPaymentPercent: downPaymentResult.downPaymentPercent,
    conditionText: paymentResult.conditionText,
    additionalConditions: conditionResult.conditions,
    sourceConditions: {
      paymentConditionText: paymentResult.conditionText,
      storeScopeText: storeResult.scopeText,
      downPaymentText: downPaymentResult.conditionText
    },
    promotionDateText: dateResult?.text || null,
    promotionDateType: dateResult?.type || null,
    parsingStatus: "PARSED",
    errorCode: null,
    databaseAction: "ALLOW_CANDIDATE_RESOLUTION"
  };
}

const exported = {
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
  cleanupEmptyBrackets,
  containsUnparsedConditionNoise
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = exported;
}

if (typeof window !== "undefined") {
  window.PromotionHeadingParser = exported;
}
