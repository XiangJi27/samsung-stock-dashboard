/**
 * Samsung Branch Operations - Mobile Tech Specs UI Safety Contract
 * Canonical verification vocabulary map (legacy profile vocabulary -> render-contract keys)
 *
 * PURPOSE
 *   The product profile file declares field-level evidence using THREE historical
 *   vocabularies (bare leaf tokens, dotted render keys, and an "identity.*" namespace)
 *   while renderDrawerSpecDetails() reads the render-contract keys (display.*,
 *   performance.*, memory.*, camera.*, battery.*, connectivityAndBuild.*).
 *   Comparing the two vocabularies as raw strings falsely reports verified values as
 *   unverified. This module provides ONE explicit mapping layer so field identity can
 *   be resolved deterministically.
 *
 * HARD RULES (enforced by tests)
 *   - Every mapping is explicit. No fuzzy / substring / regex guessing.
 *   - One legacy token maps to at most ONE canonical key (never ambiguous silently).
 *   - A token that cannot be resolved with certainty is UNMAPPED and FAILS CLOSED.
 *   - Ambiguous tokens (one token covering several canonical fields) FAIL CLOSED.
 *   - This module NEVER reads, writes or mutates a profile value. Pure metadata layer.
 *
 * STATUS VOCABULARY (exactly one per rendered value)
 *   VERIFIED                      canonical identity is declared in verifiedFields
 *   VERIFIED_NOT_SUPPORTED        declared verified AND value is a "not supported" statement
 *   PENDING_FAIL_CLOSED           canonical identity is declared in pendingFields -> do not render
 *   UNMAPPED_FAIL_CLOSED          token has no unambiguous canonical identity -> do not render
 *   STATUS_CONFLICT_FAIL_CLOSED   same canonical identity verified AND pending -> do not render
 *   NOT_APPLICABLE                non-technical / no render surface (identity, ERP, warranty...)
 *
 * MODULE SHAPE
 *   UMD: usable from Node (require) and from the browser (window.MobileUiVerificationMap).
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. NON-VALUES (placeholder sentinels)
   *    A declared value that carries no specification content.
   * ------------------------------------------------------------------ */
  const PLACEHOLDER_SENTINELS = [
    'รอระบุ',
    'รอยืนยัน',
    'รอตรวจสอบ',
    'ไม่มีข้อมูลที่ยืนยัน',
    'ไม่มีข้อมูล',
    'ยังไม่ได้ยืนยัน',
    'pending',
    'unknown',
    'tbd',
    'to be determined',
    'n/a',
    'na',
    '-'
  ];

  /** Literal "not supported" statements. When declared VERIFIED these STAY VISIBLE. */
  const NOT_SUPPORTED_LITERALS = ['ไม่รองรับ'];

  /** Normalise a candidate value for sentinel comparison. */
  function normalizeValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** True when the value is a documented non-value (placeholder / unknown marker). */
  function isPlaceholderValue(value) {
    const n = normalizeValue(value);
    if (n === '') return true;
    return PLACEHOLDER_SENTINELS.indexOf(n) >= 0;
  }

  /**
   * True when the value is a "not supported" statement (e.g. "ไม่รองรับ MicroSD").
   * Such values are legitimate specifications and must remain displayable when verified.
   */
  function isNotSupportedValue(value) {
    const raw = normalizeValue(value);
    if (raw === '') return false;
    return NOT_SUPPORTED_LITERALS.some((lit) => raw.indexOf(lit.toLowerCase()) === 0);
  }

  /* ------------------------------------------------------------------ *
   * 2. MAP OUTCOME KINDS
   * ------------------------------------------------------------------ */
  const RESOLUTION = {
    MAPPED: 'MAPPED',
    NON_TECHNICAL: 'NON_TECHNICAL',
    AMBIGUOUS: 'AMBIGUOUS',
    UNMAPPED: 'UNMAPPED'
  };

  const STATUS = {
    VERIFIED: 'VERIFIED',
    VERIFIED_NOT_SUPPORTED: 'VERIFIED_NOT_SUPPORTED',
    PENDING_FAIL_CLOSED: 'PENDING_FAIL_CLOSED',
    UNMAPPED_FAIL_CLOSED: 'UNMAPPED_FAIL_CLOSED',
    STATUS_CONFLICT_FAIL_CLOSED: 'STATUS_CONFLICT_FAIL_CLOSED',
    NOT_APPLICABLE: 'NOT_APPLICABLE'
  };

  /* ------------------------------------------------------------------ *
   * 3. NON-TECHNICAL TOKENS (no Tech Specs render surface)
   *    Identity / ERP metadata / warranty / accessory-only / deprecated fields.
   *    These resolve to NOT_APPLICABLE and never count as displayed Tech Specs.
   *    Identity-typed values (officialName, brand, category, color, modelGroup...)
   *    ARE displayed by the UI, but only as the drawer title / ERP stock box.
   * ------------------------------------------------------------------ */
  const NON_TECHNICAL_TOKENS = {
    officialName: 'identity label - drawer title only, never a spec row',
    brand: 'identity label - drawer header / ERP stock box',
    category: 'ERP stock category - ERP box',
    color: 'profile colour attribute - no Tech Specs row',
    manufacturerPn: 'identity label - manufacturer P/N header',
    manufacturerModel: 'identity label - manufacturer model header',
    modelGroup: 'identity label - model group header',
    modelName: 'identity label - model name header',
    modelVariant: 'identity label - variant header',
    productType: 'identity label - product type header',
    inventoryPn: 'ERP inventory identity - ERP box',
    subCategory: 'ERP stock sub-category - ERP box',
    // Camera OIS has no row in the render contract, so these tokens must never be promoted.
    // They are declared here as documented NON_TECHNICAL (no render surface) rather than
    // left as an unexplained UNMAPPED surprise.
    oisSupport: 'no render-contract row - camera OIS is not part of the 6-group render plan',
    'display.oisSupport': 'no render-contract row - camera OIS is not part of the 6-group render plan',
    'camera.oisSupport': 'no render-contract row - camera OIS is not part of the 6-group render plan',
    officialExactPnUrl: 'evidence URL - source link only',
    exactModelCode: 'identity model code - no Tech Specs row',
    'identity.manufacturerPn': 'identity namespace - manufacturer P/N header',
    'identity.color': 'identity namespace - profile colour attribute',
    thailandWarrantyPeriod: 'Thai warranty term - not a render-contract row',
    'thailand.thailandWarrantyPeriod': 'Thai warranty term - not a render-contract row',
    thailandCertification: 'Thai certification - not a render-contract row',
    'thailand.nbtcCertification': 'NBTC certification - not a render-contract row',
    nbtcCertification: 'NBTC certification - not a render-contract row',
    carrierSpecificCertification: 'carrier certification - not a render-contract row',
    os: 'operating system - not a render-contract row',
    operatingSystem: 'operating system - not a render-contract row',
    'performance.operatingSystem': 'operating system - not a render-contract row',
    'performance.softwareSupport': 'software support policy - not a render-contract row',
    'performance.memoryType': 'memory technology - not a render-contract row',
    'performance.aiFeatures': 'AI feature list - superseded by the aiEngine row',
    sensors: 'sensor list container - no phone Tech Specs row',
    usageHours: 'battery usage-hours block - separate UI surface',
    batteryLife: 'battery life - separate UI surface',
    anc: 'audio noise cancellation - buds audio block only',
    audioDrivers: 'audio driver spec - buds audio block only',
    driverSize: 'audio driver spec - buds audio block only',
    bluetoothSpecs: 'bluetooth container - not a phone Tech Specs row',
    dropProtectionRating: 'drop protection - not a render-contract row',
    dropTestRating: 'drop testing - not a render-contract row',
    miltaryDropTest: 'military drop test - not a render-contract row',
    gaNTechnologyForThailand: 'charger technology - charger template only',
    size: 'accessory / display size ambiguity - fail closed',
    maxOutput: 'charger output - charger template only',
    chargerType: 'charger spec - charger template only',
    cableIncluded: 'charger bundle content - charger template only',
    usbPowerDelivery: 'charger spec - charger template only',
    ppsSupported: 'charger spec - charger template only',
    pdoSupported: 'charger spec - charger template only',
    outputPort: 'charger spec - charger template only',
    standbyPower: 'charger spec - charger template only',
    pdoOutputProfiles: 'charger spec - charger template only',
    ppsOutputRange: 'charger spec - charger template only',
    superFastCharging: 'superseded by battery.chargingSpeed',
    outputPower: 'audio output power - accessory template only',
    builtInStrap: 'speaker spec - accessory template only',
    tws: 'audio spec - accessory template only',
    playTime: 'audio spec - accessory template only',
    ipRating: 'accessory IP rating - phone IP rating lives on connectivityAndBuild.waterResistance',
    accentColor: 'identity label - profile accent attribute'
  };

  /* ------------------------------------------------------------------ *
   * 4. EXPLICITLY AMBIGUOUS TOKENS - documented and deliberately FAIL CLOSED
   *    One legacy token covering several canonical render rows cannot be
   *    resolved unattended, so it is reported AMBIGUOUS and never treated
   *    as evidence for any single row.
   * ------------------------------------------------------------------ */
  const AMBIGUOUS_TOKENS = {
    cameraSpecs: ['camera.rearCamera', 'camera.frontCamera', 'camera.videoRecording'],
    batterySpecs: ['battery.capacity', 'battery.chargingSpeed', 'battery.wirelessCharging', 'battery.reverseCharging'],
    screenSpecs: ['display.screenSize', 'display.panelType', 'display.resolution', 'display.refreshRate', 'display.peakBrightness', 'display.glassProtection'],
    chargingSpecs: ['battery.chargingSpeed', 'battery.wirelessCharging', 'battery.reverseCharging'],
    connectivity: ['connectivityAndBuild.network', 'connectivityAndBuild.wifi', 'connectivityAndBuild.bluetooth'],
    esim: ['connectivityAndBuild.simType'],
    'connectivity.esim': ['connectivityAndBuild.simType'],
    networkBands: ['connectivityAndBuild.networkBands', 'connectivityAndBuild.network'],
    'connectivity.networkBands': ['connectivityAndBuild.networkBands', 'connectivityAndBuild.network'],
    dimensions: ['connectivityAndBuild.dimensions'],
    physicalDimensions: ['connectivityAndBuild.dimensions'],
    material: ['connectivityAndBuild.frameMaterial'],
    size: ['display.screenSize'],
    displayResolution: ['display.resolution'],
    resolution: ['display.resolution'],
    camera: ['camera.rearCamera', 'camera.frontCamera', 'camera.videoRecording'],
    battery: ['battery.capacity', 'battery.chargingSpeed', 'battery.wirelessCharging'],
    display: ['display.screenSize', 'display.panelType', 'display.resolution', 'display.refreshRate', 'display.peakBrightness']
  };

  /* ------------------------------------------------------------------ *
   * 5. CANONICAL TOKEN MAP
   *    Explicit, one-to-one legacy token -> canonical render-contract key.
   *    Every entry is a documented equivalent approved for this gate.
   * ------------------------------------------------------------------ */
  const CANONICAL_TOKEN_MAP = {
    /* --- Display --- */
    screenSize: 'display.screenSize',
    panelType: 'display.panelType',
    refreshRate: 'display.refreshRate',
    peakBrightness: 'display.peakBrightness',
    glassProtection: 'display.glassProtection',
    'display.screenSize': 'display.screenSize',
    'display.panelType': 'display.panelType',
    'display.resolution': 'display.resolution',
    'display.refreshRate': 'display.refreshRate',
    'display.peakBrightness': 'display.peakBrightness',
    'display.glassProtection': 'display.glassProtection',
    'display.displayResolution': 'display.resolution',

    /* --- Performance --- */
    processor: 'performance.processor',
    cpu: 'performance.cpuCores',
    cpuCores: 'performance.cpuCores',
    exactCpuModel: 'performance.cpuCores',
    gpu: 'performance.gpu',
    aiEngine: 'performance.aiEngine',
    'performance.processor': 'performance.processor',
    'performance.cpuCores': 'performance.cpuCores',
    'performance.cpu': 'performance.cpuCores',
    'performance.gpu': 'performance.gpu',

    /* --- Memory --- */
    ram: 'memory.ram',
    storage: 'memory.storage',
    expandableStorage: 'memory.expandableStorage',
    microSD: 'memory.expandableStorage',
    microSdSupport: 'memory.expandableStorage',
    'memory.ram': 'memory.ram',
    'memory.storage': 'memory.storage',
    'memory.expandableStorage': 'memory.expandableStorage',
    'build.microSdSupport': 'memory.expandableStorage',

    /* --- Camera ---
     * NOTE: the render contract has no OIS row (camera.oisSupport was removed from RENDER_ROWS).
     * These tokens therefore have NO documented render equivalent and must fail closed.
     * They are listed in AMBIGUOUS_TOKENS (no single canonical key) rather than mapped here. */
    rearCamera: 'camera.rearCamera',
    frontCamera: 'camera.frontCamera',
    videoRecording: 'camera.videoRecording',
    'camera.rearCamera': 'camera.rearCamera',
    'camera.frontCamera': 'camera.frontCamera',
    'camera.videoRecording': 'camera.videoRecording',

    /* --- Battery --- */
    capacity: 'battery.capacity',
    batteryCapacity: 'battery.capacity',
    chargingSpeed: 'battery.chargingSpeed',
    wiredCharging: 'battery.chargingSpeed',
    wirelessCharging: 'battery.wirelessCharging',
    reverseCharging: 'battery.reverseCharging',
    'battery.capacity': 'battery.capacity',
    'battery.batteryCapacity': 'battery.capacity',
    'battery.chargingSpeed': 'battery.chargingSpeed',
    'battery.wiredCharging': 'battery.chargingSpeed',
    'battery.wirelessCharging': 'battery.wirelessCharging',
    'battery.reverseCharging': 'battery.reverseCharging',

    /* --- Connectivity & Build --- */
    network: 'connectivityAndBuild.network',
    simType: 'connectivityAndBuild.simType',
    wifi: 'connectivityAndBuild.wifi',
    bluetooth: 'connectivityAndBuild.bluetooth',
    bluetoothVersion: 'connectivityAndBuild.bluetooth',
    waterResistance: 'connectivityAndBuild.waterResistance',
    spenSupport: 'connectivityAndBuild.spenSupport',
    spen: 'connectivityAndBuild.spenSupport',
    frameMaterial: 'connectivityAndBuild.frameMaterial',
    weight: 'connectivityAndBuild.weight',
    'connectivityAndBuild.network': 'connectivityAndBuild.network',
    'connectivityAndBuild.simType': 'connectivityAndBuild.simType',
    'connectivityAndBuild.wifi': 'connectivityAndBuild.wifi',
    'connectivityAndBuild.bluetooth': 'connectivityAndBuild.bluetooth',
    'connectivityAndBuild.waterResistance': 'connectivityAndBuild.waterResistance',
    'connectivityAndBuild.spenSupport': 'connectivityAndBuild.spenSupport',
    'connectivityAndBuild.frameMaterial': 'connectivityAndBuild.frameMaterial',
    'connectivityAndBuild.dimensions': 'connectivityAndBuild.dimensions',
    'connectivityAndBuild.weight': 'connectivityAndBuild.weight',
    'build.waterResistance': 'connectivityAndBuild.waterResistance',
    'build.frameMaterial': 'connectivityAndBuild.frameMaterial',
    'build.dimensions': 'connectivityAndBuild.dimensions',
    'build.weight': 'connectivityAndBuild.weight',
    'build.spenSupport': 'connectivityAndBuild.spenSupport',
    'connectivity.wifi': 'connectivityAndBuild.wifi',
    'connectivity.bluetooth': 'connectivityAndBuild.bluetooth',
    'connectivity.simType': 'connectivityAndBuild.simType',
    'connectivity.waterResistance': 'connectivityAndBuild.waterResistance'
  };

  /* ------------------------------------------------------------------ *
   * 6. LEGACY identity.* NAMESPACE (observed third vocabulary)
   *    These tokens carry canonical identity but the UI presents them as
   *    ERP header metadata, never as a Tech Specs row. Kept explicit so the
   *    map can prove it is NOT an unmapped surprise.
   * ------------------------------------------------------------------ */
  const LEGACY_IDENTITY_TOKENS = {
    'identity.ram': 'identity namespace - RAM shown as ERP header metadata',
    'identity.storage': 'identity namespace - storage shown as ERP header metadata',
    'identity.network': 'identity namespace - network shown as ERP header metadata'
  };

  /* ------------------------------------------------------------------ *
   * 7. TOKEN RESOLUTION
   * ------------------------------------------------------------------ */
  /** True when the token is an explicitly ambiguous (fail-closed) token. */
  function isAmbiguousToken(token) {
    return Object.prototype.hasOwnProperty.call(AMBIGUOUS_TOKENS, token);
  }

  /** True when the token carries no Tech Specs render surface. */
  function isNonTechnicalToken(token) {
    return Object.prototype.hasOwnProperty.call(NON_TECHNICAL_TOKENS, token) ||
      Object.prototype.hasOwnProperty.call(LEGACY_IDENTITY_TOKENS, token);
  }

  /** Human-readable reason for a resolved token (evidence output). */
  function reasonForToken(token) {
    if (isNonTechnicalToken(token)) {
      return NON_TECHNICAL_TOKENS[token] || LEGACY_IDENTITY_TOKENS[token];
    }
    if (isAmbiguousToken(token)) return 'ambiguous token covers ' + AMBIGUOUS_TOKENS[token].join(', ');
    return null;
  }

  /**
   * Resolve one legacy/canonical token to a single canonical render-contract key.
   * Never guesses: returns UNMAPPED when there is no explicit documented equivalent.
   * @returns {{token:string, resolution:string, canonicalKey:string|null, candidates:string[], reason:string|null}}
   */
  function resolveToken(token) {
    const t = String(token === null || token === undefined ? '' : token).trim();
    if (t === '') {
      return { token: t, resolution: RESOLUTION.UNMAPPED, canonicalKey: null, candidates: [], reason: 'empty token' };
    }
    if (isNonTechnicalToken(t)) {
      return { token: t, resolution: RESOLUTION.NON_TECHNICAL, canonicalKey: null, candidates: [], reason: reasonForToken(t) };
    }
    if (isAmbiguousToken(t)) {
      return { token: t, resolution: RESOLUTION.AMBIGUOUS, canonicalKey: null, candidates: AMBIGUOUS_TOKENS[t], reason: reasonForToken(t) };
    }
    if (Object.prototype.hasOwnProperty.call(CANONICAL_TOKEN_MAP, t)) {
      return { token: t, resolution: RESOLUTION.MAPPED, canonicalKey: CANONICAL_TOKEN_MAP[t], candidates: [], reason: 'documented equivalent' };
    }
    return { token: t, resolution: RESOLUTION.UNMAPPED, canonicalKey: null, candidates: [], reason: 'no documented equivalent - fail closed' };
  }

  /** Every canonical key an explicit map entry can produce (the controlled vocabulary). */
  const MAPPABLE_CANONICAL_KEYS = (function () {
    const set = {};
    Object.keys(CANONICAL_TOKEN_MAP).forEach((t) => { set[CANONICAL_TOKEN_MAP[t]] = true; });
    return Object.keys(set).sort();
  })();

  /**
   * Canonical identity sets declared by a profile.
   * @returns {{verified:Object, pending:Object, ambiguous:Array, unmapped:Array, nonTechnical:Array}}
   */
  function canonicalIdentitySets(profile) {
    const p = profile || {};
    const verified = {};
    const pending = {};
    const ambiguous = [];
    const unmapped = [];
    const nonTechnical = [];

    function collect(tok, target, sourceList) {
      const r = resolveToken(tok);
      if (r.resolution === RESOLUTION.MAPPED) {
        target[r.canonicalKey] = { token: String(tok), sourceList: sourceList };
      } else if (r.resolution === RESOLUTION.AMBIGUOUS) {
        ambiguous.push({ token: String(tok), sourceList: sourceList, candidates: r.candidates, reason: r.reason });
      } else if (r.resolution === RESOLUTION.UNMAPPED) {
        unmapped.push({ token: String(tok), sourceList: sourceList, reason: r.reason });
      } else {
        nonTechnical.push({ token: String(tok), sourceList: sourceList, reason: r.reason });
      }
    }

    (Array.isArray(p.verifiedFields) ? p.verifiedFields : []).forEach((tok) => collect(tok, verified, 'verifiedFields'));
    (Array.isArray(p.pendingFields) ? p.pendingFields : []).forEach((tok) => collect(tok, pending, 'pendingFields'));

    return { verified: verified, pending: pending, ambiguous: ambiguous, unmapped: unmapped, nonTechnical: nonTechnical };
  }

  /**
   * Classify ONE rendered Tech Specs value.
   * @param {object} input { canonicalKey, label, value, declaredSource, sets }
   */
  function classifyRenderedValue(input) {
    const canonicalKey = String(input && input.canonicalKey ? input.canonicalKey : '');
    const value = input ? input.value : null;
    const sets = (input && input.sets) || null;

    const base = {
      canonicalKey: canonicalKey,
      label: (input && input.label) || null,
      // The raw value MUST travel with the classification: buildProfileRenderPlan() merges the
      // classification into the render row, so omitting it here would replace the real value
      // with `undefined` and print the string "undefined" into the drawer.
      value: value,
      valuePresent: !(value === undefined || value === null || value === ''),
      valueIsPlaceholder: isPlaceholderValue(value),
      valueIsNotSupported: isNotSupportedValue(value),
      declaredSource: (input && input.declaredSource) || null,
      verifiedDeclared: false,
      pendingDeclared: false,
      classifiedAs: null,
      renderDecision: null
    };

    if (!canonicalKey || !sets) {
      base.classifiedAs = STATUS.UNMAPPED_FAIL_CLOSED;
      base.renderDecision = 'DO_NOT_RENDER';
      return base;
    }

    const inVerified = Object.prototype.hasOwnProperty.call(sets.verified, canonicalKey);
    const inPending = Object.prototype.hasOwnProperty.call(sets.pending, canonicalKey);
    base.verifiedDeclared = inVerified;
    base.pendingDeclared = inPending;

    if (inVerified && inPending) {
      base.classifiedAs = STATUS.STATUS_CONFLICT_FAIL_CLOSED;
      base.renderDecision = 'DO_NOT_RENDER';
      return base;
    }
    if (inPending) {
      base.classifiedAs = STATUS.PENDING_FAIL_CLOSED;
      base.renderDecision = 'DO_NOT_RENDER';
      return base;
    }
    if (!inVerified) {
      base.classifiedAs = STATUS.UNMAPPED_FAIL_CLOSED;
      base.renderDecision = 'DO_NOT_RENDER';
      return base;
    }
    if (base.valueIsPlaceholder) {
      base.classifiedAs = STATUS.VERIFIED;
      base.renderDecision = 'PENDING_BADGE';
      return base;
    }
    if (base.valueIsNotSupported) {
      base.classifiedAs = STATUS.VERIFIED_NOT_SUPPORTED;
      base.renderDecision = 'RENDER';
      return base;
    }
    base.classifiedAs = STATUS.VERIFIED;
    base.renderDecision = 'RENDER';
    return base;
  }

  /* ------------------------------------------------------------------ *
   * 8. RENDER ROW CONTRACT
   *    Exactly the technical rows emitted by renderDrawerSpecDetails().
   *    Kept in one place so UI, audit and tests cannot drift apart.
   * ------------------------------------------------------------------ */
  const RENDER_ROWS = [
    { group: 'Display', icon: '📱', title: 'หน้าจอแสดงผล (Display)', canonicalKey: 'display.screenSize', label: 'ขนาดหน้าจอ' },
    { group: 'Display', canonicalKey: 'display.panelType', label: 'ชนิดหน้าจอ' },
    { group: 'Display', canonicalKey: 'display.resolution', label: 'ความละเอียด' },
    { group: 'Display', canonicalKey: 'display.refreshRate', label: 'อัตรารีเฟรช' },
    { group: 'Display', canonicalKey: 'display.peakBrightness', label: 'ความสว่างสูงสุด' },
    { group: 'Display', canonicalKey: 'display.glassProtection', label: 'กระจกกันรอย' },

    { group: 'Performance', icon: '⚡', title: 'ประสิทธิภาพ & Galaxy AI (Performance)', canonicalKey: 'performance.processor', label: 'ชิปเซ็ตประมวลผล' },
    { group: 'Performance', canonicalKey: 'performance.cpuCores', label: 'แกนประมวลผล (CPU)' },
    { group: 'Performance', canonicalKey: 'performance.gpu', label: 'ชิปกราฟิก (GPU)' },
    { group: 'Performance', canonicalKey: 'performance.aiEngine', label: 'ระบบปัญญาประดิษฐ์' },

    { group: 'Memory', icon: '💾', title: 'หน่วยความจำ & ความจุ (Memory)', canonicalKey: 'memory.ram', label: 'หน่วยความจำ (RAM)' },
    { group: 'Memory', canonicalKey: 'memory.storage', label: 'พื้นที่จัดเก็บ (ROM)' },
    { group: 'Memory', canonicalKey: 'memory.expandableStorage', label: 'ช่องใส่ MicroSD' },

    { group: 'Camera', icon: '📷', title: 'กล้องถ่ายภาพ (Camera System)', canonicalKey: 'camera.rearCamera', label: 'กล้องหลัง (Rear)' },
    { group: 'Camera', canonicalKey: 'camera.frontCamera', label: 'กล้องหน้า (Selfie)' },
    { group: 'Camera', canonicalKey: 'camera.videoRecording', label: 'ความละเอียดวิดีโอ' },

    { group: 'Battery', icon: '🔋', title: 'แบตเตอรี่ & ระบบชาร์จ (Battery & Charging)', canonicalKey: 'battery.capacity', label: 'ความจุแบตเตอรี่' },
    { group: 'Battery', canonicalKey: 'battery.chargingSpeed', label: 'การชาร์จไวมีสาย' },
    { group: 'Battery', canonicalKey: 'battery.wirelessCharging', label: 'การชาร์จไร้สาย' },
    { group: 'Battery', canonicalKey: 'battery.reverseCharging', label: 'แชร์พลังงานไร้สาย' },

    { group: 'Connectivity', icon: '📶', title: 'การเชื่อมต่อ & ตัวเครื่อง (Connectivity & Build)', canonicalKey: 'connectivityAndBuild.network', label: 'เครือข่ายสัญญาณ' },
    { group: 'Connectivity', canonicalKey: 'connectivityAndBuild.simType', label: 'ช่องใส่ซิม (SIM)' },
    { group: 'Connectivity', canonicalKey: 'connectivityAndBuild.wifi', label: 'Wi-Fi' },
    { group: 'Connectivity', canonicalKey: 'connectivityAndBuild.bluetooth', label: 'Bluetooth' },
    { group: 'Connectivity', canonicalKey: 'connectivityAndBuild.waterResistance', label: 'มาตรฐานกันน้ำกันฝุ่น' },
    { group: 'Connectivity', canonicalKey: 'connectivityAndBuild.spenSupport', label: 'รองรับปากกา S Pen' },
    { group: 'Connectivity', canonicalKey: 'connectivityAndBuild.frameMaterial', label: 'วัสดุตัวเครื่อง' },
    { group: 'Connectivity', canonicalKey: 'connectivityAndBuild.dimensions', label: 'ขนาดตัวเครื่อง' },
    { group: 'Connectivity', canonicalKey: 'connectivityAndBuild.weight', label: 'น้ำหนัก' }
  ];

  /** Number of technical rows the render contract can display (the "25-field standard" family). */
  const RENDER_ROW_COUNT = RENDER_ROWS.length;

  /** Read a dotted path from a profile without mutating it. */
  function readPath(profile, dottedKey) {
    if (!profile) return undefined;
    return String(dottedKey).split('.').reduce(function (acc, part) {
      if (acc === null || acc === undefined) return undefined;
      return acc[part];
    }, profile);
  }

  /* ------------------------------------------------------------------ *
   * 9. RENDER PLAN
   * ------------------------------------------------------------------ */
  const BANNER_TEXT = {
    NO_VERIFIED_SPEC: 'ยังไม่มีข้อมูลสเปกที่ยืนยันแล้วสำหรับ P/N นี้',
    NON_EXACT_PN: 'ยังไม่มีข้อมูลที่ยืนยันสำหรับ P/N นี้',
    PLACEHOLDER: 'รอระบุข้อมูลที่ยืนยันแล้ว'
  };

  /** Canonical keys that the ERP product name carries as header metadata. */
  const ERP_HEADER_KEYS = ['memory.ram', 'memory.storage', 'memory.expandableStorage'];

  /**
   * Build the complete, deterministic render plan for one resolved profile.
   * Reads profile values only - never writes, never promotes, never invents a value.
   * @param {object} input { profile, officialName, matchLevel, erpProductName }
   */
  function buildProfileRenderPlan(input) {
    const profile = (input && input.profile) || {};
    const matchLevel = (input && input.matchLevel) || 'NO_MATCH';
    const erpName = String((input && input.erpProductName) || '');
    const isExact = matchLevel === 'EXACT_PN' || matchLevel === 'EXACT_ACCESSORY_PN' || matchLevel === 'PM_PROMOTION_ALIAS_EXACT_MAPPING';
    const sets = canonicalIdentitySets(profile);

    const rows = RENDER_ROWS.map(function (row) {
      const rawValue = readPath(profile, row.canonicalKey);
      const classified = classifyRenderedValue({
        canonicalKey: row.canonicalKey,
        label: row.label,
        value: rawValue,
        sets: sets
      });
      // FAIL CLOSED: a Series / Base-Model / NO_MATCH resolution may never display a value,
      // even if the resolved profile happens to declare verified fields. The plan must not
      // rely on the caller returning early.
      const rendered = isExact && classified.renderDecision === 'RENDER';
      const badgeHidden = isExact && classified.renderDecision === 'PENDING_BADGE';
      const parsed = parseSpecsMarker(rawValue);
      const erpHeaderOnly = rendered && ERP_HEADER_KEYS.indexOf(row.canonicalKey) >= 0 &&
        parsed.length > 0 && erpNameCarriesMarkerAsOwnToken(erpName, parsed);
      return Object.assign({}, row, classified, {
        group: row.group,
        icon: row.icon || null,
        groupTitle: row.title || null,
        rawValuePresent: !(rawValue === undefined || rawValue === null || rawValue === ''),
        displayed: rendered,
        badgeOnly: badgeHidden,
        countsAsDisplayedTechSpec: rendered && !erpHeaderOnly,
        erpMetadataHeaderOnly: erpHeaderOnly
      });
    });

    const displayedRows = rows.filter(function (r) { return r.displayed; });
    const techSpecRows = rows.filter(function (r) { return r.countsAsDisplayedTechSpec; });
    const headerOnlyRows = rows.filter(function (r) { return r.erpMetadataHeaderOnly; });
    const badgeRows = rows.filter(function (r) { return r.badgeOnly; });
    const withheldRows = rows.filter(function (r) { return r.renderDecision === 'DO_NOT_RENDER'; });

    var planClass;
    if (!isExact) {
      planClass = 'NON_EXACT_MATCH_FAIL_CLOSED';
    } else if (techSpecRows.length === 0) {
      planClass = 'EXACT_PROFILE_UI_INCOMPLETE';
    } else if (techSpecRows.length >= RENDER_ROW_COUNT) {
      planClass = 'UI_SPEC_FULL';
    } else {
      planClass = 'UI_SPEC_PARTIAL';
    }

    var banner;
    if (!isExact) banner = BANNER_TEXT.NON_EXACT_PN;
    else if (techSpecRows.length === 0) banner = BANNER_TEXT.NO_VERIFIED_SPEC;
    else banner = null;

    return {
      matchLevel: matchLevel,
      officialName: (input && input.officialName) || profile.officialName || null,
      isExactMatch: isExact,
      planClass: planClass,
      renderRowCount: RENDER_ROW_COUNT,
      displayedRowCount: displayedRows.length,
      techSpecRowCount: techSpecRows.length,
      headerMetadataOnlyCount: headerOnlyRows.length,
      pendingBadgeCount: badgeRows.length,
      withheldCount: withheldRows.length,
      bannerRequired: banner !== null,
      bannerText: banner,
      emptyUnexplainedDrawer: false,
      verificationBadge: isExact
        ? (techSpecRows.length >= RENDER_ROW_COUNT ? 'VERIFIED' : (techSpecRows.length > 0 ? 'PARTIALLY_VERIFIED' : 'NO_VERIFIED_SPEC'))
        : 'FAIL_CLOSED',
      rows: rows,
      declared: {
        verifiedTokens: Array.isArray(profile.verifiedFields) ? profile.verifiedFields.slice() : [],
        pendingTokens: Array.isArray(profile.pendingFields) ? profile.pendingFields.slice() : [],
        ambiguous: sets.ambiguous,
        unmapped: sets.unmapped,
        nonTechnical: sets.nonTechnical,
        verifiedCanonicalKeys: Object.keys(sets.verified).sort(),
        pendingCanonicalKeys: Object.keys(sets.pending).sort()
      }
    };
  }

  /**
   * Normalise a text for RAM/storage token comparison. Uppercases and collapses every run of
   * whitespace to a single space, so "8/256  GB" and "8/256 GB" compare alike. This is the
   * SAME rule applied to both operands (symmetric normalisation).
   */
  function normalizeSpecsText(value) {
    if (value === null || value === undefined) return '';
    return String(value).toUpperCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Tokenise a string into its RAM/storage markers as a set of compact tokens ("256GB").
   *
   * A marker is <digits>[optional whitespace]<GB|TB> that is NOT glued to a preceding or
   * following alphanumeric, so it is an OWN token rather than a substring of a longer number:
   *   "8/128GB"   -> {"128GB"}        (no "8GB": the "8" is followed by "/", not by a unit)
   *   "8/256 GB"  -> {"256GB"}        (spaced token normalises across its own space)
   *   "8GB/128GB" -> {"8GB","128GB"}  (both are own tokens)
   *   "12+256GB"  -> {"256GB"}        (the "12" is followed by "+", not by a unit)
   *   "5128GB"    -> {"5128GB"}       (no "128GB": the digits are actually 5128)
   *   "128GB"     -> {"128GB"}        (no "8GB": the 8 is glued to the preceding "12")
   * The leading boundary character is captured and discarded instead of using a lookbehind, so
   * this stays compatible with browsers that predate lookbehind support.
   */
  function specMarkerTokens(value) {
    const text = normalizeSpecsText(value);
    if (!text) return [];
    const out = [];
    const re = /(^|[^0-9A-Z])(\d+)\s*(GB|TB)(?![0-9A-Z])/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      out.push(m[2] + m[3]);
      // The boundary character is part of the match; step back one so two adjacent markers
      // ("8GB/128GB") are both found.
      if (m[1] && re.lastIndex > 0) re.lastIndex -= 1;
    }
    return out;
  }

  /**
   * True when the ERP product name carries `marker` as one of its OWN RAM/storage tokens.
   * Both operands go through the same normalisation and the same tokenisation, so the test is
   * symmetric and token-bounded: it neither misses a marker separated by a space nor accepts a
   * marker that is only a substring of a longer number.
   */
  function erpNameCarriesMarkerAsOwnToken(erpProductName, marker) {
    const wanted = String(marker === null || marker === undefined ? '' : marker)
      .toUpperCase().replace(/\s+/g, '');
    if (!wanted) return false;
    return specMarkerTokens(erpProductName).indexOf(wanted) >= 0;
  }

  /** Detect a RAM/storage marker already present in an ERP product name. */
  function parseSpecsMarker(value) {
    if (value === null || value === undefined) return '';
    const m = String(value).match(/(\d+)\s*(?:GB|TB)/i);
    return m ? m[1] + String(m[0]).replace(/^\d+\s*/, '').toUpperCase() : '';
  }

  /* ------------------------------------------------------------------ *
   * 10. PUBLIC API
   * ------------------------------------------------------------------ */
  const api = {
    PLACEHOLDER_SENTINELS: PLACEHOLDER_SENTINELS,
    NOT_SUPPORTED_LITERALS: NOT_SUPPORTED_LITERALS,
    RESOLUTION: RESOLUTION,
    STATUS: STATUS,
    BANNER_TEXT: BANNER_TEXT,
    ERP_HEADER_KEYS: ERP_HEADER_KEYS,
    RENDER_ROWS: RENDER_ROWS,
    RENDER_ROW_COUNT: RENDER_ROW_COUNT,
    MAPPABLE_CANONICAL_KEYS: MAPPABLE_CANONICAL_KEYS,
    CANONICAL_TOKEN_MAP: CANONICAL_TOKEN_MAP,
    AMBIGUOUS_TOKENS: AMBIGUOUS_TOKENS,
    NON_TECHNICAL_TOKENS: NON_TECHNICAL_TOKENS,
    LEGACY_IDENTITY_TOKENS: LEGACY_IDENTITY_TOKENS,
    normalizeValue: normalizeValue,
    isPlaceholderValue: isPlaceholderValue,
    isNotSupportedValue: isNotSupportedValue,
    isAmbiguousToken: isAmbiguousToken,
    isNonTechnicalToken: isNonTechnicalToken,
    resolveToken: resolveToken,
    canonicalIdentitySets: canonicalIdentitySets,
    classifyRenderedValue: classifyRenderedValue,
    readPath: readPath,
    normalizeSpecsText: normalizeSpecsText,
    specMarkerTokens: specMarkerTokens,
    erpNameCarriesMarkerAsOwnToken: erpNameCarriesMarkerAsOwnToken,
    parseSpecsMarker: parseSpecsMarker,
    buildProfileRenderPlan: buildProfileRenderPlan,
    /** A placeholder value is shown as a Pending badge, never as an ordinary value.
     * FAIL CLOSED BY DESIGN: this function decides from the classification itself, so it is
     * safe even when called on a bare classifyRenderedValue() result (no plan row enrichment).
     * Anything that is not explicitly renderable produces an empty string. */
    formatRowValue: function (row) {
      if (!row) return '';
      const decision = row.renderDecision;
      if (row.classifiedAs === STATUS.NOT_APPLICABLE) return '';
      if (decision === 'DO_NOT_RENDER') return '';
      if (row.badgeOnly === true || decision === 'PENDING_BADGE') {
        return '<span class="spec-pending-badge" style="color: #fbbf24; font-size: 0.72rem;">' +
          BANNER_TEXT.PLACEHOLDER + '</span>';
      }
      if (row.classifiedAs === STATUS.VERIFIED_NOT_SUPPORTED) {
        return '<span class="spec-not-supported" style="color: var(--text-muted); font-size: 0.82rem;">' +
          String(row.value) + '</span>';
      }
      if (row.classifiedAs === STATUS.VERIFIED && decision === 'RENDER' && row.valuePresent === true) {
        return String(row.value);
      }
      return '';
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MobileUiVerificationMap = api;
})(typeof window !== 'undefined' ? window : globalThis);