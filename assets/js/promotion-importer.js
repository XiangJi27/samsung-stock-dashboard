/**
 * Samsung Branch Operations - Promotion Import Center
 * Multi-Format Staging & Quality Gate Engine
 * 
 * Supports:
 * 1. Excel (.xlsx) - High automation via Header-Guided Left-to-Right Parser
 * 2. Images (.png, .jpg, .jpeg, .webp) - Draft via OCR (DRAFT_FROM_OCR, Human Review Required)
 * 3. Text (.txt) - Rule interpretation (BRANCH_RULE_DRAFT, Rule Engine clearance required)
 * 
 * Flow:
 * Upload -> Extract -> Preview Diff -> Validate -> Confirm & Publish -> Rollback
 * Storage: IndexedDB (LOCAL_BROWSER_ONLY)
 */

(function() {
  'use strict';

  const DB_NAME = 'SamsungBranchPromoImportDb_v1';
  const DB_VERSION = 1;
  const STORE_BATCHES = 'promo_import_batches';

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
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    static async saveBatch(batchRecord) {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BATCHES, 'readwrite');
        const store = tx.objectStore(STORE_BATCHES);
        store.put(batchRecord);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    static async getAllBatches() {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BATCHES, 'readonly');
        const store = tx.objectStore(STORE_BATCHES);
        const req = store.getAll();
        req.onsuccess = () => {
          const res = (req.result || []).sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
          resolve(res);
        };
        req.onerror = () => reject(req.error);
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
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!rows || rows.length < 2) {
        throw new Error('ไม่พบข้อมูลแถวในชีตแรกของไฟล์ Excel');
      }

      // Detect Header Row
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const rStr = rows[i].map(c => String(c).trim().toUpperCase()).join(' ');
        if (rStr.includes('P/N') || rStr.includes('MODEL') || rStr.includes('RRP') || rStr.includes('ราคา')) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) headerIdx = 0;
      const headers = rows[headerIdx].map(h => String(h).trim().toUpperCase());

      // Column mapping
      const colMap = {};
      headers.forEach((h, idx) => {
        if (h.includes('P/N') || h === 'PN' || h.includes('SKU')) colMap['pn'] = idx;
        else if (h.includes('MODEL') || h.includes('รุ่น')) colMap['model'] = idx;
        else if (h.includes('RRP') || h.includes('ราคาปกติ') || h.includes('ราคาป้าย')) colMap['rrp'] = idx;
        else if (h.includes('DISCOUNT') || h.includes('ส่วนลด') || h.includes('ลด')) colMap['discount'] = idx;
        else if (h.includes('NET') || h.includes('สุทธิ') || h.includes('ราคาขาย')) colMap['netPrice'] = idx;
        else if (h.includes('COUPON') || h.includes('คูปอง')) colMap['coupon'] = idx;
        else if (h.includes('MODE') || h.includes('แคมเปญ')) colMap['saleMode'] = idx;
      });

      const extractedVariants = [];

      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const pn = colMap['pn'] !== undefined ? String(row[colMap['pn']]).trim().toUpperCase() : '';
        const model = colMap['model'] !== undefined ? String(row[colMap['model']]).trim() : '';

        if (!pn && !model) continue;

        const rrp = colMap['rrp'] !== undefined ? Number(String(row[colMap['rrp']]).replace(/,/g, '')) || 0 : 0;
        const discount = colMap['discount'] !== undefined ? Number(String(row[colMap['discount']]).replace(/,/g, '')) || 0 : 0;
        let netPrice = colMap['netPrice'] !== undefined ? Number(String(row[colMap['netPrice']]).replace(/,/g, '')) || 0 : (rrp - discount);
        const coupon = colMap['coupon'] !== undefined ? String(row[colMap['coupon']]).trim() : '';
        const saleMode = colMap['saleMode'] !== undefined ? String(row[colMap['saleMode']]).trim() : 'STANDARD';

        // Product code type
        let codeType = 'UNKNOWN';
        if (pn.startsWith('F-')) codeType = 'PASS_F';
        else if (pn.startsWith('SM-')) codeType = 'STANDARD_SM';
        else if (pn.startsWith('EP-') || pn.startsWith('EF-') || pn.startsWith('GP-')) codeType = 'STANDARD_ACCESSORY';

        // Validation gate
        let validationStatus = 'PASSED_VALIDATION';
        const flags = [];

        if (!pn) {
          validationStatus = 'BLOCKED_INVALID';
          flags.push('PN_MISSING');
        } else if (codeType === 'UNKNOWN') {
          validationStatus = 'BLOCKED_UNPROVEN';
          flags.push('UNKNOWN_PRODUCT_TYPE');
        }

        const isEquationValid = (rrp - discount) === netPrice;
        if (!isEquationValid && rrp > 0 && discount > 0) {
          validationStatus = 'BLOCKED_INVALID';
          flags.push('PRICE_EQUATION_ERROR');
        }

        if (rrp <= 0 || netPrice <= 0) {
          validationStatus = 'BLOCKED_INVALID';
          flags.push('INVALID_PRICE');
        }

        extractedVariants.push({
          pn: pn || `ROW-${r+1}`,
          model: model || pn,
          productCodeType: codeType,
          rrp,
          discount,
          netPrice,
          coupon,
          saleMode: saleMode || 'STANDARD',
          validationStatus,
          validationFlags: flags,
          sourceTrace: {
            sheet: firstSheetName,
            row: r + 1,
            format: 'EXCEL_LTR'
          }
        });
      }

      return {
        format: 'EXCEL',
        status: 'DRAFT_READY',
        variants: extractedVariants
      };
    }

    static async parseImageOCR(buffer, filename) {
      // Architectural Reality: No real client OCR engine (Tesseract WASM or Vision API) is bundled.
      // Images are held in FILE_ACCEPTED_OCR_PENDING / OCR_NOT_IMPLEMENTED.
      // Auto-publish is strictly prohibited.
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
        variants: [draftItem]
      };
    }

    static parseTxtRule(buffer, filename) {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      const variants = [];

      lines.forEach((line, idx) => {
        // Natural language pattern extraction
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
            sourceTrace: { format: 'TXT_RULE', line: idx + 1, rawText: line }
          });
        }
      });

      return {
        format: 'TXT_RULE',
        status: 'REVIEW_REQUIRED',
        canAutoPublish: false,
        variants
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

        const batchId = `PROMO-BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
          stats: {
            totalVariants: extractResult.variants.length,
            passedCount,
            reviewCount,
            blockedCount
          },
          importedAt: new Date().toISOString()
        };

        this.renderPreview();
        if (statusEl) statusEl.innerHTML = `<span class="text-emerald">✓ ผ่านการตรวจสอบความปลอดภัย พร้อมดู Preview Diff</span>`;
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
        if (btnConfirm) btnConfirm.style.display = 'inline-flex';
      }

      // Update Stepper
      const stepItems = document.querySelectorAll('#promoStepper .step-item');
      if (stepItems[0]) stepItems[0].className = 'step-item completed';
      if (stepItems[1]) stepItems[1].className = 'step-item completed';
      if (stepItems[2]) stepItems[2].className = 'step-item active';

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
          if (st === 'PASSED_VALIDATION') return `<span class="status-badge-gate pass">🟢 ผ่านกฎ</span>`;
          if (st === 'REVIEW_REQUIRED') return `<span class="status-badge-gate review">🟡 ต้องตรวจ</span>`;
          if (st === 'OCR_NOT_IMPLEMENTED') return `<span class="status-badge-gate" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid #f59e0b;">📷 OCR_NOT_IMPLEMENTED</span>`;
          return `<span class="status-badge-gate blocked">🔴 บล็อก (${st})</span>`;
        };

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff;">${item.pn}</div>
              <div style="font-size: 0.76rem; color: #94a3b8;">${item.model}</div>
            </td>
            <td><span class="type-pill ${item.productCodeType === 'STANDARD_SM' ? 'active' : ''}">${item.productCodeType}</span></td>
            <td>฿${item.rrp.toLocaleString()}</td>
            <td class="text-coral">-฿${item.discount.toLocaleString()}</td>
            <td style="font-weight: 700; color: var(--neon-cyan);">฿${item.netPrice.toLocaleString()}</td>
            <td><span class="type-pill">${item.coupon || '-'}</span></td>
            <td><span class="type-pill">${item.saleMode}</span></td>
            <td>${renderStatusBadge(item.validationStatus)}</td>
            <td style="font-size: 0.74rem; color: #94a3b8;">${(item.validationFlags || []).join(', ') || '-'}</td>
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

      // Filter publishable
      const publishable = b.variants.filter(v => v.validationStatus === 'PASSED_VALIDATION');
      const quarantined = b.variants.filter(v => v.validationStatus !== 'PASSED_VALIDATION');

      if (publishable.length === 0) {
        alert('❌ ไม่สามารถ Publish ได้ เนื่องจากไม่มีรายการที่ผ่าน Validation (PASSED_VALIDATION)\n\nรายการจาก Image OCR หรือ TXT ต้องผ่านการตรวจสอบโดยมนุษย์ก่อน');
        return;
      }

      const confirmMsg = `ยืนยันการ Publish โปรโมชั่นไปยังระบบ?\n\n- Batch ID: ${b.batchId}\n- ไฟล์ต้นทาง: ${b.sourceFilename} (${b.format})\n- รายการที่จะ Publish: ${publishable.length} รายการ\n- รายการที่ถูกกักกัน (Blocked/Review): ${quarantined.length} รายการ\n\nระบบจะบันทึกในเครื่องนี้ (LOCAL_BROWSER_ONLY)`;

      if (!confirm(confirmMsg)) return;

      this.isSubmitting = true;
      const btnConfirm = document.getElementById('btnConfirmPromoPublish');
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<span>⏳ กำลัง Publish...</span>';
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
          status: quarantined.length > 0 ? 'PARTIALLY_PUBLISHED' : 'PUBLISHED'
        };

        await PromoStorageAdapter.saveBatch(batchRecord);

        alert(`✓ Publish โปรโมชั่นสำเร็จ!\nBatch ID: ${b.batchId}\nเปิดใช้งานแล้ว: ${publishable.length} รายการ\nกักกัน: ${quarantined.length} รายการ`);

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
          btnConfirm.innerHTML = '<span>⚡ ยืนยันการเผยแพร่ (Confirm & Publish)</span>';
        }
      }
    }

    resetStaging() {
      this.currentStagedBatch = null;
      const previewSec = document.getElementById('promoPreviewSection');
      if (previewSec) previewSec.classList.add('hidden');

      const statusEl = document.getElementById('promoUploadStatus');
      if (statusEl) statusEl.innerHTML = '';

      const fileInput = document.getElementById('promoCenterFileInput');
      if (fileInput) fileInput.value = '';

      const stepItems = document.querySelectorAll('#promoStepper .step-item');
      if (stepItems[0]) stepItems[0].className = 'step-item active';
      if (stepItems[1]) stepItems[1].className = 'step-item';
      if (stepItems[2]) stepItems[2].className = 'step-item';
    }
  }

  window.PromotionImportController = new PromotionImportController();
  window.PromoStorageAdapter = PromoStorageAdapter;

  document.addEventListener('DOMContentLoaded', () => {
    window.PromotionImportController.init();
  });
})();
