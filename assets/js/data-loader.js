/**
 * Samsung Branch Operations - Data Loading Gate
 * Architectural Purpose: Defers loading of stock and promotion datasets until user is authenticated.
 * 
 * IMPORTANT ARCHITECTURAL NOTE:
 * This is a client-side Data Loading Gate designed to reduce unnecessary data exposure before login.
 * It is NOT a cryptographic or server-side security boundary, as static assets may still be requested
 * directly at the network layer if public hosting lacks deployment protection.
 */

(function(window) {
  'use strict';

  class DataLoaderGate {
    constructor() {
      this.isLoaded = false;
      this.isLoading = false;
      this.loadPromise = null;
    }

    /**
     * Check if stock database has been loaded into memory.
     */
    hasData() {
      return Boolean(window.STOCK_DATABASE && window.STOCK_DATABASE.length > 0);
    }

    /**
     * Dynamically inject a script and wait for its completion.
     */
    _loadScript(src) {
      return new Promise((resolve, reject) => {
        // Check if script element already exists
        const existing = document.querySelector(`script[src^="${src}"]`);
        if (existing) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = `${src}?v=${Date.now()}`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (err) => reject(new Error(`Failed to load dataset: ${src}`));
        document.body.appendChild(script);
      });
    }

    /**
     * Load stock and promotion datasets on demand after authentication.
     */
    async loadAuthenticatedDatasets() {
      // If unauthenticated, halt immediately
      if (window.AuthService && !window.AuthService.isAuthenticated()) {
        console.warn("[DataLoaderGate] Blocked attempt to load data without active session.");
        return false;
      }

      if (this.isLoaded && this.hasData()) {
        return true;
      }

      if (this.isLoading) {
        return this.loadPromise;
      }

      this.isLoading = true;
      console.info("[DataLoaderGate] Authenticated session confirmed. Fetching branch datasets on-demand...");

      this.loadPromise = (async () => {
        try {
          await this._loadScript("stock_data.js");
          await this._loadScript("promotion_variants.js");

          // Stock Provider Hierarchy: 1. Confirmed IndexedDB Snapshot -> 2. StaticDataProvider -> 3. DATA_UNAVAILABLE
          let snapshotLoaded = false;
          if (window.StockStorageAdapter && typeof window.StockStorageAdapter.getActiveSnapshot === "function") {
            try {
              const localSnapshot = await window.StockStorageAdapter.getActiveSnapshot();
              if (localSnapshot) {
                const validation = window.StockStorageAdapter.validateSnapshot 
                  ? window.StockStorageAdapter.validateSnapshot(localSnapshot)
                  : { valid: Boolean(localSnapshot.data && localSnapshot.data.length > 0) };

                if (validation.valid) {
                  window.STOCK_DATABASE = localSnapshot.data;
                  if (localSnapshot.meta) {
                    window.STOCK_METADATA = localSnapshot.meta;
                  }
                  window.STOCK_SNAPSHOT_STATUS = "CONFIRMED_LOCAL_SNAPSHOT";
                  snapshotLoaded = true;
                  console.info("[DataLoaderGate] Restored validated active stock snapshot from IndexedDB (LOCAL_BROWSER_ONLY):", localSnapshot.batchId);
                } else {
                  console.warn("[DataLoaderGate] Snapshot in IndexedDB failed validation. Falling back to static dataset:", validation.reason);
                  window.STOCK_SNAPSHOT_STATUS = "LOCAL_SNAPSHOT_INVALID";
                  window.STOCK_SNAPSHOT_ERROR = validation.reason;
                  // Strict Safety: NEVER use partial corrupt data; keep static dataset from stock_data.js intact
                }
              }
            } catch (e) {
              console.warn("[DataLoaderGate] Error evaluating IndexedDB snapshot, using static baseline:", e);
              window.STOCK_SNAPSHOT_STATUS = "LOCAL_SNAPSHOT_INVALID";
              window.STOCK_SNAPSHOT_ERROR = e.message;
            }
          }

          if (!snapshotLoaded && !window.STOCK_SNAPSHOT_STATUS) {
            window.STOCK_SNAPSHOT_STATUS = window.STOCK_DATABASE ? "STATIC_BASELINE" : "DATA_UNAVAILABLE";
          }

          // Sync masterStockData in app.js if app.js is already running
          if (typeof window.syncMasterStockData === "function") {
            window.syncMasterStockData();
          }

          // Promotion Provider Hierarchy: 1. Confirmed IndexedDB Promo Snapshot -> 2. Static baseline
          if (window.PromoStorageAdapter && typeof window.PromoStorageAdapter.getActiveSnapshot === "function") {
            try {
              const promoSnapshot = await window.PromoStorageAdapter.getActiveSnapshot();
              if (promoSnapshot && Array.isArray(promoSnapshot.publishedItems) && promoSnapshot.publishedItems.length > 0) {
                window.PROMOTION_VARIANTS = promoSnapshot.publishedItems;
                if (promoSnapshot.meta) {
                  window.PROMOTION_BATCH_METADATA = promoSnapshot.meta;
                }
                window.PROMOTION_SNAPSHOT_STATUS = "CONFIRMED_LOCAL_PROMO_SNAPSHOT";
                console.info("[DataLoaderGate] Restored validated active promotion snapshot from IndexedDB (LOCAL_BROWSER_ONLY):", promoSnapshot.batchId);
              }
            } catch (e) {
              console.warn("[DataLoaderGate] Error evaluating Promo IndexedDB snapshot, using static baseline:", e);
            }
          }

          // Re-sync masterStockData and metrics with restored promotion snapshot
          if (typeof window.syncMasterStockData === "function") {
            window.syncMasterStockData();
          }

          this.isLoaded = true;
          this.isLoading = false;
          console.info("[DataLoaderGate] Branch datasets successfully initialized in memory. Total stock items:", window.STOCK_DATABASE ? window.STOCK_DATABASE.length : 0);
          return true;
        } catch (err) {
          this.isLoading = false;
          console.error("[DataLoaderGate] Error loading branch datasets:", err);
          return false;
        }
      })();

      return this.loadPromise;
    }

    /**
     * Unload datasets from browser memory upon logout.
     */
    purgeMemoryDatasets() {
      window.STOCK_DATABASE = null;
      window.PROMOTION_VARIANTS = null;
      this.isLoaded = false;
      this.isLoading = false;
      this.loadPromise = null;

      // Remove script tags from DOM
      const scripts = document.querySelectorAll('script[src*="stock_data.js"], script[src*="promotion_variants.js"]');
      scripts.forEach(s => s.remove());

      if (typeof window.syncMasterStockData === "function") {
        window.syncMasterStockData();
      }

      console.info("[DataLoaderGate] Branch datasets successfully purged from browser memory.");
    }
  }

  window.DataLoader = new DataLoaderGate();

})(window);
