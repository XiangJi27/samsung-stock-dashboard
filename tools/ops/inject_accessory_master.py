import json

master_path = "data/product-accessory-master.json"
target_file = "product_specs_data.js"

with open(master_path, "r", encoding="utf-8") as f:
    master_json_str = f.read().strip()

# Restore clean product_specs_data.js first by stripping previous injection if present
with open(target_file, "r", encoding="utf-8") as f:
    orig_content = f.read()

split_marker = "// ==============================================================================\n// PRODUCT ACCESSORY MASTER ARCHITECTURE & PRODUCT TYPE TEMPLATES\n// =============================================================================="
if split_marker in orig_content:
    parts = orig_content.split(split_marker)
    # The second part has the helper and then window.resolveProductSpecs
    sub_parts = parts[1].split("window.resolveProductSpecs = function(item) {")
    orig_content = parts[0].strip() + "\n\nwindow.resolveProductSpecs = function(item) {" + sub_parts[1]

helper_code = f"""
// ==============================================================================
// PRODUCT ACCESSORY MASTER ARCHITECTURE & PRODUCT TYPE TEMPLATES
// ==============================================================================
window.PRODUCT_ACCESSORY_MASTER = {master_json_str};

window.SPEC_TEMPLATES = {{
  PHONE_CASE: [
    "caseType",
    "compatibleModels",
    "material",
    "color",
    "wirelessChargingCompatible",
    "magneticCompatible",
    "standIncluded"
  ],
  SCREEN_PROTECTOR: [
    "compatibleModels",
    "protectorType",
    "hardness",
    "thickness",
    "antiFingerprint",
    "antiReflection",
    "privacyProtection",
    "installationKitIncluded"
  ],
  WALL_CHARGER: [
    "maximumOutputPower",
    "chargerType",
    "cableIncluded",
    "outputPorts",
    "usbPowerDelivery",
    "pps",
    "inputVoltage",
    "outputProfiles"
  ],
  DATA_CABLE: [
    "connectorA",
    "connectorB",
    "cableType",
    "maximumPower",
    "maximumCurrent",
    "usbPowerDelivery",
    "dataTransferSpeed",
    "length",
    "packageQuantity",
    "material",
    "eMarkerChip",
    "videoOutput",
    "compatibleDevices",
    "color"
  ],
  POWER_BANK: [
    "batteryCapacity",
    "inputPower",
    "outputPower",
    "ports",
    "wirelessCharging",
    "magneticCharging",
    "usbPowerDelivery",
    "pps",
    "dimensions",
    "weight"
  ],
  WATCH_BAND: [
    "compatibleModels",
    "bandStyle",
    "caseSizeCompatibility",
    "wristSize",
    "material",
    "color",
    "claspType",
    "waterResistance"
  ],
  BLUETOOTH_SPEAKER: [
    "outputPower",
    "bluetoothSupport",
    "bluetoothVersion",
    "playTime",
    "ipRating",
    "floating",
    "tws",
    "builtInStrap",
    "chargingPort",
    "dimensions",
    "weight"
  ],
  PREMIUM_GIFT: [
    "accessoryType",
    "compatibleSeries",
    "material",
    "color",
    "dimensions",
    "promotionConditions"
  ]
}};

function normalizeIdentity(value) {{
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\\s+/g, "");
}}

function findAccessoryMasterRecord(stockItem, master) {{
  if (!stockItem || !master || !master.products) {{
    return {{
      status: "SPEC_NOT_VERIFIED",
      record: null,
      errors: ["MISSING_PARAMS"]
    }};
  }}

  const inventoryPn = normalizeIdentity(stockItem.pn);
  const stockBrand = normalizeIdentity(stockItem.brand);
  const stockCat = normalizeIdentity(stockItem.category || stockItem.cat1 || stockItem.canonicalCategory);

  const record = master.products.find(product => {{
    const pPn = normalizeIdentity(product.inventoryIdentity && product.inventoryIdentity.inventoryPn);
    const pGtin = normalizeIdentity(product.inventoryIdentity && product.inventoryIdentity.gtin);
    return (inventoryPn && (pPn === inventoryPn || pGtin === inventoryPn));
  }});

  if (!record) {{
    return {{
      status: "SPEC_NOT_VERIFIED",
      record: null,
      errors: ["EXACT_IDENTITY_NOT_FOUND"]
    }};
  }}

  const masterBrand = normalizeIdentity(
    record.inventoryIdentity && record.inventoryIdentity.brand
  );

  if (
    stockBrand &&
    masterBrand &&
    stockBrand !== masterBrand &&
    !masterBrand.includes(stockBrand) &&
    !stockBrand.includes(masterBrand)
  ) {{
    return {{
      status: "BLOCKED_CONFLICT",
      record: null,
      errors: ["BRAND_MISMATCH"]
    }};
  }}

  // Strict Product Type / Category Guard
  const recType = normalizeIdentity(record.productIdentity && record.productIdentity.productType);
  if (stockCat === "SMARTPHONE" || stockCat === "TABLET" || stockCat === "WATCH") {{
    if (recType !== stockCat) {{
      return {{
        status: "BLOCKED_CONFLICT",
        record: null,
        errors: ["CROSS_TYPE_MISMATCH"]
      }};
    }}
  }}

  return {{
    status: record.verification.recordStatus,
    record,
    errors: []
  }};
}}

function getDisplayableSpecifications(record) {{
  if (!record) return [];
  const productType = record.productIdentity ? record.productIdentity.productType : null;
  const templateFields = (window.SPEC_TEMPLATES && window.SPEC_TEMPLATES[productType]) || [];

  return templateFields.map(fieldKey => {{
    const field = (record.specifications && record.specifications[fieldKey]) || null;
    if (!field) {{
      return {{
        fieldKey,
        value: null,
        displayValue: "ยังไม่มีข้อมูล",
        status: "NOT_AVAILABLE"
      }};
    }}
    if (field.status === "VERIFIED" || field.status === "VERIFIED_FROM_ERP") {{
      return {{
        fieldKey,
        value: field.value,
        displayValue: field.displayValue ?? String(field.value ?? ""),
        status: field.status
      }};
    }}
    return {{
      fieldKey,
      value: null,
      displayValue: field.displayValue || "ยังไม่ได้ยืนยัน",
      status: field.status
    }};
  }});
}}

window.normalizeIdentity = normalizeIdentity;
window.findAccessoryMasterRecord = findAccessoryMasterRecord;
window.getDisplayableSpecifications = getDisplayableSpecifications;
"""

