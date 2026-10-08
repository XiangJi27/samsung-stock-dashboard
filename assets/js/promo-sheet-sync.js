/**
 * Samsung Branch Operations - Multi-Category Promotion Google Sheet Sync Engine (Mode B)
 * Handles live synchronization for 3 distinct promotion link categories:
 * 1. โปรโมชั่น Smartphone (Galaxy S / Z Fold & Flip / A Series)
 * 2. โปรโมชั่น Tablet & Wearable (Galaxy Tab / Watch / Buds)
 * 3. โปรโมชั่น Acc เพิ่มเติม (Accessories / รายการลด 50-70% / ของแถม)
 *
 * Rules:
 * - Direct Google Sheet link & Published CSV link support with serverless proxy fallback.
 * - Dynamic Header Matching for Retail Shop, Tablet/Wearable, and Accessory formats.
 * - Persistent URL storage in localStorage per category.
 * - Dual-mode staging: Diff Preview vs Opt-in Auto-Apply to Active Inventory.
 */

(function(root) {
  'use strict';

  const STORAGE_KEYS = {
    URL_SMARTPHONE: 'samsung_promo_gsheet_url_smartphone',
    URL_TABLET_WEARABLE: 'samsung_promo_gsheet_url_tablet_wearable',
    URL_ACCESSORY: 'samsung_promo_gsheet_url_accessory',
    LAST_SYNC: 'samsung_promo_gsheet_last_synced',
    AUTO_APPLY: 'samsung_promo_gsheet_auto_apply_opt_in'
  };

  const DEFAULT_TIMEOUT_MS = 12000;

  class PromoGoogleSheetSync {
    constructor() {
      this.isSyncing = false;
      this.activeTab = 'MODE_B'; // Default to Google Sheet links as requested
    }

    /**
     * Parse single CSV line adhering to RFC-4180 quotes.
     */
    static splitCsvLine(line) {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    }

    /**
     * Retrieve stored URLs and configuration.
     */
    static getStoredConfig() {
      try {
        return {
          smartphone: localStorage.getItem(STORAGE_KEYS.URL_SMARTPHONE) || '',
          tabletWearable: localStorage.getItem(STORAGE_KEYS.URL_TABLET_WEARABLE) || '',
          accessory: localStorage.getItem(STORAGE_KEYS.URL_ACCESSORY) || '',
          lastSynced: localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || '',
          autoApply: localStorage.getItem(STORAGE_KEYS.AUTO_APPLY) === 'true'
        };
      } catch (e) {
        return { smartphone: '', tabletWearable: '', accessory: '', lastSynced: '', autoApply: false };
      }
    }

    /**
     * Save URL configuration to localStorage.
     */
    static saveConfig({ smartphone, tabletWearable, accessory, autoApply }) {
      try {
        if (typeof smartphone === 'string') localStorage.setItem(STORAGE_KEYS.URL_SMARTPHONE, smartphone.trim());
        if (typeof tabletWearable === 'string') localStorage.setItem(STORAGE_KEYS.URL_TABLET_WEARABLE, tabletWearable.trim());
        if (typeof accessory === 'string') localStorage.setItem(STORAGE_KEYS.URL_ACCESSORY, accessory.trim());
        if (typeof autoApply === 'boolean') localStorage.setItem(STORAGE_KEYS.AUTO_APPLY, autoApply ? 'true' : 'false');
        return true;
      } catch (e) {
        console.error('[PromoGoogleSheetSync] Error saving config:', e);
        return false;
      }
    }

    /**
     * Normalize URL for Google Sheet:
     * If user provides standard spreadsheet link, convert to gviz CSV URL.
     */
    static normalizeSheetUrl(rawUrl, defaultSheetName) {
      if (!rawUrl || typeof rawUrl !== 'string') return '';
      const url = rawUrl.trim();
      if (!url) return '';

      // Published CSV link
      if (url.includes('/pub') || url.includes('/d/e/2PACX-')) {
        if (url.includes('output=csv')) return url;
        if (url.includes('?')) return `${url}&output=csv`;
        return `${url}?output=csv`;
      }

      // Standard Google Docs spreadsheet link
      const matchDoc = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (matchDoc) {
        const docId = matchDoc[1];
        const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
        if (gidMatch) {
          return `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gidMatch[1]}`;
        }
        if (defaultSheetName) {
          return `https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(defaultSheetName)}`;
        }
        return `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv`;
      }

      return url;
    }

    /**
     * Fetch CSV content with timeout and proxy fallback.
     */
    static async fetchCsvWithFallback(targetUrl, timeoutMs = DEFAULT_TIMEOUT_MS) {
      if (!targetUrl) throw new Error('ไม่พบ URL สำหรับเชื่อมต่อ');

      // 1. Direct Fetch
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(targetUrl, {
            signal: controller.signal,
            cache: 'no-cache',
            headers: { 'Accept': 'text/csv, text/plain, */*' }
          });
          clearTimeout(timer);
          if (res.ok) {
            return await res.text();
          }
        } finally {
          clearTimeout(timer);
        }
      } catch (directErr) {
        console.warn('[PromoGoogleSheetSync] Direct fetch failed (likely CORS), attempting proxy:', directErr.message);
      }

      // 2. Serverless Proxy Fallback
      try {
        const proxyUrl = `/api/sheet-proxy?url=${encodeURIComponent(targetUrl)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const proxyRes = await fetch(proxyUrl, {
            signal: controller.signal,
            cache: 'no-cache'
          });
          clearTimeout(timer);
          if (proxyRes.ok) {
            return await proxyRes.text();
          }
        } finally {
          clearTimeout(timer);
        }
      } catch (proxyErr) {
        console.warn('[PromoGoogleSheetSync] Proxy fetch failed:', proxyErr.message);
      }

      throw new Error(`ไม่สามารถดาวน์โหลดข้อมูลจากลิงก์ได้ กรุณาตรวจสอบว่า Google Sheet ได้ตั้งค่า "Publish to web" หรือ "ทุกคนที่มีลิงก์มีสิทธิ์ดู" เรียบร้อยแล้ว`);
    }

    /**
     * Clean numeric string (e.g. "฿35,900" -> 35900).
     */
    static cleanNumber(val) {
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      if (!val) return 0;
      const s = String(val).replace(/[^\d.-]/g, '');
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    }

    /**
     * Universal Header-Guided Parser for Promotion Sheet CSV.
     */
    static parsePromotionCsv(csvText, categoryKey) {
      if (!csvText || typeof csvText !== 'string') return [];

      const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) return [];

      // Find header row in first 15 rows
      let headerIdx = -1;
      let headers = [];

      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const cols = this.splitCsvLine(lines[i]);
        const colsLower = cols.map(c => c.toLowerCase());
        const hasKeyIndicators = colsLower.some(c => 
          c.includes('model') || c.includes('รุ่น') || c.includes('rrp') || 
          c.includes('ราคา') || c.includes('sku') || c.includes('p/n') || 
          c.includes('ส่วนลด') || c.includes('discount') || c.includes('description')
        );
        if (hasKeyIndicators && cols.length >= 3) {
          headerIdx = i;
          headers = cols;
          break;
        }
      }

      if (headerIdx === -1) {
        // Fallback: row 0 as header
        headerIdx = 0;
        headers = this.splitCsvLine(lines[0]);
      }

      // Column Index Mappings
      const findCol = (synonyms) => {
        return headers.findIndex(h => {
          const hl = h.toLowerCase().replace(/[\s\-_]/g, '');
          return synonyms.some(syn => hl.includes(syn));
        });
      };

      const pnIdx = findCol(['pn', 'exactpn', 'sku', 'code', 'รหัส']);
      const catIdx = findCol(['cat', 'หมวด', 'category', 'กลุ่ม']);
      const modelIdx = findCol(['model', 'รุ่น', 'ชื่อรุ่น', 'description', 'รายการสินค้า', 'item']);
      const capIdx = findCol(['cap', 'ความจุ', 'memory', 'detail', 'storage', 'ram']);
      const rrpIdx = findCol(['rrp', 'price99', 'ราคาปกติ', 'ราคาเต็ม', 'price', 'ราคา']);
      const discIdx = findCol(['discount', 'ส่วนลด', 'ลด', 'stddisc', 'disc', 'ส่วนลดปกติ']);
      const couponIdx = findCol(['coupon', 'คูปอง', 'code', 'โค้ด']);
      const tradeUpIdx = findCol(['tradeup', 'trade-up', 'เทริน', 'trade', 'โบนัส']);
      const netIdx = findCol(['net', 'สุทธิ', 'netprice', 'ราคาสุทธิ', 'ราคาลดแล้ว']);
      const giftIdx = findCol(['gift', 'ของแถม', 'premium', 'แถม']);
      const remarkIdx = findCol(['remark', 'condition', 'เงื่อนไข', 'หมายเหตุ', 'terms']);

      const variants = [];
      let currentCategory = categoryKey === 'SMARTPHONE' ? 'SmartPhone' : (categoryKey === 'TABLET_WEARABLE' ? 'Tablet' : 'Accessory');

      for (let r = headerIdx + 1; r < lines.length; r++) {
        const cols = this.splitCsvLine(lines[r]);
        if (cols.length === 0 || cols.every(c => c === '')) continue;

        const rawCat = catIdx >= 0 ? cols[catIdx] : '';
        if (rawCat && rawCat.trim().length > 1) {
          currentCategory = rawCat.trim();
        }

        const rawModel = modelIdx >= 0 ? cols[modelIdx] : (cols[1] || cols[0] || '');
        if (!rawModel || rawModel.trim() === '' || rawModel.toLowerCase() === 'total' || rawModel.toLowerCase() === 'รวม') {
          continue;
        }

        const modelName = rawModel.trim();
        const pnVal = pnIdx >= 0 ? cols[pnIdx].trim() : '';
        const capVal = capIdx >= 0 ? cols[capIdx].trim() : '';
        const rawRrp = rrpIdx >= 0 ? cols[rrpIdx] : '';
        const rawDisc = discIdx >= 0 ? cols[discIdx] : '';
        const rawCoupon = couponIdx >= 0 ? cols[couponIdx] : '';
        const rawTradeUp = tradeUpIdx >= 0 ? cols[tradeUpIdx] : '';
        const rawNet = netIdx >= 0 ? cols[netIdx] : '';
        const rawGift = giftIdx >= 0 ? cols[giftIdx] : '';
        const rawRemark = remarkIdx >= 0 ? cols[remarkIdx] : '';

        // Check for error values in formulas
        const hasFormulaError = [rawRrp, rawDisc, rawNet].some(v => String(v).startsWith('#') || String(v).includes('ERROR'));

        let rrp = this.cleanNumber(rawRrp);
        let discount = this.cleanNumber(rawDisc);
        let tradeUpBonus = this.cleanNumber(rawTradeUp);
        let netPrice = this.cleanNumber(rawNet);

        // If net is not provided, calculate net = rrp - discount
        if (netPrice <= 0 && rrp > 0) {
          netPrice = Math.max(0, rrp - discount);
        }
        // If discount is not provided, calculate discount = rrp - net
        if (discount <= 0 && rrp > 0 && netPrice > 0 && netPrice < rrp) {
          discount = rrp - netPrice;
        }

        // Coupon cleaning
        let coupon = rawCoupon.replace(/[\n\r]/g, '').replace('คูปอง', '').trim() || (discount > 0 ? '01' : '-');

        // Target Product Type
        let productCodeType = 'STANDARD_SM';
        if (categoryKey === 'TABLET_WEARABLE') {
          productCodeType = modelName.toLowerCase().includes('watch') || modelName.toLowerCase().includes('fit') ? 'STANDARD_WATCH' : (modelName.toLowerCase().includes('buds') ? 'STANDARD_AUDIO' : 'STANDARD_TABLET');
        } else if (categoryKey === 'ACCESSORY') {
          productCodeType = 'STANDARD_ACCESSORY';
        } else if (pnVal.startsWith('F-')) {
          productCodeType = 'PASS_F';
        }

        const draftRowId = `GSHEET-${categoryKey}-${r}-${pnVal || modelName.replace(/\s+/g, '_')}`;

        // Build Primary Promotion Variant
        const variant = {
          promoId: draftRowId,
          draftRowId: draftRowId,
          sourceType: 'GOOGLE_SHEET_LIVE_SYNC',
          sourceCategory: categoryKey,
          sourceRow: r,
          category: currentCategory,
          model: modelName,
          capacity: capVal,
          pn: pnVal || null,
          productCodeType: productCodeType,
          saleMode: 'NORMAL',
          rrp: rrp,
          discount: discount,
          discountValue: discount,
          standardDiscount: discount,
          tradeUpDiscount: tradeUpBonus,
          tradeUpBonusAmount: tradeUpBonus,
          tradeUpEligible: tradeUpBonus > 0,
          sfPlusEligible: true,
          studentEligible: true,
          netPrice: netPrice,
          standardNetPrice: netPrice,
          coupon: coupon,
          couponCode: coupon,
          gift: rawGift || null,
          conditions: rawRemark ? [rawRemark] : [],
          startDate: '2026-09-01',
          endDate: '2026-10-31',
          isPromotion: (discount > 0 || tradeUpBonus > 0 || Boolean(rawGift)),
          isActive: true,
          validationStatus: hasFormulaError ? 'BLOCKED' : (rrp > 0 ? 'PASSED_VALIDATION' : 'WARNING'),
          reasonText: hasFormulaError ? 'พบสูตรผิดพลาด #ERROR! ในเซลล์ข้อมูลต้นทาง' : 'ซิงค์สำเร็จจาก Google Sheet'
        };

        variants.push(variant);

        // If row has Trade Up bonus, generate a secondary variant for explicit TRADE_UP
        if (tradeUpBonus > 0) {
          variants.push({
            ...variant,
            promoId: `${draftRowId}-TU`,
            saleMode: 'TRADE_UP',
            discount: discount + tradeUpBonus,
            discountValue: discount + tradeUpBonus,
            netPrice: Math.max(0, rrp - discount - tradeUpBonus),
            coupon: 'Trade Up'
          });
        }
      }

      return variants;
    }

    /**
     * Sync single category by key: 'SMARTPHONE', 'TABLET_WEARABLE', or 'ACCESSORY'.
     */
    static async syncCategory(categoryKey) {
      const config = this.getStoredConfig();
      let rawUrl = '';
      let defaultTab = '';

      if (categoryKey === 'SMARTPHONE') {
        rawUrl = config.smartphone;
        defaultTab = 'Smartphone';
      } else if (categoryKey === 'TABLET_WEARABLE') {
        rawUrl = config.tabletWearable;
        defaultTab = 'Tablet';
      } else if (categoryKey === 'ACCESSORY') {
        rawUrl = config.accessory;
        defaultTab = 'Accessory';
      }

      if (!rawUrl) {
        throw new Error(`ยังไม่ได้ระบุลิงก์ Google Sheet สำหรับหมวด ${categoryKey}`);
      }

      const targetUrl = this.normalizeSheetUrl(rawUrl, defaultTab);
      const csvText = await this.fetchCsvWithFallback(targetUrl);
      const variants = this.parsePromotionCsv(csvText, categoryKey);

      return {
        categoryKey,
        rawUrl,
        variantsCount: variants.length,
        variants
      };
    }

    /**
     * Sync all 3 configured Google Sheet promotion links.
     */
    static async syncAllCategories(progressCallback) {
      const config = this.getStoredConfig();
      const results = {
        timestamp: new Date().toISOString(),
        categories: {},
        allVariants: [],
        errors: []
      };

      const tasks = [
        { key: 'SMARTPHONE', label: '1. โปรโมชั่น Smartphone', url: config.smartphone },
        { key: 'TABLET_WEARABLE', label: '2. โปรโมชั่น Tablet & Wearable', url: config.tabletWearable },
        { key: 'ACCESSORY', label: '3. โปรโมชั่น Acc เพิ่มเติม', url: config.accessory }
      ];

      for (const t of tasks) {
        if (!t.url) {
          results.categories[t.key] = { status: 'SKIPPED', count: 0, message: 'ไม่ได้ระบุลิงก์' };
          continue;
        }

        try {
          if (progressCallback) progressCallback(`กำลังซิงค์ ${t.label}...`);
          const res = await this.syncCategory(t.key);
          results.categories[t.key] = { status: 'SUCCESS', count: res.variantsCount, variants: res.variants };
          results.allVariants.push(...res.variants);
        } catch (err) {
          console.warn(`[PromoGoogleSheetSync] Error syncing ${t.key}:`, err);
          results.categories[t.key] = { status: 'ERROR', count: 0, error: err.message };
          results.errors.push(`${t.label}: ${err.message}`);
        }
      }

      // Update last sync time
      const nowFormatted = new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, nowFormatted);

      return results;
    }

    /**
     * Apply synced variants into active app state.
     */
    static applyVariantsToSystem(variants, batchMeta) {
      if (!Array.isArray(variants) || variants.length === 0) return 0;

      // 1. Update window.PROMOTION_VARIANTS
      if (!Array.isArray(window.PROMOTION_VARIANTS)) {
        window.PROMOTION_VARIANTS = [];
      }

      // Keep existing non-GSHEET variants, replace matching or prepend new
      const gsheetIds = new Set(variants.map(v => v.promoId));
      const remainingOld = window.PROMOTION_VARIANTS.filter(v => !gsheetIds.has(v.promoId));
      window.PROMOTION_VARIANTS = [...variants, ...remainingOld];

      // 2. Save to PromoStorageAdapter if available
      if (window.PromoStorageAdapter && typeof window.PromoStorageAdapter.saveBatch === 'function') {
        const batchRecord = {
          batchId: `GSHEET-SYNC-${Date.now()}`,
          importedAt: new Date().toISOString(),
          format: 'GOOGLE_SHEET_CSV',
          publishedItems: variants.filter(v => v.validationStatus === 'PASSED_VALIDATION'),
          quarantinedItems: variants.filter(v => v.validationStatus !== 'PASSED_VALIDATION'),
          meta: batchMeta || { total: variants.length }
        };
        window.PromoStorageAdapter.saveBatch(batchRecord).catch(e => console.warn('[PromoGoogleSheetSync] IndexedDB save notice:', e));
      }

      // 3. Save to localStorage cache
      try {
        localStorage.setItem('samsung_live_promo_cache', JSON.stringify({
          updatedAt: new Date().toISOString(),
          count: variants.length,
          variants: variants.slice(0, 500)
        }));
      } catch (e) {
        // storage quota notice
      }

      // 4. Dispatch Event for real-time drawer & UI update
      window.dispatchEvent(new CustomEvent('promotions-updated', {
        detail: { count: variants.length, source: 'GOOGLE_SHEET_MULTI_LINK' }
      }));

      // 5. Trigger active promotions view re-render if available
      if (typeof window.renderPromotionsView === 'function') {
        window.renderPromotionsView();
      }

      return variants.length;
    }

    /**
     * Initialize UI Controls in Promotion Importer View.
     */
    static initUi() {
      const btnModeA = document.getElementById('btnPromoModeA');
      const btnModeB = document.getElementById('btnPromoModeB');
      const panelA = document.getElementById('promoModeAPanel');
      const panelB = document.getElementById('promoModeBPanel');

      const urlInputSm = document.getElementById('promoGSheetUrlSmartphone');
      const urlInputTab = document.getElementById('promoGSheetUrlTabletWearable');
      const urlInputAcc = document.getElementById('promoGSheetUrlAccessory');
      const chkAutoApply = document.getElementById('chkPromoGSheetAutoApply');
      const lastSyncBadge = document.getElementById('promoGSheetLastSyncBadge');
      const statusEl = document.getElementById('promoGSheetStatus');

      // Pre-fill stored values
      const config = this.getStoredConfig();
      if (urlInputSm) urlInputSm.value = config.smartphone;
      if (urlInputTab) urlInputTab.value = config.tabletWearable;
      if (urlInputAcc) urlInputAcc.value = config.accessory;
      if (chkAutoApply) chkAutoApply.checked = config.autoApply;
      if (lastSyncBadge && config.lastSynced) {
        lastSyncBadge.textContent = `ซิงค์ล่าสุด: ${config.lastSynced}`;
      }

      // Mode Switchers
      const switchMode = (mode) => {
        if (mode === 'MODE_A') {
          if (btnModeA) { btnModeA.classList.add('active'); btnModeA.style.borderColor = 'var(--shell-neon-cyan, #00ffff)'; btnModeA.style.background = 'rgba(0,255,255,0.08)'; btnModeA.style.color = '#fff'; }
          if (btnModeB) { btnModeB.classList.remove('active'); btnModeB.style.borderColor = 'rgba(255,255,255,0.15)'; btnModeB.style.background = 'none'; btnModeB.style.color = '#94a3b8'; }
          if (panelA) panelA.classList.remove('hidden');
          if (panelB) panelB.classList.add('hidden');
        } else {
          if (btnModeB) { btnModeB.classList.add('active'); btnModeB.style.borderColor = 'var(--shell-neon-cyan, #00ffff)'; btnModeB.style.background = 'rgba(0,255,255,0.08)'; btnModeB.style.color = '#fff'; }
          if (btnModeA) { btnModeA.classList.remove('active'); btnModeA.style.borderColor = 'rgba(255,255,255,0.15)'; btnModeA.style.background = 'none'; btnModeA.style.color = '#94a3b8'; }
          if (panelB) panelB.classList.remove('hidden');
          if (panelA) panelA.classList.add('hidden');
        }
      };

      if (btnModeA) btnModeA.addEventListener('click', () => switchMode('MODE_A'));
      if (btnModeB) btnModeB.addEventListener('click', () => switchMode('MODE_B'));

      // Save URLs Button
      const btnSave = document.getElementById('btnSavePromoGSheetUrls');
      if (btnSave) {
        btnSave.addEventListener('click', () => {
          this.saveConfig({
            smartphone: urlInputSm ? urlInputSm.value : '',
            tabletWearable: urlInputTab ? urlInputTab.value : '',
            accessory: urlInputAcc ? urlInputAcc.value : '',
            autoApply: chkAutoApply ? chkAutoApply.checked : false
          });
          if (statusEl) {
            statusEl.innerHTML = `<span style="color: #34d399;">💾 บันทึกลิงก์โปรโมชั่นทั้ง 3 หมวดหมู่ลงเครื่องเรียบร้อยแล้ว!</span>`;
          }
        });
      }

      // Single Category Sync Buttons
      const setupSingleSync = (btnId, catKey, badgeId) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const origText = btn.innerHTML;
          btn.innerHTML = `<span>⏳ กำลังซิงค์...</span>`;
          const badge = document.getElementById(badgeId);
          if (statusEl) statusEl.innerHTML = `<span style="color: #38bdf8;">🔄 กำลังดาวน์โหลดข้อมูลจาก Google Sheet...</span>`;

          try {
            // Save URL first
            this.saveConfig({
              smartphone: urlInputSm ? urlInputSm.value : '',
              tabletWearable: urlInputTab ? urlInputTab.value : '',
              accessory: urlInputAcc ? urlInputAcc.value : '',
              autoApply: chkAutoApply ? chkAutoApply.checked : false
            });

            const res = await this.syncCategory(catKey);
            if (badge) {
              badge.textContent = `✓ ซิงค์สำเร็จ (${res.variantsCount} รายการ)`;
              badge.style.color = '#34d399';
            }

            if (chkAutoApply && chkAutoApply.checked) {
              this.applyVariantsToSystem(res.variants, { category: catKey });
              if (statusEl) {
                statusEl.innerHTML = `<span style="color: #34d399;">✓ ซิงค์และอัปเดตโปรโมชั่น ${catKey} สู่ระบบเรียบร้อยแล้ว (${res.variantsCount} รายการ)!</span>`;
              }
            } else if (window.PromotionImportController) {
              // Pass to Diff Preview Staging
              window.PromotionImportController.currentStagedBatch = {
                batchId: `GSHEET-${catKey}-${Date.now()}`,
                format: 'GOOGLE_SHEET_CSV',
                variants: res.variants,
                stats: { totalVariants: res.variantsCount, passedCount: res.variantsCount, reviewCount: 0, blockedCount: 0 }
              };
              window.PromotionImportController.updateBatchStats();
              window.PromotionImportController.filterDiffTable('ALL');
              window.PromotionImportController.updateStepper(3);
              const previewSec = document.getElementById('promoPreviewSection');
              if (previewSec) previewSec.classList.remove('hidden');
              if (statusEl) {
                statusEl.innerHTML = `<span style="color: #38bdf8;">✓ ดึงข้อมูลสำเร็จ ${res.variantsCount} รายการ • กรุณาตรวจ Preview Diff ด้านล่างก่อนยืนยัน</span>`;
              }
            }
          } catch (err) {
            if (badge) {
              badge.textContent = `⚠️ ข้อผิดพลาด`;
              badge.style.color = '#f43f5e';
            }
            if (statusEl) {
              statusEl.innerHTML = `<span style="color: #f43f5e;">❌ เกิดข้อผิดพลาด: ${err.message}</span>`;
            }
          } finally {
            btn.disabled = false;
            btn.innerHTML = origText;
          }
        });
      };

      setupSingleSync('btnSyncSmartphone', 'SMARTPHONE', 'statusBadgeSmartphone');
      setupSingleSync('btnSyncTabletWearable', 'TABLET_WEARABLE', 'statusBadgeTabletWearable');
      setupSingleSync('btnSyncAccessory', 'ACCESSORY', 'statusBadgeAccessory');

      // Sync All Button
      const btnSyncAll = document.getElementById('btnSyncAllPromoGSheets');
      if (btnSyncAll) {
        btnSyncAll.addEventListener('click', async () => {
          btnSyncAll.disabled = true;
          const origText = btnSyncAll.innerHTML;
          btnSyncAll.innerHTML = `<span>⏳ กำลังซิงค์ทั้ง 3 หมวดหมู่...</span>`;
          if (statusEl) statusEl.innerHTML = `<span style="color: #38bdf8;">🔄 เริ่มต้นเชื่อมโยง Google Sheet ทั้ง 3 หมวดหมู่...</span>`;

          try {
            // Save URLs first
            this.saveConfig({
              smartphone: urlInputSm ? urlInputSm.value : '',
              tabletWearable: urlInputTab ? urlInputTab.value : '',
              accessory: urlInputAcc ? urlInputAcc.value : '',
              autoApply: chkAutoApply ? chkAutoApply.checked : false
            });

            const res = await this.syncAllCategories((msg) => {
              if (statusEl) statusEl.innerHTML = `<span style="color: #38bdf8;">${msg}</span>`;
            });

            const total = res.allVariants.length;
            const nowTime = localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || '';
            if (lastSyncBadge) lastSyncBadge.textContent = `ซิงค์ล่าสุด: ${nowTime}`;

            // Update category badge indicators
            ['SMARTPHONE', 'TABLET_WEARABLE', 'ACCESSORY'].forEach(k => {
              const bId = k === 'SMARTPHONE' ? 'statusBadgeSmartphone' : (k === 'TABLET_WEARABLE' ? 'statusBadgeTabletWearable' : 'statusBadgeAccessory');
              const bEl = document.getElementById(bId);
              if (bEl && res.categories[k]) {
                const info = res.categories[k];
                if (info.status === 'SUCCESS') {
                  bEl.textContent = `✓ ซิงค์แล้ว (${info.count} รายการ)`;
                  bEl.style.color = '#34d399';
                } else if (info.status === 'SKIPPED') {
                  bEl.textContent = '⚪ ยังไม่ระบุลิงก์';
                  bEl.style.color = '#94a3b8';
                } else {
                  bEl.textContent = '⚠️ ผิดพลาด';
                  bEl.style.color = '#f43f5e';
                }
              }
            });

            if (total === 0 && res.errors.length > 0) {
              throw new Error(res.errors.join(' | '));
            }

            if (chkAutoApply && chkAutoApply.checked) {
              this.applyVariantsToSystem(res.allVariants, { total });
              if (statusEl) {
                statusEl.innerHTML = `<span style="color: #34d399;">🎉 ซิงค์และเผยแพร่โปรโมชั่นทั้ง 3 หมวดหมู่สำเร็จรวม ${total.toLocaleString()} รายการ เข้าสู่ระบบสต็อกเรียบร้อยแล้ว!</span>`;
              }
            } else if (window.PromotionImportController) {
              // Pass into Diff Preview staging
              window.PromotionImportController.currentStagedBatch = {
                batchId: `GSHEET-ALL-${Date.now()}`,
                format: 'GOOGLE_SHEET_CSV',
                variants: res.allVariants,
                stats: { totalVariants: total, passedCount: total, reviewCount: 0, blockedCount: 0 }
              };
              window.PromotionImportController.updateBatchStats();
              window.PromotionImportController.filterDiffTable('ALL');
              window.PromotionImportController.updateStepper(3);
              const previewSec = document.getElementById('promoPreviewSection');
              if (previewSec) previewSec.classList.remove('hidden');
              if (statusEl) {
                statusEl.innerHTML = `<span style="color: #38bdf8;">✓ ซิงค์ครบ 3 หมวดหมู่ สำเร็จรวม ${total.toLocaleString()} รายการ • ข้อมูลเข้าสู่ Diff Preview ด้านล่างแล้ว</span>`;
              }
            }
          } catch (err) {
            if (statusEl) {
              statusEl.innerHTML = `<span style="color: #f43f5e;">❌ ซิงค์ไม่สำเร็จ: ${err.message}</span>`;
            }
          } finally {
            btnSyncAll.disabled = false;
            btnSyncAll.innerHTML = origText;
          }
        });
      }
    }
  }

  root.PromoGoogleSheetSync = PromoGoogleSheetSync;
  root.PromoSheetSync = PromoGoogleSheetSync;

  // Auto initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    PromoGoogleSheetSync.initUi();
  });

})(typeof window !== 'undefined' ? window : this);
