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

  function normalizeCentralStockItem(rawItem) {
    if (!rawItem || typeof rawItem !== 'object') return rawItem;

    const inventoryPn = String(
      rawItem.inventoryPn ||
      rawItem.inventory_pn ||
      rawItem.pn ||
      ""
    ).trim();

    const description = String(
      rawItem.description ||
      rawItem.productName ||
      rawItem.product_name ||
      rawItem.model ||
      rawItem.name ||
      ""
    ).trim();

    const f1 = Number(rawItem.f1 || 0);
    const f2 = Number(rawItem.f2 || 0);
    const total = rawItem.total !== undefined ? Number(rawItem.total) : (f1 + f2);

    return {
      ...rawItem,
      inventoryPn,
      pn: inventoryPn,
      barcode: rawItem.barcode || "",
      description,
      model: description || rawItem.model || "-",
      name: description || rawItem.name || "-",
      productName: description || rawItem.productName || "-",
      brand: rawItem.brand || "",
      category: rawItem.category || "",
      category1: rawItem.category1 || rawItem.cat1 || "",
      category2: rawItem.category2 || rawItem.cat2 || "",
      category3: rawItem.category3 || rawItem.cat3 || "",
      cat1: rawItem.cat1 || rawItem.category1 || "",
      cat2: rawItem.cat2 || rawItem.category2 || "",
      cat3: rawItem.cat3 || rawItem.category3 || "",
      color: rawItem.color || "",
      srp: Number(
        rawItem.srp ??
        rawItem.erpRrp ??
        rawItem.rrp ??
        rawItem.price ??
        0
      ),
      price: rawItem.price !== undefined ? rawItem.price : (rawItem.erpRrp !== undefined ? rawItem.erpRrp : null),
      erpRrp: rawItem.erpRrp !== undefined ? rawItem.erpRrp : (rawItem.price !== undefined ? rawItem.price : null),
      f1,
      f2,
      total
    };
  }

  class DataLoaderGate {
    static normalizeCentralStockItem = normalizeCentralStockItem;
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
          if (typeof window.updateStockImportBanner === "function") {
            window.updateStockImportBanner("CONNECTING");
          }

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
                const normalizedItems = centralData.items.map(normalizeCentralStockItem);
                window.STOCK_DATABASE = normalizedItems;
                window.STOCK_DATA = normalizedItems;
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
                if (typeof window.updateStockImportBanner === "function") {
                  window.updateStockImportBanner("CENTRAL_DATABASE", window.STOCK_METADATA);
                }
                console.info("[DataLoaderGate] Successfully loaded active stock snapshot from Central Database:", centralData.batchId);

                // Cache active snapshot in IndexedDB for offline resilience
                if (window.StockStorageAdapter && typeof window.StockStorageAdapter.saveBatch === "function") {
                  window.StockStorageAdapter.saveBatch({
                    batchId: centralData.batchId,
                    data: normalizedItems,
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
                  const normalizedCached = (localSnapshot.data || []).map(normalizeCentralStockItem);
                  window.STOCK_DATABASE = normalizedCached;
                  window.STOCK_DATA = normalizedCached;
                  if (localSnapshot.meta) {
                    window.STOCK_METADATA = localSnapshot.meta;
                  }
                  window.STOCK_SNAPSHOT_STATUS = localSnapshot.meta?.storageScope === 'CENTRAL_DATABASE' ? "CENTRAL_DATABASE_OFFLINE_CACHE" : "CONFIRMED_LOCAL_SNAPSHOT";
                  snapshotLoaded = true;
                  if (typeof window.updateStockImportBanner === "function") {
                    window.updateStockImportBanner("OFFLINE_CACHE", window.STOCK_METADATA);
                  }
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
            if (typeof window.updateStockImportBanner === "function") {
              window.updateStockImportBanner("STATIC_BASELINE", window.STOCK_METADATA);
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

  window.updateStockImportBanner = function(mode, meta = {}) {
    const banner = document.getElementById("stockImportStorageBanner");
    if (!banner) return;

    const iconEl = document.getElementById("stockStorageBannerIcon");
    const tagEl = document.getElementById("stockStorageBannerTag");
    const descEl = document.getElementById("stockStorageBannerDesc");
    const badgeEl = document.getElementById("stockStorageBannerBadge");

    switch (mode) {
      case "CENTRAL_DATABASE":
        banner.style.borderColor = "rgba(56, 189, 248, 0.4)";
        banner.style.background = "rgba(15, 23, 42, 0.75)";
        if (iconEl) iconEl.textContent = "🌐";
        if (tagEl) {
          tagEl.style.color = "#38bdf8";
          tagEl.textContent = "เชื่อมต่อฐานข้อมูลกลางแล้ว (CENTRAL_DATABASE)";
        }
        if (descEl) {
          const shortBatch = meta.stockBatchId ? `(Batch: ${meta.stockBatchId.substring(0, 8)}...)` : "";
          descEl.textContent = `ข้อมูล Stock Snapshot จัดเก็บในฐานข้อมูลกลาง Supabase PostgreSQL ${shortBatch} • ทุกอุปกรณ์ซิงค์ชุดข้อมูลเดียวกัน`;
        }
        if (badgeEl) {
          badgeEl.style.background = "rgba(56, 189, 248, 0.15)";
          badgeEl.style.color = "#38bdf8";
          badgeEl.style.borderColor = "rgba(56, 189, 248, 0.3)";
          badgeEl.textContent = "Storage: CENTRAL_DATABASE";
        }
        break;

      case "OFFLINE_CACHE":
      case "CENTRAL_DATABASE_OFFLINE_CACHE":
        banner.style.borderColor = "rgba(245, 158, 11, 0.4)";
        banner.style.background = "rgba(30, 27, 18, 0.75)";
        if (iconEl) iconEl.textContent = "💾";
        if (tagEl) {
          tagEl.style.color = "#f59e0b";
          tagEl.textContent = "ใช้งานออฟไลน์แคช (OFFLINE_CACHE)";
        }
        if (descEl) {
          const shortBatch = meta.stockBatchId ? `(Batch: ${meta.stockBatchId.substring(0, 8)}...)` : "";
          descEl.textContent = `ไม่สามารถเชื่อมต่อฐานข้อมูลกลางได้ชั่วคราว — แสดงผลจากแคช IndexedDB ในเบราว์เซอร์ ${shortBatch}`;
        }
        if (badgeEl) {
          badgeEl.style.background = "rgba(245, 158, 11, 0.15)";
          badgeEl.style.color = "#f59e0b";
          badgeEl.style.borderColor = "rgba(245, 158, 11, 0.3)";
          badgeEl.textContent = "Storage: OFFLINE_CACHE";
        }
        break;

      case "STATIC_BASELINE":
      case "PILOT_STOCK_SNAPSHOT":
        banner.style.borderColor = "rgba(148, 163, 184, 0.3)";
        banner.style.background = "rgba(15, 23, 42, 0.75)";
        if (iconEl) iconEl.textContent = "📁";
        if (tagEl) {
          tagEl.style.color = "#94a3b8";
          tagEl.textContent = "ใช้ชุดข้อมูลมาตรฐานเริ่มต้น (STATIC_BASELINE)";
        }
        if (descEl) {
          descEl.textContent = "แสดงผลจากชุดข้อมูลเริ่มต้น stock(1).xlsx • ยังไม่มีการซิงค์กับฐานข้อมูลกลาง";
        }
        if (badgeEl) {
          badgeEl.style.background = "rgba(148, 163, 184, 0.15)";
          badgeEl.style.color = "#94a3b8";
          badgeEl.style.borderColor = "rgba(148, 163, 184, 0.3)";
          badgeEl.textContent = "Storage: STATIC_BASELINE";
        }
        break;

      case "CONNECTION_ERROR":
        banner.style.borderColor = "rgba(239, 68, 68, 0.4)";
        banner.style.background = "rgba(35, 15, 15, 0.75)";
        if (iconEl) iconEl.textContent = "⚠️";
        if (tagEl) {
          tagEl.style.color = "#ef4444";
          tagEl.textContent = "เกิดข้อผิดพลาดในการโหลดข้อมูลกลาง (ERROR)";
        }
        if (descEl) {
          descEl.textContent = meta.error ? `ข้อผิดพลาด: ${meta.error}` : "ไม่สามารถติดต่อเซิร์ฟเวอร์ฐานข้อมูลกลางได้";
        }
        if (badgeEl) {
          badgeEl.style.background = "rgba(239, 68, 68, 0.15)";
          badgeEl.style.color = "#ef4444";
          badgeEl.style.borderColor = "rgba(239, 68, 68, 0.3)";
          badgeEl.textContent = "Status: ERROR";
        }
        break;

      case "CONNECTING":
      default:
        banner.style.borderColor = "rgba(56, 189, 248, 0.25)";
        banner.style.background = "rgba(15, 23, 42, 0.75)";
        if (iconEl) iconEl.textContent = "⏳";
        if (tagEl) {
          tagEl.style.color = "#38bdf8";
          tagEl.textContent = "กำลังเชื่อมต่อฐานข้อมูลกลาง...";
        }
        if (descEl) {
          descEl.textContent = "ระบบกำลังตรวจสอบสถานะการเชื่อมต่อกับ Supabase PostgreSQL";
        }
        if (badgeEl) {
          badgeEl.style.background = "rgba(56, 189, 248, 0.15)";
          badgeEl.style.color = "#38bdf8";
          badgeEl.style.borderColor = "rgba(56, 189, 248, 0.3)";
          badgeEl.textContent = "Status: CONNECTING";
        }
        break;
    }
  };

  // Sync banner on route change
  window.addEventListener("hashchange", () => {
    if (window.location.hash.includes("stock-import") && typeof window.updateStockImportBanner === "function") {
      window.updateStockImportBanner(window.STOCK_SNAPSHOT_STATUS || "STATIC_BASELINE", window.STOCK_METADATA || {});
    }
  });

})(window);