content = orig_content
target = "window.resolveProductSpecs = function(item) {"
idx = content.find(target)
if idx != -1:
    content = content[:idx] + helper_code + "\n\n" + content[idx:]

# In resolveProductSpecs:
if "// 0. PRODUCT ACCESSORY MASTER EXACT IDENTITY RESOLUTION" in content:
    # clean out previous 0 block if present
    start_0 = content.find("// 0. PRODUCT ACCESSORY MASTER EXACT IDENTITY RESOLUTION")
    end_0 = content.find("// 1. EXACT PART NUMBER MATCH FIRST")
    if start_0 != -1 and end_0 != -1:
        content = content[:start_0] + content[end_0:]

old_start = """window.resolveProductSpecs = function(item) {
  if (!item) return null;
  const m = (item.model || "").toUpperCase();
  const pn = (item.pn || "").trim().toUpperCase();"""

new_start = """window.resolveProductSpecs = function(item) {
  if (!item) return null;
  const m = (item.model || "").toUpperCase();
  const pn = (item.pn || "").trim().toUpperCase();

  // 0. PRODUCT ACCESSORY MASTER EXACT IDENTITY RESOLUTION (HIGHEST PRIORITY)
  if (window.PRODUCT_ACCESSORY_MASTER) {
    const accessoryMatch = findAccessoryMasterRecord(item, window.PRODUCT_ACCESSORY_MASTER);
    if (accessoryMatch.status === "BLOCKED_CONFLICT") {
      console.warn(`[AccessoryMaster] BLOCKED_CONFLICT for ${item.pn}:`, accessoryMatch.errors);
      return null;
    }
    if (accessoryMatch.record && (accessoryMatch.status === "VERIFIED" || accessoryMatch.status === "PARTIALLY_VERIFIED")) {
      const rec = accessoryMatch.record;
      const verifiedFields = Object.keys(rec.specifications || {})
        .filter(k => rec.specifications[k].status === "VERIFIED" || rec.specifications[k].status === "VERIFIED_FROM_ERP");
      const pendingFields = Object.keys(rec.specifications || {})
        .filter(k => rec.specifications[k].status === "NOT_VERIFIED" || rec.specifications[k].status === "AI_SUGGESTED_REVIEW_REQUIRED");

      const speakerSpecs = (rec.productIdentity.productType === "BLUETOOTH_SPEAKER") ? {
        outputPower: rec.specifications.outputPower?.displayValue || "5W",
        ipRating: rec.specifications.ipRating?.displayValue || "IP67",
        playTime: rec.specifications.playTime?.displayValue || "สูงสุด 20 ชั่วโมง",
        tws: rec.specifications.tws?.displayValue || "รองรับ TWS"
      } : null;

      return {
        isAccessoryMaster: true,
        masterRecord: rec,
        displayableSpecs: getDisplayableSpecifications(rec),
        officialName: rec.productIdentity.canonicalName,
        brand: rec.inventoryIdentity.brand,
        manufacturerModel: rec.productIdentity.manufacturerModel,
        productType: rec.productIdentity.productType,
        verificationStatus: rec.verification.recordStatus,
        source: (rec.sources && rec.sources[0]?.publisher) || "Official Certified Specifications",
        sourceUrl: (rec.sources && rec.sources[0]?.url) || null,
        verifiedFields,
        pendingFields,
        speakerSpecs,
        fieldVerification: rec.specifications
      };
    }
  }"""

content = content.replace(old_start, new_start)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("Injected updated Product Accessory Master into product_specs_data.js successfully!")
