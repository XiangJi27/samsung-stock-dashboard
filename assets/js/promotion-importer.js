/**
 * Samsung Branch Operations - Promotion Import Center
 * Client-Side Excel Staging & Quality Gate Engine (Phase 3)
 * 
 * Rules & Contract:
 * - Multi-Sheet & Tabular scanning: Iterates all promotion sheets.
 * - Formula Error Isolation: Detects #ERROR!, #REF!, #VALUE!, etc. and quarantines row with exact cell provenance.
 * - Add-on Purchase Equation: Validates expectedNet = rrp - (ssDiscount + cpwDiscount) for ADD_ON_PURCHASE.
 * - Standard Equation: Validates netPrice = rrp - discount.
 * - Selective Publishing: Allows publishing only PASSED_VALIDATION items while keeping BLOCKED items quarantined.
 * - Cross-Device Sync Bridge: Export/Import JSON with Stale Overwrite Protection (Anti-Silent Data Loss).
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

    static async saveBatch(batchRecord) {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_BATCHES, STORE_CURRENT], 'readwrite');
        const batchStore = tx.objectStore(STORE_BATCHES);
        const currentStore = tx.objectStore(STORE_CURRENT);

        batchStore.put(batchRecord);
        currentStore.put({
          key: 'active',
          batchId: batchRecord.batchId,
          publishedItems: batchRecord.publishedItems || [],
          quarantinedItems: batchRecord.quarantinedItems || [],
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
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
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

        // Add-on sheet detection heuristic
        const isAddonSheet = sheetName.includes('50-70%') || sheetName.includes('แลกซื้อ') || colMap['addOnDiscount'] !== undefined || (colMap['ssDiscount'] !== undefined && colMap['cpwDiscount'] !== undefined);

        // Scan rows
        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;

          // Helper to get Col letter
          const getColLetter = (cIdx) => {
            return String.fromCharCode(65 + (cIdx % 26));
          };

          // Raw cell values & formula error check
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

          // Skip empty row
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

          // If add-on purchase, discount comes from ss + cpw / addOnDiscount
          if (saleMode === 'ADD_ON_PURCHASE' && addOnDisc > 0) {
            discount = addOnDisc;
          }

          // Product code type
          let codeType = 'UNKNOWN';
          if (pn.startsWith('F-')) codeType = 'PASS_F';
          else if (pn.startsWith('SM-')) codeType = 'STANDARD_SM';
          else if (pn.startsWith('EP-') || pn.startsWith('EF-') || pn.startsWith('GP-') || pn.startsWith('EE-')) codeType = 'STANDARD_ACCESSORY';

          // Validation Gate Evaluation
          let validationStatus = 'PASSED_VALIDATION';
          const flags = [];
          let reasonText = '';

          // 1. Formula Error Gate
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

          // 2. Exact P/N Gate
          if (!pn && validationStatus !== 'BLOCKED_INVALID') {
            flags.push('PN_MISSING_MODEL_ONLY');
            reasonText = 'ไม่พบรหัสสินค้า P/N (มีเฉพาะชื่อรุ่น)';
          }

          // 3. Price Equations Gate
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
            // Standard equation check
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

    static async parseImageOCR(buffer, filename) {
      const draftItem = {
        pn: 'IMAGE_OCR_PENDING',
        model: `รูปภาพ: ${filename}`,
        productCodeType: 'UNKNOWN',
        rrp: 0,
        discount: 0,
        netPrice: 0,
        coupon: '',
        saleMode: 'MANUAL_ENTRY_REQUIRED',
        validationStatus: 'OCR_NOT_IMPLEMENTED',
        validationFlags: ['FILE_ACCEPTED_OCR_PENDING', 'OCR_NOT_IMPLEMENTED', 'HUMAN_ENTRY_MANDATORY'],
        reasonText: 'ภาพถ่ายโปรโมชั่น: ต้องผ่านการตรวจสอบโดยมนุษย์ (ยังไม่สามารถ Publish อัตโนมัติ)',
        ocrMeta: {
          status: 'OCR_NOT_IMPLEMENTED',
          label: 'FILE_ACCEPTED_OCR_PENDING',
          canAutoPublish: false,
          sourceImage: filename,
          message: 'รองรับการรับไฟล์รูปภาพ แต่ยังไม่สามารถอ่านข้อความอัตโนมัติ'
        },
        sourceTrace: {
          format: 'IMAGE_DROPZONE',
          sourceFile: filename
        }
      };

      return {
        format: 'IMAGE_DROPZONE',
        status: 'OCR_NOT_IMPLEMENTED',
        canAutoPublish: false,
        variants: [draftItem],
        warnings: [{ message: 'รูปภาพยังไม่สามารถแปลงเป็นตารางราคาอัตโนมัติได้ ต้องตรวจทานด้วยตนเอง' }]
      };
    }

    static parseTxtRule(buffer, filename) {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      const variants = [];
      const warnings = [];

      lines.forEach((line, idx) => {
        const tradeMatch = line.match(/([A-Za-z0-9\s]+?)\s+(Trade\s*Up|ส่วนลด|ลด)\s*([\d,]+)\s*(?:เหลือ|สุทธิ)\s*([\d,]+)/i);
        const passFMatch = line.match(/พาส\s*F\s*ได้\s*(.+)/i);

        if (tradeMatch) {
          const model = tradeMatch[1].trim();
          const discount = Number(tradeMatch[3].replace(/,/g, ''));
          const net = Number(tradeMatch[4].replace(/,/g, ''));
          variants.push({
            pn: `TXT-RULE-${idx+1}`,
            model: model,
            productCodeType: 'UNKNOWN',
            rrp: net + discount,
            discount: discount,
            netPrice: net,
            coupon: '',
            saleMode: 'TRADE_UP',
            validationStatus: 'REVIEW_REQUIRED',
            validationFlags: ['BRANCH_RULE_DRAFT', 'STORE_MANAGER_CONFIRMATION_REQUIRED'],
            reasonText: 'กฎจากไฟล์ TXT: ต้องผ่านการตรวจทานและติ๊กรับรองโดยผู้จัดการสาขา',
            sourceTrace: { format: 'TXT_RULE', line: idx + 1, rawText: line }
          });
        } else if (passFMatch) {
          variants.push({
            pn: `TXT-PASS-F-${idx+1}`,
            model: 'All Pass F Models',
            productCodeType: 'PASS_F',
            rrp: 0,
            discount: 0,
            netPrice: 0,
            coupon: '',
            saleMode: 'PASS_F',
            giftDesc: passFMatch[1].trim(),
            validationStatus: 'REVIEW_REQUIRED',
            validationFlags: ['BRANCH_RULE_DRAFT', 'GIFT_RULE'],
            reasonText: 'เงื่อนไขของแถมพาส F: ต้องผ่านการตรวจทานโดยผู้จัดการสาขา',
            sourceTrace: { format: 'TXT_RULE', line: idx + 1, rawText: line }
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
            validationStatus: 'REVIEW_REQUIRED',
            validationFlags: ['BRANCH_RULE_DRAFT', 'UNSTRUCTURED_RULE'],
            reasonText: 'ข้อความเงื่อนไขทั่วไป: รอการยืนยันรูปแบบ',
            sourceTrace: { format: 'TXT_RULE', line: idx + 1, rawText: line }
          });
        }
      });

      return {
        format: 'TXT_RULE',
        status: 'REVIEW_REQUIRED',
        canAutoPublish: false,
        variants,
        warnings: [{ message: 'ข้อมูลจากไฟล์ข้อความ TXT ต้องได้รับการรับรองจากผู้จัดการสาขาก่อน Publish' }]
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

      // Filter tabs in Diff preview
      const filterBtns = document.querySelectorAll('.promo-tab-filter');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.filterDiffTable(btn.getAttribute('data-filter'));
        });
      });

      // Confirm Import Button
      const btnConfirm = document.getElementById('btnConfirmPromoPublish');
      if (btnConfirm) {
        btnConfirm.addEventListener('click', () => this.confirmPublish());
      }

      // Cancel Button
      const btnCancel = document.getElementById('btnCancelPromoImport');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => this.resetStaging());
      }

      // Cross-Device Sync Buttons
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

        // Stale Overwrite Protection (Anti-Silent Data Loss)
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
          extractResult = await MultiFormatExtractor.parseImageOCR(fileMeta.buffer, file.name);
        } else if (fileMeta.ext === 'txt') {
          extractResult = MultiFormatExtractor.parseTxtRule(fileMeta.buffer, file.name);
        }

        const batchId = `PROMO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        // Compute validation summary
        let passedCount = 0;
        let reviewCount = 0;
        let blockedCount = 0;

        extractResult.variants.forEach(v => {
          if (v.validationStatus === 'PASSED_VALIDATION') passedCount++;
          else if (v.validationStatus === 'REVIEW_REQUIRED') reviewCount++;
          else blockedCount++;
        });

        this.currentStagedBatch = {
          batchId,
          sourceFilename: file.name,
          fileHash: fileMeta.fileHash,
          format: extractResult.format,
          canAutoPublish: extractResult.canAutoPublish !== false,
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
        if (statusEl) statusEl.innerHTML = `<span class="text-emerald">✓ ผ่านการตรวจสอบความปลอดภัยและโครงสร้างไฟล์ พร้อมดู Preview Diff</span>`;
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

      // Human-friendly Validation Warning Box
      const warningBanner = document.getElementById('promoValidationWarningBanner');
      if (warningBanner) {
        const warnings = b.warnings || [];
        const blockedItems = b.variants.filter(v => v.validationStatus !== 'PASSED_VALIDATION');
        
        if (blockedItems.length > 0 || warnings.length > 0) {
          warningBanner.classList.remove('hidden');
          const sampleIssues = blockedItems.slice(0, 5);
          const moreCount = blockedItems.length - sampleIssues.length;

          warningBanner.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; color: #fbbf24;">
              <span>🛡️ สรุปผลการคัดกรองความเสี่ยงโปรโมชั่น (${blockedItems.length} รายการถูกกักกัน):</span>
            </div>
            <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; line-height: 1.6; color: #fde68a;">
              ${sampleIssues.map(item => `
                <li>
                  <strong>${item.model}</strong> (${item.sourceTrace.sheet || 'Excel'}!${item.sourceTrace.cellRef || ('แถว ' + item.sourceTrace.row)}): 
                  <span style="color: #fca5a5;">${item.reasonText || item.validationFlags.join(', ')}</span>
                </li>
              `).join('')}
              ${moreCount > 0 ? `<li>...และอีก ${moreCount} รายการที่ถูกกักกัน (ดูรายละเอียดในแท็บ "ถูกกักกัน")</li>` : ''}
            </ul>
            <div style="margin-top: 10px; font-size: 0.82rem; color: #cbd5e1; border-top: 1px dashed rgba(251, 191, 36, 0.3); padding-top: 8px;">
              💡 <strong>Triple Safety Net:</strong> ระบบจะกักกันเฉพาะรายการที่มีข้อผิดพลาดไว้ โดยคุณสามารถกด <em>"ยืนยันการเผยแพร่"</em> เพื่อนำเข้ารายการที่ถูกต้อง (${b.stats.passedCount} รายการ) สู่ระบบหน้าร้านได้อย่างปลอดภัย
            </div>
          `;
        } else {
          warningBanner.classList.add('hidden');
          warningBanner.innerHTML = '';
        }
      }

      this.filterDiffTable('ALL');

      // UI Handling for Image vs TXT vs Excel
      const btnConfirm = document.getElementById('btnConfirmPromoPublish');
      const isImage = b.format === 'IMAGE_DROPZONE' || b.variants.some(v => v.validationStatus === 'OCR_NOT_IMPLEMENTED');
      if (isImage) {
        if (btnConfirm) btnConfirm.style.display = 'none';
        const uploadStatusEl = document.getElementById('promoUploadStatus');
        if (uploadStatusEl) {
          uploadStatusEl.innerHTML = `
            <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; color: #fde68a; margin-top: 10px;">
              📷 <strong>รองรับการรับไฟล์รูปภาพ แต่ยังไม่สามารถอ่านข้อความอัตโนมัติ</strong><br>
              <span style="font-size: 0.8rem; color: #cbd5e1;">(สถานะ: OCR_NOT_IMPLEMENTED • นโยบายความปลอดภัยระงับการ Publish รูปภาพเข้า Master โดยอัตโนมัติ)</span>
            </div>
          `;
        }
      } else {
        if (btnConfirm) {
          btnConfirm.style.display = 'inline-flex';
          btnConfirm.innerHTML = `<span>⚡ เผยแพร่เฉพาะรายการที่ผ่านเกณฑ์ (${b.stats.passedCount} รายการ) &rarr;</span>`;
        }
      }

      // Update Stepper
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

      const isTxt = b.format === 'TXT_RULE';
      const txtReviewBanner = isTxt ? `
        <tr>
          <td colspan="9" style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); padding: 12px 16px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #e2e8f0; font-size: 0.88rem;">
              <input type="checkbox" id="chkTxtManagerReview" style="width: 18px; height: 18px;">
              <span><strong>ผู้จัดการสาขาตรวจทานความถูกต้องแล้ว (Branch Manager Review & Syntax Verification)</strong></span>
            </label>
          </td>
        </tr>
      ` : '';

      tbody.innerHTML = txtReviewBanner + list.map(item => {
        const renderStatusBadge = (st) => {
          if (st === 'PASSED_VALIDATION') return `<span class="status-badge-gate pass">🟢 ผ่านเกณฑ์</span>`;
          if (st === 'REVIEW_REQUIRED') return `<span class="status-badge-gate review">🟡 ต้องตรวจ</span>`;
          if (st === 'OCR_NOT_IMPLEMENTED') return `<span class="status-badge-gate" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid #f59e0b;">📷 OCR PENDING</span>`;
          return `<span class="status-badge-gate blocked">🔴 กักกัน (${st.replace('BLOCKED_', '')})</span>`;
        };

        const sheetInfo = item.sourceTrace ? `${item.sourceTrace.sheet || 'Excel'}!${item.sourceTrace.cellRef || ('แถว ' + item.sourceTrace.row)}` : '-';

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff;">${item.pn || '<span style="color: #94a3b8;">-</span>'}</div>
              <div style="font-size: 0.78rem; color: #cbd5e1;">${item.model}</div>
            </td>
            <td><span class="type-pill ${item.productCodeType === 'STANDARD_SM' ? 'active' : ''}">${item.productCodeType}</span></td>
            <td>฿${item.rrp.toLocaleString()}</td>
            <td class="text-coral">-฿${item.discount.toLocaleString()}</td>
            <td style="font-weight: 700; color: var(--neon-cyan);">฿${item.netPrice.toLocaleString()}</td>
            <td><span class="type-pill">${item.coupon || '-'}</span></td>
            <td><span class="type-pill" style="font-size: 0.72rem;">${item.saleMode}</span></td>
            <td>${renderStatusBadge(item.validationStatus)}</td>
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

      // Check Image OCR Hard Rule: NEVER AUTO-PUBLISH
      if (b.format === 'IMAGE_DROPZONE' || b.variants.some(v => v.validationStatus === 'OCR_NOT_IMPLEMENTED')) {
        alert('❌ นโยบายความปลอดภัย: ระบบไม่อนุญาตให้ Publish ข้อมูลจากรูปภาพเข้า Master เนื่องจากยังไม่มี OCR Engine ในตัว (OCR_NOT_IMPLEMENTED)');
        return;
      }

      // Check TXT Manager Review Requirement
      if (b.format === 'TXT_RULE') {
        const chk = document.getElementById('chkTxtManagerReview');
        if (!chk || !chk.checked) {
          alert('⚠️ รายการจาก TXT (BRANCH_RULE_DRAFT) ต้องได้รับการตรวจทานและติ๊กรับรองโดยผู้จัดการสาขาก่อนเผยแพร่');
          return;
        }
      }

      // Filter publishable vs quarantined
      const publishable = b.variants.filter(v => v.validationStatus === 'PASSED_VALIDATION');
      const quarantined = b.variants.filter(v => v.validationStatus !== 'PASSED_VALIDATION');

      if (publishable.length === 0) {
        alert('❌ ไม่สามารถ Publish ได้ เนื่องจากไม่มีรายการที่ผ่าน Validation (PASSED_VALIDATION)\n\nรายการที่มีข้อผิดพลาดถูกกักกันทั้งหมดเพื่อความปลอดภัยหน้าร้าน');
        return;
      }

      const confirmMsg = `ยืนยันการ Publish โปรโมชั่นไปยังระบบหน้าร้าน?\n\n` +
        `• Batch ID: ${b.batchId}\n` +
        `• ไฟล์ต้นทาง: ${b.sourceFilename} (${b.format})\n` +
        `• รายการที่จะเปิดใช้งานทันที: ${publishable.length.toLocaleString()} รายการ\n` +
        `• รายการที่ถูกกักกัน (Quarantined): ${quarantined.length.toLocaleString()} รายการ\n\n` +
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

        // Update runtime in-memory state
        window.PROMOTION_VARIANTS = publishable;
        window.PROMOTION_BATCH_METADATA = batchRecord.meta;

        // Advance stepper to Step 5
        const stepItems = document.querySelectorAll('#promoStepper .step-item');
        if (stepItems[3]) stepItems[3].className = 'step-item completed';
        if (stepItems[4]) stepItems[4].className = 'step-item active';

        // Refresh views
        if (window.renderPromotionsView) {
          window.renderPromotionsView();
        }

        alert(`✓ Publish โปรโมชั่นสำเร็จ!\n\n` +
          `• Batch ID: ${b.batchId}\n` +
          `• เปิดใช้งานแล้ว: ${publishable.length.toLocaleString()} รายการ\n` +
          `• รายการที่ถูกกักกันความเสี่ยง: ${quarantined.length.toLocaleString()} รายการ\n` +
          `• พร้อมใช้งานบนหน้าขายหน้าร้านทันที`);

        // Navigate to Promotions view
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
          btnConfirm.innerHTML = '<span>⚡ เผยแพร่เฉพาะรายการที่ผ่านเกณฑ์ &rarr;</span>';
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
