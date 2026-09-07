/**
 * Samsung Branch Operations - Data Service Abstraction Layer
 * Architecture: Pluggable Data Provider Pattern (StaticDataProvider vs. ApiDataProvider)
 * 
 * Prepares the application shell for Phase C (Backend & Enterprise Authentication Migration)
 * without breaking existing client-side logic.
 */

(function(window) {
  'use strict';

  /**
   * Base Data Provider Interface
   */
  class BaseDataProvider {
    async getStock(filters = {}) {
      throw new Error("Method getStock() must be implemented by provider");
    }

    async getPromotions(filters = {}) {
      throw new Error("Method getPromotions() must be implemented by provider");
    }

    async getStockSummary() {
      throw new Error("Method getStockSummary() must be implemented by provider");
    }

    async getAuditSummary() {
      throw new Error("Method getAuditSummary() must be implemented by provider");
    }

    async getSystemMetadata() {
      throw new Error("Method getSystemMetadata() must be implemented by provider");
    }
  }

  /**
   * Static Data Provider (Phase A / Current Default)
   * Reads from client-side window.STOCK_DATABASE and window.PROMOTION_VARIANTS.
   */
  class StaticDataProvider extends BaseDataProvider {
    constructor() {
      super();
      this.providerName = "STATIC_DATASET";
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
        batchId: "IMPORT-20260906-002",
        quarantineCompliance: "100%"
      };
    }

    async getSystemMetadata() {
      return {
        provider: this.providerName,
        dataMode: "CLIENT_IN_MEMORY",
        authMode: window.APP_CONFIG ? window.APP_CONFIG.authMode : "DEVELOPMENT",
        version: window.APP_CONFIG ? window.APP_CONFIG.version : "2026.09-v1"
      };
    }
  }

  /**
   * API Data Provider (Phase C Target Architecture)
   * Fetches data dynamically from an authenticated serverless / REST API endpoint.
   */
  class ApiDataProvider extends BaseDataProvider {
    constructor(config = {}) {
      super();
      this.providerName = "REST_API";
      this.baseUrl = config.baseUrl || "/api/v1";
    }

    getAuthHeader() {
      const session = window.AuthService ? window.AuthService.getSession() : null;
      if (!session) return {};
      return {
        "Authorization": `Bearer ${session.token || "DEV_TOKEN"}`,
        "X-Branch-Code": session.branchCode || "CPW-01"
      };
    }

    async _fetchJson(endpoint, params = {}) {
      const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);
      Object.keys(params).forEach(k => {
        if (params[k] !== undefined && params[k] !== null) {
          url.searchParams.append(k, params[k]);
        }
      });

      const response = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeader()
        }
      });

      if (!response.ok) {
        throw new Error(`API Request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    }

    async getStock(filters = {}) {
      return await this._fetchJson("/stock", filters);
    }

    async getPromotions(filters = {}) {
      return await this._fetchJson("/promotions", filters);
    }

    async getStockSummary() {
      return await this._fetchJson("/stock/summary");
    }

    async getAuditSummary() {
      return await this._fetchJson("/audit/summary");
    }

    async getSystemMetadata() {
      return await this._fetchJson("/system/metadata");
    }
  }

  /**
   * DataService Facade
   */
  class DataServiceFacade {
    constructor() {
      // Default to StaticDataProvider in Phase A/B
      this.provider = new StaticDataProvider();
    }

    /**
     * Switch active data provider (e.g. for testing or Phase C migration).
     */
    setProvider(newProvider) {
      if (newProvider instanceof BaseDataProvider) {
        console.info(`[DataService] Data provider switched to: ${newProvider.providerName}`);
        this.provider = newProvider;
      } else {
        console.error("[DataService] Invalid provider. Must inherit from BaseDataProvider.");
      }
    }

    getActiveProviderName() {
      return this.provider ? this.provider.providerName : "NONE";
    }

    async getStock(filters) {
      return await this.provider.getStock(filters);
    }

    async getPromotions(filters) {
      return await this.provider.getPromotions(filters);
    }

    async getStockSummary() {
      return await this.provider.getStockSummary();
    }

    async getAuditSummary() {
      return await this.provider.getAuditSummary();
    }

    async getSystemMetadata() {
      return await this.provider.getSystemMetadata();
    }
  }

  // Register on window
  window.BaseDataProvider = BaseDataProvider;
  window.StaticDataProvider = StaticDataProvider;
  window.ApiDataProvider = ApiDataProvider;
  window.DataService = new DataServiceFacade();

})(window);
