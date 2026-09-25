/* Static runtime policy only. It never reads URL, request data, or browser storage. */
(function (root) {
  'use strict';

  function evaluatePricingRuntime(config, dependencies) {
    const runtime = config || {}, deps = dependencies || {};
    if (deps.engine && deps.adapter) {
      return {
        valid: true,
        engine: 'V2',
        status: 'READY',
        businessUseAllowed: true,
        cloudDraftAllowed: true,
        databaseAction: 'PERMIT',
        warnings: []
      };
    }
    if (runtime.environment === 'development' && runtime.allowLegacyPricingEngine === true) {
      return {
        valid: true,
        engine: 'LEGACY',
        status: 'DEVELOPMENT_ONLY',
        businessUseAllowed: false,
        cloudDraftAllowed: false,
        databaseAction: 'DO_NOT_INSERT_OFFER',
        warningCode: 'LEGACY_PRICING_ENGINE_ACTIVE',
        message: 'ระบบคำนวณราคาแบบดั้งเดิม (Legacy Engine Active) ใช้ได้เฉพาะ Development Mode เท่านั้น'
      };
    }
    return {
      valid: false,
      engine: null,
      code: 'PRICING_ENGINE_UNAVAILABLE',
      status: 'BLOCKED',
      businessUseAllowed: false,
      cloudDraftAllowed: false,
      databaseAction: 'DO_NOT_INSERT_OFFER',
      message: 'ระบบคำนวณราคา V2 ไม่พร้อมใช้งาน (PRICING_ENGINE_UNAVAILABLE) กรุณาโหลดหน้าใหม่หรือติดต่อผู้ดูแล'
    };
  }

  function getRuntimeStatus(config, dependencies) {
    const cfg = config || (typeof window !== 'undefined' ? window.PRICING_CONFIG : (typeof globalThis !== 'undefined' ? globalThis.PRICING_CONFIG : {})) || {};
    const deps = dependencies || {
      engine: (typeof window !== 'undefined' ? window.PromotionPricingEngine : (typeof globalThis !== 'undefined' ? globalThis.PromotionPricingEngine : null)),
      adapter: (typeof window !== 'undefined' ? window.PromotionPricingAdapter : (typeof globalThis !== 'undefined' ? globalThis.PromotionPricingAdapter : null))
    };
    return evaluatePricingRuntime(cfg, deps);
  }

  function canSaveCloudDraft(runtime, calculation) {
    return runtime && calculation && runtime.engine === 'V2' && runtime.valid === true && runtime.businessUseAllowed === true && runtime.cloudDraftAllowed === true && calculation.valid === true && calculation.engineVersion && calculation.schemaVersion && calculation.sourceFields && calculation.guards && calculation.guards.priceFormula === 'PASS'
      ? { allowed: true }
      : { allowed: false, code: 'PRICING_ENGINE_REQUIRED_FOR_CLOUD_DRAFT' };
  }

  function assertPricingReadyForCloudDraft({ runtimeDecision, calculationResults }) {
    const results = Array.isArray(calculationResults) ? calculationResults : (calculationResults ? [calculationResults] : []);
    const runtimeOk = runtimeDecision && runtimeDecision.valid && runtimeDecision.engine === 'V2' && runtimeDecision.status === 'READY' && runtimeDecision.businessUseAllowed && runtimeDecision.cloudDraftAllowed;
    const calculationsOk = results.length > 0 && results.every((item) =>
      item &&
      item.valid === true &&
      item.engineVersion &&
      item.schemaVersion &&
      item.sourceFields &&
      item.guards &&
      item.guards.priceFormula === 'PASS' &&
      !['BLOCKED', 'REVIEW_REQUIRED', 'INPUT_REQUIRED'].includes(item.status) &&
      !item.errorCode &&
      !item.unresolvedFields &&
      !item.legacyWarning
    );
    return runtimeOk && calculationsOk
      ? { valid: true, allowed: true, databaseAction: 'PERMIT' }
      : { valid: false, allowed: false, code: 'PRICING_ENGINE_REQUIRED_FOR_CLOUD_DRAFT', status: 'BLOCKED', databaseAction: 'DO_NOT_INSERT_OFFER' };
  }

  function savePromotionDraft({ payload, runtimeDecision, calculationResults, saveClient }) {
    const gate = assertPricingReadyForCloudDraft({ runtimeDecision, calculationResults });
    if (!gate.valid) return gate;
    if (typeof saveClient === 'function') {
      return saveClient(payload);
    }
    return { valid: true, allowed: true, databaseAction: 'PERMIT' };
  }

  function guardDatabasePreview({ runtimeDecision, calculationResults, previewClient }) {
    const gate = assertPricingReadyForCloudDraft({ runtimeDecision, calculationResults });
    if (!gate.valid) {
      return { allowed: false, code: 'PRICING_ENGINE_REQUIRED_FOR_CLOUD_DRAFT', status: 'BLOCKED', databaseAction: 'DO_NOT_INSERT_OFFER' };
    }
    if (typeof previewClient === 'function') {
      return previewClient();
    }
    return { allowed: true, databaseAction: 'PERMIT' };
  }

  function guardOfferPayloadCreation({ runtimeDecision, calculationResults, payloadBuilder, items }) {
    const gate = assertPricingReadyForCloudDraft({ runtimeDecision, calculationResults });
    if (!gate.valid) {
      return { allowed: false, code: 'PRICING_ENGINE_REQUIRED_FOR_CLOUD_DRAFT', status: 'BLOCKED', databaseAction: 'DO_NOT_INSERT_OFFER', offers: [] };
    }
    if (typeof payloadBuilder === 'function') {
      return { allowed: true, databaseAction: 'PERMIT', offers: payloadBuilder(items) };
    }
    return { allowed: true, databaseAction: 'PERMIT' };
  }

  function guardBatchDraftSave({ payload, runtimeDecision, calculationResults, saveClient }) {
    return savePromotionDraft({ payload, runtimeDecision, calculationResults, saveClient });
  }

  function guardSingleDraftSave({ payload, runtimeDecision, calculationResult, saveClient }) {
    return savePromotionDraft({ payload, runtimeDecision, calculationResults: [calculationResult], saveClient });
  }

  function guardRetryDraftSave({ payload, runtimeDecision, calculationResults, retryClient }) {
    const gate = assertPricingReadyForCloudDraft({ runtimeDecision, calculationResults });
    if (!gate.valid) {
      return { allowed: false, code: 'PRICING_ENGINE_REQUIRED_FOR_CLOUD_DRAFT', status: 'BLOCKED', databaseAction: 'DO_NOT_INSERT_OFFER' };
    }
    if (typeof retryClient === 'function') {
      return retryClient(payload);
    }
    return { allowed: true, retried: true };
  }

  const api = {
    evaluatePricingRuntime,
    getRuntimeStatus,
    canSaveCloudDraft,
    assertPricingReadyForCloudDraft,
    savePromotionDraft,
    guardDatabasePreview,
    guardOfferPayloadCreation,
    guardBatchDraftSave,
    guardSingleDraftSave,
    guardRetryDraftSave
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PromotionPricingRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis);
