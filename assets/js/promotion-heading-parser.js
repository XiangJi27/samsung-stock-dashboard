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

const MEMORY_PATTERN =
  /\(?\s*(\d{1,2})\s*[\/+]\s*(32|64|128|256|512|1|2)\s*(GB|TB)\s*\)?/iu;

const CAPACITY_ONLY_PATTERN =
  /(?:^|[^\d])(32|64|128|256|512)\s*(GB)(?=$|[^\w])|(?:^|[^\d])(1|2)\s*(TB)(?=$|[^\w])/iu;

const CONDITION_CLEANUP_PATTERNS = [
  // 1. NON_SF_PLUS patterns (Specific / longer phrases FIRST)
  {
    pattern: /ชำระ(?:เงิน)?\s*แบบ\s*ไม่\s*(?:ใช้|ร่วม)(?:\s*กับ)?\s*SF\s*\+/iu,
    paymentCondition: "NON_SF_PLUS",
    saleMode: "NON_SF_PLUS",
    promotionType: "NON_SF_PLUS_DISCOUNT"
  },
  {
    pattern: /ไม่(?:\s*สามารถ)?\s*(?:ใช้)?\s*ร่วม(?:\s*กับ)?\s*SF\s*\+(?:\s*ได้)?/iu,
    paymentCondition: "NON_SF_PLUS",
    saleMode: "NON_SF_PLUS",
    promotionType: "NON_SF_PLUS_DISCOUNT"
  },
  {
    pattern: /ไม่\s*ร่วม\s*SF\s*\+/iu,
    paymentCondition: "NON_SF_PLUS",
    saleMode: "NON_SF_PLUS",
    promotionType: "NON_SF_PLUS_DISCOUNT"
  },
  {
    pattern: /ไม่\s*ใช้(?:\s*สิทธิ์)?\s*SF\s*\+/iu,
    paymentCondition: "NON_SF_PLUS",
    saleMode: "NON_SF_PLUS",
    promotionType: "NON_SF_PLUS_DISCOUNT"
  },

  // 2. SF_PLUS patterns (Specific / longer phrases FIRST)
  {
    pattern: /ชำระ(?:เงิน)?\s*ผ่าน\s*SF\s*\+/iu,
    paymentCondition: "SF_PLUS",
    saleMode: "SF_PLUS",
    promotionType: "SF_PLUS_FINANCING"
  },
  {
    pattern: /ใช้\s*สิทธิ์\s*SF\s*\+/iu,
    paymentCondition: "SF_PLUS",
    saleMode: "SF_PLUS",
    promotionType: "SF_PLUS_FINANCING"
  },
  {
    pattern: /(?<!ไม่\s*)(?:สามารถ\s*)?(?:ใช้\s*)?ร่วม(?:\s*กับ)?\s*SF\s*\+(?:\s*ได้)?/iu,
    paymentCondition: "SF_PLUS",
    saleMode: "SF_PLUS",
    promotionType: "SF_PLUS_FINANCING"
  },
  {
    pattern: /ร่วม\s*SF\s*\+/iu,
    paymentCondition: "SF_PLUS",
    saleMode: "SF_PLUS",
    promotionType: "SF_PLUS_FINANCING"
  }
];

const STANDALONE_SF_PLUS_PATTERN =
  /(?:^|\s)SF\s*\+(?:\s|$)/iu;

