/**
 * Samsung Branch Operations - Vendor-Neutral Service Abstraction Layer
 * 
 * Architecture:
 * 1. DataProvider (Vendor-Neutral: Static, REST API, Supabase, Future)
 * 2. AuthProvider (Decoupled: Development, Passwordless, Supabase, Future)
 * 3. MonitoringAdapter (Console, Supabase, Sentry with Strict Data Redaction)
 * 
 * Complies with Independent Backend Foundation (Zero vendor lock-in, zero external leaks).
 */

(function(window) {
  'use strict';

  /**
   * System Global Configuration
   */
  const SYSTEM_CONFIG = Object.freeze({
    dataProvider: "STATIC",
    authProvider: "DEVELOPMENT",
    notebookLmMode: "READ_ONLY",
    apiEnabled: false,
    supabaseEnabled: false,
    externalMonitoringEnabled: false,
    version: "2026.09-v2",
    buildCommit: "802a786"
  });

  // ============================================================================
  // 1. DATA PROVIDER INTERFACE & IMPLEMENTATIONS
  // ============================================================================

  /**
   * Base DataProvider Interface
   */
  class DataProvider {
    constructor(providerName = "BASE") {
      this.providerName = providerName;
    }

    async getStock(filters = {}) {
      throw new Error(`Method getStock() not implemented by ${this.providerName}`);
    }

    async getPromotions(filters = {}) {
      throw new Error(`Method getPromotions() not implemented by ${this.providerName}`);
    }

    async getStockSummary() {
      throw new Error(`Method getStockSummary() not implemented by ${this.providerName}`);
    }

    async getAuditSummary() {
      throw new Error(`Method getAuditSummary() not implemented by ${this.providerName}`);
    }

    async getMetadata() {
      throw new Error(`Method getMetadata() not implemented by ${this.providerName}`);
    }

    async healthCheck() {
      return { status: "UP", provider: this.providerName, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Static Data Provider (Default in Phase A/B)
   * Reads from validated in-memory datasets loaded via DataLoader.
   */
  class StaticDataProvider extends DataProvider {
    constructor() {
      super("STATIC");
    }

    async ensureDataLoaded() {
      if (window.DataLoader && !window.DataLoader.hasData()) {
        await window.DataLoader.loadAuthenticatedDatasets();
      }
    }

    async getStock(filters = {}) {
      await this.ensureDataLoaded();
      let items = window.STOCK_DATABASE || [];

      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        items = items.filter(item => 
          (item.model && item.model.toLowerCase().includes(q)) ||
          (item.pn && item.pn.toLowerCase().includes(q)) ||
          (item.color && item.color.toLowerCase().includes(q))
        );
      }

      if (filters.category && filters.category !== "all") {
        items = items.filter(item => item.category === filters.category);
      }

      if (filters.inStockOnly) {
        items = items.filter(item => (item.total || 0) > 0);
      }

      return items;
    }

    async getPromotions(filters = {}) {
      await this.ensureDataLoaded();
      let variants = window.PROMOTION_VARIANTS || [];

      if (filters.pn) {
        variants = variants.filter(v => v.pn === filters.pn);
      }

      if (filters.saleMode && filters.saleMode !== "ALL") {
        variants = variants.filter(v => v.saleMode === filters.saleMode);
      }

      if (filters.activeOnly !== false) {
        variants = variants.filter(v => v.isActive !== false && v.validationStatus !== "BLOCKED_INVALID");
      }

      return variants;
    }

    async getStockSummary() {
      await this.ensureDataLoaded();
      const items = window.STOCK_DATABASE || [];

      let totalUnits = 0;
      let f1Units = 0;
      let f2Units = 0;
      let inStockCount = 0;
      let outOfStockCount = 0;

      items.forEach(item => {
        const f1 = item.f1 || 0;
        const f2 = item.f2 || 0;
        const total = item.total || 0;

        totalUnits += total;
        f1Units += f1;
        f2Units += f2;

        if (total > 0) {
          inStockCount++;
        } else {
          outOfStockCount++;
        }
      });

      return {
        totalSkus: items.length,
        totalUnits,
        f1Units,
        f2Units,
        inStockCount,
        outOfStockCount,
        lastUpdated: new Date().toISOString()
      };
    }

    async getAuditSummary() {
      await this.ensureDataLoaded();
      const variants = window.PROMOTION_VARIANTS || [];
      const totalVariants = variants.length;
      const activeCount = variants.filter(v => v.isActive !== false && v.validationStatus !== "BLOCKED_INVALID").length;
      const blockedCount = totalVariants - activeCount;

      return {
        totalVariants,
        activeCount,
        blockedCount,
        stockBatchId: "IMPORT-20260906-002",
        promotionBatchId: "BATCH-20260907-105441",
        quarantineCompliance: "100%"
      };
    }

    async getMetadata() {
      return {
        provider: this.providerName,
        dataMode: "CLIENT_IN_MEMORY",
        authMode: SYSTEM_CONFIG.authProvider,
        version: SYSTEM_CONFIG.version,
        notebookLmMode: SYSTEM_CONFIG.notebookLmMode
      };
    }

    async healthCheck() {
      const hasStock = Boolean(window.STOCK_DATABASE && window.STOCK_DATABASE.length > 0);
      const hasPromo = Boolean(window.PROMOTION_VARIANTS && window.PROMOTION_VARIANTS.length > 0);
      return {
        status: (hasStock && hasPromo) ? "UP" : "DEGRADED",
        provider: this.providerName,
        stockLoaded: hasStock,
        promotionsLoaded: hasPromo,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * REST API Data Provider (Generic Vendor-Neutral Serverless / Express / Fastify)
   */
  class RestApiDataProvider extends DataProvider {
    constructor(config = {}) {
      super("REST_API");
      this.baseUrl = config.baseUrl || "/api/v1";
      this.status = SYSTEM_CONFIG.apiEnabled ? "ACTIVE" : "NOT_CONFIGURED";
    }

    _getAuthHeaders() {
      const session = window.AuthService ? window.AuthService.getSession() : null;
      if (!session) return {};
      return {
        "Authorization": `Bearer ${session.token || "SESSION_TOKEN"}`,
        "X-Branch-Code": session.branchCode || "CPW-01"
      };
    }

    async _fetch(endpoint, params = {}) {
      if (this.status === "NOT_CONFIGURED") {
        throw new Error("RestApiDataProvider is NOT_CONFIGURED. Please use StaticDataProvider.");
      }
      const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);
      Object.keys(params).forEach(k => {
        if (params[k] !== undefined && params[k] !== null) {
          url.searchParams.append(k, params[k]);
        }
      });
      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json", ...this._getAuthHeaders() }
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    }

    async getStock(filters = {}) { return await this._fetch("/stock", filters); }
    async getPromotions(filters = {}) { return await this._fetch("/promotions", filters); }
    async getStockSummary() { return await this._fetch("/stock/summary"); }
    async getAuditSummary() { return await this._fetch("/audit/summary"); }
    async getMetadata() { return await this._fetch("/system/metadata"); }
    async healthCheck() {
      return { status: this.status, provider: this.providerName, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Supabase Data Provider (Reserved for Independent Backend Architecture)
   */
  class SupabaseDataProvider extends DataProvider {
    constructor() {
      super("SUPABASE");
      this.status = "NOT_CONFIGURED";
    }
    async getStock() { throw new Error("SupabaseDataProvider is NOT_CONFIGURED."); }
    async getPromotions() { throw new Error("SupabaseDataProvider is NOT_CONFIGURED."); }
    async getStockSummary() { throw new Error("SupabaseDataProvider is NOT_CONFIGURED."); }
    async getAuditSummary() { throw new Error("SupabaseDataProvider is NOT_CONFIGURED."); }
    async getMetadata() { return { provider: this.providerName, status: this.status }; }
    async healthCheck() { return { status: this.status, provider: this.providerName }; }
  }

  /**
   * Future Data Provider (Extensibility Placeholder)
   */
  class FutureDataProvider extends DataProvider {
    constructor() {
      super("FUTURE_PROVIDER");
      this.status = "NOT_CONFIGURED";
    }
    async healthCheck() { return { status: this.status, provider: this.providerName }; }
  }

  // ============================================================================
  // 2. AUTH PROVIDER INTERFACE & IMPLEMENTATIONS
  // ============================================================================

  /**
   * Base AuthProvider Interface
   */
  class AuthProvider {
    constructor(providerName = "BASE_AUTH") {
      this.providerName = providerName;
    }
    async login(credentials) { throw new Error("login() not implemented"); }
    async logout() { throw new Error("logout() not implemented"); }
    async getSession() { throw new Error("getSession() not implemented"); }
    async isAuthenticated() { throw new Error("isAuthenticated() not implemented"); }
    async healthCheck() { return { status: "UP", provider: this.providerName }; }
  }

  /**
   * Development Auth Provider (Local Session UI Gate)
   */
  class DevelopmentAuthProvider extends AuthProvider {
    constructor() {
      super("DEVELOPMENT");
    }
    async login(credentials) {
      if (window.AuthService) {
        return window.AuthService.login(credentials.employeeId, credentials.passcode, credentials.branchCode);
      }
      return { success: false, error: "AuthService not loaded" };
    }
    async logout() {
      if (window.AuthService) return window.AuthService.logout();
    }
    async getSession() {
      return window.AuthService ? window.AuthService.getSession() : null;
    }
    async isAuthenticated() {
      return window.AuthService ? window.AuthService.isAuthenticated() : false;
    }
    async healthCheck() {
      return { status: "UP", provider: this.providerName, authenticated: await this.isAuthenticated() };
    }
  }

  /**
   * Passwordless Auth Provider (Magic Link / WebAuthn / OTP - Future)
   */
  class PasswordlessAuthProvider extends AuthProvider {
    constructor() {
      super("PASSWORDLESS");
      this.status = "NOT_CONFIGURED";
    }
    async login() { throw new Error("PasswordlessAuthProvider is NOT_CONFIGURED."); }
    async logout() {}
    async getSession() { return null; }
    async isAuthenticated() { return false; }
    async healthCheck() { return { status: this.status, provider: this.providerName }; }
  }

  /**
   * Supabase Auth Provider (Future Option)
   */
  class SupabaseAuthProvider extends AuthProvider {
    constructor() {
      super("SUPABASE_AUTH");
      this.status = "NOT_CONFIGURED";
    }
    async login() { throw new Error("SupabaseAuthProvider is NOT_CONFIGURED."); }
    async logout() {}
    async getSession() { return null; }
    async isAuthenticated() { return false; }
    async healthCheck() { return { status: this.status, provider: this.providerName }; }
  }

  /**
   * Future Auth Provider Placeholder
   */
  class FutureAuthProvider extends AuthProvider {
    constructor() {
      super("FUTURE_AUTH");
      this.status = "NOT_CONFIGURED";
    }
    async healthCheck() { return { status: this.status, provider: this.providerName }; }
  }

  // ============================================================================
  // 3. MONITORING ADAPTER WITH STRICT DATA REDACTION
  // ============================================================================

  /**
   * Base Monitoring Adapter
   */
  class BaseMonitoringAdapter {
    constructor(adapterName = "BASE_MONITOR") {
      this.adapterName = adapterName;
    }

    /**
     * Strict Log Redaction:
     * Removes passwords, full employee IDs, tokens, cookies, auth headers, customer data, and raw Excel rows.
     */
    redact(data) {
      if (!data) return data;
      if (typeof data === "string") {
        return data
          .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]")
          .replace(/password\s*[:=]\s*["']?[^"'\s]+/gi, "password=[REDACTED]")
          .replace(/passcode\s*[:=]\s*["']?[^"'\s]+/gi, "passcode=[REDACTED]");
      }
      if (typeof data !== "object") return data;

      if (Array.isArray(data)) {
        return data.map(item => this.redact(item));
      }

      const redactedObj = {};
      const prohibitedKeys = [
        "password", "passcode", "employeeId", "token", "accessToken", "refreshToken",
        "authorization", "cookie", "cookies", "customerData", "rawExcelRow",
        "apiKey", "clientSecret", "secret", "privateKey"
      ];

      Object.keys(data).forEach(key => {
        const lowerKey = key.toLowerCase();
        const isProhibited = prohibitedKeys.some(pk => lowerKey.includes(pk.toLowerCase()));
        if (isProhibited) {
          redactedObj[key] = "[REDACTED]";
        } else {
          redactedObj[key] = this.redact(data[key]);
        }
      });

      return redactedObj;
    }

    logEvent(level, message, context = {}) {
      throw new Error("logEvent() not implemented");
    }

    captureError(error, context = {}) {
      throw new Error("captureError() not implemented");
    }
  }

  /**
   * Console Monitoring Adapter (Active in Development)
   */
  class ConsoleMonitoring extends BaseMonitoringAdapter {
    constructor() {
      super("CONSOLE");
    }

    logEvent(level, message, context = {}) {
      const cleanContext = this.redact(context);
      const entry = {
        timestamp: new Date().toISOString(),
        applicationVersion: SYSTEM_CONFIG.version,
        route: window.location.hash || "#/",
        level,
        message,
        context: cleanContext
      };
      if (level === "error") {
        console.error(`[BranchMonitor] [${level.toUpperCase()}] ${message}`, cleanContext);
      } else if (level === "warn") {
        console.warn(`[BranchMonitor] [${level.toUpperCase()}] ${message}`, cleanContext);
      } else {
        console.info(`[BranchMonitor] [${level.toUpperCase()}] ${message}`, cleanContext);
      }
      return entry;
    }

    captureError(error, context = {}) {
      const cleanContext = this.redact(context);
      const entry = {
        timestamp: new Date().toISOString(),
        applicationVersion: SYSTEM_CONFIG.version,
        route: window.location.hash || "#/",
        errorCode: error.code || "UNCAUGHT_RUNTIME_ERROR",
        errorType: error.name || "Error",
        errorMessage: error.message,
        context: cleanContext
      };
      console.error(`[BranchMonitor] [ERROR-CAPTURED] ${error.message}`, entry);
      return entry;
    }
  }

  /**
   * Supabase Monitoring Adapter (NOT_CONFIGURED)
   */
  class SupabaseMonitoring extends BaseMonitoringAdapter {
    constructor() {
      super("SUPABASE_LOGGING");
      this.status = "NOT_CONFIGURED";
    }
    logEvent() {}
    captureError() {}
  }

  /**
   * Sentry Monitoring Adapter (NOT_CONFIGURED)
   */
  class SentryMonitoring extends BaseMonitoringAdapter {
    constructor() {
      super("SENTRY");
      this.status = "NOT_CONFIGURED";
    }
    logEvent() {}
    captureError() {}
  }

  // ============================================================================
  // 4. FACADE SERVICES & INITIALIZATION
  // ============================================================================

  class DataServiceFacade {
    constructor() {
      this.provider = new StaticDataProvider();
    }

    setProvider(provider) {
      if (provider instanceof DataProvider) {
        this.provider = provider;
        console.info(`[DataService] Provider switched to ${provider.providerName}`);
      } else {
        console.error("[DataService] Invalid DataProvider instance");
      }
    }

    async getStock(filters) { return await this.provider.getStock(filters); }
    async getPromotions(filters) { return await this.provider.getPromotions(filters); }
    async getStockSummary() { return await this.provider.getStockSummary(); }
    async getAuditSummary() { return await this.provider.getAuditSummary(); }
    async getMetadata() { return await this.provider.getMetadata(); }
    async healthCheck() { return await this.provider.healthCheck(); }
  }

  class MonitoringServiceFacade {
    constructor() {
      this.adapter = new ConsoleMonitoring();
    }
    logEvent(level, message, context) { return this.adapter.logEvent(level, message, context); }
    captureError(error, context) { return this.adapter.captureError(error, context); }
  }

  // Register Global Symbols
  window.SYSTEM_CONFIG = SYSTEM_CONFIG;
  window.DataProvider = DataProvider;
  window.StaticDataProvider = StaticDataProvider;
  window.RestApiDataProvider = RestApiDataProvider;
  window.SupabaseDataProvider = SupabaseDataProvider;
  window.FutureDataProvider = FutureDataProvider;

  window.AuthProvider = AuthProvider;
  window.DevelopmentAuthProvider = DevelopmentAuthProvider;
  window.PasswordlessAuthProvider = PasswordlessAuthProvider;
  window.SupabaseAuthProvider = SupabaseAuthProvider;
  window.FutureAuthProvider = FutureAuthProvider;

  window.BaseMonitoringAdapter = BaseMonitoringAdapter;
  window.ConsoleMonitoring = ConsoleMonitoring;
  window.SupabaseMonitoring = SupabaseMonitoring;
  window.SentryMonitoring = SentryMonitoring;

  window.DataService = new DataServiceFacade();
  window.MonitoringService = new MonitoringServiceFacade();

})(window);
