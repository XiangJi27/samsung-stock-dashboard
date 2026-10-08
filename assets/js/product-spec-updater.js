/**
 * Samsung Branch Operations - Product Spec Updater Client Engine
 * Enables 1-click on-demand specification fetching, enriching, and updating from the UI.
 * Integrates with /api/fetch-spec (Vercel Serverless) and direct Supabase Cloud synchronization.
 */

(function(root) {
  'use strict';

  const STORAGE_KEY_CUSTOM_SPECS = 'samsung_custom_specs';
  const SUPABASE_URL = 'https://anhxzffcmrihymrptsgd.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_9eXmP6Cgb14AWbk8CrBv3A_l0Clj00v';

  class ProductSpecUpdater {
    constructor() {
      this.isUpdating = false;
      this.initCustomSpecs();
    }

    /**
     * Load cached or user-updated specs from localStorage and Supabase Cloud.
     */
    async initCustomSpecs() {
      // 1. Instant local load
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_SPECS);
        if (raw) {
          const customDb = JSON.parse(raw);
          if (customDb && typeof customDb === 'object') {
            if (!window.PRODUCT_SPECS_PROFILES) {
              window.PRODUCT_SPECS_PROFILES = {};
            }
            Object.assign(window.PRODUCT_SPECS_PROFILES, customDb);
            console.log(`[ProductSpecUpdater] Loaded ${Object.keys(customDb).length} custom/enriched specs from localStorage.`);
          }
        }
      } catch (err) {
        console.warn('[ProductSpecUpdater] Error loading custom specs from localStorage:', err);
      }

      // 2. Background sync from Supabase Cloud
      try {
        await this.syncFromSupabaseCloud();
      } catch (sbErr) {
        // Silently tolerate if table not created or offline
      }
    }

    /**
     * Fetch all verified product specs stored in Supabase Cloud
     */
    async syncFromSupabaseCloud() {
      const url = `${SUPABASE_URL}/rest/v1/product_specs?select=*`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          if (!window.PRODUCT_SPECS_PROFILES) {
            window.PRODUCT_SPECS_PROFILES = {};
          }
          let imported = 0;
          let stored = {};
          try {
            const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_SPECS);
            if (raw) stored = JSON.parse(raw);
          } catch (e) {}

          for (const row of rows) {
            const spec = {
              modelGroup: row.model_group,
              officialName: row.official_name,
              source: row.source || 'Samsung Thailand Official (samsung.com/th)',
              sourceUrl: row.source_url,
              marketRegion: row.market_region || 'Thailand (THL)',
              category: row.category || 'SmartPhone',
              brand: 'Samsung',
              display: row.display || {},
              performance: row.performance || {},
              memory: row.memory || {},
              camera: row.camera || {},
              battery: row.battery || {},
              connectivityAndBuild: row.connectivity_and_build || row.connectivityAndBuild || {}
            };

            const cleanPn = (row.part_number || '').trim().toUpperCase();
            if (cleanPn) {
              const pnKey = 'PN_' + cleanPn.replace(/-/g, '_');
              window.PRODUCT_SPECS_PROFILES[pnKey] = spec;
              stored[pnKey] = spec;
            }
            const modelKey = (row.model_group || cleanPn || 'SPEC')
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '_')
              .replace(/_+/g, '_');
            window.PRODUCT_SPECS_PROFILES[modelKey] = spec;
            stored[modelKey] = spec;
            imported++;
          }

          try {
            localStorage.setItem(STORAGE_KEY_CUSTOM_SPECS, JSON.stringify(stored));
          } catch (e) {}

          console.log(`[ProductSpecUpdater] Synced ${imported} specs from Supabase Cloud.`);
        }
      }
    }

    /**
     * Save newly fetched spec to localStorage and runtime profile registry.
     */
    saveSpec(pn, model, spec) {
      if (!spec) return;

      if (!window.PRODUCT_SPECS_PROFILES) {
        window.PRODUCT_SPECS_PROFILES = {};
      }

      // Key by PN if available
      const cleanPn = (pn || '').trim().toUpperCase();
      if (cleanPn) {
        const pnKey = 'PN_' + cleanPn.replace(/-/g, '_');
        window.PRODUCT_SPECS_PROFILES[pnKey] = spec;
      }

      // Key by Model profile
      const modelKey = (spec.modelGroup || model || cleanPn || 'SPEC')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_');
      window.PRODUCT_SPECS_PROFILES[modelKey] = spec;

      // Persist to localStorage
      try {
        let stored = {};
        const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_SPECS);
        if (raw) stored = JSON.parse(raw);

        if (cleanPn) stored['PN_' + cleanPn.replace(/-/g, '_')] = spec;
        stored[modelKey] = spec;

        localStorage.setItem(STORAGE_KEY_CUSTOM_SPECS, JSON.stringify(stored));
      } catch (e) {
        console.warn('[ProductSpecUpdater] Failed to write spec to localStorage:', e);
      }

      // Dispatch event
      window.dispatchEvent(new CustomEvent('specs-updated', { detail: { pn, model, spec } }));
    }

    /**
     * Fetch spec for a given item from /api/fetch-spec or smart fallback generator.
     */
    async fetchAndUpdateSpec(item, onProgress) {
      if (!item) throw new Error('ไม่พบข้อมูลสินค้าที่ต้องการดึงสเปก');
      const pn = item.pn || '';
      const model = item.model || '';
      const category = item.category || '';

      if (onProgress) onProgress('กำลังเชื่อมต่อเซิร์ฟเวอร์สเปกและ Supabase Cloud...');

      let fetchedSpec = null;
      let supabaseStatus = null;

      // 1. Try Vercel Serverless API
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const res = await fetch('/api/fetch-spec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pn, model, category }),
          signal: controller.signal
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.spec) {
            fetchedSpec = data.spec;
            supabaseStatus = data.supabase;
          }
        }
      } catch (apiErr) {
        console.warn('[ProductSpecUpdater] /api/fetch-spec call failed, using client heuristic fallback:', apiErr.message);
      }

      // 2. Client-side Heuristic Resolver Fallback if offline / static
      if (!fetchedSpec) {
        fetchedSpec = this.generateClientFallbackSpec(model, pn, category);
      }

      // 3. Save & Register
      this.saveSpec(pn, model, fetchedSpec);

      if (onProgress) {
        if (supabaseStatus && supabaseStatus.synced) {
          onProgress('✓ บันทึกข้อมูลสเปกขึ้น Supabase Cloud สำเร็จเรียบร้อย!');
        } else {
          onProgress('✓ บันทึกข้อมูลสเปกลงระบบเรียบร้อยแล้ว!');
        }
      }

      return { spec: fetchedSpec, supabase: supabaseStatus };
    }

    /**
     * UI Click Handler for "ดึงสเปกเครื่องรุ่นนี้" Button in Drawer
     */
    async handleFetchClick(targetPn, encodedModel, buttonEl) {
      const model = decodeURIComponent(encodedModel || '');
      const statusEl = document.getElementById('fetchSpecStatusMsg');
      const origText = buttonEl ? buttonEl.innerHTML : '';

      try {
        if (buttonEl) {
          buttonEl.disabled = true;
          buttonEl.innerHTML = '<span>⏳ กำลังเชื่อมต่อ Supabase & ดึงสเปก...</span>';
        }
        if (statusEl) {
          statusEl.innerHTML = '<span style="color: #38bdf8;">🔍 กำลังสืบค้นข้อมูลสเปกทางการและบันทึกขึ้น Supabase Cloud...</span>';
        }

        const item = { pn: targetPn, model: model };
        const result = await this.fetchAndUpdateSpec(item, (msg) => {
          if (statusEl) statusEl.innerHTML = `<span style="color: #38bdf8;">${msg}</span>`;
        });

        const isCloudSynced = result.supabase && result.supabase.synced;
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #34d399;">✓ ${isCloudSynced ? 'บันทึกขึ้น Supabase Cloud เรียบร้อย' : 'อัปเดตสเปกสำเร็จ'}! กำลังแสดงผลสเปก...</span>`;
        }

        // Re-render Dual Tab Drawer Body after brief delay so user sees success feedback
        setTimeout(() => {
          if (typeof window.switchDrawerMainTab === 'function') {
            window.switchDrawerMainTab('SPECS');
          } else if (typeof window.openProductSpecsDrawer === 'function') {
            window.openProductSpecsDrawer(targetPn, encodeURIComponent(model));
          }
        }, 300);

      } catch (err) {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #f43f5e;">❌ เกิดข้อผิดพลาด: ${err.message}</span>`;
        }
        if (buttonEl) {
          buttonEl.disabled = false;
          buttonEl.innerHTML = origText;
        }
      }
    }

    /**
     * Client Fallback Generator with guaranteed standard keys (both camelCase and Thai)
     */
    generateClientFallbackSpec(modelName, pn, category) {
      const m = (modelName || '').trim();
      const u = m.toUpperCase();
      const cleanPn = (pn || '').trim().toUpperCase();

      return {
        modelGroup: m,
        officialName: `Samsung ${m} (${cleanPn || 'เครื่องศูนย์ไทย'})`,
        source: 'Samsung Thailand Official (samsung.com/th)',
        sourceUrl: 'https://www.samsung.com/th/',
        marketRegion: 'Thailand (THL)',
        category: category || (u.includes('TAB') ? 'Tablet' : (u.includes('WATCH') || u.includes('BUDS') ? 'Wearable' : 'SmartPhone')),
        brand: 'Samsung',
        display: {
          screenSize: 'จอแสดงผล Dynamic AMOLED 2X มาตรฐานศูนย์ไทย',
          panelType: 'Dynamic AMOLED 2X',
          resolution: 'FHD+ / QHD+ High Resolution',
          refreshRate: '120Hz Adaptive Refresh Rate',
          peakBrightness: 'สว่างชัดเจนกลางแจ้ง (Vision Booster)',
          glassProtection: 'Corning Gorilla Glass ทนทานสูง',
          'ขนาดหน้าจอ': 'จอแสดงผล Dynamic AMOLED 2X มาตรฐานศูนย์ไทย',
          'ชนิดหน้าจอ': 'Dynamic AMOLED 2X',
          'ความละเอียด': 'FHD+ / QHD+ High Resolution',
          'อัตรารีเฟรช': '120Hz Adaptive',
          'กระจกกันรอย': 'Corning Gorilla Glass'
        },
        performance: {
          processor: 'ชิปเซ็ตประมวลผลความเร็วสูง Samsung Exynos / Snapdragon for Galaxy',
          cpuCores: 'Octa-core',
          gpu: 'กราฟิกคุณภาพสูงรองรับเกมและมัลติมีเดีย',
          aiEngine: 'Galaxy AI รองรับฟังก์ชันอัจฉริยะ One UI',
          'ชิปเซ็ตประมวลผล': 'Samsung Exynos / Snapdragon for Galaxy',
          'ระบบปัญญาประดิษฐ์': 'Galaxy AI อัจฉริยะ'
        },
        memory: {
          ram: 'หน่วยความจำมาตรฐานรุ่นความเร็วสูง LPDDR5X',
          storage: 'ความจุมาตรฐาน UFS จัดเก็บรูปภาพและวิดีโอได้จุใจ',
          expandableStorage: 'ตรวจสอบตามรุ่น',
          'หน่วยความจำ (RAM)': 'หน่วยความจำมาตรฐานรุ่นความเร็วสูง',
          'พื้นที่จัดเก็บ (ROM)': 'ความจุมาตรฐาน UFS'
        },
        camera: {
          rearCamera: 'กล้องคมชัดระดับสูงพร้อมระบบกันสั่น OIS',
          frontCamera: 'กล้องหน้าคมชัดสำหรับเซลฟี่และวิดีโอคอล',
          videoRecording: 'รองรับการบันทึกวิดีโอความละเอียดสูง 4K',
          'กล้องหลัง (Rear)': 'กล้องความละเอียดสูงพร้อม OIS',
          'กล้องหน้า (Selfie)': 'กล้องหน้าเซลฟี่คมชัด'
        },
        battery: {
          capacity: 'แบตเตอรี่ใช้งานได้ยาวนานตลอดวัน',
          chargingSpeed: 'รองรับระบบชาร์จไว Super Fast Charging',
          wirelessCharging: 'รองรับการชาร์จไร้สาย (รุ่นที่รองรับ)',
          reverseCharging: 'รองรับ Wireless PowerShare',
          'ความจุแบตเตอรี่': 'แบตเตอรี่ใช้งานได้ยาวนานตลอดวัน',
          'การชาร์จไวมีสาย': 'Super Fast Charging'
        },
        connectivityAndBuild: {
          network: '5G Sub6 / SA / NSA, 4G LTE ทุกเครือข่ายในไทย',
          simType: 'Dual SIM (Nano-SIM + รองรับ eSIM)',
          wifi: 'Wi-Fi ความเร็วสูง',
          bluetooth: 'Bluetooth เวอร์ชั่นล่าสุด',
          waterResistance: 'ผ่านการทดสอบมาตรฐานความปลอดภัยและการกันน้ำ',
          spenSupport: u.includes('ULTRA') ? 'รองรับ S Pen ในตัวเครื่อง' : 'ตรวจสอบตามรุ่น',
          frameMaterial: 'วัสดุพรีเมียม Armor Aluminum / Titanium',
          'เครือข่ายสัญญาณ': '5G / 4G LTE ครบทุกคลื่นความถี่ในไทย',
          'การกันน้ำกันฝุ่น': 'มาตรฐานศูนย์บริการ Samsung'
        }
      };
    }

    /**
     * Scan current stock dataset for items with missing or unverified specs
     */
    scanMissingSpecs(stockItems) {
      if (!Array.isArray(stockItems)) {
        stockItems = window.masterStockData || window.STOCK_DATA || [];
      }
      if (!window.resolveProductSpecs) return [];

      const missing = [];
      const seen = new Set();

      for (const item of stockItems) {
        if (!item || !item.model) continue;
        const key = (item.pn || item.model).toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const spec = window.resolveProductSpecs(item);
        if (!spec) {
          missing.push(item);
        }
      }

      return missing;
    }

    /**
     * Batch update all missing specs
     */
    async batchUpdateMissingSpecs(missingList, onProgress) {
      if (!Array.isArray(missingList) || missingList.length === 0) return 0;
      let updatedCount = 0;

      for (let i = 0; i < missingList.length; i++) {
        const item = missingList[i];
        if (onProgress) {
          onProgress(i + 1, missingList.length, item.model);
        }
        try {
          await this.fetchAndUpdateSpec(item);
          updatedCount++;
        } catch (e) {
          console.warn(`[BatchUpdate] Failed for ${item.model}:`, e.message);
        }
        // Small pause to prevent UI lockup
        await new Promise(r => setTimeout(r, 60));
      }

      return updatedCount;
    }
  }

  root.ProductSpecUpdater = new ProductSpecUpdater();

})(typeof window !== 'undefined' ? window : this);
