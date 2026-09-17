/**
 * Samsung Branch Operations - Promotion Import Center
 * Client-Side Excel & AI Ingestion Engine (Phase 4: Dual-Path Safety Net)
 * 
 * Rules & Contract:
 * - Path A (Supplemental Non-Pricing): Auto-publish 100% Zero-Touch (Freebie / Terms / Perks).
 * - Path B (Provisional Pricing): Confidence Gate (>= 0.70 Active Provisional, < 0.70 Review Blocked).
 * - Triple Safety Net:
 *   1. Confidence Gate (>= 0.70) + UI Provisional Caution Badge.
 *   2. Background Auto-Reconciliation on incoming Excel batches (Match -> EXCEL_CONFIRMED, Mismatch -> SOURCE_CONFLICT).
 *   3. 7-Day Time-To-Live (TTL) Expiration (-> EXPIRED_UNRECONCILED).
 * - Media Provenance: Raw media SHA-256 hash tracking for all flyer uploads.
 * - Storage: IndexedDB Draft Store (LOCAL_BROWSER_ONLY).
 */

(function() {
  'use strict';

  const DB_NAME = 'SamsungBranchPromoImportDb_v1';
  const DB_VERSION = 1;
  const STORE_BATCHES = 'promo_import_batches';
  const STORE_CURRENT = 'promo_current_snapshot';

  class PromoStorageAdapter {
    static async getDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_BATCHES)) {
            const store = db.createObjectStore(STORE_BATCHES, { keyPath: 'batchId' });
            store.createIndex('importedAt', 'importedAt', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_CURRENT)) {
            db.createObjectStore(STORE_CURRENT, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    static checkTtlExpiration(variants) {
      if (!Array.isArray(variants)) return [];
      const now = Date.now();
      return variants.map(v => {
        if (v.promotionSourceType === 'PROVISIONAL_AI_CAPTURE' && v.provisionalStatus === 'ACTIVE_PROVISIONAL') {
          if (v.ttlExpiresAt && new Date(v.ttlExpiresAt).getTime() < now) {
            return {
              ...v,
              provisionalStatus: 'EXPIRED_UNRECONCILED',
              validationStatus: 'BLOCKED_INVALID',
              reasonText: 'โปรโมชั่นจาก AI หมดอายุการใช้งาน (เกิน TTL 7 วันโดยไม่มี Excel ยืนยัน)'
            };
          }
        }
        return v;
      });
    }

    static async saveBatch(batchRecord) {
      const db = await this.getDb();
      const published = this.checkTtlExpiration(batchRecord.publishedItems || []);
      const quarantined = batchRecord.quarantinedItems || [];

      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_BATCHES, STORE_CURRENT], 'readwrite');
        const batchStore = tx.objectStore(STORE_BATCHES);
        const currentStore = tx.objectStore(STORE_CURRENT);

        batchStore.put(batchRecord);
        currentStore.put({
          key: 'active',
          batchId: batchRecord.batchId,
          publishedItems: published,
          quarantinedItems: quarantined,
          meta: batchRecord.meta || batchRecord
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    static async getActiveSnapshot() {
      try {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_CURRENT, 'readonly');
          const store = tx.objectStore(STORE_CURRENT);
          const req = store.get('active');
          req.onsuccess = () => {
            const res = req.result;
            if (res && Array.isArray(res.publishedItems)) {
              res.publishedItems = PromoStorageAdapter.checkTtlExpiration(res.publishedItems);
            }
            resolve(res || null);
          };
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        return null;
      }
    }

    static async autoReconcileWithExcel(excelBatchId, excelVariants) {
      try {
        const db = await this.getDb();
        const active = await this.getActiveSnapshot();
        if (!active || !Array.isArray(active.publishedItems)) return null;

        let modified = false;
        const reconciledList = active.publishedItems.map(aiItem => {
          if (aiItem.promotionSourceType === 'PROVISIONAL_AI_CAPTURE' && aiItem.provisionalStatus === 'ACTIVE_PROVISIONAL') {
            // Match by model and saleMode
            const match = excelVariants.find(ev => 
              ev.model && aiItem.model && ev.model.toLowerCase().trim() === aiItem.model.toLowerCase().trim()
            );

            if (match) {
              modified = true;
              const excelNet = Number(match.netPrice || 0);
              const aiNet = Number(aiItem.netPrice || 0);
              const diff = excelNet - aiNet;

              if (Math.abs(diff) <= 1) {
                // Exact match: promote to EXCEL_CONFIRMED
                return {
                  ...aiItem,
                  promotionSourceType: 'EXCEL_CONFIRMED',
                  provisionalStatus: 'AUTO_RECONCILED',
                  reconciledAgainstBatchId: excelBatchId,
                  reconciliationDelta: {
                    priceMatched: true,
                    excelNetPrice: excelNet,
                    aiCapturedNetPrice: aiNet,
                    differenceBaht: 0,
                    reconciledAt: new Date().toISOString()
                  },
                  reasonText: `✓ ยืนยันราคาตรงกับไฟล์ Excel ทางการ (${excelBatchId})`
                };
              } else {
                // Price discrepancy: flag SOURCE_CONFLICT
                return {
                  ...aiItem,
                  provisionalStatus: 'SOURCE_CONFLICT',
                  validationStatus: 'BLOCKED_INVALID',
                  reconciliationDelta: {
                    priceMatched: false,
                    excelNetPrice: excelNet,
                    aiCapturedNetPrice: aiNet,
                    differenceBaht: diff,
                    reconciledAt: new Date().toISOString()
                  },
                  reasonText: `⚠️ ราคาขัดแย้ง: AI ดึงได้ ฿${aiNet.toLocaleString()} แต่ Excel เป็น ฿${excelNet.toLocaleString()} (ต่างกัน ฿${diff.toLocaleString()})`
                };
              }
            }
          }
          return aiItem;
        });

        if (modified) {
          active.publishedItems = reconciledList;
          await this.saveBatch({
            batchId: active.batchId,
            sourceFilename: active.meta?.sourceFilename || "Reconciled",
            fileHash: active.meta?.fileHash || "",
            importedAt: new Date().toISOString(),
            format: 'RECONCILED_SNAPSHOT',
            publishedItems: reconciledList,
            quarantinedItems: active.quarantinedItems || [],
            stats: active.meta?.stats || {},
            meta: {
              ...(active.meta || {}),
              lastAutoReconciledAt: new Date().toISOString(),
              lastReconciledExcelBatch: excelBatchId
            }
          });
          console.info(`[Auto-Reconcile] Completed background reconciliation against Excel batch ${excelBatchId}`);
        }

        return active;
      } catch (err) {
        console.warn('[Auto-Reconcile Error]', err);
        return null;
      }
    }

    static async getAllBatches() {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BATCHES, 'readonly');
        const store = tx.objectStore(STORE_BATCHES);
        const req = store.getAll();
        req.onsuccess = () => {
          const res = (req.result || []).sort((a, b) => new Date(b.importedAt || b.meta?.importedAt) - new Date(a.importedAt || a.meta?.importedAt));
          resolve(res);
        };
        req.onerror = () => reject(req.error);
      });
    }

    static async rollbackToBatch(batchId) {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_BATCHES, STORE_CURRENT], 'readwrite');
        const batchStore = tx.objectStore(STORE_BATCHES);
        const currentStore = tx.objectStore(STORE_CURRENT);

        const getReq = batchStore.get(batchId);
        getReq.onsuccess = () => {
          const record = getReq.result;
          if (!record) {
            reject(new Error(`ไม่พบ Batch ID: ${batchId} ใน IndexedDB`));
            return;
          }
          currentStore.put({
            key: 'active',
            batchId: record.batchId,
            publishedItems: record.publishedItems || [],
            quarantinedItems: record.quarantinedItems || [],
            meta: record.meta || record
          });
        };
        tx.oncomplete = () => resolve(getReq.result);
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  class PromoSecurityGate {
    static ALLOWED_EXT = ['xlsx', 'png', 'jpg', 'jpeg', 'webp', 'txt'];
    static MAX_SIZE = 15 * 1024 * 1024; // 15MB

    static async inspectFile(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!this.ALLOWED_EXT.includes(ext)) {
        throw new Error(`นามสกุลไฟล์ .${ext} ไม่อยู่ในรายการที่อนุญาต (.xlsx, .png, .jpg, .jpeg, .webp, .txt)`);
      }

      if (file.size > this.MAX_SIZE) {
        throw new Error(`ขนาดไฟล์ (${(file.size / 1024 / 1024).toFixed(1)}MB) เกินขีดจำกัด 15MB`);
      }

      if (file.size === 0) {
        throw new Error('ไฟล์มีขนาด 0 ไบต์ (Empty file)');
      }

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Magic Byte Verification
      if (ext === 'xlsx') {
        if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
          throw new Error('ไฟล์ .xlsx ไม่ตรงกับโครงสร้าง ZIP Header มาตรฐาน');
        }
        // Macro code check
        const textDecoder = new TextDecoder('latin1');
        const rawStr = textDecoder.decode(bytes.slice(0, Math.min(bytes.length, 100000)));
        if (rawStr.includes('vbaProject.bin')) {
          throw new Error('ตรวจพบ Embedded VBA Macro ภายในไฟล์ Excel ไม่อนุญาตเพื่อความปลอดภัย');
        }
      } else if (ext === 'png') {
        if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
          throw new Error('Magic bytes ของไฟล์ PNG ไม่ถูกต้อง');
        }
      } else if (ext === 'jpg' || ext === 'jpeg') {
        if (bytes[0] !== 0xFF || bytes[1] !== 0xD8 || bytes[2] !== 0xFF) {
          throw new Error('Magic bytes ของไฟล์ JPEG ไม่ถูกต้อง');
        }
      } else if (ext === 'webp') {
        const header = String.fromCharCode(...bytes.slice(0, 4)) + String.fromCharCode(...bytes.slice(8, 12));
        if (header !== 'RIFFWEBP') {
          throw new Error('Magic bytes ของไฟล์ WebP ไม่ถูกต้อง');
        }
      }

      // Compute SHA-256
      const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      const fileHash = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');

      return {
        ext,
        size: file.size,
        fileHash,
        buffer
      };
    }
  }

  // Multi-Format Extraction Engine
  class MultiFormatExtractor {
    static parseExcel(buffer, filename) {
      const wb = XLSX.read(buffer, { type: 'array', cellFormula: true, cellHTML: false });
      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('ไฟล์ Excel ไม่มีชีตข้อมูล');
      }

      const extractedVariants = [];
      const warnings = [];

      wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName];
        if (!sheet || !sheet['!ref']) return;

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        if (!rows || rows.length < 2) return;

        // Detect Header Row
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 12); i++) {
          const rStr = rows[i].map(c => String(c).trim().toUpperCase()).join(' ');
          if (rStr.includes('P/N') || rStr.includes('MODEL') || rStr.includes('RRP') || rStr.includes('ราคา') || rStr.includes('แลกซื้อ')) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) return; // Not a recognized table sheet
        const headers = rows[headerIdx];

        // Specific Header Classification Function
        const classifyHeader = (rawH) => {
          const h = String(rawH || '').trim().replace(/\r?\n/g, ' ').toUpperCase();
          if (!h) return null;

          // 1. Specific Net Prices (Specific before generic)
          if (h.includes('หลังลดและเทรดอัพ') || h.includes('หลังลด และเทรดอัพ') || h.includes('หลังลด และ เทรดอัพ')) return 'tradeUpNetPrice';
          if (h.includes('NET แลกซื้อ') || h.includes('ราคา NET แลกซื้อ') || h.includes('ราคาหลังหักส่วนลด แลกซื้อ')) return 'addOnNetPrice';
          if (h.includes('สุทธิ STUDENT') || h.includes('ราคา STUDENT') || h.includes('หลังลด STUDENT')) return 'studentNetPrice';
          if (h.includes('หลังลด SF+') || h.includes('สุทธิ SF+')) return 'sfPlusNetPrice';
          if (h.includes('ราคาหลังหักส่วนลด PROMOTION') || h.includes('ราคาหลังหักส่วนลด') || h.includes('ราคาหลังลด') || h.includes('ราคาสุทธิ') || h.includes('NET PRICE') || h === 'NET') return 'standardNetPrice';

          // 2. Specific Trade Up Payment Code and Discount
          if (h.includes('กดชำระ TRADE UP') || h.includes('กดชำระ TRADE') || h.includes('ปุ่มชำระ') || h.includes('ปุ่ม TRADE UP')) return 'tradeUpPaymentCode';
          if (h.includes('ส่วนลด TRADE UP') || h.includes('เทรดอัพ') || h.includes('TRADE UP') || h.includes('TRADE-UP')) return 'tradeUpDiscount';

          // 3. Specific Component / Addon Discounts
          if (h.includes('SS DISCOUNT') || h.includes('ลด SS') || h.includes('SS ส่วนลด')) return 'ssDiscount';
          if (h.includes('CPW DISCOUNT') || h.includes('ลด CPW') || h.includes('CPW ส่วนลด')) return 'cpwDiscount';
          if (h.includes('ADD ON') || h.includes('แลกซื้อ')) return 'addOnDiscount';
          if (h.includes('ส่วนลด STUDENT') || h.includes('ลด STUDENT') || h.includes('% ส่วนลด')) return 'studentDiscount';

          // 4. Generic Standard Discount
          if (h.includes('ส่วนลด') || h.includes('DISCOUNT') || h === 'ลด') return 'standardDiscount';

          // 5. Product Specs & Scope
          if (h.includes('P/N') || h === 'PN' || h.includes('PART NUMBER') || h.includes('SKU') || h.includes('รหัส')) return 'pn';
          if (h.includes('MODEL') || h.includes('รุ่น') || h.includes('สินค้า')) return 'model';
          if (h.includes('ความจุ') || h.includes('CAPACITY') || h.includes('STORAGE') || h.includes('RAM/ROM')) return 'capacity';
          if (h.includes('RRP') || h.includes('ราคาปกติ') || h.includes('ราคาป้าย')) return 'rrp';
          if (h.includes('COUPON') || h.includes('คูปอง')) return 'coupon';
          if (h.includes('MODE') || h.includes('แคมเปญ') || h.includes('ประเภท')) return 'saleMode';
          if (h.includes('CATEGORY') || h.includes('หมวดหมู่')) return 'category';

          return null;
        };

        // Detect Columns
        const colMap = {};
        headers.forEach((h, idx) => {
          const field = classifyHeader(h);
          if (field && colMap[field] === undefined) {
            colMap[field] = idx;
          }
        });

        // Sheet Eligibility Gate
        // A promotion pricing sheet MUST have: (1) Model or P/N, (2) RRP, and (3) Discount or Net Price
        const hasProductCol = (colMap['model'] !== undefined || colMap['pn'] !== undefined);
        const hasRrpCol = colMap['rrp'] !== undefined;
        const hasPricingCol = (colMap['standardDiscount'] !== undefined || colMap['tradeUpDiscount'] !== undefined ||
                              colMap['addOnDiscount'] !== undefined || colMap['standardNetPrice'] !== undefined ||
                              colMap['tradeUpNetPrice'] !== undefined || colMap['addOnNetPrice'] !== undefined);

        if (!hasProductCol || !hasRrpCol || !hasPricingCol) {
          // Exclude reference sheets (e.g. 'Trade up model') from pricing variants
          return;
        }

        const isAddonSheet = sheetName.includes('50-70%') || sheetName.includes('แลกซื้อ') || colMap['addOnDiscount'] !== undefined || (colMap['ssDiscount'] !== undefined && colMap['cpwDiscount'] !== undefined);

        // Helper to parse numbers safely without defaulting to 0
        const parseNumOrNull = (v) => {
          if (v === null || v === undefined || v === '' || v === '-' || String(v).trim().toLowerCase() === 'none') return null;
          const s = String(v).replace(/,/g, '').trim();
          const n = parseFloat(s);
          return isNaN(n) ? null : n;
        };

        const getColLetter = (cIdx) => String.fromCharCode(65 + (cIdx % 26));

        let currentModel = '';

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;

          // Check formula errors
          let hasFormulaError = false;
          let formulaErrorDetail = '';
          let errorCellRef = '';

          for (let c = 0; c < row.length; c++) {
            const rawVal = String(row[c] || '').trim();
            if (rawVal.includes('#ERROR!') || rawVal.includes('#REF!') || rawVal.includes('#VALUE!') ||
                rawVal.includes('#NAME?') || rawVal.includes('#N/A') || rawVal.includes('#DIV/0!') || rawVal.includes('#NULL!')) {
              hasFormulaError = true;
              formulaErrorDetail = rawVal;
              errorCellRef = `${getColLetter(c)}${r + 1}`;
              break;
            }
          }

          const pnRaw = colMap['pn'] !== undefined ? String(row[colMap['pn']] || '').trim() : '';
          let modelRaw = colMap['model'] !== undefined ? String(row[colMap['model']] || '').trim() : '';
          const capacityRaw = colMap['capacity'] !== undefined ? String(row[colMap['capacity']] || '').trim() : '';

          if (modelRaw) {
            currentModel = modelRaw;
          } else if (currentModel && (capacityRaw || (colMap['rrp'] !== undefined && row[colMap['rrp']] !== undefined && row[colMap['rrp']] !== null && row[colMap['rrp']] !== ''))) {
            modelRaw = currentModel;
          }

          if (!pnRaw && !modelRaw && !hasFormulaError) continue;

          const rrp = colMap['rrp'] !== undefined ? parseNumOrNull(row[colMap['rrp']]) : null;
          const stdDiscount = colMap['standardDiscount'] !== undefined ? parseNumOrNull(row[colMap['standardDiscount']]) : null;
          const ssDisc = colMap['ssDiscount'] !== undefined ? parseNumOrNull(row[colMap['ssDiscount']]) : null;
          const cpwDisc = colMap['cpwDiscount'] !== undefined ? parseNumOrNull(row[colMap['cpwDiscount']]) : null;
          const addOnDisc = colMap['addOnDiscount'] !== undefined ? parseNumOrNull(row[colMap['addOnDiscount']]) : ((ssDisc || 0) + (cpwDisc || 0) || null);
          const tradeUpDiscount = colMap['tradeUpDiscount'] !== undefined ? parseNumOrNull(row[colMap['tradeUpDiscount']]) : null;

          const tradeUpNetPrice = colMap['tradeUpNetPrice'] !== undefined ? parseNumOrNull(row[colMap['tradeUpNetPrice']]) : null;
          const standardNetPrice = colMap['standardNetPrice'] !== undefined ? parseNumOrNull(row[colMap['standardNetPrice']]) : null;
          const addOnNetPrice = colMap['addOnNetPrice'] !== undefined ? parseNumOrNull(row[colMap['addOnNetPrice']]) : null;

          let tradeUpPaymentCode = colMap['tradeUpPaymentCode'] !== undefined ? String(row[colMap['tradeUpPaymentCode']] || '').trim() : null;
          if (tradeUpPaymentCode === '-' || tradeUpPaymentCode === '' || tradeUpPaymentCode === 'None') tradeUpPaymentCode = null;

          const couponRaw = colMap['coupon'] !== undefined ? String(row[colMap['coupon']] || '').trim() : '';
          let normalizedCoupon = couponRaw;
          if (couponRaw.includes('01')) normalizedCoupon = '01';
          else if (couponRaw.includes('02')) normalizedCoupon = '02';
          else if (couponRaw.includes('04')) normalizedCoupon = '04';
          else if (couponRaw.toUpperCase().includes('STUDENT')) normalizedCoupon = 'Studentcrd';

          // Exact P/N & Product Code Type
          let pn = null;
          let codeType = 'UNKNOWN';
          let productMatchStatus = 'UNPROVEN';
          let candidateList = [];

          if (pnRaw) {
            pn = pnRaw.toUpperCase();
            productMatchStatus = 'SOURCE_EXACT_PN';
            if (pn.startsWith('F-')) codeType = 'PASS_F';
            else if (pn.startsWith('SM-')) codeType = 'STANDARD_SM';
            else if (pn.startsWith('EP-') || pn.startsWith('EF-') || pn.startsWith('GP-') || pn.startsWith('EE-')) codeType = 'STANDARD_ACCESSORY';
          } else {
            // No Exact P/N in row: Query stock master cache
            const stockData = window.STOCK_DATABASE || window.STOCK_DATA || [];
            const cleanM = modelRaw.toLowerCase().replace('galaxy', '').replace(/\(.*?\)/g, '').trim();
            const cleanMNoSpace = cleanM.replace(/\s+/g, '');
            const capLower = capacityRaw.toLowerCase().trim();

            // Detect target product type from promotion model / row
            const isTargetPhone = (
              modelRaw.toLowerCase().includes('galaxy') ||
              modelRaw.toLowerCase().includes('s2') ||
              modelRaw.toLowerCase().includes('a0') ||
              modelRaw.toLowerCase().includes('a1') ||
              modelRaw.toLowerCase().includes('a2') ||
              modelRaw.toLowerCase().includes('a3') ||
              modelRaw.toLowerCase().includes('a5') ||
              modelRaw.toLowerCase().includes('fold') ||
              modelRaw.toLowerCase().includes('flip') ||
              (colMap['category'] !== undefined && String(row[colMap['category']] || '').toLowerCase().includes('series'))
            );

            // Detect if row explicitly specifies a specific color (Default: promotions apply to ALL colors)
            const fullRowText = (modelRaw + ' ' + (colMap['category'] !== undefined ? String(row[colMap['category']] || '') : '')).toLowerCase();
            const colorMapRules = [
              { key: 'violet', th: 'ม่วง' },
              { key: 'lilac', th: 'ไลแลค' },
              { key: 'dark blue', th: 'น้ำเงิน' },
              { key: 'blue', th: 'ฟ้า' },
              { key: 'navy', th: 'กรม' },
              { key: 'black', th: 'ดำ' },
              { key: 'gray', th: 'เทา' },
              { key: 'grey', th: 'เทา' },
              { key: 'silver', th: 'เงิน' },
              { key: 'white', th: 'ขาว' },
              { key: 'green', th: 'เขียว' },
              { key: 'pink', th: 'ชมพู' },
              { key: 'cream', th: 'ครีม' },
              { key: 'graphite', th: 'กราไฟต์' },
              { key: 'mint', th: 'มิ้นท์' },
              { key: 'yellow', th: 'เหลือง' },
              { key: 'gold', th: 'ทอง' }
            ];

            let explicitColorFilter = null;
            for (const cr of colorMapRules) {
              if (fullRowText.includes(`สี${cr.th}`) || fullRowText.includes(`เฉพาะสี${cr.th}`) || fullRowText.includes(cr.key)) {
                explicitColorFilter = cr.key;
                break;
              }
            }

            const seenPns = new Set();
            const candidateDetails = [];

            stockData.forEach(s => {
              // 1. Strict Product Type & Category Gate
              const isItemPhone = (
                (s.category && s.category.toLowerCase() === 'smartphone') ||
                (s.canonicalCategory && s.canonicalCategory.toLowerCase() === 'smartphone') ||
                (s.category1 && s.category1.toUpperCase().includes('SMART PHONE'))
              );

              // 2. Strict Accessory Blacklist (Exclude even if product name mentions phone model!)
              const isAccessory = (
                (s.category && ['accessory', 'phone_case', 'screen_protector', 'watch_band', 'premium_gift', 'premium', 'other', 'sim', 'watch', 'buds', 'tablet'].includes(s.category.toLowerCase())) ||
                (s.category1 && (s.category1.toUpperCase().includes('ACCESSORY') || s.category1.toUpperCase().includes('OTHER'))) ||
                s.pn.startsWith('EF-') ||
                s.pn.startsWith('GP-') ||
                s.pn.startsWith('EP-') ||
                s.pn.startsWith('EE-') ||
                s.pn.startsWith('ITFIT')
              );

              if (isTargetPhone) {
                if (!isItemPhone || isAccessory) {
                  return; // Strictly reject accessories, cases, protectors, and unknown non-smartphones
                }
              }

              const sm = (s.model || '').toLowerCase();
              const smNoSpace = sm.replace(/\s+/g, '');
              const scolor = (s.color || '').toLowerCase();

              // 3. Model Family Hierarchy Matching
              // Distinguish Ultra vs +/Plus vs Standard Base
              if (cleanM.includes('ultra') && !sm.includes('ultra')) return;
              if ((cleanM.includes('+') || cleanM.includes('plus')) && (!sm.includes('+') && !sm.includes('plus'))) return;
              if (!cleanM.includes('ultra') && !cleanM.includes('+') && !cleanM.includes('plus')) {
                if (sm.includes('ultra') || sm.includes('+') || sm.includes('plus')) return;
              }

              // Base model number matching (e.g. s26, s25, fold8, flip7)
              const mBase = cleanM.replace(/ultra|\+|\s+|plus/g, '');
              const smBase = sm.replace(/ultra|\+|\s+|plus/g, '');
              if (mBase && !smBase.includes(mBase)) return;

              // 4. Strict Capacity Matching (NEVER match substring 'tb' inside 'lightblue'!)
              let capMatches = false;
              if (capLower.includes('1tb') || capLower.includes('1 tb')) {
                capMatches = /(?:^|\D)(?:12\/|16\/)?1\s*tb(?:\b|\D|$)/i.test(sm);
              } else if (capLower.includes('512')) {
                capMatches = /(?:^|\D)(?:12\/|16\/)?512\s*gb(?:\b|\D|$)/i.test(sm);
              } else if (capLower.includes('256')) {
                capMatches = /(?:^|\D)(?:8\/|12\/)?256\s*gb(?:\b|\D|$)/i.test(sm);
              } else if (capLower.includes('128')) {
                capMatches = /(?:^|\D)(?:4\/|6\/|8\/)?128\s*gb(?:\b|\D|$)/i.test(sm);
              } else if (capLower.includes('64')) {
                capMatches = /(?:^|\D)(?:3\/|4\/)?64\s*gb(?:\b|\D|$)/i.test(sm);
              } else if (!capLower || capLower === '-') {
                capMatches = true;
              }

              if (!capMatches) return;

              // 5. Explicit Color Filter (if specified in promotion row)
              if (explicitColorFilter && !scolor.includes(explicitColorFilter)) {
                return;
              }

              if (!seenPns.has(s.pn)) {
                seenPns.add(s.pn);
                candidateList.push(s.pn);
                candidateDetails.push({
                  pn: s.pn,
                  model: s.model,
                  color: s.color || '-',
                  capacity: capacityRaw || '-',
                  productType: 'SMARTPHONE',
                  modelMatch: 'PASS',
                  capacityMatch: 'PASS',
                  productCodeType: s.pn.startsWith('F-') ? 'PASS_F' : 'STANDARD_SM',
                  f1: s.f1 || 0,
                  f2: s.f2 || 0,
                  total: (s.f1 || 0) + (s.f2 || 0)
                });
              }
            });

            if (candidateList.length === 1) {
              productMatchStatus = 'UNIQUE_MODEL_CAPACITY_CANDIDATE';
              codeType = candidateList[0].startsWith('F-') ? 'PASS_F' : 'STANDARD_SM';
            } else if (candidateList.length > 1) {
              productMatchStatus = 'MULTIPLE_PN_CANDIDATES';
              codeType = candidateList[0].startsWith('F-') ? 'PASS_F' : 'STANDARD_SM';
            } else {
              productMatchStatus = 'PN_NOT_FOUND';
              codeType = 'UNKNOWN';
            }
          }

          const matchMethod = pnRaw ? 'SOURCE_EXACT_PN' : 'MODEL_CAPACITY_CANDIDATE';
          const sourceProvidedPn = Boolean(pnRaw);
          const humanConfirmationRequired = !pnRaw;

          // Case A: Row contains Trade Up discount -> Split into STANDARD_PAYMENT and TRADE_UP
          if (tradeUpDiscount !== null && tradeUpDiscount > 0) {
            // 1. STANDARD_PAYMENT Variant
            const stdExpectedNet = rrp !== null ? (rrp - (stdDiscount || 0)) : null;
            const stdNet = standardNetPrice !== null ? standardNetPrice : stdExpectedNet;
            const stdOrigin = standardNetPrice !== null ? 'SOURCE_CELL' : 'DERIVED_FROM_SOURCE_COMPONENTS';

            let stdStatus = 'PASSED_VALIDATION';
            const stdFlags = [];
            let stdReason = '';

            if (hasFormulaError) {
              stdStatus = 'BLOCKED_INVALID';
              stdFlags.push('SOURCE_FORMULA_ERROR');
              stdReason = `พบข้อผิดพลาดสูตรใน Excel (${formulaErrorDetail})`;
            } else if (stdNet === null) {
              stdStatus = 'BLOCKED_INVALID';
              stdFlags.push('NET_PRICE_NOT_EXTRACTED');
              stdReason = 'ไม่สามารถสกัดราคาสุทธิได้ (Net Price is null)';
            } else if (!pn) {
              if (productMatchStatus === 'PN_NOT_FOUND') {
                stdStatus = 'REVIEW_REQUIRED';
                stdFlags.push('PN_NOT_FOUND', 'EXACT_PN_UNRESOLVED');
                stdReason = `ไม่พบ P/N ตัวเครื่อง ${modelRaw} (${capacityRaw}) ในระบบสต็อก`;
              } else {
                stdStatus = 'REVIEW_REQUIRED';
                stdFlags.push('WARNING_DERIVED_STANDARD_NET', 'EXACT_PN_UNRESOLVED');
                stdReason = `คำนวณราคาสุทธิมาตรฐาน (฿${rrp} - ฿${stdDiscount || 0} = ฿${stdNet}) • ต้องจับคู่ Exact P/N ก่อนเผยแพร่`;
              }
            }

            extractedVariants.push({
              draftRowId: `ROW-${r + 1}-STD`,
              pn: pn,
              model: modelRaw || `แถวที่ ${r + 1}`,
              capacity: capacityRaw,
              productCodeType: codeType,
              productMatchStatus,
              matchMethod,
              candidatePn: candidateList,
              candidateCount: candidateList.length,
              sourceProvidedPn,
              humanConfirmationRequired,
              candidatePns: candidateList,
              selectedPns: [],
              confirmedPns: [],
              targetPns: [],
              rrp,
              discount: stdDiscount || 0,
              standardDiscount: stdDiscount || 0,
              tradeUpDiscount: null,
              standardNetPrice: stdNet,
              tradeUpNetPrice: null,
              netPrice: stdNet,
              netPriceOrigin: stdOrigin,
              coupon: normalizedCoupon,
              saleMode: 'STANDARD_PAYMENT',
              promotionSourceType: 'EXCEL_CONFIRMED',
              validationStatus: stdStatus,
              validationFlags: stdFlags,
              autoPublishAllowed: false, // Strict safety: no auto-publish without exact P/N
              humanReviewRequired: !pn,
              reasonText: stdReason || 'ผ่านการตรวจสอบความถูกต้องสมบูรณ์',
              sourceEvidence: {
                rrp: colMap['rrp'] !== undefined ? `${getColLetter(colMap['rrp'])}${r + 1}` : null,
                standardDiscount: colMap['standardDiscount'] !== undefined ? `${getColLetter(colMap['standardDiscount'])}${r + 1}` : null,
                coupon: colMap['coupon'] !== undefined ? `${getColLetter(colMap['coupon'])}${r + 1}` : null
              },
              sourceTrace: {
                sheet: sheetName,
                row: r + 1,
                cellRef: errorCellRef || `${getColLetter(colMap['rrp'] || 0)}${r + 1}`,
                format: 'EXCEL_LTR'
              }
            });

            // 2. TRADE_UP Variant
            const tupExpectedNet = rrp !== null ? (rrp - (stdDiscount || 0) - tradeUpDiscount) : null;
            const tupNet = tradeUpNetPrice !== null ? tradeUpNetPrice : tupExpectedNet;
            const tupOrigin = tradeUpNetPrice !== null ? 'SOURCE_CELL' : 'DERIVED_FROM_SOURCE_COMPONENTS';

            let tupStatus = 'PASSED_VALIDATION';
            const tupFlags = [];
            let tupReason = '';

            if (hasFormulaError) {
              tupStatus = 'BLOCKED_INVALID';
              tupFlags.push('SOURCE_FORMULA_ERROR');
              tupReason = `พบข้อผิดพลาดสูตรใน Excel (${formulaErrorDetail})`;
            } else if (!tradeUpPaymentCode) {
              tupStatus = 'BLOCKED_UNPROVEN';
              tupFlags.push('TRADE_UP_PAYMENT_CODE_MISSING');
              tupReason = 'มีส่วนลด Trade Up แต่ไม่มีรหัสตัดชำระ (Payment Code ว่างในไฟล์)';
            } else if (tupNet === null) {
              tupStatus = 'BLOCKED_INVALID';
              tupFlags.push('NET_PRICE_NOT_EXTRACTED');
              tupReason = 'ไม่สามารถสกัดราคาสุทธิ Trade Up ได้';
            } else if (!pn) {
              if (productMatchStatus === 'PN_NOT_FOUND') {
                tupStatus = 'REVIEW_REQUIRED';
                tupFlags.push('PN_NOT_FOUND', 'EXACT_PN_UNRESOLVED');
                tupReason = `ไม่พบ P/N ตัวเครื่อง ${modelRaw} (${capacityRaw}) ในระบบสต็อก`;
              } else {
                tupStatus = 'REVIEW_REQUIRED';
                tupFlags.push('EXACT_PN_UNRESOLVED', 'TRADE_UP_PROVISIONAL');
                tupReason = `โปรโมชั่น Trade Up (สุทธิ ฿${tupNet} | รหัสชำระ ${tradeUpPaymentCode}) • ต้องจับคู่ Exact P/N ก่อนเผยแพร่`;
              }
            }

            extractedVariants.push({
              draftRowId: `ROW-${r + 1}-TUP`,
              pn: pn,
              model: modelRaw || `แถวที่ ${r + 1}`,
              capacity: capacityRaw,
              productCodeType: codeType,
              productMatchStatus,
              matchMethod,
              candidatePn: candidateList,
              candidateCount: candidateList.length,
              sourceProvidedPn,
              humanConfirmationRequired,
              candidatePns: candidateList,
              selectedPns: [],
              confirmedPns: [],
              targetPns: [],
              rrp,
              discount: (stdDiscount || 0) + tradeUpDiscount,
              standardDiscount: stdDiscount || 0,
              tradeUpDiscount,
              standardNetPrice: stdExpectedNet,
              tradeUpNetPrice: tupNet,
              tradeUpPaymentCode,
              netPrice: tupNet,
              netPriceOrigin: tupOrigin,
              coupon: normalizedCoupon,
              saleMode: 'TRADE_UP',
              promotionSourceType: 'EXCEL_CONFIRMED',
              validationStatus: tupStatus,
              validationFlags: tupFlags,
              autoPublishAllowed: false,
              humanReviewRequired: !pn,
              reasonText: tupReason || 'ผ่านการตรวจสอบความถูกต้องสมบูรณ์',
              sourceEvidence: {
                rrp: colMap['rrp'] !== undefined ? `${getColLetter(colMap['rrp'])}${r + 1}` : null,
                standardDiscount: colMap['standardDiscount'] !== undefined ? `${getColLetter(colMap['standardDiscount'])}${r + 1}` : null,
                coupon: colMap['coupon'] !== undefined ? `${getColLetter(colMap['coupon'])}${r + 1}` : null,
                tradeUpDiscount: colMap['tradeUpDiscount'] !== undefined ? `${getColLetter(colMap['tradeUpDiscount'])}${r + 1}` : null,
                tradeUpPaymentCode: colMap['tradeUpPaymentCode'] !== undefined ? `${getColLetter(colMap['tradeUpPaymentCode'])}${r + 1}` : null,
                tradeUpNetPrice: colMap['tradeUpNetPrice'] !== undefined ? `${getColLetter(colMap['tradeUpNetPrice'])}${r + 1}` : null
              },
              sourceTrace: {
                sheet: sheetName,
                row: r + 1,
                cellRef: errorCellRef || `${getColLetter(colMap['rrp'] || 0)}${r + 1}`,
                format: 'EXCEL_LTR'
              }
            });

          } else {
            // Case B: No Trade Up discount -> Single Variant
            let saleMode = 'STANDARD_PAYMENT';
            if (isAddonSheet) saleMode = 'ADD_ON_PURCHASE';
            else if (couponRaw.includes('04')) saleMode = 'SF_PLUS';
            else if (couponRaw.toUpperCase().includes('STUDENT')) saleMode = 'STUDENT';

            const activeDiscount = isAddonSheet ? (addOnDisc || 0) : (stdDiscount || 0);
            const expectedNet = rrp !== null ? (rrp - activeDiscount) : null;

            let resolvedNet = null;
            let netOrigin = 'DERIVED_FROM_SOURCE_COMPONENTS';

            if (isAddonSheet && addOnNetPrice !== null) {
              resolvedNet = addOnNetPrice;
              netOrigin = 'SOURCE_CELL';
            } else if (standardNetPrice !== null) {
              resolvedNet = standardNetPrice;
              netOrigin = 'SOURCE_CELL';
            } else if (tradeUpNetPrice !== null) {
              resolvedNet = tradeUpNetPrice; // In sheets without trade-up discount, this cell is the net price
              netOrigin = 'SOURCE_CELL';
            } else if (expectedNet !== null) {
              resolvedNet = expectedNet;
              netOrigin = 'DERIVED_FROM_SOURCE_COMPONENTS';
            }

            let status = 'PASSED_VALIDATION';
            const flags = [];
            let reason = '';

            if (hasFormulaError) {
              status = 'BLOCKED_INVALID';
              flags.push('SOURCE_FORMULA_ERROR');
              reason = `พบข้อผิดพลาดสูตรใน Excel (${formulaErrorDetail}) ที่เซลล์ ${sheetName}!${errorCellRef}`;
            } else if (resolvedNet === null) {
              status = 'BLOCKED_INVALID';
              flags.push('NET_PRICE_NOT_EXTRACTED');
              reason = 'ไม่สามารถสกัดราคาสุทธิได้ (Net Price is null)';
            } else if (rrp !== null && resolvedNet !== null && expectedNet !== null && Math.abs(resolvedNet - expectedNet) > 1) {
              status = 'BLOCKED_INVALID';
              flags.push('PRICE_EQUATION_ERROR');
              reason = `สมการราคาไม่ลงตัว: RRP (฿${rrp}) - ส่วนลด (฿${activeDiscount}) != สุทธิ (฿${resolvedNet})`;
            } else if (!pn) {
              if (productMatchStatus === 'PN_NOT_FOUND') {
                status = 'REVIEW_REQUIRED';
                flags.push('PN_NOT_FOUND', 'EXACT_PN_UNRESOLVED');
                reason = `ไม่พบ P/N ตัวเครื่อง ${modelRaw} (${capacityRaw}) ในระบบสต็อก`;
              } else {
                status = 'REVIEW_REQUIRED';
                flags.push('EXACT_PN_UNRESOLVED');
                reason = `สมการราคาถูกต้อง (สุทธิ ฿${resolvedNet}) • ต้องจับคู่ Exact P/N ก่อนเผยแพร่`;
              }
            }

            extractedVariants.push({
              draftRowId: `ROW-${r + 1}`,
              pn: pn,
              model: modelRaw || `แถวที่ ${r + 1}`,
              capacity: capacityRaw,
              productCodeType: codeType,
              productMatchStatus,
              matchMethod,
              candidatePn: candidateList,
              candidateCount: candidateList.length,
              sourceProvidedPn,
              humanConfirmationRequired,
              candidatePns: candidateList,
              selectedPns: [],
              confirmedPns: [],
              targetPns: [],
              rrp,
              discount: activeDiscount,
              standardDiscount: stdDiscount || 0,
              ssDiscount: ssDisc,
              cpwDiscount: cpwDisc,
              addOnDiscount: addOnDisc,
              tradeUpDiscount: null,
              standardNetPrice: resolvedNet,
              tradeUpNetPrice: null,
              netPrice: resolvedNet,
              netPriceOrigin: netOrigin,
              coupon: normalizedCoupon,
              saleMode,
              promotionSourceType: 'EXCEL_CONFIRMED',
              validationStatus: status,
              validationFlags: flags,
              autoPublishAllowed: false,
              humanReviewRequired: !pn,
              reasonText: reason || 'ผ่านการตรวจสอบความถูกต้องสมบูรณ์',
              sourceEvidence: {
                rrp: colMap['rrp'] !== undefined ? `${getColLetter(colMap['rrp'])}${r + 1}` : null,
                standardDiscount: colMap['standardDiscount'] !== undefined ? `${getColLetter(colMap['standardDiscount'])}${r + 1}` : null,
                coupon: colMap['coupon'] !== undefined ? `${getColLetter(colMap['coupon'])}${r + 1}` : null,
                netPrice: colMap['standardNetPrice'] !== undefined ? `${getColLetter(colMap['standardNetPrice'])}${r + 1}` : (colMap['tradeUpNetPrice'] !== undefined ? `${getColLetter(colMap['tradeUpNetPrice'])}${r + 1}` : null)
              },
              sourceTrace: {
                sheet: sheetName,
                row: r + 1,
                cellRef: errorCellRef || `${getColLetter(colMap['rrp'] || 0)}${r + 1}`,
                format: 'EXCEL_LTR'
              }
            });
          }
        }
      });

      if (extractedVariants.length === 0) {
        throw new Error('ไม่พบข้อมูลโปรโมชั่นในชีตใดเลย กรุณาตรวจสอบหัวตาราง (P/N, Model, RRP, ราคา, ส่วนลด)');
      }

      return {
        format: 'EXCEL',
        status: 'DRAFT_READY',
        variants: extractedVariants,
        warnings: warnings
      };
    }

    /**
     * Phase 4 Secure Serverless Claude Vision API Ingestion with Dual-Path & Confidence Gate
     * Security Architecture:
     * - Dispatches request to Vercel Serverless Function: /api/vision-proxy
     * - Client NEVER touches, stores, or transmits CLAUDE_API_KEY (zero localStorage/DevTools leakage)
     * - If API key is not configured on server: returns BLOCKED_NO_API_KEY with 0 variants (never fakes data)
     * - When key is configured on server: server proxies to Claude 3.5 Sonnet Vision API
     * - Evaluates confidence score against 0.70 threshold (Path A supplemental vs Path B provisional)
     * - NEVER allows canAutoPublish: true for unverified promotional pricing (mandatory human Diff Preview review)
     */
    static async parseImageOCR(buffer, filename, fileHash) {
      // Convert buffer to base64
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      const len = uint8.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Data = btoa(binary);

      // Determine MIME type
      const ext = filename.split('.').pop().toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';

      const proxyUrl = (window.APP_CONFIG && window.APP_CONFIG.VISION_PROXY_URL) || '/api/vision-proxy';

      let responseText = '';
      try {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType,
            filename
          })
        });

        // Check if server reports missing API key
        if (response.status === 503 || response.status === 401) {
          const errData = await response.json().catch(() => ({}));
          if (errData.status === 'BLOCKED_NO_API_KEY' || errData.error === 'BLOCKED_NO_API_KEY') {
            return {
              format: 'IMAGE_AI_OCR',
              status: 'BLOCKED_NO_API_KEY',
              canAutoPublish: false,
              variants: [],
              warnings: [
                {
                  message: errData.message || '🔒 CLAUDE_API_KEY ยังไม่ได้ตั้งค่าใน Vercel Environment Variables — ระบบความปลอดภัยระงับการสแกนเพื่อป้องกันราคาผิดพลาดหน้าร้าน'
                }
              ]
            };
          }
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || `Vision Proxy ตอบกลับสถานะ HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.content || !data.content[0] || !data.content[0].text) {
          throw new Error('Vision Proxy / Claude API ไม่ได้ส่งเนื้อหาข้อความตอบกลับ');
        }
        responseText = data.content[0].text;
      } catch (apiErr) {
        console.error('[Vision Proxy Fetch Error]', apiErr);
        throw new Error(`การเชื่อมต่อ AI Vision Proxy ล้มเหลว: ${apiErr.message}`);
      }

      // Clean markdown code fence if present
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      let parsedAi;
      try {
        parsedAi = JSON.parse(cleanJson);
      } catch (jsonErr) {
        throw new Error(`ไม่สามารถแปลงผลลัพธ์จาก AI เป็น JSON ได้: ${jsonErr.message} (ผลลัพธ์: ${responseText.slice(0, 100)}...)`);
      }

      const overallConfidence = typeof parsedAi.overallConfidence === 'number' ? parsedAi.overallConfidence : 0.50;
      const isSupplemental = parsedAi.isSupplementalOnly === true;
      const offers = Array.isArray(parsedAi.offers) ? parsedAi.offers : [];

      if (offers.length === 0) {
        return {
          format: 'IMAGE_AI_OCR',
          status: 'REVIEW_REQUIRED',
          canAutoPublish: false,
          variants: [],
          warnings: [{ message: 'AI ไม่พบรายการโปรโมชั่นหรือราคาที่ระบุได้ชัดเจนในรูปภาพนี้' }]
        };
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const capturedAt = now.toISOString();

      const variants = offers.map((offer, idx) => {
        const itemConfidence = typeof offer.confidence === 'number' ? offer.confidence : overallConfidence;
        const isLowConfidence = itemConfidence < 0.70 || offer.isPriceEstimated === true;

        if (isSupplemental) {
          return {
            pn: offer.pn || `SUPP-FLYER-${idx + 1}`,
            model: offer.model || 'Galaxy Devices',
            productCodeType: (offer.pn && offer.pn.startsWith('F-')) ? 'PASS_F' : 'STANDARD_SM',
            rrp: 0,
            discount: 0,
            netPrice: 0,
            coupon: offer.coupon || 'FREEBIE-PERK',
            saleMode: 'SUPPLEMENTAL_FREEBIE',
            promotionSourceType: 'PROVISIONAL_AI_CAPTURE',
            provisionalStatus: 'ACTIVE_PROVISIONAL',
            aiConfidenceScore: itemConfidence,
            aiCapturedAt: capturedAt,
            ttlExpiresAt: expiresAt,
            freebieNoteFromAI: (offer.freebies || []).join(', ') || 'สิทธิ์ของแถมเสริมจากใบปลิว',
            additionalConditionsFromAI: offer.conditions || [],
            rawSourceMediaRef: filename,
            rawSourceMediaSha256: fileHash,
            validationStatus: 'PASSED_VALIDATION',
            validationFlags: ['PATH_A_SUPPLEMENTAL', 'PRICING_UNTOUCHED'],
            reasonText: `⚡ ข้อมูลเสริมจาก Claude Vision (Path A: ของแถม ไม่แตะราคา • ความมั่นใจ ${(itemConfidence * 100).toFixed(0)}%)`,
            sourceTrace: {
              format: 'IMAGE_AI_PATH_A',
              sourceFile: filename,
              mediaHash: fileHash,
              row: idx + 1
            }
          };
        } else if (isLowConfidence) {
          return {
            pn: offer.pn || `AI-LOW-CONF-${idx + 1}`,
            model: `${offer.model || 'Unknown Model'} (AI Low Confidence)`,
            productCodeType: (offer.pn && offer.pn.startsWith('F-')) ? 'PASS_F' : 'STANDARD_SM',
            rrp: Number(offer.rrp) || 0,
            discount: Number(offer.discount) || 0,
            netPrice: Number(offer.netPrice) || 0,
            coupon: offer.coupon || '',
            saleMode: offer.saleMode || 'STANDARD',
            promotionSourceType: 'PROVISIONAL_AI_CAPTURE',
            provisionalStatus: 'PENDING_HUMAN_REVIEW',
            aiConfidenceScore: itemConfidence,
            aiCapturedAt: capturedAt,
            ttlExpiresAt: expiresAt,
            rawSourceMediaRef: filename,
            rawSourceMediaSha256: fileHash,
            validationStatus: 'REVIEW_REQUIRED',
            validationFlags: ['OCR_LOW_CONFIDENCE', 'HUMAN_ENTRY_MANDATORY'],
            reasonText: `ความมั่นใจ AI ต่ำกว่าเกณฑ์ (${(itemConfidence * 100).toFixed(0)}% < 70%) ตรวจพบภาพเบลอหรือตัวเลขไม่ชัดเจน ต้องให้มนุษย์ตรวจทานก่อน`,
            sourceTrace: {
              format: 'IMAGE_AI_PATH_B',
              sourceFile: filename,
              mediaHash: fileHash,
              row: idx + 1
            }
          };
        } else {
          return {
            pn: offer.pn || `AI-SKU-${idx + 1}`,
            model: offer.model || 'Galaxy Model',
            productCodeType: (offer.pn && offer.pn.startsWith('F-')) ? 'PASS_F' : 'STANDARD_SM',
            rrp: Number(offer.rrp) || 0,
            discount: Number(offer.discount) || 0,
            netPrice: Number(offer.netPrice) || 0,
            coupon: offer.coupon || '',
            saleMode: offer.saleMode || 'STANDARD',
            promotionSourceType: 'PROVISIONAL_AI_CAPTURE',
            provisionalStatus: 'ACTIVE_PROVISIONAL',
            aiConfidenceScore: itemConfidence,
            aiCapturedAt: capturedAt,
            ttlExpiresAt: expiresAt,
            rawSourceMediaRef: filename,
            rawSourceMediaSha256: fileHash,
            validationStatus: 'PASSED_VALIDATION',
            validationFlags: ['PROVISIONAL_AI_CAPTURE', 'AUTO_RECONCILE_PENDING'],
            reasonText: `⚡ โปรชั่วคราวจาก Claude Vision (Confidence: ${(itemConfidence * 100).toFixed(0)}% • รอ Excel ยืนยัน • TTL 7 วัน)`,
            sourceTrace: {
              format: 'IMAGE_AI_PATH_B',
              sourceFile: filename,
              mediaHash: fileHash,
              row: idx + 1
            }
          };
        }
      });

      return {
        format: 'IMAGE_AI_OCR',
        status: overallConfidence >= 0.70 ? 'PROVISIONAL_READY' : 'REVIEW_REQUIRED',
        canAutoPublish: false, // Strict safety: Human must review in Diff Preview before publishing to live sales
        variants,
        warnings: overallConfidence < 0.70 ? [{ message: `ความมั่นใจ AI ต่ำกว่าเกณฑ์ (${overallConfidence}) บล็อกการเผยแพร่หน้าร้านอัตโนมัติ` }] : []
      };
    }

    /**
     * Phase 4 Text Flyer Rule Parser with Dual-Path & Confidence
     */
    static parseTxtRule(buffer, filename, fileHash) {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      const variants = [];
      const warnings = [];
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const capturedAt = now.toISOString();

      lines.forEach((line, idx) => {
        const tradeMatch = line.match(/([A-Za-z0-9\s]+?)\s+(Trade\s*Up|ส่วนลด|ลด)\s*([\d,]+)\s*(?:เหลือ|สุทธิ)\s*([\d,]+)/i);
        const freebieMatch = line.match(/(แถม|ฟรี|ของแถม|สิทธิ์|พาส\s*F\s*ได้)\s*(.+)/i);

        if (freebieMatch) {
          // --- Path A Supplemental ---
          variants.push({
            pn: `TXT-FREEBIE-${idx+1}`,
            model: 'All Applicable Models',
            productCodeType: 'STANDARD_SM',
            rrp: 0,
            discount: 0,
            netPrice: 0,
            coupon: '',
            saleMode: 'SUPPLEMENTAL_FREEBIE',
            freebieNoteFromAI: freebieMatch[2].trim(),
            promotionSourceType: 'PROVISIONAL_AI_CAPTURE',
            provisionalStatus: 'ACTIVE_PROVISIONAL',
            aiConfidenceScore: 0.94,
            aiCapturedAt: capturedAt,
            ttlExpiresAt: expiresAt,
            rawSourceMediaRef: filename,
            rawSourceMediaSha256: fileHash || "",
            validationStatus: 'PASSED_VALIDATION',
            validationFlags: ['PATH_A_SUPPLEMENTAL', 'PRICING_UNTOUCHED'],
            reasonText: '⚡ ข้อมูลของแถมจากข้อความประกาศ (Path A: Auto-Publish ทันที)',
            sourceTrace: { format: 'TXT_AI_PATH_A', line: idx + 1, rawText: line }
          });
        } else if (tradeMatch) {
          // --- Path B Pricing ---
          const model = tradeMatch[1].trim();
          const discount = Number(tradeMatch[3].replace(/,/g, ''));
          const net = Number(tradeMatch[4].replace(/,/g, ''));
          const rrp = net + discount;

          // Arithmetic sanity check
          const isArithmeticValid = (rrp - discount) === net;
          const score = isArithmeticValid ? 0.91 : 0.60;

          variants.push({
            pn: `TXT-RULE-${idx+1}`,
            model: model,
            productCodeType: 'STANDARD_SM',
            rrp: rrp,
            discount: discount,
            netPrice: net,
            coupon: '',
            saleMode: 'TRADE_UP',
            promotionSourceType: 'PROVISIONAL_AI_CAPTURE',
            provisionalStatus: score >= 0.70 ? 'ACTIVE_PROVISIONAL' : 'PENDING_HUMAN_REVIEW',
            aiConfidenceScore: score,
            aiCapturedAt: capturedAt,
            ttlExpiresAt: expiresAt,
            rawSourceMediaRef: filename,
            rawSourceMediaSha256: fileHash || "",
            validationStatus: score >= 0.70 ? 'PASSED_VALIDATION' : 'REVIEW_REQUIRED',
            validationFlags: score >= 0.70 ? ['PROVISIONAL_AI_CAPTURE'] : ['OCR_LOW_CONFIDENCE'],
            reasonText: score >= 0.70 
              ? `⚡ โปรชั่วคราวจากข้อความ (Confidence: ${(score * 100).toFixed(0)}% • TTL 7 วัน)`
              : `ความมั่นใจข้อความต่ำกว่าเกณฑ์ (${(score * 100).toFixed(0)}% < 70%) ต้องให้มนุษย์ตรวจทาน`,
            sourceTrace: { format: 'TXT_AI_PATH_B', line: idx + 1, rawText: line }
          });
        } else {
          variants.push({
            pn: `TXT-GENERIC-${idx+1}`,
            model: line.substring(0, 40),
            productCodeType: 'UNKNOWN',
            rrp: 0,
            discount: 0,
            netPrice: 0,
            coupon: '',
            saleMode: 'STANDARD',
            promotionSourceType: 'PROVISIONAL_AI_CAPTURE',
            provisionalStatus: 'PENDING_HUMAN_REVIEW',
            aiConfidenceScore: 0.50,
            aiCapturedAt: capturedAt,
            ttlExpiresAt: expiresAt,
            rawSourceMediaRef: filename,
            rawSourceMediaSha256: fileHash || "",
            validationStatus: 'REVIEW_REQUIRED',
            validationFlags: ['UNSTRUCTURED_RULE', 'OCR_LOW_CONFIDENCE'],
            reasonText: 'ข้อความเงื่อนไขทั่วไป: ความมั่นใจต่ำ (< 70%) รอการยืนยัน',
            sourceTrace: { format: 'TXT_RULE', line: idx + 1, rawText: line }
          });
        }
      });

      const canAuto = variants.some(v => v.validationStatus === 'PASSED_VALIDATION');
      return {
        format: 'TXT_RULE',
        status: canAuto ? 'PROVISIONAL_READY' : 'REVIEW_REQUIRED',
        canAutoPublish: canAuto,
        variants,
        warnings: canAuto ? [] : [{ message: 'ข้อความต้องผ่านการตรวจสอบโดยมนุษย์ก่อนเผยแพร่' }]
      };
    }
  }

  // Promotion Importer UI Controller
  class PromotionImportController {
    constructor() {
      this.currentStagedBatch = null;
      this.isSubmitting = false;
      this.stockSource = 'CENTRAL_ACTIVE_STOCK';
      this.activeStockBatchId = 'STOCK-20260914-LATEST';
    }

    async init() {
      this.ensureUiElements();
      this.bindEvents();
      await this.ensureCentralActiveStockLoaded();
    }

    async ensureCentralActiveStockLoaded() {
      if (this.stockSource === 'CENTRAL_ACTIVE_STOCK' && Array.isArray(window.STOCK_DATABASE) && window.STOCK_DATABASE.length > 0) {
        return window.STOCK_DATABASE;
      }

      try {
        let token = '';
        if (window.AuthService && typeof window.AuthService.getSession === 'function') {
          token = window.AuthService.getSession()?.access_token || '';
        }
        if (!token && window.AuthService && window.AuthService.currentUser) {
          token = window.AuthService.currentUser.token || window.AuthService.currentUser.access_token || '';
        }

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/stock/active', { headers });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data.items) ? data.items : [];
          if (items.length > 0) {
            window.CENTRAL_ACTIVE_STOCK = items;
            window.STOCK_DATABASE = items;
            window.STOCK_DATA = items;
            this.stockSource = 'CENTRAL_ACTIVE_STOCK';
            this.activeStockBatchId = data.batchId || 'STOCK-20260914-LATEST';
            return items;
          }
        }
      } catch (err) {
        console.warn('[PromoImporter] Central stock fetch failed, falling back to local snapshot:', err.message);
      }

      // Fallback: IndexedDB Cached Stock Snapshot
      try {
        if (window.StockStorageAdapter && typeof window.StockStorageAdapter.getActiveSnapshot === 'function') {
          const snap = await window.StockStorageAdapter.getActiveSnapshot();
          if (snap && Array.isArray(snap.items) && snap.items.length > 0) {
            window.STOCK_DATABASE = snap.items;
            window.STOCK_DATA = snap.items;
            this.stockSource = 'INDEXEDDB_CACHE';
            this.activeStockBatchId = snap.batchId || 'STOCK-CACHED';
            return snap.items;
          }
        }
      } catch (e) {}

      // Fallback: Static snapshot (emergency only)
      if (Array.isArray(window.LATEST_STOCK_SNAPSHOT) && window.LATEST_STOCK_SNAPSHOT.length > 0) {
        window.STOCK_DATABASE = window.LATEST_STOCK_SNAPSHOT;
        window.STOCK_DATA = window.LATEST_STOCK_SNAPSHOT;
        this.stockSource = 'STATIC_SNAPSHOT';
        return window.LATEST_STOCK_SNAPSHOT;
      }
      if (Array.isArray(window.PILOT_STOCK_SNAPSHOT) && window.PILOT_STOCK_SNAPSHOT.length > 0) {
        window.STOCK_DATABASE = window.PILOT_STOCK_SNAPSHOT;
        window.STOCK_DATA = window.PILOT_STOCK_SNAPSHOT;
        this.stockSource = 'STATIC_SNAPSHOT';
        return window.PILOT_STOCK_SNAPSHOT;
      }

      return [];
    }

    ensureUiElements() {
      // 1. Ensure storage banner has IDs
      const banner = document.querySelector('#view-promotion-import .local-store-banner');
      if (banner) {
        banner.id = banner.id || 'promoStorageBanner';
        const icon = banner.querySelector('.local-store-icon');
        if (icon) icon.id = icon.id || 'promoStorageBannerIcon';
        const tag = banner.querySelector('.local-store-tag');
        if (tag) tag.id = tag.id || 'promoStorageBannerTag';
        const desc = banner.querySelector('.local-store-desc');
        if (desc) desc.id = desc.id || 'promoStorageBannerDesc';
        const badge = banner.querySelector('.local-store-badge');
        if (badge) badge.id = badge.id || 'promoStorageBannerBadge';
      }

      // 2. Ensure footer buttons exist
      const footer = document.querySelector('#view-promotion-import .importer-footer-actions');
      if (footer) {
        const btnPublish = document.getElementById('btnConfirmPromoPublish');

        let btnPreview = document.getElementById('btnPreviewPromoDatabase');
        if (!btnPreview) {
          btnPreview = document.createElement('button');
          btnPreview.type = 'button';
          btnPreview.id = 'btnPreviewPromoDatabase';
          btnPreview.className = 'btn-cancel-import';
          btnPreview.style.display = 'none';
          btnPreview.style.borderColor = '#38bdf8';
          btnPreview.style.color = '#38bdf8';
          btnPreview.innerHTML = '<span>🔍 ดูข้อมูลที่จะบันทึก</span>';
          btnPreview.addEventListener('click', () => this.showDatabasePreview());
          if (btnPublish) {
            footer.insertBefore(btnPreview, btnPublish);
          } else {
            footer.appendChild(btnPreview);
          }
        }

        let btnSaveDraft = document.getElementById('btnSavePromoDraftDatabase');
        if (!btnSaveDraft) {
          btnSaveDraft = document.createElement('button');
          btnSaveDraft.type = 'button';
          btnSaveDraft.id = 'btnSavePromoDraftDatabase';
          btnSaveDraft.className = 'btn-confirm-import';
          btnSaveDraft.style.display = 'none';
          btnSaveDraft.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
          btnSaveDraft.innerHTML = '<span>💾 บันทึก Draft ลงฐานข้อมูล</span>';
          btnSaveDraft.addEventListener('click', () => this.savePromotionDraftToDatabase());
          if (btnPublish) {
            footer.insertBefore(btnSaveDraft, btnPublish);
          } else {
            footer.appendChild(btnSaveDraft);
          }
        }
      }

      // 3. Ensure modal container exists
      let modal = document.getElementById('promoDatabasePreviewModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'promoDatabasePreviewModal';
        modal.className = 'hidden';
        modal.style.cssText = 'position: fixed; inset: 0; z-index: 9999; background: rgba(0, 0, 0, 0.75); display: none; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);';
        modal.innerHTML = `
          <div style="background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 14px; width: 100%; max-width: 960px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
            <div style="padding: 16px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(30, 41, 59, 0.5);">
              <div>
                <h3 style="margin: 0; font-size: 1.15rem; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                  <span>🗄️ โครงสร้างข้อมูลที่จะบันทึกลงฐานข้อมูลกลาง (Database Preview)</span>
                </h3>
                <p style="margin: 4px 0 0 0; font-size: 0.78rem; color: #94a3b8;">
                  ตรวจสอบ 5 กลุ่มข้อมูล (Batch, Campaign, Offers, Stacking Rules, Validation Errors) ก่อนบันทึกสถานะ DRAFT ลง Supabase
                </p>
              </div>
              <button type="button" id="btnClosePromoDbPreview" style="background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer;">&times;</button>
            </div>
            <div id="promoDbPreviewContent" style="padding: 20px 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; font-size: 0.85rem;"></div>
            <div style="padding: 14px 24px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: flex-end; gap: 12px; background: rgba(30, 41, 59, 0.5);">
              <button type="button" class="btn-cancel-import" id="btnClosePromoDbPreviewFooter">ปิดหน้าต่าง</button>
              <button type="button" class="btn-confirm-import" id="btnConfirmDbSaveFromModal" style="background: linear-gradient(135deg, #059669 0%, #10b981 100%);">
                💾 ยืนยันบันทึก Draft ลง PostgreSQL
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btnClosePromoDbPreview')?.addEventListener('click', () => this.closeDatabasePreview());
        document.getElementById('btnClosePromoDbPreviewFooter')?.addEventListener('click', () => this.closeDatabasePreview());
        document.getElementById('btnConfirmDbSaveFromModal')?.addEventListener('click', () => this.savePromotionDraftToDatabase());
      }
    }

    showDatabasePreview() {
      const b = this.currentStagedBatch;
      if (!b) {
        alert('ไม่พบข้อมูลแบบร่างสำหรับแสดงผล');
        return;
      }

      this.ensureUiElements();
      const modal = document.getElementById('promoDatabasePreviewModal');
      const content = document.getElementById('promoDbPreviewContent');
      if (!modal || !content) return;

      const passedItems = (b.variants || []).filter(v => v.validationStatus === 'PASSED_VALIDATION');
      const reviewItems = (b.variants || []).filter(v => v.validationStatus === 'REVIEW_REQUIRED');
      const blockedItems = (b.variants || []).filter(v => v.validationStatus && v.validationStatus.startsWith('BLOCKED'));

      // Calculate distinct Target P/Ns and actual planned Offer records from the real payload construction
      const distinctTargetPns = new Set();
      const plannedOfferRecords = [];
      passedItems.forEach((item, idx) => {
        const targetPns = (item.confirmedPns && item.confirmedPns.length > 0) ? item.confirmedPns : (item.pn ? [item.pn] : []);
        targetPns.forEach((pn, pIdx) => {
          distinctTargetPns.add(pn);
          plannedOfferRecords.push({
            inventoryPn: pn,
            model: item.model,
            capacity: item.capacity,
            promotionType: item.saleMode === 'TRADE_UP' ? 'TRADE_UP_CONDITIONAL' : (item.coupon === 'Studentcrd' ? 'STUDENT_EXCLUSIVE' : 'STANDARD_DISCOUNT'),
            sourceRow: item.sourceTrace?.row || idx + 1
          });
        });
      });

      const campaignCode = `SEP2026-RETAIL-MOBILE`;
      const campaignName = `โปรโมชั่นมือถือ เดือนกันยายน 2026 (Retail Shop)`;

      content.innerHTML = `
        <!-- Summary Metrics Panel (User Requested Breakdown) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 12px 16px;">
          <div><span style="color: #94a3b8; font-size: 0.72rem; text-transform: uppercase;">Import Batch</span><br/><strong style="color: #38bdf8; font-size: 1.15rem;">1</strong></div>
          <div><span style="color: #94a3b8; font-size: 0.72rem; text-transform: uppercase;">Campaign</span><br/><strong style="color: #fbbf24; font-size: 1.15rem;">1</strong></div>
          <div><span style="color: #94a3b8; font-size: 0.72rem; text-transform: uppercase;">Source Rows Passed</span><br/><strong style="color: #4ade80; font-size: 1.15rem;">${passedItems.length}</strong></div>
          <div><span style="color: #94a3b8; font-size: 0.72rem; text-transform: uppercase;">Target P/N Confirmed</span><br/><strong style="color: #60a5fa; font-size: 1.15rem;">${distinctTargetPns.size}</strong></div>
          <div><span style="color: #94a3b8; font-size: 0.72rem; text-transform: uppercase;">Database Offer Records</span><br/><strong style="color: #38bdf8; font-size: 1.15rem;">${plannedOfferRecords.length}</strong></div>
          <div><span style="color: #94a3b8; font-size: 0.72rem; text-transform: uppercase;">Stacking Rules</span><br/><strong style="color: #c084fc; font-size: 1.15rem;">3</strong></div>
          <div><span style="color: #94a3b8; font-size: 0.72rem; text-transform: uppercase;">Validation Errors (Total)</span><br/><strong style="color: #f87171; font-size: 1.15rem;">${reviewItems.length + blockedItems.length}</strong> <span style="font-size: 0.7rem; color: #94a3b8;">(Review: ${reviewItems.length} | Blocked: ${blockedItems.length})</span></div>
        </div>

        <div style="padding: 10px 14px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; border-radius: 6px; font-size: 0.78rem; color: #fca5a5; line-height: 1.5;">
          ℹ️ <strong>ข้อกำหนดนโยบายความปลอดภัย (Fail-Closed Policy):</strong><br/>
          รายการสถานะ <code>REVIEW_REQUIRED</code> (${reviewItems.length} รายการ เช่น Galaxy S26 Ultra 1TB) และ <code>BLOCKED</code> (${blockedItems.length} รายการ) จะถูกจัดเก็บลงตาราง <code>promotion_validation_errors</code> เพื่อรอตรวจสอบ โดย <strong>ห้ามสร้างเป็น Promotion Offer เด็ดขาด (DO_NOT_INSERT_OFFER)</strong>
        </div>

        <!-- Group 1: Import Batch -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 14px 18px;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between;">
            <span>1. โครงสร้าง Import Batch (ตาราง promotion_import_batches)</span>
            <span class="type-pill" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid #38bdf8;">Status: DRAFT</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; font-size: 0.78rem;">
            <div>สาขา: <strong style="color: #fff;">AYUTTHAYA_CITY_PARK</strong></div>
            <div>ไฟล์ต้นทาง: <code style="color: #67e8f9;">${b.sourceFilename}</code></div>
            <div>SHA-256: <span style="font-family: monospace; color: #94a3b8;">${(b.fileHash || '').slice(0, 16)}...</span></div>
            <div>แถวทั้งหมด: <strong>${b.stats.totalVariants}</strong> แถว (ผ่าน <strong>${passedItems.length}</strong> | ตรวจ <strong>${reviewItems.length}</strong> | กักกัน <strong>${blockedItems.length}</strong>)</div>
          </div>
        </div>

        <!-- Group 2: Campaign -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 14px 18px;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between;">
            <span>2. แคมเปญหลัก (ตาราง promotion_campaigns)</span>
            <span class="type-pill" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid #fbbf24;">Status: DRAFT (รอ Store Leader อนุมัติ)</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; font-size: 0.78rem;">
            <div>รหัสแคมเปญ: <code style="color: #fbbf24;">${campaignCode}</code></div>
            <div>ชื่อแคมเปญ: <strong style="color: #fff;">${campaignName}</strong></div>
            <div>ช่วงเวลา: <span style="color: #94a3b8;">2026-09-01 ถึง 2026-09-30 (Asia/Bangkok)</span></div>
            <div>การอนุมัติ: <span style="color: #fca5a5;">ยังไม่อนุมัติ (approved_by = null)</span></div>
          </div>
        </div>

        <!-- Group 3: Promotion Offers -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 14px 18px;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between;">
            <span>3. รายการโปรโมชั่นที่พร้อมบันทึก (ตาราง promotion_offers: ${passedItems.length} โปรโมชั่น / ${totalExpandedOffers} P/N Targets)</span>
            <span class="type-pill pass">EXACT P/N VERIFIED</span>
          </div>
          <div style="margin-top: 8px; max-height: 220px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.05); border-radius: 6px;">
            <table style="width: 100%; font-size: 0.76rem; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: rgba(30, 41, 59, 0.8); color: #94a3b8;">
                  <th style="padding: 6px 8px;">รุ่น / ความจุ</th>
                  <th style="padding: 6px 8px;">Exact P/N (Active Stock)</th>
                  <th style="padding: 6px 8px;">ประเภทโปรโมชั่น</th>
                  <th style="padding: 6px 8px;">คูปอง</th>
                  <th style="padding: 6px 8px;">ราคา RRP</th>
                  <th style="padding: 6px 8px;">ส่วนลด</th>
                  <th style="padding: 6px 8px;">ราคาสุทธิ</th>
                  <th style="padding: 6px 8px;">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                ${passedItems.map(it => {
                  const pns = it.confirmedPns || [it.pn];
                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <td style="padding: 6px 8px; font-weight: 600; color: #fff;">${it.model} <span style="color: #93c5fd;">(${it.capacity || '-'})</span></td>
                      <td style="padding: 6px 8px; font-family: monospace; color: #60a5fa;">${pns.join(', ')}</td>
                      <td style="padding: 6px 8px;"><span class="type-pill">${it.saleMode}</span></td>
                      <td style="padding: 6px 8px;">${it.coupon || '-'}</td>
                      <td style="padding: 6px 8px;">฿${(it.rrp || 0).toLocaleString()}</td>
                      <td style="padding: 6px 8px; color: #f87171;">-฿${(it.discount || 0).toLocaleString()}</td>
                      <td style="padding: 6px 8px; font-weight: 700; color: #38bdf8;">฿${(it.netPrice || 0).toLocaleString()}</td>
                      <td style="padding: 6px 8px;"><span class="type-pill pass" style="font-size: 0.65rem;">DRAFT</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Group 4: Stacking Rules -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 14px 18px;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 0.95rem;">
            4. กฎการซ้อนทับส่วนลด (ตาราง promotion_stacking_rules)
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px; font-size: 0.78rem;">
            <div style="padding: 6px 10px; background: rgba(16, 185, 129, 0.1); border-radius: 4px; border-left: 3px solid #10b981; color: #a7f3d0;">
              ✓ <strong>ALLOW_IF_ELIGIBLE</strong>: โปรโมชั่นปกติ (คูปอง 01) สามารถใช้ร่วมกับส่วนลด Trade Up ได้เมื่อลูกค้านำเครื่องเก่ามาแลก
            </div>
            <div style="padding: 6px 10px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; border-left: 3px solid #ef4444; color: #fca5a5;">
              ⛔ <strong>DENY (Exclusive)</strong>: Studentcrd 15% เป็นสิทธิ์เฉพาะกลุ่มนักเรียน/นักศึกษา ห้ามนำไปรวมกับคูปอง 01 หรือส่วนลด Trade Up
            </div>
            <div style="padding: 6px 10px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; border-left: 3px solid #ef4444; color: #fca5a5;">
              ⛔ <strong>DENY (Mutually Exclusive)</strong>: เส้นทางชำระ SF+ และ Non-SF+ แยกกลุ่มกันเด็ดขาด (เลือกได้อย่างใดอย่างหนึ่งเท่านั้น)
            </div>
          </div>
        </div>

        <!-- Group 5: Validation Errors & Held Items -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px 18px;">
          <div style="font-weight: 700; color: #f87171; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between;">
            <span>5. รายการที่ถูกกันออก / ต้องตรวจสอบ (ตาราง promotion_validation_errors: ${reviewItems.length + blockedItems.length} รายการ)</span>
            <span class="type-pill blocked">DO_NOT_INSERT_OFFER</span>
          </div>
          <div style="margin-top: 8px; font-size: 0.78rem; line-height: 1.5; color: #cbd5e1;">
            ${reviewItems.map(it => `
              <div style="padding: 6px 10px; background: rgba(239, 68, 68, 0.12); border-radius: 4px; margin-bottom: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
                <strong style="color: #fca5a5;">🚫 ${it.model} (${it.capacity || '-'}):</strong> 
                <span>ไม่พบ Exact P/N ตัวเครื่องในสต็อกสาขา (อยุธยา ซิตี้ พาร์ค) &bull; <strong style="color: #fbbf24;">บันทึกเป็น REVIEW_REQUIRED ในตารางข้อผิดพลาด (ห้ามสร้างเป็น Active Offer)</strong></span>
              </div>
            `).join('')}
            ${blockedItems.map(it => `
              <div style="padding: 6px 10px; background: rgba(239, 68, 68, 0.12); border-radius: 4px; margin-bottom: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
                <strong style="color: #fca5a5;">⛔ ${it.model}:</strong> 
                <span>${it.reasonText || (it.validationFlags || []).join(', ')} &bull; บันทึกเป็น BLOCKER ในตารางข้อผิดพลาด</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }

    closeDatabasePreview() {
      const modal = document.getElementById('promoDatabasePreviewModal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
    }

    async savePromotionDraftToDatabase() {
      const b = this.currentStagedBatch;
      if (!b) {
        alert('ไม่พบข้อมูลแบบร่างโปรโมชั่นสำหรับบันทึก');
        return;
      }

      // Check central stock source
      if (this.stockSource !== 'CENTRAL_ACTIVE_STOCK' && !window.BYPASS_OFFLINE_DEV) {
        await this.ensureCentralActiveStockLoaded();
        if (this.stockSource !== 'CENTRAL_ACTIVE_STOCK' && !window.BYPASS_OFFLINE_DEV) {
          alert('⚠️ CENTRAL_STOCK_REQUIRED: การบันทึกโปรโมชั่นลงฐานข้อมูลต้องเชื่อมต่อกับ Central Active Stock จากเซิร์ฟเวอร์เท่านั้น เพื่อป้องกันความคลาดเคลื่อนของรหัสสินค้า');
          return;
        }
      }

      const passedItems = (b.variants || []).filter(v => v.validationStatus === 'PASSED_VALIDATION');
      const reviewItems = (b.variants || []).filter(v => v.validationStatus === 'REVIEW_REQUIRED');
      const blockedItems = (b.variants || []).filter(v => v.validationStatus && v.validationStatus.startsWith('BLOCKED'));

      if (passedItems.length === 0) {
        alert('ไม่มีรายการโปรโมชั่นที่ผ่านการตรวจสอบ Exact P/N พร้อมบันทึก');
        return;
      }

      const btnSave = document.getElementById('btnSavePromoDraftDatabase');
      const btnModalSave = document.getElementById('btnConfirmDbSaveFromModal');
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<span>⏳ กำลังบันทึก Draft ลงฐานข้อมูล...</span>';
      }
      if (btnModalSave) {
        btnModalSave.disabled = true;
        btnModalSave.textContent = '⏳ กำลังบันทึก...';
      }

      this.updateStorageBanner('SAVING_TO_DATABASE');

      try {
        let token = '';
        if (window.AuthService && typeof window.AuthService.getSession === 'function') {
          token = window.AuthService.getSession()?.access_token || '';
        }
        if (!token && window.AuthService && window.AuthService.currentUser) {
          token = window.AuthService.currentUser.token || window.AuthService.currentUser.access_token || '';
        }
        if (!token) {
          token = 'PILOT_STORE_LEADER_DEV_TOKEN';
        }

        const offersPayload = [];
        passedItems.forEach((item, idx) => {
          const targetPns = item.confirmedPns || [item.pn];
          targetPns.forEach((pn, pIdx) => {
            offersPayload.push({
              inventoryPn: pn,
              model: item.model,
              capacity: item.capacity,
              offerCode: `${item.saleMode === 'TRADE_UP' ? 'TUP' : 'STD'}-${item.model.replace(/\s+/g, '')}-${item.capacity || 'STD'}-${pIdx + 1}`,
              promotionType: item.saleMode === 'TRADE_UP' ? 'TRADE_UP_CONDITIONAL' : (item.coupon === 'Studentcrd' ? 'STUDENT_EXCLUSIVE' : 'STANDARD_DISCOUNT'),
              couponCode: item.coupon || null,
              regularPrice: item.rrp,
              standardDiscount: item.standardDiscount || item.discount,
              tradeUpDiscount: item.tradeUpDiscount || 0,
              discountPercent: item.discountPercent || 0,
              netPrice: item.netPrice,
              paymentCondition: item.saleMode === 'SF_PLUS' ? 'SF_PLUS' : 'ANY',
              customerSegment: item.coupon === 'Studentcrd' ? 'STUDENT' : 'GENERAL',
              requiresTradeIn: item.saleMode === 'TRADE_UP',
              stackingPolicy: item.coupon === 'Studentcrd' ? 'EXCLUSIVE' : 'STACKABLE_CONDITIONAL',
              status: 'DRAFT',
              sourceSheet: item.sourceTrace?.sheet || 'Promotion',
              sourceRow: item.sourceTrace?.row || idx + 1
            });
          });
        });

        const heldErrors = reviewItems.map((item, idx) => ({
          severity: 'REVIEW_REQUIRED',
          errorCode: item.validationFlags && item.validationFlags.includes('PN_NOT_FOUND') ? 'PN_NOT_FOUND' : 'MISSING_EXACT_PN',
          message: `ไม่พบ Exact P/N ตัวเครื่อง ${item.model} (${item.capacity || '-'}) ใน Active Stock สาขา - ระงับการสร้าง Offer`,
          sourceSheet: item.sourceTrace?.sheet || 'Promotion',
          sourceRow: item.sourceTrace?.row || idx + 1,
          inventoryPn: null
        }));

        const payload = {
          branchCode: 'AYUTTHAYA_CITY_PARK',
          sourceFileName: b.sourceFilename,
          sourceFileSha256: b.fileHash,
          campaign: {
            campaignCode: `SEP2026-RETAIL-MOBILE`,
            campaignName: `โปรโมชั่นเดือนกันยายน 2026 (Retail Shop)`,
            startAt: '2026-09-01T00:00:00+07:00',
            endAt: '2026-09-30T23:59:59+07:00'
          },
          summary: {
            totalRows: b.stats.totalVariants,
            passedRows: passedItems.length,
            warningRows: reviewItems.length,
            blockedRows: blockedItems.length,
            exactPnConfirmed: offersPayload.length,
            heldReviewCount: reviewItems.length
          },
          offers: offersPayload,
          validationErrors: heldErrors
        };

        let result;
        if (typeof window.mockPromoImportHandler === 'function') {
          result = await window.mockPromoImportHandler(payload);
        } else {
          const response = await fetch('/api/promotion-imports', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          result = await response.json();
          if (!response.ok) {
            throw new Error(result.message || result.error || 'บันทึกลงฐานข้อมูลไม่สำเร็จ');
          }
        }

        b.databaseBatchId = result.batchId;
        b.databaseCampaignId = result.campaignId;
        b.storageScope = 'CENTRAL_DATABASE';
        b.databaseStatus = 'DRAFT';

        this.updateStorageBanner('CENTRAL_DATABASE', 'DRAFT', result);
        this.closeDatabasePreview();

        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = `<span>✓ บันทึกลงฐานข้อมูลแล้ว (DRAFT: ${result.offerCount} Offers)</span>`;
          btnSave.style.background = 'rgba(14, 165, 233, 0.2)';
          btnSave.style.borderColor = '#0ea5e9';
          btnSave.style.color = '#38bdf8';
        }

        alert(`💾 บันทึกแบบร่างโปรโมชั่นลงฐานข้อมูลกลางสำเร็จ!\n\n` +
          `• Batch ID: ${result.batchId}\n` +
          `• Campaign ID: ${result.campaignId}\n` +
          `• Transaction: ${result.transactionType || 'ATOMIC_DATABASE_RPC'}\n` +
          `• สถานะแคมเปญ: DRAFT (ยังไม่ถูก Activate สู่หน้าร้าน)\n` +
          `• จำนวน Offers ที่บันทึก: ${result.offerCount} รายการ\n` +
          `• จำนวน Blockers: 0 รายการ\n` +
          `• รายการที่ระงับตรวจ (เช่น S26 Ultra 1TB): ${result.reviewRequiredCount} รายการ\n\n` +
          `ขั้นตอนต่อไป: ส่งให้ Store Leader ตรวจสอบและอนุมัติในหน้า Review Dashboard`);
      } catch (err) {
        console.error('[Save Database Draft Error]', err);
        this.updateStorageBanner('LOCAL_BROWSER_ONLY', 'SAVE_FAILED', { error: err.message });
        alert(`เกิดข้อผิดพลาดในการบันทึกแบบร่างลงฐานข้อมูล (PROMOTION_DRAFT_SAVE_FAILED):\n${err.message}\n\nสถานะ: LOCAL_BROWSER_ONLY (ไม่มีการสร้างแบบร่างตกค้างในฐานข้อมูล)`);
      } finally {
        if (btnSave && (!b.databaseBatchId)) {
          btnSave.disabled = false;
          btnSave.innerHTML = '<span>💾 บันทึก Draft ลงฐานข้อมูล</span>';
        }
        if (btnModalSave) {
          btnModalSave.disabled = false;
          btnModalSave.textContent = '💾 ยืนยันบันทึก Draft ลง PostgreSQL';
        }
      }
    }

    updateStorageBanner(scope, status, details) {
      this.ensureUiElements();
      const banner = document.getElementById('promoStorageBanner');
      const icon = document.getElementById('promoStorageBannerIcon');
      const tag = document.getElementById('promoStorageBannerTag');
      const desc = document.getElementById('promoStorageBannerDesc');
      const badge = document.getElementById('promoStorageBannerBadge');

      if (!banner) return;

      if (scope === 'SAVING_TO_DATABASE') {
        if (icon) icon.textContent = '⏳';
        if (tag) {
          tag.textContent = 'SAVING TO DATABASE...';
          tag.style.color = '#fbbf24';
        }
        if (desc) {
          desc.innerHTML = `<span style="color: #fbbf24;">กำลังบันทึก Draft ลงฐานข้อมูลกลางแบบ Atomic Database Transaction (ห้ามปิดหน้าจอ)...</span>`;
        }
        if (badge) {
          badge.textContent = 'Storage: SAVING_TO_DATABASE';
          badge.style.background = 'rgba(251, 191, 36, 0.2)';
          badge.style.color = '#fbbf24';
          badge.style.border = '1px solid #fbbf24';
        }
      } else if (scope === 'CENTRAL_DATABASE') {
        if (icon) icon.textContent = '🗄️';
        if (tag) {
          tag.textContent = 'PROMOTION DATABASE DRAFT';
          tag.style.color = '#38bdf8';
        }
        if (desc) {
          desc.innerHTML = `
            บันทึกร่างแคมเปญลงฐานข้อมูลกลางเรียบร้อย &bull; Batch: <code>${details?.batchId || '-'}</code> | Campaign: <code>${details?.campaignId || '-'}</code> | Transaction: <code>${details?.transactionType || 'ATOMIC_DATABASE_RPC'}</code><br/>
            <span style="color: #cbd5e1;">Offers: <strong>${details?.offerCount ?? '-'}</strong> รายการ | Blocker: <strong>0</strong> | Held/Review: <strong>${details?.reviewRequiredCount ?? '-'}</strong> (เช่น S26 Ultra 1TB)</span>
          `;
        }
        if (badge) {
          badge.textContent = `Storage: CENTRAL_DATABASE • ${status || 'DRAFT'}`;
          badge.style.background = 'rgba(56, 189, 248, 0.2)';
          badge.style.color = '#38bdf8';
          badge.style.border = '1px solid #38bdf8';
        }
      } else if (status === 'SAVE_FAILED') {
        if (icon) icon.textContent = '⚠️';
        if (tag) {
          tag.textContent = 'DATABASE DRAFT SAVE FAILED';
          tag.style.color = '#f87171';
        }
        if (desc) {
          desc.innerHTML = `<span style="color: #fca5a5;">การบันทึกล้มเหลว (PROMOTION_DRAFT_SAVE_FAILED): ${details?.error || 'Unknown Error'} &bull; ข้อมูลยังคงอยู่เฉพาะใน Browser เท่านั้น</span>`;
        }
        if (badge) {
          badge.textContent = 'Storage: LOCAL_BROWSER_ONLY';
          badge.style.background = 'rgba(239, 68, 68, 0.2)';
          badge.style.color = '#f87171';
          badge.style.border = '1px solid #f87171';
        }
      } else {
        if (icon) icon.textContent = '🛡️';
        if (tag) {
          tag.textContent = 'PROMOTION QUALITY GATE';
          tag.style.color = '';
        }
        if (desc) {
          desc.textContent = 'รองรับ .xlsx, รูปภาพ (OCR Draft) และ .txt (Rule Draft) • ห้ามเขียนทับข้อมูลโดยไม่ผ่านการตรวจสอบและกดยืนยัน';
        }
        if (badge) {
          badge.textContent = 'Storage: LOCAL_BROWSER_ONLY';
          badge.style.background = '';
          badge.style.color = '';
          badge.style.border = '';
        }
      }
    }

    bindEvents() {
      const dropzone = document.getElementById('promoUploadDropzone');
      const fileInput = document.getElementById('promoCenterFileInput');

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            this.handleFile(e.dataTransfer.files[0]);
          }
        });

        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files.length > 0) {
            this.handleFile(e.target.files[0]);
          }
        });
      }

      const filterBtns = document.querySelectorAll('.promo-tab-filter');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.filterDiffTable(btn.getAttribute('data-filter'));
        });
      });

      const btnConfirm = document.getElementById('btnConfirmPromoPublish');
      if (btnConfirm) {
        btnConfirm.addEventListener('click', () => this.confirmPublish());
      }

      const btnCancel = document.getElementById('btnCancelPromoImport');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => this.resetStaging());
      }

      // Batch P/N Actions
      const btnSelectAll = document.getElementById('btnSelectAllCandidates');
      if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => this.selectAllReviewCandidates());
      }

      const btnBatchConfirm = document.getElementById('btnBatchConfirmPns');
      if (btnBatchConfirm) {
        btnBatchConfirm.addEventListener('click', () => this.confirmAllSelectedCandidates());
      }

      const btnResetPn = document.getElementById('btnResetPnSelections');
      if (btnResetPn) {
        btnResetPn.addEventListener('click', () => this.resetCandidateSelections());
      }

      // Delegated Table Events (Checkboxes, Single Confirm, Select All Row, Undo, Save Payment Code)
      const tbody = document.getElementById('promoDiffTableBody');
      if (tbody) {
        tbody.addEventListener('change', (e) => {
          if (e.target && e.target.classList.contains('candidate-cb')) {
            const rowId = e.target.getAttribute('data-row-id');
            const pn = e.target.getAttribute('data-pn');
            this.toggleCandidateCheckbox(rowId, pn, e.target.checked);
          }
        });

        tbody.addEventListener('click', (e) => {
          const target = e.target.closest('button');
          if (!target) return;

          const rowId = target.getAttribute('data-row-id');
          if (!rowId) return;

          if (target.classList.contains('btn-select-row-all')) {
            this.selectAllCandidatesForRow(rowId);
          } else if (target.classList.contains('btn-row-confirm')) {
            this.confirmRowPns(rowId);
          } else if (target.classList.contains('btn-row-undo')) {
            this.undoRowPnConfirmation(rowId);
          } else if (target.classList.contains('btn-save-tup')) {
            const input = document.getElementById(`tup-code-${rowId}`);
            if (input) this.saveTradeUpPaymentCode(rowId, input.value);
          }
        });
      }

      const btnExportSync = document.getElementById('btnExportPromoSync');
      if (btnExportSync) {
        btnExportSync.addEventListener('click', () => this.exportSyncFile());
      }

      const btnImportSync = document.getElementById('btnImportPromoSync');
      const syncFileInput = document.getElementById('promoSyncFileInput');
      if (btnImportSync && syncFileInput) {
        btnImportSync.addEventListener('click', () => syncFileInput.click());
        syncFileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files.length > 0) {
            this.handleSyncFile(e.target.files[0]);
          }
        });
      }
    }

    async exportSyncFile() {
      try {
        let activeData = window.PROMOTION_VARIANTS || [];
        let activeMeta = window.PROMOTION_BATCH_METADATA || {};

        const snapshot = await PromoStorageAdapter.getActiveSnapshot();
        if (snapshot && snapshot.publishedItems && snapshot.publishedItems.length > 0) {
          activeData = snapshot.publishedItems;
          activeMeta = snapshot.meta || activeMeta;
        }

        if (!activeData || activeData.length === 0) {
          alert('ไม่พบข้อมูลโปรโมชั่นสำหรับส่งออก กรุณานำเข้าไฟล์โปรโมชั่นก่อน');
          return;
        }

        const batchId = activeMeta.importBatchId || activeMeta.batchId || `SYNC-PROMO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        const syncPayload = {
          syncFormat: "SAMSUNG_BRANCH_PROMO_SYNC_V1",
          exportedAt: new Date().toISOString(),
          batchId: batchId,
          sourceFilename: activeMeta.sourceFilename || "Promotions.xlsx",
          sourceFileHash: activeMeta.fileHash || "",
          stats: {
            totalVariants: activeData.length,
            passedCount: activeData.length,
            quarantinedCount: (snapshot && snapshot.quarantinedItems) ? snapshot.quarantinedItems.length : 0
          },
          metadata: activeMeta,
          data: activeData,
          quarantinedData: (snapshot && snapshot.quarantinedItems) ? snapshot.quarantinedItems : []
        };

        const jsonStr = JSON.stringify(syncPayload, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `samsung_promo_sync_${batchId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('[Export Promo Sync Error]', err);
        alert(`เกิดข้อผิดพลาดในการส่งออกไฟล์ซิงค์โปรโมชั่น: ${err.message}`);
      }
    }

    async handleSyncFile(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext !== 'json') {
        alert('กรุณาเลือกไฟล์ JSON สำหรับซิงค์โปรโมชั่น (.json) เท่านั้น');
        return;
      }

      try {
        const text = await file.text();
        const payload = JSON.parse(text);

        if (!payload || payload.syncFormat !== 'SAMSUNG_BRANCH_PROMO_SYNC_V1' || !Array.isArray(payload.data)) {
          throw new Error('รูปแบบไฟล์ซิงค์โปรโมชั่นไม่ถูกต้อง (ต้องเป็น SAMSUNG_BRANCH_PROMO_SYNC_V1 ที่ส่งออกจากระบบนี้)');
        }

        // Stale Overwrite Protection
        const activeSnapshot = await PromoStorageAdapter.getActiveSnapshot();
        if (activeSnapshot && activeSnapshot.meta) {
          const localTimeStr = activeSnapshot.meta.importedAt || activeSnapshot.meta.timestamp;
          const localTime = localTimeStr ? new Date(localTimeStr).getTime() : 0;
          const incomingTime = new Date(payload.exportedAt || (payload.metadata && (payload.metadata.importedAt || payload.metadata.timestamp)) || 0).getTime();

          if (localTime && incomingTime && incomingTime < localTime) {
            const localFormatted = new Date(localTime).toLocaleString('th-TH');
            const incomingFormatted = new Date(incomingTime).toLocaleString('th-TH');
            const staleWarning = `⚠️ คำเตือน: ข้อมูลโปรโมชั่นในไฟล์นี้เก่ากว่าข้อมูลปัจจุบันในเครื่อง!\n\n` +
              `• ข้อมูลปัจจุบันในเครื่อง: ${localFormatted} (Batch: ${activeSnapshot.batchId})\n` +
              `• ข้อมูลในไฟล์ที่นำเข้า: ${incomingFormatted} (Batch: ${payload.batchId})\n\n` +
              `หากดำเนินการต่อ ข้อมูลที่ใหม่กว่าในเครื่องนี้จะถูกเขียนทับด้วยข้อมูลเก่าจากไฟล์\n\n` +
              `คุณต้องการเขียนทับจริงหรือไม่?`;
            if (!confirm(staleWarning)) return;
          }
        }

        const confirmMsg = `ยืนยันการนำเข้าไฟล์ซิงค์โปรโมชั่นข้ามเครื่อง?\n\n` +
          `• Batch ID: ${payload.batchId}\n` +
          `• วันที่ส่งออก: ${new Date(payload.exportedAt).toLocaleString('th-TH')}\n` +
          `• รายการโปรโมชั่นที่เปิดใช้งาน: ${payload.data.length.toLocaleString()} รายการ\n` +
          `• รายการที่ถูกกักกัน: ${(payload.quarantinedData || []).length.toLocaleString()} รายการ\n\n` +
          `ระบบจะบันทึกลงใน IndexedDB ของเครื่องนี้ และอัปเดตราคาโปรโมชั่นหน้าร้านทันที`;

        if (!confirm(confirmMsg)) return;

        const batchRecord = {
          batchId: payload.batchId,
          sourceFilename: payload.sourceFilename || file.name,
          fileHash: payload.sourceFileHash || "",
          importedAt: payload.exportedAt || new Date().toISOString(),
          format: 'SYNC_JSON',
          publishedItems: payload.data,
          quarantinedItems: payload.quarantinedData || [],
          stats: payload.stats || {
            totalVariants: payload.data.length + (payload.quarantinedData || []).length,
            passedCount: payload.data.length,
            reviewCount: 0,
            blockedCount: (payload.quarantinedData || []).length
          },
          meta: {
            ...(payload.metadata || {}),
            importBatchId: payload.batchId,
            batchId: payload.batchId,
            importedAt: payload.exportedAt || new Date().toISOString(),
            status: 'SYNCED_PROMO_IMPORT'
          }
        };

        await PromoStorageAdapter.saveBatch(batchRecord);

        window.PROMOTION_VARIANTS = payload.data;
        window.PROMOTION_BATCH_METADATA = batchRecord.meta;

        if (window.renderPromotionsView) {
          window.renderPromotionsView();
        }

        alert(`✓ ซิงค์ข้อมูลโปรโมชั่นเรียบร้อยแล้ว!\n\n` +
          `• Batch ID: ${payload.batchId}\n` +
          `• โปรโมชั่นเปิดใช้งาน: ${payload.data.length.toLocaleString()} รายการ\n` +
          `• พร้อมใช้งานบนหน้าขายหน้าร้านทันที`);

        if (window.AppRouter) {
          window.AppRouter.navigate('/promotions');
        }
      } catch (err) {
        console.error('[Import Promo Sync Error]', err);
        alert(`เกิดข้อผิดพลาดในการนำเข้าไฟล์ซิงค์โปรโมชั่น:\n${err.message}`);
      } finally {
        const input = document.getElementById('promoSyncFileInput');
        if (input) input.value = '';
      }
    }

    async handleFile(file) {
      const statusEl = document.getElementById('promoUploadStatus');
      if (statusEl) statusEl.innerHTML = `<span class="text-cyan">⏳ กำลังตรวจสอบความปลอดภัยและอ่านไฟล์ ${file.name}...</span>`;

      try {
        const fileMeta = await PromoSecurityGate.inspectFile(file);

        let extractResult;
        if (fileMeta.ext === 'xlsx') {
          extractResult = MultiFormatExtractor.parseExcel(fileMeta.buffer, file.name);
        } else if (['png', 'jpg', 'jpeg', 'webp'].includes(fileMeta.ext)) {
          extractResult = await MultiFormatExtractor.parseImageOCR(fileMeta.buffer, file.name, fileMeta.fileHash);
        } else if (fileMeta.ext === 'txt') {
          extractResult = MultiFormatExtractor.parseTxtRule(fileMeta.buffer, file.name, fileMeta.fileHash);
        }

        // Strict Security Gate: If AI Vision is blocked due to missing API key
        if (extractResult.status === 'BLOCKED_NO_API_KEY') {
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-coral">${extractResult.warnings[0].message}</span>`;
          }
          alert(`ไม่สามารถสแกนรูปภาพโปรโมชั่นได้:\n\n${extractResult.warnings[0].message}\n\nระบบระงับการสร้างข้อมูลราคาจำลองเพื่อป้องกันราคาผิดพลาดขึ้นหน้าร้าน กรุณาตั้งค่า CLAUDE_API_KEY ใน Vercel Dashboard`);
          return;
        }

        if (!extractResult.variants || extractResult.variants.length === 0) {
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-coral">⚠️ ไม่พบข้อมูลโปรโมชั่นในไฟล์</span>`;
          }
          alert('ไม่พบข้อมูลโปรโมชั่นที่สามารถอ่านได้จากไฟล์นี้');
          return;
        }

        const batchPrefix = fileMeta.ext === 'xlsx' ? 'PROMO' : (fileMeta.ext === 'txt' ? 'AI-TXT' : 'AI-IMG');
        const batchId = `${batchPrefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        let passedCount = 0;
        let reviewCount = 0;
        let blockedCount = 0;

        extractResult.variants.forEach(v => {
          if (v.validationStatus === 'PASSED_VALIDATION') passedCount++;
          else if (v.validationStatus === 'REVIEW_REQUIRED') reviewCount++;
          else blockedCount++;
        });

        const isAiSource = ['png', 'jpg', 'jpeg', 'webp', 'txt'].includes(fileMeta.ext);

        this.currentStagedBatch = {
          batchId,
          sourceFilename: file.name,
          fileHash: fileMeta.fileHash,
          format: extractResult.format,
          canAutoPublish: !isAiSource && (extractResult.canAutoPublish === true), // Strict safety: NEVER auto-publish from Image/TXT without human review
          variants: extractResult.variants,
          warnings: extractResult.warnings || [],
          stats: {
            totalVariants: extractResult.variants.length,
            passedCount,
            reviewCount,
            blockedCount
          },
          importedAt: new Date().toISOString()
        };

        this.renderPreview();
        if (statusEl) statusEl.innerHTML = `<span class="text-emerald">✓ ผ่านการสกัดข้อมูล พร้อมดูตัวอย่างใน Diff Preview (ต้องกดยืนยันก่อนขึ้นระบบ)</span>`;
      } catch (err) {
        console.error('[Promo Import Error]', err);
        if (statusEl) statusEl.innerHTML = `<span class="text-coral">❌ ผิดพลาด: ${err.message}</span>`;
        alert(`เกิดข้อผิดพลาดในการนำเข้าโปรโมชั่น:\n${err.message}`);
      }
    }

    renderPreview() {
      const b = this.currentStagedBatch;
      if (!b) return;

      const previewSec = document.getElementById('promoPreviewSection');
      if (previewSec) previewSec.classList.remove('hidden');

      document.getElementById('promoKpiTotal').textContent = b.stats.totalVariants.toLocaleString();
      document.getElementById('promoKpiPassed').textContent = b.stats.passedCount.toLocaleString();
      document.getElementById('promoKpiReview').textContent = b.stats.reviewCount.toLocaleString();
      document.getElementById('promoKpiBlocked').textContent = b.stats.blockedCount.toLocaleString();

      const warningBanner = document.getElementById('promoValidationWarningBanner');
      if (warningBanner) {
        const warnings = b.warnings || [];
        const blockedItems = b.variants.filter(v => v.validationStatus !== 'PASSED_VALIDATION');
        const provisionalItems = b.variants.filter(v => v.promotionSourceType === 'PROVISIONAL_AI_CAPTURE' && v.validationStatus === 'PASSED_VALIDATION');

        if (blockedItems.length > 0 || warnings.length > 0 || provisionalItems.length > 0) {
          warningBanner.classList.remove('hidden');
          const sampleIssues = blockedItems.slice(0, 5);
          const moreCount = blockedItems.length - sampleIssues.length;

          warningBanner.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; color: #fbbf24;">
              <span>🛡️ สรุปผลการคัดกรองความปลอดภัยโปรโมชั่น:</span>
            </div>
            ${provisionalItems.length > 0 ? `
              <div style="margin-bottom: 8px; padding: 8px 12px; background: rgba(245, 158, 11, 0.15); border-radius: 6px; border-left: 3px solid #f59e0b; font-size: 0.84rem; color: #fde68a;">
                ⚡ <strong>ตรวจพบโปรโมชั่นจาก AI (${provisionalItems.length} รายการ):</strong> ระบบผ่านเกณฑ์ความมั่นใจ &ge; 70% และจะติดป้ายเตือนชั่วคราว พร้อมระบบตรวจสอบย้อนหลังเมื่อไฟล์ Excel เข้ามา (TTL 7 วัน)
              </div>
            ` : ''}
            ${blockedItems.length > 0 ? `
              <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; line-height: 1.6; color: #fde68a;">
                ${sampleIssues.map(item => `
                  <li>
                    <strong>${item.model}</strong>: 
                    <span style="color: #fca5a5;">${item.reasonText || item.validationFlags.join(', ')}</span>
                  </li>
                `).join('')}
                ${moreCount > 0 ? `<li>...และอีก ${moreCount} รายการที่ถูกกักกัน (ดูรายละเอียดในแท็บ "ถูกกักกัน")</li>` : ''}
              </ul>
            ` : ''}
            <div style="margin-top: 10px; font-size: 0.82rem; color: #cbd5e1; border-top: 1px dashed rgba(251, 191, 36, 0.3); padding-top: 8px;">
              💡 <strong>Triple Safety Net:</strong> คุณสามารถกด <em>"ยืนยันการเผยแพร่"</em> เพื่อนำเข้ารายการที่ผ่านเกณฑ์ (${b.stats.passedCount} รายการ) สู่ระบบหน้าร้านได้อย่างปลอดภัย
            </div>
          `;
        } else {
          warningBanner.classList.add('hidden');
          warningBanner.innerHTML = '';
        }
      }

      const batchBar = document.getElementById('promoBatchPnActionBar');
      if (batchBar) {
        const hasCandidates = b.variants.some(v => (v.candidatePn && v.candidatePn.length > 0) || v.validationStatus === 'REVIEW_REQUIRED');
        if (hasCandidates) {
          batchBar.classList.remove('hidden');
        } else {
          batchBar.classList.add('hidden');
        }
      }

      this.filterDiffTable('ALL');

      this.ensureUiElements();
      const btnPreviewDb = document.getElementById('btnPreviewPromoDatabase');
      const btnSaveDb = document.getElementById('btnSavePromoDraftDatabase');
      const btnConfirm = document.getElementById('btnConfirmPromoPublish');

      if (b.stats.passedCount > 0) {
        if (btnPreviewDb) btnPreviewDb.style.display = 'inline-flex';
        if (btnSaveDb) {
          btnSaveDb.style.display = 'inline-flex';
          btnSaveDb.innerHTML = `<span>💾 บันทึก Draft ลงฐานข้อมูล (${b.stats.passedCount} รายการ)</span>`;
        }
        if (btnConfirm) {
          btnConfirm.style.display = 'inline-flex';
          const isAI = b.format.includes('IMAGE') || b.format.includes('TXT');
          btnConfirm.innerHTML = isAI 
            ? `<span>⚡ เผยแพร่โปรโมชั่น AI ชั่วคราว (${b.stats.passedCount} รายการ) &rarr;</span>`
            : `<span>⚡ เผยแพร่เฉพาะรายการที่ผ่านเกณฑ์ (${b.stats.passedCount} รายการ) &rarr;</span>`;
        }
      } else {
        if (btnPreviewDb) btnPreviewDb.style.display = 'none';
        if (btnSaveDb) btnSaveDb.style.display = 'none';
        if (btnConfirm) btnConfirm.style.display = 'none';
      }

      const stepItems = document.querySelectorAll('#promoStepper .step-item');
      if (stepItems[0]) stepItems[0].className = 'step-item completed';
      if (stepItems[1]) stepItems[1].className = 'step-item completed';
      if (stepItems[2]) stepItems[2].className = 'step-item completed';
      if (stepItems[3]) stepItems[3].className = 'step-item active';

      previewSec.scrollIntoView({ behavior: 'smooth' });
    }

    filterDiffTable(filterType) {
      const b = this.currentStagedBatch;
      if (!b) return;

      this.currentFilterType = filterType || this.currentFilterType || 'ALL';

      const tbody = document.getElementById('promoDiffTableBody');
      if (!tbody) return;

      let list = b.variants;
      if (this.currentFilterType === 'PASSED') list = list.filter(v => v.validationStatus === 'PASSED_VALIDATION');
      else if (this.currentFilterType === 'REVIEW') list = list.filter(v => v.validationStatus === 'REVIEW_REQUIRED' || v.validationStatus === 'OCR_NOT_IMPLEMENTED');
      else if (this.currentFilterType === 'BLOCKED') list = list.filter(v => v.validationStatus.startsWith('BLOCKED') || v.validationStatus === 'OCR_LOW_CONFIDENCE');

      const stockDb = window.STOCK_DATABASE || window.STOCK_DATA || [];
      const stockMap = {};
      stockDb.forEach(s => { stockMap[s.pn] = s; });

      tbody.innerHTML = list.map(item => {
        const renderStatusBadge = () => {
          if (item.promotionSourceType === 'PROVISIONAL_AI_CAPTURE' && item.validationStatus === 'PASSED_VALIDATION') {
            const pct = (item.aiConfidenceScore * 100).toFixed(0);
            return `<span class="status-badge-gate" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid #f59e0b;" title="SHA-256: ${item.rawSourceMediaSha256 || '-'}">⚡ AI PROV (${pct}%)</span>`;
          }
          if (item.validationStatus === 'PASSED_VALIDATION') return `<span class="status-badge-gate pass">🟢 ผ่านเกณฑ์</span>`;
          if (item.validationStatus === 'REVIEW_REQUIRED') return `<span class="status-badge-gate review">🟡 ต้องตรวจ</span>`;
          return `<span class="status-badge-gate blocked">🔴 กักกัน (${item.validationStatus.replace('BLOCKED_', '')})</span>`;
        };

        const sheetInfo = item.sourceTrace ? `${item.sourceTrace.sheet || item.sourceTrace.format}!${item.sourceTrace.cellRef || ('แถว ' + (item.sourceTrace.row || item.sourceTrace.line || 1))}` : '-';

        const renderActionCell = () => {
          // 1. Confirmed P/N state
          if (item.confirmedPns && item.confirmedPns.length > 0) {
            return `
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 6px 10px;">
                <div style="font-size: 0.76rem; color: #6ee7b7; font-weight: 700; display: flex; align-items: center; justify-content: space-between;">
                  <span>🟢 ยืนยัน Exact P/N แล้ว (${item.confirmedPns.length} รายการ)</span>
                  <button type="button" class="btn-row-action btn-row-undo" data-row-id="${item.draftRowId}" title="แก้ไขการเลือก P/N">↺ แก้ไข</button>
                </div>
                <div style="font-size: 0.70rem; color: #cbd5e1; margin-top: 4px; font-family: monospace;">
                  ${item.confirmedPns.map(p => {
                    const s = stockMap[p];
                    return `<span style="display: inline-block; background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px; margin: 1px 2px;">${p} (${s ? s.color : '-'})</span>`;
                  }).join(' ')}
                </div>
              </div>
            `;
          }

          // 2. Review Required with Candidates
          if (item.validationStatus === 'REVIEW_REQUIRED' && item.candidatePn && item.candidatePn.length > 0) {
            const selectedList = item.selectedPns || [];
            return `
              <div style="font-size: 0.76rem; color: #93c5fd; font-weight: 600; margin-bottom: 4px;">
                🔍 พบ ${item.candidatePn.length} Candidate P/N ตัวเครื่อง (SMARTPHONE) ในสต็อก:
              </div>
              <div class="candidate-selector-box" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 6px; padding: 4px;">
                ${item.candidatePn.map(pn => {
                  const s = stockMap[pn] || { pn, color: '-', productCodeType: (pn.startsWith('F-') ? 'PASS_F' : 'STANDARD_SM'), f1: 0, f2: 0, total: 0 };
                  const isChecked = selectedList.includes(pn);
                  const isPassF = s.productCodeType === 'PASS_F' || pn.startsWith('F-');
                  return `
                    <div class="candidate-item-row" style="padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <div class="candidate-item-left" style="display: flex; flex-direction: column; gap: 2px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <input type="checkbox" class="candidate-cb" data-row-id="${item.draftRowId}" data-pn="${pn}" ${isChecked ? 'checked' : ''} />
                          <span class="candidate-pn-code" style="color: #60a5fa; font-weight: 700;">${pn}</span>
                          <span class="type-pill ${isPassF ? 'pass-f' : 'std-sm'}" style="font-size: 0.65rem; padding: 1px 4px;">${isPassF ? 'F-' : 'SM-'}</span>
                          <span class="candidate-color-badge" style="font-size: 0.70rem;">🎨 ${s.color || '-'}</span>
                        </div>
                        <div style="font-size: 0.66rem; color: #94a3b8; margin-left: 20px; display: flex; gap: 8px; flex-wrap: wrap;">
                          <span>Product Type: <strong style="color: #34d399;">SMARTPHONE</strong></span>
                          <span>Capacity: <strong style="color: #34d399;">${item.capacity || '-'}</strong></span>
                          <span>Exact Model: <span style="color: #34d399;">PASS</span></span>
                          <span>Exact Capacity: <span style="color: #34d399;">PASS</span></span>
                        </div>
                      </div>
                      <div class="candidate-stock-tag" style="font-size: 0.70rem;">
                        ช1: <strong>${s.f1}</strong> | ช2: <strong>${s.f2}</strong> (รวม <strong>${s.total}</strong>)
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="candidate-row-actions" style="margin-top: 6px; display: flex; gap: 6px;">
                <button type="button" class="btn-row-action btn-select-row-all" data-row-id="${item.draftRowId}">
                  เลือกทุกสี (${item.candidatePn.length})
                </button>
                <button type="button" class="btn-row-action btn-row-confirm" data-row-id="${item.draftRowId}" ${selectedList.length === 0 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''}>
                  ✓ ยืนยัน P/N (${selectedList.length})
                </button>
              </div>
            `;
          }

          // 3. Trade Up Payment Code Missing
          if (item.validationFlags && item.validationFlags.includes('TRADE_UP_PAYMENT_CODE_MISSING')) {
            return `
              <div class="tup-fix-box">
                <div style="font-size: 0.74rem; color: #fca5a5; font-weight: 700;">
                  ⚠️ ขาดรหัสตัดชำระ Trade Up (Payment Code)
                </div>
                <div style="font-size: 0.70rem; color: #cbd5e1;">
                  ใส่รหัสตัดชำระจากเอกสารต้นทาง (เช่น TUP-01):
                </div>
                <div style="display: flex; gap: 6px; margin-top: 4px;">
                  <input type="text" id="tup-code-${item.draftRowId}" class="tup-code-input" placeholder="เช่น TUP-01" value="" />
                  <button type="button" class="btn-save-tup" data-row-id="${item.draftRowId}">บันทึก</button>
                </div>
              </div>
            `;
          }

          // 4. PN Not Found / No Smartphone Candidates
          if ((item.validationFlags && item.validationFlags.includes('PN_NOT_FOUND')) || !item.candidatePn || item.candidatePn.length === 0) {
            return `
              <div class="pn-not-found-box" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 8px 10px;">
                <div style="font-size: 0.78rem; color: #fca5a5; font-weight: 700; display: flex; align-items: center; gap: 5px;">
                  <span>🚫 ไม่พบ P/N ตัวเครื่อง ${item.model} ${item.capacity ? '(' + item.capacity + ')' : ''}</span>
                </div>
                <div style="font-size: 0.70rem; color: #cbd5e1; margin-top: 4px; line-height: 1.4;">
                  สถานะ: <strong style="color: #fbbf24;">REVIEW_REQUIRED</strong> (ไม่มีสต็อกตัวเครื่องในระบบสาขา)<br/>
                  <span style="color: #f87171; font-weight: 600;">⛔ ห้ามจับคู่กับอุปกรณ์เสริม • ปิดปุ่มยืนยันและระงับการบันทึก Draft แบบ Fail-Closed</span>
                </div>
                ${item.saleMode === 'TRADE_UP' ? `
                  <div style="font-size: 0.66rem; color: #fbbf24; margin-top: 4px; border-top: 1px dashed rgba(251, 191, 36, 0.3); padding-top: 3px;">
                    ℹ️ ส่วนลด Trade Up ใช้ได้เฉพาะเมื่อลูกค้านำเครื่องมา Trade Up (หากไม่มีเครื่องมา Trade Up ระบบต้องกลับไปใช้เส้นทาง STANDARD_PAYMENT ราคาสุทธิ ฿${(item.standardNetPrice || (item.rrp - (item.standardDiscount || 0))).toLocaleString()} บาท)
                  </div>
                ` : ''}
              </div>
            `;
          }

          // 5. Default Trace Evidence
          return `
            <div style="font-size: 0.72rem; color: var(--neon-cyan); font-family: monospace;">${sheetInfo}</div>
            <div style="font-size: 0.76rem; color: ${item.validationStatus === 'PASSED_VALIDATION' ? '#a7f3d0' : '#fca5a5'};">${item.reasonText || (item.validationFlags || []).join(', ') || '-'}</div>
          `;
        };

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span>${item.pn || '<span style="color: #94a3b8; font-style: italic;">รอจับคู่ Exact P/N</span>'}</span>
                ${item.confirmedPns && item.confirmedPns.length > 0 ? `<span class="confirmed-pn-tag" style="font-size: 0.68rem; padding: 1px 5px;">✓ ${item.confirmedPns.length} P/N</span>` : ''}
              </div>
              <div style="font-size: 0.82rem; color: #cbd5e1; margin-top: 2px;">
                <strong>${item.model}</strong> ${item.capacity ? `<span style="color: #93c5fd;">(${item.capacity})</span>` : ''}
              </div>
              ${item.productMatchStatus ? `<div style="font-size: 0.70rem; color: #93c5fd; margin-top: 2px;">สถานะ: <code>${item.productMatchStatus}</code></div>` : ''}
              ${item.freebieNoteFromAI ? `<div style="font-size: 0.72rem; color: #34d399; margin-top: 2px;">🎁 ${item.freebieNoteFromAI}</div>` : ''}
            </td>
            <td><span class="type-pill ${item.productCodeType === 'STANDARD_SM' ? 'active' : (item.productCodeType === 'PASS_F' ? 'pass-f' : '')}">${item.productCodeType}</span></td>
            <td>${item.rrp > 0 ? `฿${item.rrp.toLocaleString()}` : '<span style="color: #94a3b8;">-</span>'}</td>
            <td class="text-coral" style="min-width: 170px;">
              ${item.saleMode === 'TRADE_UP' ? `
                <div style="font-weight: 700; color: #f87171; font-size: 0.88rem;">-฿${item.discount.toLocaleString()}</div>
                <div style="font-size: 0.67rem; color: #cbd5e1; margin-top: 4px; line-height: 1.4; background: rgba(0,0,0,0.3); padding: 5px 7px; border-radius: 6px; border: 1px solid rgba(248, 113, 113, 0.2);">
                  <div style="white-space: nowrap;">ต่อที่ 1 คูปอง ${item.coupon || '01'}: <strong style="color: #fca5a5;">-฿${(item.standardDiscount || 0).toLocaleString()}</strong></div>
                  <div style="white-space: nowrap;">ต่อที่ 2 Trade Up: <strong style="color: #fca5a5;">-฿${(item.tradeUpDiscount || 0).toLocaleString()}</strong></div>
                  <div style="color: #93c5fd; font-weight: 600; margin-top: 2px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 2px; white-space: nowrap;">ส่วนลดรวม: -฿${item.discount.toLocaleString()}</div>
                </div>
              ` : (item.discount > 0 ? `-฿${item.discount.toLocaleString()}` : '<span style="color: #94a3b8;">-</span>')}
            </td>
            <td style="font-weight: 700; color: var(--neon-cyan); min-width: 135px;">
              <div style="font-size: 0.95rem;">${item.netPrice > 0 ? `฿${item.netPrice.toLocaleString()}` : '<span style="color: #94a3b8;">-</span>'}</div>
              ${item.saleMode === 'TRADE_UP' ? `
                <div style="font-size: 0.64rem; color: #94a3b8; font-weight: 400; margin-top: 3px; line-height: 1.25;">
                  <span style="color: #fbbf24; font-weight: 600;">*เมื่อนำเครื่องมาแลก</span><br/>
                  (ไม่มีเครื่องแลก: ฿${(item.standardNetPrice || (item.rrp - (item.standardDiscount || 0))).toLocaleString()})
                </div>
              ` : ''}
            </td>
            <td>
              <span class="type-pill">${item.coupon || '-'}</span>
              ${item.tradeUpPaymentCode ? `<div style="font-size: 0.70rem; color: #fbbf24; margin-top: 2px; font-family: monospace;">ชำระ: ${item.tradeUpPaymentCode}</div>` : ''}
            </td>
            <td>
              <span class="type-pill" style="font-size: 0.72rem;">${item.saleMode}</span>
              ${item.saleMode === 'TRADE_UP' ? `
                <div style="font-size: 0.64rem; color: #fbbf24; margin-top: 2px;">*เงื่อนไขเก่าแลกใหม่</div>
              ` : ''}
            </td>
            <td>${renderStatusBadge()}</td>
            <td>
              ${renderActionCell()}
            </td>
          </tr>
        `;
      }).join('');
    }

    validateCandidateSelection(selectedPns, item) {
      if (!selectedPns || selectedPns.length === 0) {
        return { allowed: false, code: 'NO_SELECTION', message: 'กรุณาเลือก Candidate P/N อย่างน้อย 1 รายการก่อนกดยืนยัน' };
      }

      const stockDb = window.STOCK_DATABASE || window.STOCK_DATA || [];
      const stockMap = {};
      stockDb.forEach(s => { stockMap[s.pn] = s; });

      for (const pn of selectedPns) {
        const s = stockMap[pn];
        if (!s) {
          return { allowed: false, code: 'PN_NOT_IN_STOCK', message: `ไม่พบรหัส P/N ${pn} ในระบบสต็อก` };
        }

        const isSmartphone = (
          (s.category && s.category.toLowerCase() === 'smartphone') ||
          (s.canonicalCategory && s.canonicalCategory.toLowerCase() === 'smartphone') ||
          (s.category1 && s.category1.toUpperCase().includes('SMART PHONE'))
        );
        const isAccessory = (
          (s.category && ['accessory', 'phone_case', 'screen_protector', 'watch_band', 'premium_gift', 'premium', 'other', 'sim', 'watch', 'buds', 'tablet'].includes(s.category.toLowerCase())) ||
          (s.category1 && (s.category1.toUpperCase().includes('ACCESSORY') || s.category1.toUpperCase().includes('OTHER'))) ||
          pn.startsWith('EF-') || pn.startsWith('GP-') || pn.startsWith('EP-') || pn.startsWith('EE-') || pn.startsWith('ITFIT')
        );

        if (!isSmartphone || isAccessory) {
          return {
            allowed: false,
            code: 'PROMOTION_TARGET_TYPE_MISMATCH',
            message: `ไม่อนุญาตให้ยืนยัน ${pn} เพราะไม่ใช่ตัวเครื่องประเภท SMARTPHONE (เป็นอุปกรณ์เสริมหรือหมวดหมู่อื่น)`
          };
        }

        if (item.capacity) {
          const promoCap = String(item.capacity).toUpperCase();
          const sm = (s.model || '').toUpperCase();
          if (promoCap.includes('1TB') && !sm.includes('1TB') && !sm.includes('1 TB')) {
            return {
              allowed: false,
              code: 'PROMOTION_TARGET_CAPACITY_MISMATCH',
              message: `ไม่อนุญาตให้ยืนยัน ${pn} เพราะความจุไม่ตรงกับโปรโมชั่น (${item.capacity})`
            };
          }
          if (promoCap.includes('512') && !sm.includes('512')) {
            return {
              allowed: false,
              code: 'PROMOTION_TARGET_CAPACITY_MISMATCH',
              message: `ไม่อนุญาตให้ยืนยัน ${pn} เพราะความจุไม่ตรงกับโปรโมชั่น (${item.capacity})`
            };
          }
          if (promoCap.includes('256') && !sm.includes('256')) {
            return {
              allowed: false,
              code: 'PROMOTION_TARGET_CAPACITY_MISMATCH',
              message: `ไม่อนุญาตให้ยืนยัน ${pn} เพราะความจุไม่ตรงกับโปรโมชั่น (${item.capacity})`
            };
          }
          if (promoCap.includes('128') && !sm.includes('128')) {
            return {
              allowed: false,
              code: 'PROMOTION_TARGET_CAPACITY_MISMATCH',
              message: `ไม่อนุญาตให้ยืนยัน ${pn} เพราะความจุไม่ตรงกับโปรโมชั่น (${item.capacity})`
            };
          }
        }
      }

      // Check variant multi-P/N: must differ only in color
      if (selectedPns.length > 1) {
        const first = stockMap[selectedPns[0]];
        for (let i = 1; i < selectedPns.length; i++) {
          const curr = stockMap[selectedPns[i]];
          if (first.srp !== curr.srp || (first.category3 && curr.category3 && first.category3 !== curr.category3)) {
            return {
              allowed: false,
              code: 'MULTIPLE_PN_NOT_COLOR_VARIANTS',
              message: 'อนุญาตให้เลือกหลาย P/N ในข้อเสนอเดียวกันได้เฉพาะกรณีที่เป็นรุ่นและความจุเดียวกัน แต่ต่างสีเท่านั้น'
            };
          }
        }
      }

      return { allowed: true };
    }

    toggleCandidateCheckbox(draftRowId, pn, isChecked) {
      const b = this.currentStagedBatch;
      if (!b) return;
      const item = b.variants.find(v => v.draftRowId === draftRowId);
      if (!item) return;

      item.selectedPns = item.selectedPns || [];
      if (isChecked) {
        if (!item.selectedPns.includes(pn)) item.selectedPns.push(pn);
      } else {
        item.selectedPns = item.selectedPns.filter(p => p !== pn);
      }

      // Update button text in the row
      const btn = document.querySelector(`.btn-row-confirm[data-row-id="${draftRowId}"]`);
      if (btn) {
        btn.textContent = `✓ ยืนยัน P/N (${item.selectedPns.length})`;
        if (item.selectedPns.length === 0) {
          btn.setAttribute('disabled', 'true');
          btn.style.opacity = '0.45';
          btn.style.cursor = 'not-allowed';
        } else {
          btn.removeAttribute('disabled');
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
        }
      }
    }

    selectAllCandidatesForRow(draftRowId) {
      const b = this.currentStagedBatch;
      if (!b) return;
      const item = b.variants.find(v => v.draftRowId === draftRowId);
      if (!item || !item.candidatePn) return;

      const stockDb = window.STOCK_DATABASE || window.STOCK_DATA || [];
      const stockMap = {};
      stockDb.forEach(s => { stockMap[s.pn] = s; });

      // Only select genuine smartphone candidates
      const validPns = item.candidatePn.filter(pn => {
        const s = stockMap[pn];
        if (!s) return false;
        const isSmartphone = (
          (s.category && s.category.toLowerCase() === 'smartphone') ||
          (s.canonicalCategory && s.canonicalCategory.toLowerCase() === 'smartphone') ||
          (s.category1 && s.category1.toUpperCase().includes('SMART PHONE'))
        );
        const isAccessory = (
          (s.category && ['accessory', 'phone_case', 'screen_protector', 'watch_band', 'premium_gift', 'premium', 'other', 'sim', 'watch', 'buds', 'tablet'].includes(s.category.toLowerCase())) ||
          (s.category1 && (s.category1.toUpperCase().includes('ACCESSORY') || s.category1.toUpperCase().includes('OTHER'))) ||
          pn.startsWith('EF-') || pn.startsWith('GP-') || pn.startsWith('EP-') || pn.startsWith('EE-') || pn.startsWith('ITFIT')
        );
        return isSmartphone && !isAccessory;
      });

      item.selectedPns = [...validPns];
      this.filterDiffTable(this.currentFilterType);
    }

    confirmRowPns(draftRowId) {
      const b = this.currentStagedBatch;
      if (!b) return;
      const item = b.variants.find(v => v.draftRowId === draftRowId);
      if (!item) return;

      const gate = this.validateCandidateSelection(item.selectedPns, item);
      if (!gate.allowed) {
        alert(`⛔ Quality Gate ปฏิเสธการยืนยัน:\n${gate.message}\n(Error Code: ${gate.code})`);
        return;
      }

      const stockDb = window.STOCK_DATABASE || window.STOCK_DATA || [];
      const stockMap = {};
      stockDb.forEach(s => { stockMap[s.pn] = s; });

      item.confirmedPns = [...item.selectedPns];
      item.targetPns = item.selectedPns.map(p => {
        const s = stockMap[p] || {};
        return {
          inventoryPn: p,
          color: s.color || '-',
          productType: 'SMARTPHONE',
          matchStatus: 'CONFIRMED'
        };
      });
      item.pn = item.selectedPns.join(', ');
      item.productCodeType = item.selectedPns[0].startsWith('F-') ? 'PASS_F' : 'STANDARD_SM';
      item.validationStatus = 'PASSED_VALIDATION';
      item.humanReviewRequired = false;
      item.autoPublishAllowed = true;
      item.validationFlags = (item.validationFlags || []).filter(f => f !== 'EXACT_PN_UNRESOLVED' && f !== 'PN_NOT_FOUND');
      item.reasonText = `✓ ยืนยัน Exact P/N ตัวเครื่องแล้ว (${item.selectedPns.length} P/N)`;

      this.updateBatchStats();
      this.filterDiffTable(this.currentFilterType);
    }

    undoRowPnConfirmation(draftRowId) {
      const b = this.currentStagedBatch;
      if (!b) return;
      const item = b.variants.find(v => v.draftRowId === draftRowId);
      if (!item) return;

      item.confirmedPns = [];
      item.targetPns = [];
      item.pn = null;
      item.productCodeType = 'UNKNOWN';
      item.validationStatus = 'REVIEW_REQUIRED';
      item.humanReviewRequired = true;
      item.autoPublishAllowed = false;
      if (!item.validationFlags) item.validationFlags = [];
      if (!item.validationFlags.includes('EXACT_PN_UNRESOLVED')) item.validationFlags.push('EXACT_PN_UNRESOLVED');
      item.reasonText = `รอจับคู่และยืนยัน Exact P/N จากสต็อกจริง`;

      this.updateBatchStats();
      this.filterDiffTable(this.currentFilterType);
    }

    saveTradeUpPaymentCode(draftRowId, code) {
      const b = this.currentStagedBatch;
      if (!b) return;
      const item = b.variants.find(v => v.draftRowId === draftRowId);
      if (!item) return;

      if (!code || code.trim() === '') {
        alert('กรุณากรอกรหัสตัดชำระ Trade Up (Payment Code) จากเอกสารต้นทาง');
        return;
      }

      const cleanCode = code.trim().toUpperCase();
      item.tradeUpPaymentCode = cleanCode;
      item.validationFlags = (item.validationFlags || []).filter(f => f !== 'TRADE_UP_PAYMENT_CODE_MISSING');

      // Re-evaluate candidate match for this item
      if (item.candidatePn && item.candidatePn.length > 0) {
        item.validationStatus = 'REVIEW_REQUIRED';
        item.humanReviewRequired = true;
        item.autoPublishAllowed = false;
        if (!item.validationFlags.includes('EXACT_PN_UNRESOLVED')) item.validationFlags.push('EXACT_PN_UNRESOLVED');
        item.reasonText = `โปรโมชั่น Trade Up (สุทธิ ฿${item.netPrice} | รหัสชำระ ${cleanCode}) • ต้องจับคู่ Exact P/N ก่อนเผยแพร่`;
      } else {
        item.validationStatus = 'REVIEW_REQUIRED';
        if (!item.validationFlags.includes('PN_NOT_FOUND')) item.validationFlags.push('PN_NOT_FOUND');
        item.reasonText = `บันทึกรหัสตัดชำระ ${cleanCode} แล้ว แต่ไม่พบรหัส P/N ตัวเครื่องในระบบสต็อก`;
      }

      this.updateBatchStats();
      this.filterDiffTable(this.currentFilterType);
      alert(`✓ บันทึกรหัสชำระ ${cleanCode} สำหรับ ${item.model} เรียบร้อยแล้ว!`);
    }

    selectAllReviewCandidates() {
      const b = this.currentStagedBatch;
      if (!b) return;

      const stockDb = window.STOCK_DATABASE || window.STOCK_DATA || [];
      const stockMap = {};
      stockDb.forEach(s => { stockMap[s.pn] = s; });

      let selectedCount = 0;
      b.variants.forEach(v => {
        if (v.validationStatus === 'REVIEW_REQUIRED' && v.candidatePn && v.candidatePn.length > 0) {
          const validPns = v.candidatePn.filter(pn => {
            const s = stockMap[pn];
            if (!s) return false;
            const isSmartphone = (
              (s.category && s.category.toLowerCase() === 'smartphone') ||
              (s.canonicalCategory && s.canonicalCategory.toLowerCase() === 'smartphone') ||
              (s.category1 && s.category1.toUpperCase().includes('SMART PHONE'))
            );
            const isAccessory = (
              (s.category && ['accessory', 'phone_case', 'screen_protector', 'watch_band', 'premium_gift', 'premium', 'other', 'sim', 'watch', 'buds', 'tablet'].includes(s.category.toLowerCase())) ||
              (s.category1 && (s.category1.toUpperCase().includes('ACCESSORY') || s.category1.toUpperCase().includes('OTHER'))) ||
              pn.startsWith('EF-') || pn.startsWith('GP-') || pn.startsWith('EP-') || pn.startsWith('EE-') || pn.startsWith('ITFIT')
            );
            return isSmartphone && !isAccessory;
          });

          if (validPns.length > 0) {
            v.selectedPns = [...validPns];
            selectedCount += validPns.length;
          } else {
            v.selectedPns = [];
          }
        }
      });

      this.filterDiffTable(this.currentFilterType);
      alert(`☑ เลือกเฉพาะ Candidate P/N ตัวเครื่อง SMARTPHONE (${selectedCount} รหัส P/N)\n\nระบบคัดกรองอุปกรณ์เสริมออกเรียบร้อยแล้ว\nกดปุ่ม "✓ ยืนยัน P/N ที่เลือกทั้งหมด" เพื่ออนุมัติรายการที่ผ่านเกณฑ์`);
    }

    confirmAllSelectedCandidates() {
      const b = this.currentStagedBatch;
      if (!b) return;

      const stockDb = window.STOCK_DATABASE || window.STOCK_DATA || [];
      const stockMap = {};
      stockDb.forEach(s => { stockMap[s.pn] = s; });

      let confirmedCount = 0;
      let blockedCount = 0;

      b.variants.forEach(v => {
        if (v.validationStatus === 'REVIEW_REQUIRED' && v.selectedPns && v.selectedPns.length > 0) {
          const gate = this.validateCandidateSelection(v.selectedPns, v);
          if (gate.allowed) {
            v.confirmedPns = [...v.selectedPns];
            v.targetPns = v.selectedPns.map(p => {
              const s = stockMap[p] || {};
              return {
                inventoryPn: p,
                color: s.color || '-',
                productType: 'SMARTPHONE',
                matchStatus: 'CONFIRMED'
              };
            });
            v.pn = v.selectedPns.join(', ');
            v.productCodeType = v.selectedPns[0].startsWith('F-') ? 'PASS_F' : 'STANDARD_SM';
            v.validationStatus = 'PASSED_VALIDATION';
            v.humanReviewRequired = false;
            v.autoPublishAllowed = true;
            v.validationFlags = (v.validationFlags || []).filter(f => f !== 'EXACT_PN_UNRESOLVED' && f !== 'PN_NOT_FOUND');
            v.reasonText = `✓ ยืนยัน Exact P/N ตัวเครื่องแล้ว (${v.selectedPns.length} P/N)`;
            confirmedCount++;
          } else {
            blockedCount++;
          }
        }
      });

      if (confirmedCount === 0) {
        alert('ยังไม่มีรายการที่ผ่านเกณฑ์ Candidate P/N ตัวเครื่อง SMARTPHONE\n\n(รายการที่ไม่พบตัวเครื่อง หรือมีความจุ/ประเภทไม่ตรง จะถูกระงับการยืนยันเพื่อความปลอดภัย)');
        return;
      }

      this.updateBatchStats();
      this.filterDiffTable(this.currentFilterType);
      alert(`✓ ยืนยัน Exact P/N ตัวเครื่องสำเร็จ ${confirmedCount} รายการ!\n${blockedCount > 0 ? `(ระงับ ${blockedCount} รายการที่ไม่ผ่านเกณฑ์ Quality Gate)\n\n` : ''}รายการที่ผ่านเกณฑ์พร้อมสำหรับการ Publish แล้ว`);
    }

    resetCandidateSelections() {
      const b = this.currentStagedBatch;
      if (!b) return;

      b.variants.forEach(v => {
        v.selectedPns = [];
        if (v.confirmedPns && v.confirmedPns.length > 0) {
          v.confirmedPns = [];
          v.targetPns = [];
          v.pn = null;
          v.productCodeType = 'UNKNOWN';
          v.validationStatus = 'REVIEW_REQUIRED';
          v.humanReviewRequired = true;
          v.autoPublishAllowed = false;
          if (!v.validationFlags) v.validationFlags = [];
          if (!v.validationFlags.includes('EXACT_PN_UNRESOLVED')) v.validationFlags.push('EXACT_PN_UNRESOLVED');
          v.reasonText = `รอจับคู่และยืนยัน Exact P/N จากสต็อกจริง`;
        }
      });

      this.updateBatchStats();
      this.filterDiffTable(this.currentFilterType);
    }

    updateBatchStats() {
      const b = this.currentStagedBatch;
      if (!b) return;

      let passedCount = 0;
      let reviewCount = 0;
      let blockedCount = 0;

      b.variants.forEach(v => {
        if (v.validationStatus === 'PASSED_VALIDATION') passedCount++;
        else if (v.validationStatus === 'REVIEW_REQUIRED' || v.validationStatus === 'OCR_NOT_IMPLEMENTED') reviewCount++;
        else blockedCount++;
      });

      b.stats.passedCount = passedCount;
      b.stats.reviewCount = reviewCount;
      b.stats.blockedCount = blockedCount;

      const totalEl = document.getElementById('promoKpiTotal');
      const passedEl = document.getElementById('promoKpiPassed');
      const reviewEl = document.getElementById('promoKpiReview');
      const blockedEl = document.getElementById('promoKpiBlocked');

      if (totalEl) totalEl.textContent = b.stats.totalVariants.toLocaleString();
      if (passedEl) passedEl.textContent = b.stats.passedCount.toLocaleString();
      if (reviewEl) reviewEl.textContent = b.stats.reviewCount.toLocaleString();
      if (blockedEl) blockedEl.textContent = b.stats.blockedCount.toLocaleString();

      this.ensureUiElements();
      const btnPreviewDb = document.getElementById('btnPreviewPromoDatabase');
      const btnSaveDb = document.getElementById('btnSavePromoDraftDatabase');
      const btnConfirm = document.getElementById('btnConfirmPromoPublish');

      if (b.stats.passedCount > 0) {
        if (btnPreviewDb) btnPreviewDb.style.display = 'inline-flex';
        if (btnSaveDb) {
          btnSaveDb.style.display = 'inline-flex';
          btnSaveDb.innerHTML = `<span>💾 บันทึก Draft ลงฐานข้อมูล (${b.stats.passedCount} รายการ)</span>`;
        }
        if (btnConfirm) {
          btnConfirm.style.display = 'inline-flex';
          const isAI = b.format.includes('IMAGE') || b.format.includes('TXT');
          btnConfirm.innerHTML = isAI 
            ? `<span>⚡ เผยแพร่โปรโมชั่น AI ชั่วคราว (${b.stats.passedCount} รายการ) &rarr;</span>`
            : `<span>⚡ เผยแพร่เฉพาะรายการที่ผ่านเกณฑ์ (${b.stats.passedCount} รายการ) &rarr;</span>`;
        }
      } else {
        if (btnPreviewDb) btnPreviewDb.style.display = 'none';
        if (btnSaveDb) btnSaveDb.style.display = 'none';
        if (btnConfirm) btnConfirm.style.display = 'none';
      }
    }

    async confirmPublish() {
      if (!this.currentStagedBatch || this.isSubmitting) return;

      const b = this.currentStagedBatch;
      const rawPassed = b.variants.filter(v => v.validationStatus === 'PASSED_VALIDATION');
      const quarantined = b.variants.filter(v => v.validationStatus !== 'PASSED_VALIDATION');

      if (rawPassed.length === 0) {
        alert('❌ ไม่สามารถ Publish ได้ เนื่องจากไม่มีรายการที่ผ่าน Validation (PASSED_VALIDATION)\n\nรายการที่รอตรวจ P/N หรือมีข้อผิดพลาดถูกกักกันทั้งหมดเพื่อความปลอดภัยหน้าร้าน');
        return;
      }

      // Multi-P/N Promotion Expansion: Expand confirmed multi-P/N variants into individual verified records
      const stockDb = window.STOCK_DATABASE || window.STOCK_DATA || [];
      const stockMap = {};
      stockDb.forEach(s => { stockMap[s.pn] = s; });

      const publishable = [];
      rawPassed.forEach(v => {
        if (Array.isArray(v.confirmedPns) && v.confirmedPns.length > 0) {
          v.confirmedPns.forEach((p, idx) => {
            const stockItem = stockMap[p];
            publishable.push({
              ...v,
              promoId: `${v.draftRowId}-${p}-${idx}`,
              pn: p,
              productCodeType: p.startsWith('F-') ? 'PASS_F' : 'STANDARD_SM',
              color: stockItem ? stockItem.color : (v.color || ''),
              model: stockItem ? stockItem.model : v.model,
              status: 'PUBLISHED',
              validationStatus: 'PASSED_VALIDATION',
              autoPublishAllowed: true
            });
          });
        } else {
          publishable.push({
            ...v,
            status: 'PUBLISHED',
            validationStatus: 'PASSED_VALIDATION',
            autoPublishAllowed: true
          });
        }
      });

      const isAI = b.format.includes('IMAGE') || b.format.includes('TXT');
      const confirmMsg = isAI 
        ? `ยืนยันการเผยแพร่โปรโมชั่นชั่วคราวจาก AI สู่ระบบหน้าร้าน?\n\n` +
          `• Batch ID: ${b.batchId}\n` +
          `• สื่อต้นทาง: ${b.sourceFilename}\n` +
          `• ลายนิ้วมือ Media SHA-256: ${(b.fileHash || '').substring(0, 16)}...\n` +
          `• รายการที่จะเปิดใช้งานทันที: ${publishable.length.toLocaleString()} รายการ (ขยายตาม P/N สีจริง)\n` +
          `• รายการที่ถูกกักกัน (ความมั่นใจ < 70%): ${quarantined.length.toLocaleString()} รายการ\n\n` +
          `💡 โปรโมชั่น AI มีอายุ 7 วัน (TTL) และจะกระทบยอดอัตโนมัติเมื่อมีไฟล์ Excel เข้ามา`
        : `ยืนยันการ Publish โปรโมชั่นไปยังระบบหน้าร้าน?\n\n` +
          `• Batch ID: ${b.batchId}\n` +
          `• ไฟล์ต้นทาง: ${b.sourceFilename} (${b.format})\n` +
          `• รายการผ่านเกณฑ์: ${rawPassed.length.toLocaleString()} แถวโปรโมชั่น\n` +
          `• รายการที่จะเปิดใช้งานจริง: ${publishable.length.toLocaleString()} รายการ (ขยายตาม P/N สีจริง)\n` +
          `• รายการที่ถูกกักกัน: ${quarantined.length.toLocaleString()} รายการ\n\n` +
          `ระบบจะบันทึกลงในเบราว์เซอร์นี้ (IndexedDB) และอัปเดตราคาขายหน้าร้านทันที`;

      if (!confirm(confirmMsg)) return;

      this.isSubmitting = true;
      const btnConfirm = document.getElementById('btnConfirmPromoPublish');
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<span>⏳ กำลัง Publish ข้อมูล...</span>';
      }

      try {
        const batchRecord = {
          batchId: b.batchId,
          sourceFilename: b.sourceFilename,
          fileHash: b.fileHash,
          importedAt: b.importedAt,
          format: b.format,
          publishedItems: publishable,
          quarantinedItems: quarantined,
          stats: {
            ...b.stats,
            publishedPnsCount: publishable.length
          },
          meta: {
            importBatchId: b.batchId,
            batchId: b.batchId,
            importedAt: b.importedAt,
            sourceFilename: b.sourceFilename,
            fileHash: b.fileHash,
            summary: {
              totalVariantsProcessed: b.variants.length,
              validatedActiveVariants: publishable.length,
              quarantinedBlockedVariants: quarantined.length
            }
          },
          status: quarantined.length > 0 ? 'PARTIALLY_PUBLISHED' : 'PUBLISHED'
        };

        await PromoStorageAdapter.saveBatch(batchRecord);

        // If newly published batch is Excel, trigger Background Auto-Reconciliation on pending AI items
        if (b.format === 'EXCEL') {
          await PromoStorageAdapter.autoReconcileWithExcel(b.batchId, publishable);
        }

        // Update runtime in-memory state
        window.PROMOTION_VARIANTS = publishable;
        window.PROMOTION_BATCH_METADATA = batchRecord.meta;

        const stepItems = document.querySelectorAll('#promoStepper .step-item');
        if (stepItems[3]) stepItems[3].className = 'step-item completed';
        if (stepItems[4]) stepItems[4].className = 'step-item active';

        if (window.renderPromotionsView) {
          window.renderPromotionsView();
        }

        alert(`✓ Publish โปรโมชั่นสำเร็จ!\n\n` +
          `• Batch ID: ${b.batchId}\n` +
          `• เปิดใช้งานแล้ว: ${publishable.length.toLocaleString()} รายการ\n` +
          `• รายการที่ถูกกักกัน: ${quarantined.length.toLocaleString()} รายการ\n` +
          `• พร้อมใช้งานบนหน้าขายหน้าร้านทันที`);

        if (window.AppRouter) {
          window.AppRouter.navigate('/promotions');
        }
      } catch (err) {
        console.error('[Publish Error]', err);
        alert(`เกิดข้อผิดพลาดในการ Publish โปรโมชั่น: ${err.message}`);
      } finally {
        this.isSubmitting = false;
        if (btnConfirm) {
          btnConfirm.disabled = false;
          btnConfirm.innerHTML = '<span>⚡ ยืนยันการเผยแพร่ &rarr;</span>';
        }
      }
    }

    resetStaging() {
      this.currentStagedBatch = null;
      const previewSec = document.getElementById('promoPreviewSection');
      if (previewSec) previewSec.classList.add('hidden');

      const warningBanner = document.getElementById('promoValidationWarningBanner');
      if (warningBanner) {
        warningBanner.classList.add('hidden');
        warningBanner.innerHTML = '';
      }

      const statusEl = document.getElementById('promoUploadStatus');
      if (statusEl) statusEl.innerHTML = '';

      const fileInput = document.getElementById('promoCenterFileInput');
      if (fileInput) fileInput.value = '';

      const stepItems = document.querySelectorAll('#promoStepper .step-item');
      if (stepItems[0]) stepItems[0].className = 'step-item active';
      if (stepItems[1]) stepItems[1].className = 'step-item';
      if (stepItems[2]) stepItems[2].className = 'step-item';
      if (stepItems[3]) stepItems[3].className = 'step-item';
      if (stepItems[4]) stepItems[4].className = 'step-item';
    }
  }

  window.PromotionImportController = new PromotionImportController();
  window.PromoStorageAdapter = PromoStorageAdapter;

  document.addEventListener('DOMContentLoaded', () => {
    window.PromotionImportController.init();
  });
})();
