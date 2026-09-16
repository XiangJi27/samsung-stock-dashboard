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
     * Centralized Stock Dataset Selector following 3-tier hierarchy:
     * 1. IndexedDB Confirmed Import ล่าสุด
     * 2. Pilot Packaged Snapshot ล่าสุด
     * 3. Static Baseline Snapshot
     */
    static getActiveStockDataset() {
      if (window.CONFIRMED_LOCAL_SNAPSHOT?.data && Array.isArray(window.CONFIRMED_LOCAL_SNAPSHOT.data) && window.CONFIRMED_LOCAL_SNAPSHOT.data.length > 0) {
        return window.CONFIRMED_LOCAL_SNAPSHOT.data;
      }
      if (window.LATEST_STOCK_SNAPSHOT && Array.isArray(window.LATEST_STOCK_SNAPSHOT) && window.LATEST_STOCK_SNAPSHOT.length > 0) {
        return window.LATEST_STOCK_SNAPSHOT;
      }
      return window.STOCK_DATABASE || [];
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

          // Stock Provider Hierarchy: 1. Central Database (/api/stock/active) -> 2. IndexedDB Offline Cache -> 3. StaticDataProvider
          let snapshotLoaded = false;

          // Step 1: Query Central Database Active Batch
          try {
            const client = window.SupabaseAdapter?.getClient();
            let token = null;
            if (client) {
              const { data } = await client.auth.getSession();
              token = data?.session?.access_token;
            }
            const headers = { 'Cache-Control': 'no-store' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch('/api/stock/active?branch_code=AYUTTHAYA_CITY_PARK', {
              headers,
              cache: 'no-store'
            });

            if (response.ok) {
              const centralData = await response.json();
              if (centralData && Array.isArray(centralData.items) && centralData.items.length > 0) {
                window.STOCK_DATABASE = centralData.items;
                window.STOCK_DATA = centralData.items;
                window.STOCK_METADATA = {
                  stockBatchId: centralData.batchId,
                  importBatchId: centralData.batchId,
                  sourceType: "Nimbus Excel Database Snapshot",
                  sourceFile: centralData.sourceFileName,
                  sourceFilename: centralData.sourceFileName,
                  sourceFileHash: centralData.sourceFileSha256,
                  importedAt: centralData.importedAt,
                  activatedAt: centralData.activatedAt,
                  storageScope: 'CENTRAL_DATABASE',
                  storageMode: 'NIMBUS_EXCEL_DATABASE_SNAPSHOT',
                  recordCount: centralData.summary.totalRows,
                  uniquePn: centralData.summary.totalRows,
                  f1Total: centralData.summary.f1Total,
                  f2Total: centralData.summary.f2Total,
                  grandTotal: centralData.summary.totalQuantity || (centralData.summary.f1Total + centralData.summary.f2Total)
                };
                window.STOCK_SNAPSHOT_STATUS = "CENTRAL_DATABASE";
                snapshotLoaded = true;
                console.info("[DataLoaderGate] Successfully loaded active stock snapshot from Central Database:", centralData.batchId);

                // Cache active snapshot in IndexedDB for offline resilience
                if (window.StockStorageAdapter && typeof window.StockStorageAdapter.saveBatch === "function") {
                  window.StockStorageAdapter.saveBatch({
                    batchId: centralData.batchId,
                    data: centralData.items,
                    meta: window.STOCK_METADATA
                  }).catch(e => console.warn("[DataLoaderGate] Failed to cache snapshot in IndexedDB:", e));
                }
              }
            }
          } catch (netErr) {
            console.warn("[DataLoaderGate] Central database unavailable, falling back to local offline cache:", netErr.message);
          }

          // Step 2: Fallback to local IndexedDB if Central Database was unreachable or returned 404
          if (!snapshotLoaded && window.StockStorageAdapter && typeof window.StockStorageAdapter.getActiveSnapshot === "function") {
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
                  window.STOCK_SNAPSHOT_STATUS = localSnapshot.meta?.storageScope === 'CENTRAL_DATABASE' ? "CENTRAL_DATABASE_OFFLINE_CACHE" : "CONFIRMED_LOCAL_SNAPSHOT";
                  snapshotLoaded = true;
                  console.info("[DataLoaderGate] Restored validated stock snapshot from IndexedDB cache:", localSnapshot.batchId);
                } else {
                  console.warn("[DataLoaderGate] Snapshot in IndexedDB failed validation. Falling back to static dataset:", validation.reason);
                  window.STOCK_SNAPSHOT_STATUS = "LOCAL_SNAPSHOT_INVALID";
                  window.STOCK_SNAPSHOT_ERROR = validation.reason;
                }
              }
            } catch (e) {
              console.warn("[DataLoaderGate] Error evaluating IndexedDB snapshot, using static baseline:", e);
              window.STOCK_SNAPSHOT_STATUS = "LOCAL_SNAPSHOT_INVALID";
              window.STOCK_SNAPSHOT_ERROR = e.message;
            }
          }

          // Step 3: Fallback to pilot static baseline
          if (!snapshotLoaded) {
            if (window.PILOT_MODE === true && window.LATEST_STOCK_SNAPSHOT) {
              window.STOCK_DATABASE = window.LATEST_STOCK_SNAPSHOT;
              window.STOCK_METADATA = window.PILOT_STOCK_METADATA || {
                stockBatchId: "STOCK-20260914-LATEST",
                importBatchId: "STOCK-20260914-LATEST",
                sourceType: "Imported Excel Snapshot",
                sourceFile: "stock(1).xlsx",
                sourceFilename: "stock(1).xlsx",
                storageScope: "PILOT_SNAPSHOT",
                recordCount: 399,
                uniquePn: 399,
                f1Total: 1701,
                f2Total: 1635,
                grandTotal: 3336,
                importedAt: "2026-09-14T09:00:00+07:00"
              };
              window.STOCK_SNAPSHOT_STATUS = "PILOT_STOCK_SNAPSHOT";
            } else if (!window.STOCK_SNAPSHOT_STATUS) {
              window.STOCK_SNAPSHOT_STATUS = window.STOCK_DATABASE ? "STATIC_BASELINE" : "DATA_UNAVAILABLE";
            }
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
  window.getActiveStockDataset = DataLoaderGate.getActiveStockDataset;

})(window);
