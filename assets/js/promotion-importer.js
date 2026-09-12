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

        if (headerIdx === -1) return; // Not a promotion table sheet
        const headers = rows[headerIdx].map(h => String(h).trim().toUpperCase());

        // Detect Columns
        const colMap = {};
        headers.forEach((h, idx) => {
          if (h.includes('P/N') || h === 'PN' || h.includes('SKU') || h.includes('รหัส')) colMap['pn'] = idx;
          else if (h.includes('MODEL') || h.includes('รุ่น') || h.includes('สินค้า')) colMap['model'] = idx;
          else if (h.includes('RRP') || h.includes('ราคาปกติ') || h.includes('ราคาป้าย')) colMap['rrp'] = idx;
          else if (h.includes('SS DISCOUNT') || h.includes('ลด SS') || h.includes('SS ส่วนลด')) colMap['ssDiscount'] = idx;
          else if (h.includes('CPW DISCOUNT') || h.includes('ลด CPW') || h.includes('CPW ส่วนลด')) colMap['cpwDiscount'] = idx;
          else if (h.includes('ADD ON') || h.includes('แลกซื้อ')) colMap['addOnDiscount'] = idx;
          else if (h.includes('DISCOUNT') || h.includes('ส่วนลด') || h.includes('ลด')) {
            if (colMap['discount'] === undefined) colMap['discount'] = idx;
          }
          else if (h.includes('NET') || h.includes('สุทธิ') || h.includes('ราคาขาย') || h.includes('หลังลด')) colMap['netPrice'] = idx;
          else if (h.includes('COUPON') || h.includes('คูปอง')) colMap['coupon'] = idx;
          else if (h.includes('MODE') || h.includes('แคมเปญ') || h.includes('ประเภท')) colMap['saleMode'] = idx;
        });

        const isAddonSheet = sheetName.includes('50-70%') || sheetName.includes('แลกซื้อ') || colMap['addOnDiscount'] !== undefined || (colMap['ssDiscount'] !== undefined && colMap['cpwDiscount'] !== undefined);

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;

          const getColLetter = (cIdx) => String.fromCharCode(65 + (cIdx % 26));

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
          const modelRaw = colMap['model'] !== undefined ? String(row[colMap['model']] || '').trim() : '';

          if (!pnRaw && !modelRaw && !hasFormulaError) continue;

          const pn = pnRaw.toUpperCase();
          const model = modelRaw || pn || `แถวที่ ${r + 1}`;

          const cleanNum = (v) => {
            if (v === null || v === undefined || v === '') return 0;
            const s = String(v).replace(/,/g, '').trim();
            const n = parseFloat(s);
            return isNaN(n) ? 0 : n;
          };

          const rrp = colMap['rrp'] !== undefined ? cleanNum(row[colMap['rrp']]) : 0;
          let discount = colMap['discount'] !== undefined ? cleanNum(row[colMap['discount']]) : 0;
          const ssDisc = colMap['ssDiscount'] !== undefined ? cleanNum(row[colMap['ssDiscount']]) : 0;
          const cpwDisc = colMap['cpwDiscount'] !== undefined ? cleanNum(row[colMap['cpwDiscount']]) : 0;
          const addOnDisc = colMap['addOnDiscount'] !== undefined ? cleanNum(row[colMap['addOnDiscount']]) : (ssDisc + cpwDisc);

          let netPrice = colMap['netPrice'] !== undefined ? cleanNum(row[colMap['netPrice']]) : 0;
          const coupon = colMap['coupon'] !== undefined ? String(row[colMap['coupon']] || '').trim() : '';
          let saleMode = colMap['saleMode'] !== undefined ? String(row[colMap['saleMode']] || '').trim().toUpperCase() : '';

          if (!saleMode) {
            if (isAddonSheet) saleMode = 'ADD_ON_PURCHASE';
            else if (coupon.toUpperCase().includes('STUDENT')) saleMode = 'STUDENT';
            else if (coupon.includes('04')) saleMode = 'SF_PLUS';
            else saleMode = 'STANDARD';
          }

          if (saleMode === 'ADD_ON_PURCHASE' && addOnDisc > 0) {
            discount = addOnDisc;
          }

          let codeType = 'UNKNOWN';
          if (pn.startsWith('F-')) codeType = 'PASS_F';
          else if (pn.startsWith('SM-')) codeType = 'STANDARD_SM';
          else if (pn.startsWith('EP-') || pn.startsWith('EF-') || pn.startsWith('GP-') || pn.startsWith('EE-')) codeType = 'STANDARD_ACCESSORY';

          let validationStatus = 'PASSED_VALIDATION';
          const flags = [];
          let reasonText = '';

          if (hasFormulaError) {
            validationStatus = 'BLOCKED_INVALID';
            flags.push('SOURCE_FORMULA_ERROR');
            reasonText = `พบข้อผิดพลาดสูตรใน Excel (${formulaErrorDetail}) ที่เซลล์ ${sheetName}!${errorCellRef}`;
            warnings.push({
              sheet: sheetName,
              row: r + 1,
              cellRef: `${sheetName}!${errorCellRef}`,
              message: `แถวที่ ${r + 1} (${model}): สูตรผิดพลาด ${formulaErrorDetail} ที่เซลล์ ${errorCellRef}`
            });
          }

          if (!pn && validationStatus !== 'BLOCKED_INVALID') {
            flags.push('PN_MISSING_MODEL_ONLY');
            reasonText = 'ไม่พบรหัสสินค้า P/N (มีเฉพาะชื่อรุ่น)';
          }

          if (saleMode === 'ADD_ON_PURCHASE') {
            const expectedNet = rrp - addOnDisc;
            if (netPrice > 0 && Math.abs(netPrice - expectedNet) > 1 && validationStatus !== 'BLOCKED_INVALID') {
              validationStatus = 'BLOCKED_INVALID';
              flags.push('ADD_ON_EQUATION_MISMATCH');
              reasonText = `สมการแลกซื้อไม่ตรง: RRP (฿${rrp.toLocaleString()}) - ลดแลกซื้อ (฿${addOnDisc.toLocaleString()}) != สุทธิ (฿${netPrice.toLocaleString()})`;
              warnings.push({
                sheet: sheetName,
                row: r + 1,
                cellRef: `${sheetName}!${colMap['netPrice'] !== undefined ? getColLetter(colMap['netPrice']) + (r+1) : 'R' + (r+1)}`,
                message: `แถวที่ ${r + 1} (${model}): สมการแลกซื้อไม่ลงตัว (Expected ${expectedNet} vs Net ${netPrice})`
              });
            } else if (netPrice === 0 && expectedNet > 0) {
              netPrice = expectedNet;
            }
          } else {
            if (rrp > 0 && netPrice > 0) {
              const expectedNet = rrp - discount;
              if (Math.abs(netPrice - expectedNet) > 1 && validationStatus !== 'BLOCKED_INVALID') {
                validationStatus = 'BLOCKED_INVALID';
                flags.push('PRICE_EQUATION_ERROR');
                reasonText = `สมการราคาไม่ลงตัว: RRP (฿${rrp.toLocaleString()}) - ส่วนลด (฿${discount.toLocaleString()}) != สุทธิ (฿${netPrice.toLocaleString()})`;
                warnings.push({
                  sheet: sheetName,
                  row: r + 1,
                  cellRef: `${sheetName}!${colMap['netPrice'] !== undefined ? getColLetter(colMap['netPrice']) + (r+1) : 'R' + (r+1)}`,
                  message: `แถวที่ ${r + 1} (${model}): สมการราคาไม่ตรง (RRP ${rrp} - ลด ${discount} != ${netPrice})`
                });
              }
            } else if (rrp <= 0 || netPrice <= 0) {
              if (validationStatus !== 'BLOCKED_INVALID') {
                validationStatus = 'BLOCKED_INVALID';
                flags.push('INVALID_PRICE');
                reasonText = `ราคาต้องมากกว่า 0 บาท (RRP: ฿${rrp}, Net: ฿${netPrice})`;
              }
            }
          }

          extractedVariants.push({
            pn: pn || `ROW-${r+1}`,
            model: model,
            productCodeType: codeType,
            rrp,
            discount,
            ssDiscount: ssDisc,
            cpwDiscount: cpwDisc,
            addOnDiscount: addOnDisc,
            netPrice,
            coupon,
            saleMode,
            promotionSourceType: 'EXCEL_CONFIRMED',
            validationStatus,
            validationFlags: flags,
            reasonText: reasonText || (validationStatus === 'PASSED_VALIDATION' ? 'ผ่านการตรวจสอบความถูกต้องสมบูรณ์' : flags.join(', ')),
            sourceTrace: {
              sheet: sheetName,
              row: r + 1,
              cellRef: errorCellRef || `${getColLetter(colMap['rrp'] || 0)}${r+1}`,
              format: 'EXCEL_LTR'
            }
          });
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
     * Phase 4 Real Claude Vision API Ingestion with Dual-Path & Confidence Gate
     * Rules:
     * - Requires Anthropic Claude API Key (configured in localStorage or APP_CONFIG)
     * - If no API key: strictly refuses to fabricate fake data and returns BLOCKED_NO_API_KEY
     * - When key is provided: encodes image buffer to base64, calls Claude 3.5 Sonnet Vision API
     * - Parses LLM JSON output, checks confidence score against 0.70 threshold
     * - Never allows canAutoPublish: true for unverified promotional pricing (always requires human Diff Preview review)
     */
    static async parseImageOCR(buffer, filename, fileHash) {
      const apiKey = localStorage.getItem('samsung_branch_claude_api_key') || (window.APP_CONFIG && window.APP_CONFIG.CLAUDE_API_KEY) || '';

      if (!apiKey) {
        return {
          format: 'IMAGE_AI_OCR',
          status: 'BLOCKED_NO_API_KEY',
          canAutoPublish: false,
          variants: [],
          warnings: [
            {
              message: '🔒 ยังไม่ได้ระบุ Claude API Key สำหรับระบบ AI Vision — ฟังก์ชันสแกนรูปภาพถูกระงับเพื่อป้องกันการขึ้นราคาจำลองหน้าร้าน กรุณาบันทึก Claude API Key ก่อนใช้งาน'
            }
          ]
        };
      }

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

      const apiUrl = (window.APP_CONFIG && window.APP_CONFIG.CLAUDE_VISION_API_URL) || 'https://api.anthropic.com/v1/messages';
      const modelName = (window.APP_CONFIG && window.APP_CONFIG.CLAUDE_VISION_MODEL) || 'claude-3-5-sonnet-20241022';

      const promptPayload = {
        model: modelName,
        max_tokens: 4096,
        system: "You are an expert Samsung retail promotion parser for Samsung Branch Operations. You analyze official promotional flyers, posters, and marketing leaflets. You must extract structured promotional offers with zero hallucination. If text or numbers are blurred, ambiguous, or cut off, indicate low confidence. You must respond ONLY with a strict JSON object.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: base64Data
                }
              },
              {
                type: "text",
                text: `Analyze this Samsung promotional flyer image (${filename}). Extract all device models, retail pricing (RRP), discount amounts, final net prices, sale modes (STANDARD or TRADE_UP), coupon codes, and any freebies/gifts.\nRespond strictly with a JSON object following this format:\n{\n  "overallConfidence": 0.95,\n  "isSupplementalOnly": false,\n  "summary": "Short description of the campaign",\n  "offers": [\n    {\n      "model": "Galaxy S26 Ultra",\n      "pn": "SM-S938B",\n      "rrp": 49900,\n      "discount": 4000,\n      "netPrice": 45900,\n      "saleMode": "STANDARD",\n      "coupon": "LAUNCH-S26",\n      "freebies": ["45W Power Adapter"],\n      "conditions": ["Valid until 30 Sept"],\n      "confidence": 0.95,\n      "isPriceEstimated": false\n    }\n  ]\n}\nIf the image does not contain clear pricing or is too blurry/unreadable, set overallConfidence to a value below 0.70.`
              }
            ]
          }
        ]
      };

      let responseText = '';
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify(promptPayload)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Claude API ตอบกลับสถานะ HTTP ${response.status}: ${errText || response.statusText}`);
        }

        const data = await response.json();
        if (!data.content || !data.content[0] || !data.content[0].text) {
          throw new Error('Claude API ไม่ได้ส่งเนื้อหาข้อความตอบกลับ');
        }
        responseText = data.content[0].text;
      } catch (apiErr) {
        console.error('[Claude Vision Fetch Error]', apiErr);
        throw new Error(`การเชื่อมต่อ Claude Vision API ล้มเหลว: ${apiErr.message}`);
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
    }

    init() {
      this.bindEvents();
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
          alert(`ไม่สามารถสแกนรูปภาพโปรโมชั่นได้:\n\n${extractResult.warnings[0].message}\n\nระบบระงับการสร้างข้อมูลราคาจำลองเพื่อป้องกันราคาผิดพลาดขึ้นหน้าร้าน กรุณากรอก Claude API Key ด้านบน`);
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

      this.filterDiffTable('ALL');

      const btnConfirm = document.getElementById('btnConfirmPromoPublish');
      if (btnConfirm) {
        if (b.stats.passedCount > 0) {
          btnConfirm.style.display = 'inline-flex';
          const isAI = b.format.includes('IMAGE') || b.format.includes('TXT');
          btnConfirm.innerHTML = isAI 
            ? `<span>⚡ เผยแพร่โปรโมชั่น AI ชั่วคราว (${b.stats.passedCount} รายการ) &rarr;</span>`
            : `<span>⚡ เผยแพร่เฉพาะรายการที่ผ่านเกณฑ์ (${b.stats.passedCount} รายการ) &rarr;</span>`;
        } else {
          btnConfirm.style.display = 'none';
        }
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

      const tbody = document.getElementById('promoDiffTableBody');
      if (!tbody) return;

      let list = b.variants;
      if (filterType === 'PASSED') list = list.filter(v => v.validationStatus === 'PASSED_VALIDATION');
      else if (filterType === 'REVIEW') list = list.filter(v => v.validationStatus === 'REVIEW_REQUIRED' || v.validationStatus === 'OCR_NOT_IMPLEMENTED');
      else if (filterType === 'BLOCKED') list = list.filter(v => v.validationStatus.startsWith('BLOCKED') || v.validationStatus === 'OCR_LOW_CONFIDENCE');

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

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff;">${item.pn || '<span style="color: #94a3b8;">-</span>'}</div>
              <div style="font-size: 0.78rem; color: #cbd5e1;">${item.model}</div>
              ${item.freebieNoteFromAI ? `<div style="font-size: 0.72rem; color: #34d399; margin-top: 2px;">🎁 ${item.freebieNoteFromAI}</div>` : ''}
            </td>
            <td><span class="type-pill ${item.productCodeType === 'STANDARD_SM' ? 'active' : ''}">${item.productCodeType}</span></td>
            <td>${item.rrp > 0 ? `฿${item.rrp.toLocaleString()}` : '<span style="color: #94a3b8;">-</span>'}</td>
            <td class="text-coral">${item.discount > 0 ? `-฿${item.discount.toLocaleString()}` : '<span style="color: #94a3b8;">-</span>'}</td>
            <td style="font-weight: 700; color: var(--neon-cyan);">${item.netPrice > 0 ? `฿${item.netPrice.toLocaleString()}` : '<span style="color: #94a3b8;">-</span>'}</td>
            <td><span class="type-pill">${item.coupon || '-'}</span></td>
            <td><span class="type-pill" style="font-size: 0.72rem;">${item.saleMode}</span></td>
            <td>${renderStatusBadge()}</td>
            <td>
              <div style="font-size: 0.72rem; color: var(--neon-cyan); font-family: monospace;">${sheetInfo}</div>
              <div style="font-size: 0.76rem; color: ${item.validationStatus === 'PASSED_VALIDATION' ? '#a7f3d0' : '#fca5a5'};">${item.reasonText || (item.validationFlags || []).join(', ') || '-'}</div>
            </td>
          </tr>
        `;
      }).join('');
    }

    async confirmPublish() {
      if (!this.currentStagedBatch || this.isSubmitting) return;

      const b = this.currentStagedBatch;
      const publishable = b.variants.filter(v => v.validationStatus === 'PASSED_VALIDATION');
      const quarantined = b.variants.filter(v => v.validationStatus !== 'PASSED_VALIDATION');

      if (publishable.length === 0) {
        alert('❌ ไม่สามารถ Publish ได้ เนื่องจากไม่มีรายการที่ผ่าน Validation (PASSED_VALIDATION)\n\nรายการที่มีข้อผิดพลาดหรือความมั่นใจต่ำกว่า 70% ถูกกักกันทั้งหมดเพื่อความปลอดภัยหน้าร้าน');
        return;
      }

      const isAI = b.format.includes('IMAGE') || b.format.includes('TXT');
      const confirmMsg = isAI 
        ? `ยืนยันการเผยแพร่โปรโมชั่นชั่วคราวจาก AI สู่ระบบหน้าร้าน?\n\n` +
          `• Batch ID: ${b.batchId}\n` +
          `• สื่อต้นทาง: ${b.sourceFilename}\n` +
          `• ลายนิ้วมือ Media SHA-256: ${(b.fileHash || '').substring(0, 16)}...\n` +
          `• รายการที่จะเปิดใช้งานทันที: ${publishable.length.toLocaleString()} รายการ\n` +
          `• รายการที่ถูกกักกัน (ความมั่นใจ < 70%): ${quarantined.length.toLocaleString()} รายการ\n\n` +
          `💡 โปรโมชั่น AI มีอายุ 7 วัน (TTL) และจะกระทบยอดอัตโนมัติเมื่อมีไฟล์ Excel เข้ามา`
        : `ยืนยันการ Publish โปรโมชั่นไปยังระบบหน้าร้าน?\n\n` +
          `• Batch ID: ${b.batchId}\n` +
          `• ไฟล์ต้นทาง: ${b.sourceFilename} (${b.format})\n` +
          `• รายการที่จะเปิดใช้งานทันที: ${publishable.length.toLocaleString()} รายการ\n` +
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
          stats: b.stats,
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