const REMOVABLE_PROMOTION_CONDITIONS = [
  {
    pattern: /Trade\s*Up\s*Only/iu,
    code: "TRADE_UP_ONLY"
  },
  {
    pattern: /Trade\s*Up/iu,
    code: "TRADE_UP"
  },
  {
    pattern: /Studentcrd/iu,
    code: "STUDENT_EXCLUSIVE"
  },
  {
    pattern: /โปร(?:โมชั่น|โมชัน)?พิเศษ/iu,
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

function parsePaymentCondition(text) {
  for (const condition of CONDITION_CLEANUP_PATTERNS) {
    const match = text.match(condition.pattern);

    if (!match) {
      continue;
    }

    return {
      modelText: text
        .replace(match[0], " ")
        .replace(/\s+/g, " ")
        .trim(),
      conditionText: match[0].trim(),
      paymentCondition: condition.paymentCondition,
      saleMode: condition.saleMode,
      promotionType: condition.promotionType,
      ambiguous: false
    };
  }

  if (STANDALONE_SF_PLUS_PATTERN.test(text)) {
    return {
      modelText: text,
      conditionText: "SF+",
      paymentCondition: null,
      saleMode: null,
      promotionType: null,
      ambiguous: true,
      errorCode: "AMBIGUOUS_SF_PLUS_CONDITION"
    };
  }

  return {
    modelText: text,
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
    modelText: workingText
      .replace(/\s+/g, " ")
      .trim(),
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
    modelText: text
      .replace(match[0], " ")
      .replace(/\s+/g, " ")
      .trim(),
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
    /เงินดาวน์/iu,
    /ผ่อน/iu
  ];

  return noisePatterns.some(
    (pattern) => pattern.test(model)
  );
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

  const dateResult = findPromotionDate(workingText);

  if (dateResult) {
    workingText = workingText.replace(
      dateResult.match[0],
      " "
    );
  }

  const paymentResult =
    parsePaymentCondition(workingText);

  if (paymentResult.ambiguous) {
    return {
      originalText,
      model: null,
      modelFamily: null,
      promotionDateText:
        dateResult?.text || null,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode:
        paymentResult.errorCode,
      databaseAction:
        "DO_NOT_INSERT_OFFER"
    };
  }

  workingText = paymentResult.modelText;

  const conditionResult =
    extractPromotionConditions(workingText);

  workingText = conditionResult.modelText;

  const memoryMatch =
    workingText.match(MEMORY_PATTERN);

  let memory = null;
  let ram = null;
  let capacity = null;

  if (memoryMatch) {
    const normalizedMemory =
      normalizeMemoryMatch(memoryMatch);

    if (!normalizedMemory.valid) {
      return {
        originalText,
        model: null,
        modelFamily: null,
        parsingStatus: "REVIEW_REQUIRED",
        errorCode:
          normalizedMemory.errorCode,
        databaseAction:
          "DO_NOT_INSERT_OFFER"
      };
    }

    memory = normalizedMemory.memory;
    ram = normalizedMemory.ram;
    capacity = normalizedMemory.capacity;

    workingText = workingText.replace(
      memoryMatch[0],
      " "
    );
  } else {
    const capacityResult =
      extractCapacityOnly(workingText);

    workingText = capacityResult.modelText;
    capacity = capacityResult.capacity;
  }

  const model = workingText
    .replace(
      /\b(?:โปรโมชั่น|โปรโมชัน|promotion|promo)\b/giu,
      " "
    )
    .replace(/[()[\]]/g, " ")
    .replace(/^[\s|:,-]+/, "")
    .replace(/[\s|:,-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

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
      databaseAction:
        "DO_NOT_INSERT_OFFER"
    };
  }

  if (findPromotionDate(model)) {
    return {
      originalText,
      model,
      modelFamily: null,
      memory,
      ram,
      capacity,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode:
        "MODEL_CONTAINS_PROMOTION_DATE_NOISE",
      databaseAction:
        "DO_NOT_INSERT_OFFER"
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
      errorCode:
        "MODEL_CONTAINS_PROMOTION_CONDITION_NOISE",
      databaseAction:
        "DO_NOT_INSERT_OFFER"
    };
  }

  const modelFamily =
    normalizeSamsungModelFamily(model);

  if (!modelFamily) {
    return {
      originalText,
      model,
      modelFamily: null,
      memory,
      ram,
      capacity,
      paymentCondition:
        paymentResult.paymentCondition,
      saleMode:
        paymentResult.saleMode,
      promotionType:
        paymentResult.promotionType,
      parsingStatus: "REVIEW_REQUIRED",
      errorCode:
        "UNKNOWN_MODEL_FAMILY",
      databaseAction:
        "DO_NOT_INSERT_OFFER"
    };
  }

  return {
    originalText,
    model,
    modelFamily,
    memory,
    ram,
    capacity,
    paymentCondition:
      paymentResult.paymentCondition,
    saleMode:
      paymentResult.saleMode,
    promotionType:
      paymentResult.promotionType,
    conditionText:
      paymentResult.conditionText,
    additionalConditions:
      conditionResult.conditions,
    promotionDateText:
      dateResult?.text || null,
    promotionDateType:
      dateResult?.type || null,
    parsingStatus: "PARSED",
    errorCode: null,
    databaseAction:
      "ALLOW_CANDIDATE_RESOLUTION"
  };
}

const exported = {
  parsePromotionProductHeading,
  parsePaymentCondition,
  normalizeSamsungModelFamily,
  normalizeMemoryMatch,
  findPromotionDate,
  containsUnparsedConditionNoise
};

if (
  typeof module !== "undefined" &&
  module.exports
) {
  module.exports = exported;
}

if (typeof window !== "undefined") {
  window.PromotionHeadingParser = exported;
}
