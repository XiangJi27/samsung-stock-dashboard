/**
 * Samsung Branch Operations - Stock Import Center
 * Client-Side Excel Snapshot Ingestion Engine
 * 
 * Rules & Contract:
 * - Source: Manual Excel (.xlsx) upload (Sheet1 = ชั้น 1 / f1, Sheet2 = ชั้น 2 / f2)
 * - Match Key: Exact P/N (trimmed, uppercase, no description fallback)
 * - Quantity: ONLY 'On Hand' column. (On B/R, On Alloc, On T/F are metadata only)
 * - Full Outer Join of Sheet1 & Sheet2 (total = f1 + f2)
 * - Price 99 is stockReferencePrice only; NEVER overwrites promotion prices.
 * - Storage: IndexedDB Draft Store (LOCAL_BROWSER_ONLY)
 * - Rollback: Multi-batch history with instantaneous snapshot restoration.
 */

(function() {
  'use strict';

  const DB_NAME = 'SamsungBranchStockDb_v1';
  const DB_VERSION = 1;
  const STORE_BATCHES = 'stock_batches';
  const STORE_CURRENT = 'stock_current_snapshot';

  class StockStorageAdapter {
    static async getDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_BATCHES)) {
            const batchStore = db.createObjectStore(STORE_BATCHES, { keyPath: 'batchId' });
            batchStore.createIndex('importedAt', 'importedAt', { unique: false });
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
        currentStore.put({ key: 'active', batchId: batchRecord.batchId, data: batchRecord.data, meta: batchRecord.meta });

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
          const res = (req.result || []).sort((a, b) => new Date(b.meta.importedAt) - new Date(a.meta.importedAt));
          resolve(res);
        };
        req.onerror = () => reject(req.error);
      });
    }

    static async getBatchById(batchId) {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BATCHES, 'readonly');
        const store = tx.objectStore(STORE_BATCHES);
        const req = store.get(batchId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    static validateSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') {
        return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: 'Snapshot ไม่ใช่ Object ที่ถูกต้อง' };
      }
      if (!snapshot.batchId || typeof snapshot.batchId !== 'string') {
        return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: 'ไม่พบ Batch ID หรือรูปแบบไม่ถูกต้อง' };
      }
      const meta = snapshot.meta;
      if (!meta || typeof meta !== 'object') {
        return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: 'ไม่พบ Metadata ประจำ Snapshot' };
      }
      if (!meta.schemaVersion || !String(meta.schemaVersion).startsWith('2.')) {
        return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: `Schema version (${meta.schemaVersion || 'none'}) ไม่รองรับ ต้องเป็น 2.x` };
      }
      if (!meta.importedAt) {
        return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: 'ไม่พบวันที่นำเข้า (importedAt)' };
      }
      if (!meta.sourceFileHash) {
        return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: 'ไม่พบ Source File Hash' };
      }
      if (typeof meta.grandTotal === 'number' && typeof meta.f1Total === 'number' && typeof meta.f2Total === 'number') {
        if (meta.grandTotal !== (meta.f1Total + meta.f2Total)) {
          return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: `Metadata grandTotal != f1Total + f2Total (${meta.grandTotal} != ${meta.f1Total}+${meta.f2Total})` };
        }
      }
      if (!Array.isArray(snapshot.data) || snapshot.data.length === 0) {
        return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: 'ข้อมูลสต็อกว่างเปล่าหรือไม่ใช่อาร์เรย์' };
      }

      // Validate records integrity
      const pnSet = new Set();
      for (let i = 0; i < snapshot.data.length; i++) {
        const item = snapshot.data[i];
        if (!item || !item.pn) {
          return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: `แถวที่ ${i + 1} ไม่มีรหัส P/N` };
        }
        if (pnSet.has(item.pn)) {
          return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: `พบรหัส P/N ซ้ำซ้อนใน Snapshot: ${item.pn}` };
        }
        pnSet.add(item.pn);

        const f1 = Number(item.f1);
        const f2 = Number(item.f2);
        const total = Number(item.total);
        if (isNaN(f1) || isNaN(f2) || isNaN(total) || f1 < 0 || f2 < 0) {
          return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: `ยอด On Hand ไม่ใช่ตัวเลขที่ถูกต้องที่ SKU ${item.pn}` };
        }
        if (total !== (f1 + f2)) {
          return { valid: false, errorCode: 'LOCAL_SNAPSHOT_INVALID', reason: `ผลรวม Total != f1 + f2 ที่ SKU ${item.pn} (${total} != ${f1}+${f2})` };
        }
      }

      return { valid: true, batchId: snapshot.batchId, itemCount: snapshot.data.length };
    }

    static async saveAuditEvent(event) {
      try {
        const existing = JSON.parse(localStorage.getItem('SAMSUNG_STOCK_AUDIT_EVENTS') || '[]');
        existing.unshift(event);
        localStorage.setItem('SAMSUNG_STOCK_AUDIT_EVENTS', JSON.stringify(existing.slice(0, 50)));
        console.info('[StockStorageAdapter] Audit event logged:', event.eventType, event);
      } catch (e) {
        console.warn('[StockStorageAdapter] Could not persist audit event to localStorage:', e);
      }
    }

    static getAuditEvents() {
      try {
        return JSON.parse(localStorage.getItem('SAMSUNG_STOCK_AUDIT_EVENTS') || '[]');
      } catch (e) {
        return [];
      }
    }

    static async rollbackToBatch(batchId) {
      const currentActive = await this.getActiveSnapshot();
      const fromBatchId = currentActive ? currentActive.batchId : 'STOCK-INITIAL';
      const targetBatch = await this.getBatchById(batchId);
      if (!targetBatch) throw new Error(`ไม่พบ Batch ID: ${batchId}`);

      // Create explicit Rollback Event ledger entry without deleting any prior batches
      const rollbackEvent = {
        eventId: `EVT-ROLLBACK-${Date.now()}`,
        eventType: 'STOCK_SNAPSHOT_ROLLBACK',
        fromBatchId: fromBatchId,
        toBatchId: targetBatch.batchId,
        executedAt: new Date().toISOString(),
        storageScope: 'LOCAL_BROWSER_ONLY'
      };

      await this.saveAuditEvent(rollbackEvent);

      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CURRENT, 'readwrite');
        const currentStore = tx.objectStore(STORE_CURRENT);
        currentStore.put({
          key: 'active',
          batchId: targetBatch.batchId,
          data: targetBatch.data,
          meta: {
            ...targetBatch.meta,
            rolledBackAt: rollbackEvent.executedAt,
            lastRollbackEvent: rollbackEvent,
            status: 'ROLLED_BACK'
          }
        });
        tx.oncomplete = () => resolve(targetBatch);
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  class StockExcelParser {
    static parseSheet(sheetObj, sheetName) {
      const range = XLSX.utils.decode_range(sheetObj['!ref'] || 'A1:M1');
      let headerRow = -1;

      // Scan rows 0 to 15 to locate P/N and On Hand header row
      for (let r = 0; r <= Math.min(15, range.e.r); r++) {
        const rowVals = [];
        for (let c = 0; c <= range.e.c; c++) {
          const cell = sheetObj[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v !== undefined) {
            rowVals.push(String(cell.v).trim().toUpperCase());
          }
        }
        if (rowVals.includes('P/N') && (rowVals.includes('ON HAND') || rowVals.includes('ONHAND'))) {
          headerRow = r;
          break;
        }
      }

      if (headerRow === -1) {
        throw new Error(`ไม่พบ Header 'P/N' และ 'On Hand' ใน ${sheetName}`);
      }

      // Map column headers
      const colMap = {};
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheetObj[XLSX.utils.encode_cell({ r: headerRow, c })];
        if (cell && cell.v !== undefined) {
          const val = String(cell.v).trim().toUpperCase();
          if (val === 'CAT1' || val === 'CATEGORY 1') colMap['cat1'] = c;
          else if (val === 'CAT2' || val === 'CATEGORY 2') colMap['cat2'] = c;
          else if (val === 'CAT3' || val === 'CATEGORY 3') colMap['cat3'] = c;
          else if (val === 'BRAND') colMap['brand'] = c;
          else if (val.includes('PRICE 99') || val === 'RRP') colMap['price99'] = c;
          else if (val === 'P/N' || val === 'PN' || val === 'PART NUMBER') colMap['pn'] = c;
          else if (val.includes('KOAN SKU')) colMap['koanSku'] = c;
          else if (val.includes('APPLE PART')) colMap['applePart'] = c;
          else if (val === 'DESCRIPTION') colMap['description'] = c;
          else if (val === 'ON HAND' || val === 'ONHAND') colMap['onHand'] = c;
          else if (val.includes('ON B/R')) colMap['onBr'] = c;
          else if (val.includes('ON ALLOC')) colMap['onAlloc'] = c;
          else if (val.includes('ON T/F')) colMap['onTf'] = c;
        }
      }

      if (colMap['pn'] === undefined || colMap['onHand'] === undefined) {
        throw new Error(`คอลัมน์ P/N หรือ On Hand ไม่ครบถ้วนใน ${sheetName}`);
      }

      const rows = [];
      const pnSeen = new Set();
      const duplicatePns = new Set();
      const warnings = [];
      let invalidCount = 0;

      for (let r = headerRow + 1; r <= range.e.r; r++) {
        const pnCell = sheetObj[XLSX.utils.encode_cell({ r, c: colMap['pn'] })];
        const rawPn = pnCell ? String(pnCell.v).trim() : '';

        // Check if row has data despite empty P/N
        const descCell = colMap['description'] !== undefined ? sheetObj[XLSX.utils.encode_cell({ r, c: colMap['description'] })] : null;
        const ohCell = colMap['onHand'] !== undefined ? sheetObj[XLSX.utils.encode_cell({ r, c: colMap['onHand'] })] : null;

        if (!rawPn) {
          if ((descCell && descCell.v) || (ohCell && ohCell.v !== undefined && ohCell.v !== '')) {
            warnings.push({
              type: 'MISSING_PN',
              sheet: sheetName,
              row: r + 1,
              message: `${sheetName} แถว ${r + 1}: พบข้อมูล (${descCell ? descCell.v : 'ยอดสต็อก'}) แต่ไม่มีรหัส P/N (ระบบข้ามแถวนี้)`
            });
          }
          continue; // Skip blank lines
        }

        const exactPn = rawPn.toUpperCase();
        if (pnSeen.has(exactPn)) {
          duplicatePns.add(exactPn);
          warnings.push({
            type: 'DUPLICATE_PN',
            sheet: sheetName,
            row: r + 1,
            pn: exactPn,
            message: `${sheetName} แถว ${r + 1}: พบรหัส P/N '${exactPn}' ซ้ำกับแถวก่อนหน้าในชีตเดียวกัน`
          });
        }
        pnSeen.add(exactPn);

        const onHandCell = sheetObj[XLSX.utils.encode_cell({ r, c: colMap['onHand'] })];
        let onHandVal = 0;
        let isOnHandValid = true;

        if (onHandCell === undefined || onHandCell.v === null || onHandCell.v === '') {
          isOnHandValid = false;
          invalidCount++;
          warnings.push({
            type: 'BLANK_ON_HAND',
            sheet: sheetName,
            row: r + 1,
            pn: exactPn,
            message: `${sheetName} แถว ${r + 1} (${exactPn}): ยอด On Hand เป็นค่าว่าง ระบบปรับเป็น 0`
          });
        } else {
          const num = Number(onHandCell.v);
          if (isNaN(num)) {
            isOnHandValid = false;
            invalidCount++;
            warnings.push({
              type: 'INVALID_ON_HAND',
              sheet: sheetName,
              row: r + 1,
              pn: exactPn,
              message: `${sheetName} แถว ${r + 1} (${exactPn}): ยอด On Hand ไม่ใช่ตัวเลข ('${onHandCell.v}') ระบบปรับเป็น 0`
            });
          } else if (num < 0) {
            isOnHandValid = false;
            invalidCount++;
            warnings.push({
              type: 'NEGATIVE_ON_HAND',
              sheet: sheetName,
              row: r + 1,
              pn: exactPn,
              message: `${sheetName} แถว ${r + 1} (${exactPn}): ยอด On Hand ติดลบ (${num}) ระบบปรับเป็น 0`
            });
          } else {
            onHandVal = Math.floor(num);
          }
        }

        const getCellStr = (colKey) => {
          if (colMap[colKey] === undefined) return '';
          const cell = sheetObj[XLSX.utils.encode_cell({ r, c: colMap[colKey] })];
          return cell && cell.v !== undefined ? String(cell.v).trim() : '';
        };

        const getCellNum = (colKey) => {
          if (colMap[colKey] === undefined) return 0;
          const cell = sheetObj[XLSX.utils.encode_cell({ r, c: colMap[colKey] })];
          const n = Number(cell ? cell.v : 0);
          return isNaN(n) ? 0 : n;
        };

        rows.push({
          pn: exactPn,
          category1: getCellStr('cat1'),
          category2: getCellStr('cat2'),
          category3: getCellStr('cat3'),
          brand: getCellStr('brand'),
          stockReferencePrice: getCellNum('price99'),
          koanSku: getCellStr('koanSku'),
          applePart: getCellStr('applePart'),
          description: getCellStr('description'),
          onHand: onHandVal,
          onBackReserve: getCellNum('onBr'),
          onAllocated: getCellNum('onAlloc'),
          onTransfer: getCellNum('onTf'),
          isOnHandValid,
          rowNumber: r + 1
        });
      }

      return {
        sheetName,
        totalRows: rows.length,
        uniquePns: pnSeen.size,
        duplicatePns: Array.from(duplicatePns),
        invalidCount,
        warnings,
        rows
      };
    }

    static mergeSheets(sheet1Parsed, sheet2Parsed) {
      const s1Map = new Map();
      sheet1Parsed.rows.forEach(r => s1Map.set(r.pn, r));

      const s2Map = new Map();
      sheet2Parsed.rows.forEach(r => s2Map.set(r.pn, r));

      const allWarnings = [
        ...(sheet1Parsed.warnings || []),
        ...(sheet2Parsed.warnings || [])
      ];

      const allPns = new Set([...s1Map.keys(), ...s2Map.keys()]);
      const merged = [];

      let matchedCount = 0;
      let s1OnlyCount = 0;
      let s2OnlyCount = 0;
      let f1Total = 0;
      let f2Total = 0;

      allPns.forEach(pn => {
        const r1 = s1Map.get(pn);
        const r2 = s2Map.get(pn);

        let f1 = 0;
        let f2 = 0;

        if (r1 && r2) {
          matchedCount++;
          f1 = r1.onHand;
          f2 = r2.onHand;
        } else if (r1) {
          s1OnlyCount++;
          f1 = r1.onHand;
          f2 = 0;
        } else {
          s2OnlyCount++;
          f1 = 0;
          f2 = r2.onHand;
        }

        f1Total += f1;
        f2Total += f2;

        const ref = r1 || r2;

        // Classify inventory scope
        let scope = 'OTHER';
        const brandUpper = (ref.brand || '').toUpperCase();
        const cat1Upper = (ref.category1 || '').toUpperCase();
        const cat2Upper = (ref.category2 || '').toUpperCase();
        const descUpper = (ref.description || '').toUpperCase();

        if (cat1Upper.includes('PREMIUM') || cat1Upper.includes('GIFT') || cat2Upper.includes('PREMIUM') || descUpper.includes('PREMIUM')) {
          scope = 'PREMIUM_GIFT';
        } else if (cat1Upper.includes('SIM') || cat2Upper.includes('SIM') || descUpper.includes('SIM')) {
          scope = 'SIM_SERVICE';
        } else if (brandUpper.includes('SAMSUNG')) {
          if (cat1Upper.includes('PHONE') || cat1Upper.includes('TABLET') || cat1Upper.includes('WATCH') || cat1Upper.includes('DEVICE') || pn.startsWith('SM-') || pn.startsWith('F-')) {
            if (pn.startsWith('EP-') || pn.startsWith('EF-') || pn.startsWith('GP-') || pn.startsWith('ET-') || pn.startsWith('EJ-') || pn.startsWith('EE-')) {
              scope = 'SAMSUNG_ACCESSORY';
            } else {
              scope = 'CORE_DEVICE';
            }
          } else {
            scope = 'SAMSUNG_ACCESSORY';
          }
        } else if (cat1Upper.includes('ACC') || cat2Upper.includes('ACC') || cat1Upper.includes('CASE') || cat1Upper.includes('FILM') || cat1Upper.includes('CHARGER') || cat1Upper.includes('AUDIO')) {
          scope = 'THIRD_PARTY_ACCESSORY';
        } else {
          scope = 'OTHER';
        }

        const isCore = (scope === 'CORE_DEVICE');
        let categoryLabel = 'Accessory';
        if (isCore) {
          if (cat1Upper.includes('TABLET') || descUpper.includes('TAB')) categoryLabel = 'Tablet';
          else if (cat1Upper.includes('WATCH') || descUpper.includes('WATCH')) categoryLabel = 'Watch';
          else categoryLabel = 'SmartPhone';
        } else if (scope === 'SIM_SERVICE') {
          categoryLabel = 'SIM';
        } else if (scope === 'PREMIUM_GIFT') {
          categoryLabel = 'Premium';
        }

        merged.push({
          pn: pn,
          model: ref.description || pn,
          description: ref.description,
          category: categoryLabel,
          category1: ref.category1,
          category2: ref.category2,
          category3: ref.category3,
          brand: ref.brand,
          koanSku: ref.koanSku,
          applePart: ref.applePart,
          srp: ref.stockReferencePrice,
          stockReferencePrice: ref.stockReferencePrice,
          f1: f1,
          f2: f2,
          total: f1 + f2,
          stock_f1: f1,
          stock_f2: f2,
          stock_total: f1 + f2,
          inventoryGroup: scope,
          includedInCoreDeviceKpi: isCore,
          sourceSheet: 'Stock.xlsx',
          onBackReserve: (r1 ? r1.onBackReserve : 0) + (r2 ? r2.onBackReserve : 0),
          onAllocated: (r1 ? r1.onAllocated : 0) + (r2 ? r2.onAllocated : 0),
          onTransfer: (r1 ? r1.onTransfer : 0) + (r2 ? r2.onTransfer : 0),
          sourceLocation: (r1 && r2) ? 'BOTH_FLOORS' : (r1 ? 'FLOOR_1_ONLY' : 'FLOOR_2_ONLY')
        });
      });

      // Sort alphabetically by P/N
      merged.sort((a, b) => a.pn.localeCompare(b.pn));

      return {
        totalUniqueProducts: merged.length,
        matchedCount,
        s1OnlyCount,
        s2OnlyCount,
        f1Total,
        f2Total,
        grandTotal: f1Total + f2Total,
        warnings: allWarnings,
        items: merged
      };
    }
  }

  // Stock Importer UI Controller
  class StockImportController {
    constructor() {
      this.currentStagedBatch = null;
      this.isSubmitting = false;
      this.activeMode = localStorage.getItem('samsung_stock_import_active_mode') || 'MODE_A';
    }

    init() {
      this.bindEvents();
      this.initModeSelector();
    }

    bindEvents() {
      const dropzone = document.getElementById('stockUploadDropzone');
      const fileInput = document.getElementById('stockFileInput');

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
      const filterBtns = document.querySelectorAll('.stock-tab-filter');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.filterDiffTable(btn.getAttribute('data-filter'));
        });
      });

      // Confirm Import Button
      const btnConfirm = document.getElementById('btnConfirmStockImport');
      if (btnConfirm) {
        btnConfirm.addEventListener('click', () => this.confirmImport());
      }

      // Cancel Button
      const btnCancel = document.getElementById('btnCancelStockImport');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => this.resetStaging());
      }

      // Export Sync File Button
      const btnExportSync = document.getElementById('btnExportStockSync');
      if (btnExportSync) {
        btnExportSync.addEventListener('click', () => this.exportSyncFile());
      }

      // Import Sync File Button
      const btnImportSync = document.getElementById('btnImportStockSync');
      const syncFileInput = document.getElementById('stockSyncFileInput');
      if (btnImportSync && syncFileInput) {
        btnImportSync.addEventListener('click', () => syncFileInput.click());
        syncFileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files.length > 0) {
            this.handleSyncFile(e.target.files[0]);
          }
        });
      }

      // Mode A / Mode B Switcher Buttons
      const btnModeA = document.getElementById('btnStockModeA');
      const btnModeB = document.getElementById('btnStockModeB');
      if (btnModeA) btnModeA.addEventListener('click', () => this.switchMode('MODE_A'));
      if (btnModeB) btnModeB.addEventListener('click', () => this.switchMode('MODE_B'));

      // Google Sheet Mode B Controls
      const btnSaveUrl = document.getElementById('btnSaveGSheetUrl');
      if (btnSaveUrl) btnSaveUrl.addEventListener('click', () => this.saveGSheetUrl());

      const btnRefreshGSheet = document.getElementById('btnRefreshStockGSheet');
      if (btnRefreshGSheet) btnRefreshGSheet.addEventListener('click', () => this.fetchFromGoogleSheet(false));

      const chkAutoPub = document.getElementById('chkStockGSheetAutoPublish');
      if (chkAutoPub) {
        chkAutoPub.checked = localStorage.getItem('samsung_stock_sheet_auto_publish_opt_in') === 'true';
        chkAutoPub.addEventListener('change', (e) => {
          localStorage.setItem('samsung_stock_sheet_auto_publish_opt_in', e.target.checked ? 'true' : 'false');
        });
      }
    }

    initModeSelector() {
      const savedMode = localStorage.getItem('samsung_stock_import_active_mode') || 'MODE_A';
      this.switchMode(savedMode, false);
      this.updateGSheetSyncBadge();

      // Pre-fill Google Sheet URL input
      const urlInput = document.getElementById('stockGSheetUrlInput');
      if (urlInput && window.GoogleSheetStockSync) {
        urlInput.value = window.GoogleSheetStockSync.getStoredSheetUrl();
      }
    }

    switchMode(mode, savePref = true) {
      this.activeMode = mode;
      if (savePref) {
        localStorage.setItem('samsung_stock_import_active_mode', mode);
      }

      const btnA = document.getElementById('btnStockModeA');
      const btnB = document.getElementById('btnStockModeB');
      const panelA = document.getElementById('stockModeAPanel');
      const panelB = document.getElementById('stockModeBPanel');

      if (mode === 'MODE_B') {
        if (btnA) {
          btnA.classList.remove('active');
          btnA.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          btnA.style.background = 'transparent';
          btnA.style.color = '#94a3b8';
        }
        if (btnB) {
          btnB.classList.add('active');
          btnB.style.borderColor = 'var(--shell-neon-cyan, #00ffff)';
          btnB.style.background = 'rgba(0, 255, 255, 0.08)';
          btnB.style.color = '#fff';
        }
        if (panelA) panelA.classList.add('hidden');
        if (panelB) panelB.classList.remove('hidden');
        this.updateGSheetSyncBadge();
      } else {
        if (btnA) {
          btnA.classList.add('active');
          btnA.style.borderColor = 'var(--shell-neon-cyan, #00ffff)';
          btnA.style.background = 'rgba(0, 255, 255, 0.08)';
          btnA.style.color = '#fff';
        }
        if (btnB) {
          btnB.classList.remove('active');
          btnB.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          btnB.style.background = 'transparent';
          btnB.style.color = '#94a3b8';
        }
        if (panelA) panelA.classList.remove('hidden');
        if (panelB) panelB.classList.add('hidden');
      }
    }

    saveGSheetUrl() {
      const urlInput = document.getElementById('stockGSheetUrlInput');
      const statusEl = document.getElementById('stockGSheetStatus');
      if (!urlInput || !window.GoogleSheetStockSync) return;

      const url = urlInput.value.trim();
      if (!url) {
        alert('กรุณากรอก URL ลิงก์ Google Sheet Published CSV');
        return;
      }

      window.GoogleSheetStockSync.setStoredSheetUrl(url);
      if (statusEl) {
        statusEl.innerHTML = `<span class="text-emerald">💾 บันทึก URL Google Sheet เรียบร้อยแล้ว พร้อมกดรีเฟรชข้อมูล</span>`;
      }
      alert('✓ บันทึก URL Google Sheet สำหรับสาขาเรียบร้อยแล้ว');
    }

    updateGSheetSyncBadge() {
      const badge = document.getElementById('stockGSheetLastSyncBadge');
      if (!badge || !window.GoogleSheetStockSync) return;
      const lastSync = window.GoogleSheetStockSync.getLastSyncTime();
      if (lastSync) {
        const d = new Date(lastSync);
        badge.textContent = `ซิงค์ล่าสุด: ${d.toLocaleString('th-TH')}`;
        badge.style.color = '#38bdf8';
      } else {
        badge.textContent = 'ซิงค์ล่าสุด: ยังไม่ได้ซิงค์';
        badge.style.color = '#94a3b8';
      }
    }

    async fetchFromGoogleSheet(isAuto = false) {
      if (!window.GoogleSheetStockSync) {
        console.warn('[StockImportController] GoogleSheetStockSync module not loaded');
        return;
      }

      const urlInput = document.getElementById('stockGSheetUrlInput');
      const storedUrl = window.GoogleSheetStockSync.getStoredSheetUrl();
      const currentUrl = (urlInput && urlInput.value.trim()) ? urlInput.value.trim() : storedUrl;

      const statusEl = document.getElementById('stockGSheetStatus');
      const fallbackBanner = document.getElementById('stockGSheetFallbackBanner');
      const refreshBtn = document.getElementById('btnRefreshStockGSheet');

      if (!currentUrl) {
        if (!isAuto) {
          alert('ยังไม่ได้ระบุลิงก์ Google Sheet CSV กรุณากรอกในช่องลิงก์ด้านบน');
        }
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #fbbf24;">⚠️ ยังไม่ได้ตั้งค่า URL ลิงก์ Google Sheet สำหรับสต็อก</span>`;
        }
        return;
      }

      // Sync the input value with stored URL
      window.GoogleSheetStockSync.setStoredSheetUrl(currentUrl);

      if (refreshBtn) refreshBtn.disabled = true;
      if (statusEl) {
        statusEl.innerHTML = `<span class="text-cyan">⏳ กำลังเชื่อมต่อและดึงข้อมูลจาก Google Sheet (CSV)...</span>`;
      }
      if (fallbackBanner) fallbackBanner.classList.add('hidden');

      try {
        const syncResult = await window.GoogleSheetStockSync.fetchGoogleSheetCsv(currentUrl);

        // Stage the batch through diff preview
        const currentStockList = window.STOCK_DATA || [];
        const stagedBatch = window.GoogleSheetStockSync.createStagedBatchFromSync(syncResult, currentStockList);

        this.currentStagedBatch = stagedBatch;

        // Check opt-in auto publish
        const isOptInAutoPublish = localStorage.getItem('samsung_stock_sheet_auto_publish_opt_in') === 'true';

        if (isOptInAutoPublish) {
          await this.confirmImport();
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-emerald">⚡ Auto-Publish สำเร็จ: บันทึก ${syncResult.totalRows.toLocaleString()} รายการ เข้าสู่สต็อกหน้าร้านทันที</span>`;
          }
        } else {
          this.renderPreview();
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-emerald">✓ ดึงข้อมูลสำเร็จ ${syncResult.totalRows.toLocaleString()} รายการ (F1: ${syncResult.f1Total}, F2: ${syncResult.f2Total}) • กรุณาตรวจสอบใน Diff Preview ด้านล่าง</span>`;
          }
        }

        window.GoogleSheetStockSync.setLastSyncTime(syncResult.fetchedAt);
        this.updateGSheetSyncBadge();

      } catch (err) {
        console.error('[Google Sheet Sync Error]', err);

        // Human-friendly Thai error and graceful fallback
        if (statusEl) {
          statusEl.innerHTML = `<span class="text-coral">❌ ดึงข้อมูลจาก Google Sheet ไม่สำเร็จ (เหตุผล: ${err.message})</span>`;
        }

        if (fallbackBanner) {
          fallbackBanner.classList.remove('hidden');
          fallbackBanner.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
              <span>⚠️ ดึงข้อมูลจาก Google Sheet ไม่สำเร็จ — กำลังใช้ข้อมูลล่าสุดที่มีอยู่แทน</span>
            </div>
            <div style="line-height: 1.5;">
              เหตุผล: <strong>${err.message}</strong><br>
              ระบบได้ทำการ Fallback สต็อกกลับไปใช้ Snapshot ล่าสุดใน IndexedDB เรียบร้อยแล้ว เพื่อให้หน้าจอไม่ว่างเปล่าและหน้าร้านสามารถเช็คสต็อกได้ตามปกติ
            </div>
          `;
        }

        // Fallback: Verify active stock in memory/IndexedDB is preserved
        if (!window.STOCK_DATA || window.STOCK_DATA.length === 0) {
          StockStorageAdapter.getActiveSnapshot().then(snap => {
            if (snap && snap.data) {
              window.STOCK_DATABASE = snap.data;
              window.STOCK_DATA = snap.data;
              if (window.DataService && typeof window.DataService.setStockData === 'function') {
                window.DataService.setStockData(snap.data);
              }
            }
          });
        }
      } finally {
        if (refreshBtn) refreshBtn.disabled = false;
      }
    }

    handleRouteEnter() {
      this.initModeSelector();
      // Auto-fetch ONLY when in Mode B and URL is already configured
      if (this.activeMode === 'MODE_B' && window.GoogleSheetStockSync) {
        const url = window.GoogleSheetStockSync.getStoredSheetUrl();
        if (url) {
          console.info('[StockImportController] Auto-fetching Google Sheet stock on page enter...');
          this.fetchFromGoogleSheet(true);
        }
      }
    }

    async handleFile(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext !== 'xlsx') {
        alert('กรุณาเลือกไฟล์ Excel (.xlsx) ที่มี Sheet1 และ Sheet2 เท่านั้น');
        return;
      }

      const statusEl = document.getElementById('stockUploadStatus');
      if (statusEl) statusEl.innerHTML = `<span class="text-cyan">⏳ กำลังตรวจสอบและอ่านข้อมูลไฟล์ ${file.name}...</span>`;

      try {
        const dataBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(dataBuffer, { type: 'array' });

        if (!workbook.SheetNames.includes('Sheet1') || !workbook.SheetNames.includes('Sheet2')) {
          throw new Error('ไฟล์ Stock.xlsx ต้องมีทั้ง Sheet1 (ร้านเรา ชั้น 1) และ Sheet2 (สาขา ชั้น 2)');
        }

        const s1Parsed = StockExcelParser.parseSheet(workbook.Sheets['Sheet1'], 'Sheet1');
        const s2Parsed = StockExcelParser.parseSheet(workbook.Sheets['Sheet2'], 'Sheet2');

        const mergedResult = StockExcelParser.mergeSheets(s1Parsed, s2Parsed);

        // Compute File Hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Compute diff against active data
        const currentStockList = window.STOCK_DATA || [];
        const currentMap = new Map();
        currentStockList.forEach(item => {
          const key = (item.pn || item.sku || '').trim().toUpperCase();
          if (key) currentMap.set(key, item);
        });

        let changedCount = 0;
        let unchangedCount = 0;
        let newCount = 0;

        const diffItems = mergedResult.items.map(newItem => {
          const curr = currentMap.get(newItem.pn);
          let diffF1 = newItem.f1;
          let diffF2 = newItem.f2;
          let diffTotal = newItem.total;
          let isNew = false;
          let isChanged = false;

          if (curr) {
            const currF1 = Number(curr.f1 || curr.floor1 || 0);
            const currF2 = Number(curr.f2 || curr.floor2 || 0);
            const currTot = Number(curr.total || 0);

            diffF1 = newItem.f1 - currF1;
            diffF2 = newItem.f2 - currF2;
            diffTotal = newItem.total - currTot;

            if (diffF1 !== 0 || diffF2 !== 0) {
              isChanged = true;
              changedCount++;
            } else {
              unchangedCount++;
            }
          } else {
            isNew = true;
            newCount++;
          }

          return {
            ...newItem,
            isNew,
            isChanged,
            diffF1,
            diffF2,
            diffTotal,
            prevF1: curr ? Number(curr.f1 || curr.floor1 || 0) : 0,
            prevF2: curr ? Number(curr.f2 || curr.floor2 || 0) : 0,
            prevTotal: curr ? Number(curr.total || 0) : 0
          };
        });

        const batchId = `STOCK-BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        this.currentStagedBatch = {
          batchId,
          sourceFilename: file.name,
          fileHash,
          importedAt: new Date().toISOString(),
          s1Summary: s1Parsed,
          s2Summary: s2Parsed,
          mergedResult,
          diffItems,
          warnings: mergedResult.warnings || [],
          stats: {
            totalProducts: mergedResult.totalUniqueProducts,
            f1Total: mergedResult.f1Total,
            f2Total: mergedResult.f2Total,
            grandTotal: mergedResult.grandTotal,
            newCount,
            changedCount,
            unchangedCount
          }
        };

        this.renderPreview();
        if (statusEl) statusEl.innerHTML = `<span class="text-emerald">✓ ตรวจสอบข้อมูลเสร็จสมบูรณ์ พร้อมดูตัวอย่าง Diff</span>`;
      } catch (err) {
        console.error('[Stock Import Error]', err);
        if (statusEl) statusEl.innerHTML = `<span class="text-coral">❌ ผิดพลาด: ${err.message}</span>`;
        alert(`เกิดข้อผิดพลาดในการประมวลผลไฟล์ Stock.xlsx:\n${err.message}`);
      }
    }

    renderPreview() {
      const b = this.currentStagedBatch;
      if (!b) return;

      const previewSection = document.getElementById('stockPreviewSection');
      if (previewSection) previewSection.classList.remove('hidden');

      // Update KPI Stat cards
      document.getElementById('stkKpiUnique').textContent = b.stats.totalProducts.toLocaleString();
      document.getElementById('stkKpiF1').textContent = b.stats.f1Total.toLocaleString();
      document.getElementById('stkKpiF2').textContent = b.stats.f2Total.toLocaleString();
      document.getElementById('stkKpiTotal').textContent = b.stats.grandTotal.toLocaleString();
      document.getElementById('stkKpiChanged').textContent = b.stats.changedCount.toLocaleString();
      document.getElementById('stkKpiNew').textContent = b.stats.newCount.toLocaleString();

      // Render Validation Warnings Banner if any anomalies exist
      const warningBanner = document.getElementById('stockValidationWarningBanner');
      if (warningBanner) {
        const warnings = b.warnings || [];
        if (warnings.length > 0) {
          warningBanner.classList.remove('hidden');
          const sampleWarnings = warnings.slice(0, 5);
          const moreCount = warnings.length - sampleWarnings.length;
          warningBanner.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
              <span>⚠️ ข้อควรทราบจากการตรวจสอบข้อมูล (${warnings.length} รายการ):</span>
            </div>
            <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; line-height: 1.5;">
              ${sampleWarnings.map(w => `<li>${w.message || w}</li>`).join('')}
              ${moreCount > 0 ? `<li>...และอีก ${moreCount} รายการ (ระบบปรับแก้ให้อัตโนมัติ ปลอดภัยต่อการนำเข้า)</li>` : ''}
            </ul>
          `;
        } else {
          warningBanner.classList.add('hidden');
          warningBanner.innerHTML = '';
        }
      }

      // Render Table
      this.filterDiffTable('ALL');

      // Update Stepper
      const stepItems = document.querySelectorAll('#stockStepper .step-item');
      if (stepItems[0]) stepItems[0].className = 'step-item completed';
      if (stepItems[1]) stepItems[1].className = 'step-item completed';
      if (stepItems[2]) stepItems[2].className = 'step-item active';

      // Scroll to preview
      previewSection.scrollIntoView({ behavior: 'smooth' });
    }

    filterDiffTable(filterType) {
      const b = this.currentStagedBatch;
      if (!b) return;

      const tbody = document.getElementById('stockDiffTableBody');
      if (!tbody) return;

      let list = b.diffItems;
      if (filterType === 'CHANGED') {
        list = list.filter(it => it.isChanged || it.isNew);
      } else if (filterType === 'NEW') {
        list = list.filter(it => it.isNew);
      } else if (filterType === 'CORE') {
        list = list.filter(it => it.inventoryScope === 'CORE_DEVICE');
      }

      tbody.innerHTML = list.map(item => {
        const renderDiffBadge = (diffVal) => {
          if (diffVal > 0) return `<span class="diff-chip inc">+${diffVal}</span>`;
          if (diffVal < 0) return `<span class="diff-chip dec">${diffVal}</span>`;
          return `<span class="diff-chip zero">0</span>`;
        };

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff;">${item.pn}</div>
              <div style="font-size: 0.76rem; color: #94a3b8;">${item.description || item.model}</div>
            </td>
            <td><span class="type-pill ${item.inventoryScope === 'CORE_DEVICE' ? 'active' : ''}">${item.inventoryScope}</span></td>
            <td>
              <span>${item.f1}</span>
              ${item.diffF1 !== 0 ? renderDiffBadge(item.diffF1) : ''}
              <div style="font-size: 0.72rem; color: #64748b;">เดิม: ${item.prevF1}</div>
            </td>
            <td>
              <span>${item.f2}</span>
              ${item.diffF2 !== 0 ? renderDiffBadge(item.diffF2) : ''}
              <div style="font-size: 0.72rem; color: #64748b;">เดิม: ${item.prevF2}</div>
            </td>
            <td style="font-weight: 700; color: var(--neon-cyan);">
              <span>${item.total}</span>
              ${item.diffTotal !== 0 ? renderDiffBadge(item.diffTotal) : ''}
              <div style="font-size: 0.72rem; color: #64748b;">เดิม: ${item.prevTotal}</div>
            </td>
            <td style="color: #cbd5e1;">฿${item.stockReferencePrice.toLocaleString()}</td>
            <td>
              ${item.isNew ? '<span class="status-badge-gate review">✨ สินค้าใหม่</span>' : (item.isChanged ? '<span class="status-badge-gate pass">🔄 สต็อกเปลี่ยน</span>' : '<span class="status-badge-gate" style="color:#64748b;">คงเดิม</span>')}
            </td>
          </tr>
        `;
      }).join('');
    }

    async confirmImport() {
      if (!this.currentStagedBatch || this.isSubmitting) return;

      const b = this.currentStagedBatch;
      const confirmMsg = `ยืนยันการนำเข้า Stock Snapshot ชุดใหม่?\n\n- Batch ID: ${b.batchId}\n- ไฟล์ต้นทาง: ${b.sourceFilename}\n- จำนวนสินค้า: ${b.stats.totalProducts} รายการ\n- ผลรวม F1: ${b.stats.f1Total} | F2: ${b.stats.f2Total} (รวม ${b.stats.grandTotal})\n- สินค้าที่สต็อกเปลี่ยน: ${b.stats.changedCount} รายการ\n- สินค้าใหม่: ${b.stats.newCount} รายการ\n\nข้อมูลจะถูกบันทึกในเครื่องนี้ (LOCAL_BROWSER_ONLY) และอัปเดตหน้า Dashboard ทันที`;

      if (!confirm(confirmMsg)) return;

      this.isSubmitting = true;
      const btnConfirm = document.getElementById('btnConfirmStockImport');
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<span>⏳ กำลังบันทึก Snapshot...</span>';
      }

      try {
        const batchRecord = {
          batchId: b.batchId,
          data: b.mergedResult.items,
          meta: {
            stockBatchId: b.batchId,
            importBatchId: b.batchId,
            batchId: b.batchId,
            importedAt: b.importedAt,
            sourceFilename: b.sourceFilename,
            sourceFileHash: b.fileHash,
            sheet1Rows: (b.s1Summary ? b.s1Summary.totalRows : (b.sheet1 ? b.sheet1.totalRows : 0)),
            sheet2Rows: (b.s2Summary ? b.s2Summary.totalRows : (b.sheet2 ? b.sheet2.totalRows : 0)),
            uniquePn: b.stats.totalProducts,
            f1Total: b.stats.f1Total,
            f2Total: b.stats.f2Total,
            grandTotal: b.stats.grandTotal,
            storageScope: 'LOCAL_BROWSER_ONLY',
            schemaVersion: '2.0.0',
            applicationVersion: '20260907-b2',
            stats: b.stats,
            storageMode: 'LOCAL_BROWSER_ONLY',
            status: 'IMPORTED'
          }
        };

        // Auto-Register New Products into System Master Database
        const currentStockDb = Array.isArray(window.STOCK_DATABASE) ? window.STOCK_DATABASE : (Array.isArray(window.STOCK_DATA) ? window.STOCK_DATA : []);
        const incomingPns = new Set(b.mergedResult.items.map(it => it.pn));
        let newItemsRegistered = 0;

        // Detect new items not yet in master catalog
        const existingPns = new Set(currentStockDb.map(it => it.pn));
        b.mergedResult.items.forEach(newItem => {
          if (!existingPns.has(newItem.pn)) {
            newItemsRegistered++;
            console.info(`[AutoCatalog] Auto-registered new product into system database: ${newItem.pn} (${newItem.model || newItem.description})`);
          }
        });

        // Combined database: incoming active items + preserve catalog products not in current count (qty = 0)
        const combinedMaster = [...b.mergedResult.items];
        currentStockDb.forEach(oldItem => {
          if (!incomingPns.has(oldItem.pn)) {
            combinedMaster.push({
              ...oldItem,
              f1: 0,
              f2: 0,
              total: 0
            });
          }
        });

        batchRecord.data = combinedMaster;
        batchRecord.meta.autoRegisteredNewItemsCount = newItemsRegistered;

        // Save to IndexedDB
        await StockStorageAdapter.saveBatch(batchRecord);

        // Update in-memory databases with complete catalog
        window.STOCK_DATABASE = combinedMaster;
        window.STOCK_DATA = combinedMaster;

        const coreItems = b.mergedResult.items.filter(it => it.includedInCoreDeviceKpi);
        const coreF1 = coreItems.reduce((acc, it) => acc + it.f1, 0);
        const coreF2 = coreItems.reduce((acc, it) => acc + it.f2, 0);

        window.STOCK_METADATA = {
          stockBatchId: b.batchId,
          importBatchId: b.batchId,
          sourceType: "Manual Excel Snapshot",
          sourceFile: b.sourceFilename,
          sourceFilename: b.sourceFilename,
          sourceFileHash: b.fileHash,
          importedAt: b.importedAt,
          recordCount: b.stats.totalProducts,
          sheet1Rows: (b.s1Summary ? b.s1Summary.totalRows : (b.sheet1 ? b.sheet1.totalRows : 0)),
          sheet2Rows: (b.s2Summary ? b.s2Summary.totalRows : (b.sheet2 ? b.sheet2.totalRows : 0)),
          uniquePn: b.stats.totalProducts,
          f1Total: b.stats.f1Total,
          f2Total: b.stats.f2Total,
          grandTotal: b.stats.grandTotal,
          coreDevices: {
            floor1: coreF1,
            floor2: coreF2,
            total: coreF1 + coreF2
          },
          importedInventoryTotal: b.stats.grandTotal,
          storageScope: 'LOCAL_BROWSER_ONLY',
          storageMode: 'LOCAL_BROWSER_ONLY',
          schemaVersion: '2.0.0',
          applicationVersion: '20260907-b2'
        };

        // If DataService exists, update it as well
        if (window.DataService && typeof window.DataService.setStockData === 'function') {
          window.DataService.setStockData(b.mergedResult.items);
        }

        // Trigger app.js synchronization to re-render table, cards, and metrics
        if (typeof window.syncMasterStockData === "function") {
          window.syncMasterStockData();
        }

        // Update Last Sync / Snapshot label in top header (Never use new Date() on refresh)
        const importTimeFormatted = b.importedAt ? b.importedAt.replace('T', ' ').substring(0, 19) : '2026-09-11 13:31:00';
        const lastSyncLabel = document.getElementById('lastSyncTime');
        if (lastSyncLabel) {
          lastSyncLabel.textContent = `Excel Snapshot (${importTimeFormatted})`;
        }

        // Truthful local disclosure dialog
        alert(`✓ นำเข้า Stock Snapshot ในเบราว์เซอร์นี้แล้ว\n\n` +
              `• Batch ID: ${b.batchId}\n` +
              `• สถานะการบันทึก: LOCAL_BROWSER_ONLY (IndexedDB)\n` +
              `• เครื่องหลักรวม (Core Devices): ${(coreF1 + coreF2).toLocaleString()} เครื่อง (ช1: ${coreF1} | ช2: ${coreF2})\n` +
              `• ยอดคงเหลือรวมทุกหมวด: ${b.stats.grandTotal.toLocaleString()} รายการ (${b.stats.totalProducts} SKUs)\n\n` +
              `ระบบได้อัปเดตหน้า Dashboard ในเบราว์เซอร์นี้เรียบร้อยแล้ว (ยังไม่มีการกระจายไปยังอุปกรณ์อื่นอัตโนมัติ)`);

        // Navigate to Stock View
        if (window.AppRouter) {
          window.AppRouter.navigate('/stock');
        }
      } catch (err) {
        console.error('[Stock Save Error]', err);
        alert(`เกิดข้อผิดพลาดในการบันทึก Stock Snapshot: ${err.message}`);
      } finally {
        this.isSubmitting = false;
        if (btnConfirm) {
          btnConfirm.disabled = false;
          btnConfirm.innerHTML = '<span>✓ ยืนยันการนำเข้า (Confirm Import)</span>';
        }
      }
    }

    resetStaging() {
      this.currentStagedBatch = null;
      const previewSection = document.getElementById('stockPreviewSection');
      if (previewSection) previewSection.classList.add('hidden');

      const warningBanner = document.getElementById('stockValidationWarningBanner');
      if (warningBanner) {
        warningBanner.classList.add('hidden');
        warningBanner.innerHTML = '';
      }

      const statusEl = document.getElementById('stockUploadStatus');
      if (statusEl) statusEl.innerHTML = '';

      const fileInput = document.getElementById('stockFileInput');
      if (fileInput) fileInput.value = '';

      const stepItems = document.querySelectorAll('#stockStepper .step-item');
      if (stepItems[0]) stepItems[0].className = 'step-item active';
      if (stepItems[1]) stepItems[1].className = 'step-item';
      if (stepItems[2]) stepItems[2].className = 'step-item';
    }

    async exportSyncFile() {
      try {
        let activeData = window.STOCK_DATA || window.STOCK_DATABASE || [];
        let activeMeta = window.STOCK_METADATA || {};

        const snapshot = await StockStorageAdapter.getActiveSnapshot();
        if (snapshot && snapshot.data && snapshot.data.length > 0) {
          activeData = snapshot.data;
          activeMeta = snapshot.meta || activeMeta;
        }

        if (!activeData || activeData.length === 0) {
          alert('ไม่พบข้อมูลสต็อกสำหรับส่งออก กรุณานำเข้าไฟล์สต็อกก่อน');
          return;
        }

        const batchId = activeMeta.stockBatchId || activeMeta.batchId || `SYNC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        const syncPayload = {
          syncFormat: "SAMSUNG_BRANCH_STOCK_SYNC_V1",
          exportedAt: new Date().toISOString(),
          batchId: batchId,
          sourceFilename: activeMeta.sourceFilename || activeMeta.sourceFile || "Stock.xlsx",
          sourceFileHash: activeMeta.sourceFileHash || "",
          stats: {
            totalProducts: activeData.length,
            grandTotal: activeData.reduce((acc, it) => acc + (it.total || 0), 0),
            f1Total: activeData.reduce((acc, it) => acc + (it.f1 || 0), 0),
            f2Total: activeData.reduce((acc, it) => acc + (it.f2 || 0), 0)
          },
          metadata: activeMeta,
          data: activeData
        };

        const jsonStr = JSON.stringify(syncPayload, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `samsung_stock_sync_${batchId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('[Export Sync Error]', err);
        alert(`เกิดข้อผิดพลาดในการส่งออกไฟล์ซิงค์: ${err.message}`);
      }
    }

    async handleSyncFile(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext !== 'json') {
        alert('กรุณาเลือกไฟล์ JSON สำหรับซิงค์สต็อก (.json) เท่านั้น');
        return;
      }

      try {
        const text = await file.text();
        const payload = JSON.parse(text);

        if (!payload || payload.syncFormat !== 'SAMSUNG_BRANCH_STOCK_SYNC_V1' || !Array.isArray(payload.data)) {
          throw new Error('รูปแบบไฟล์ซิงค์ไม่ถูกต้อง (ต้องเป็น SAMSUNG_BRANCH_STOCK_SYNC_V1 ที่ส่งออกจากระบบนี้)');
        }

        const grandTot = payload.stats ? payload.stats.grandTotal : payload.data.reduce((a, b) => a + (b.total || 0), 0);

        // Check Stale Overwrite Protection (Anti-Silent Data Loss)
        const activeSnapshot = await StockStorageAdapter.getActiveSnapshot();
        if (activeSnapshot && activeSnapshot.meta && activeSnapshot.meta.importedAt) {
          const localTime = new Date(activeSnapshot.meta.importedAt).getTime();
          const incomingTime = new Date(payload.exportedAt || (payload.metadata && payload.metadata.importedAt) || 0).getTime();
          if (incomingTime && incomingTime < localTime) {
            const localTimeStr = new Date(activeSnapshot.meta.importedAt).toLocaleString('th-TH');
            const incomingTimeStr = new Date(incomingTime).toLocaleString('th-TH');
            const staleWarning = `⚠️ คำเตือน: ข้อมูลในไฟล์นี้เก่ากว่าข้อมูลปัจจุบันในเครื่อง!\n\n` +
              `• ข้อมูลปัจจุบันในเครื่อง: ${localTimeStr} (Batch: ${activeSnapshot.batchId})\n` +
              `• ข้อมูลในไฟล์ที่นำเข้า: ${incomingTimeStr} (Batch: ${payload.batchId})\n\n` +
              `หากดำเนินการต่อ ข้อมูลที่ใหม่กว่าในเครื่องนี้จะถูกเขียนทับด้วยข้อมูลเก่าจากไฟล์\n\n` +
              `คุณต้องการเขียนทับจริงหรือไม่?`;
            if (!confirm(staleWarning)) return;
          }
        }

        const confirmMsg = `ยืนยันการนำเข้าไฟล์ซิงค์สต็อกข้ามเครื่อง?\n\n` +
          `• Batch ID: ${payload.batchId}\n` +
          `• วันที่ส่งออก: ${new Date(payload.exportedAt).toLocaleString('th-TH')}\n` +
          `• จำนวนสินค้า: ${payload.data.length.toLocaleString()} รายการ\n` +
          `• ผลรวมยอดคงเหลือ: ${grandTot.toLocaleString()} ชิ้น\n\n` +
          `ระบบจะบันทึกลงในเบราว์เซอร์นี้ (IndexedDB) และอัปเดตสต็อกหน้าร้านทันที`;

        if (!confirm(confirmMsg)) return;

        const batchRecord = {
          batchId: payload.batchId,
          data: payload.data,
          meta: {
            ...(payload.metadata || {}),
            stockBatchId: payload.batchId,
            importBatchId: payload.batchId,
            batchId: payload.batchId,
            importedAt: payload.exportedAt || new Date().toISOString(),
            sourceFilename: payload.sourceFilename || file.name,
            sourceFileHash: payload.sourceFileHash || "",
            storageScope: 'LOCAL_BROWSER_ONLY',
            schemaVersion: '2.0.0',
            applicationVersion: '20260907-b2',
            stats: payload.stats || { totalProducts: payload.data.length, grandTotal: grandTot },
            status: 'SYNCED_IMPORT'
          }
        };

        await StockStorageAdapter.saveBatch(batchRecord);

        window.STOCK_DATABASE = payload.data;
        window.STOCK_DATA = payload.data;
        window.STOCK_METADATA = batchRecord.meta;

        if (window.DataService && typeof window.DataService.setStockData === 'function') {
          window.DataService.setStockData(payload.data);
        }
        if (typeof window.syncMasterStockData === "function") {
          window.syncMasterStockData();
        }

        const lastSyncLabel = document.getElementById('lastSyncTime');
        if (lastSyncLabel) {
          lastSyncLabel.textContent = `Sync (${payload.batchId})`;
        }

        alert(`✓ ซิงค์ Stock Snapshot เรียบร้อยแล้ว!\n\n` +
          `• Batch ID: ${payload.batchId}\n` +
          `• จำนวนสินค้า: ${payload.data.length.toLocaleString()} รายการ\n` +
          `• พร้อมใช้งานบน Dashboard ของเครื่องนี้ทันที`);

        if (window.AppRouter) {
          window.AppRouter.navigate('/stock');
        }
      } catch (err) {
        console.error('[Import Sync Error]', err);
        alert(`เกิดข้อผิดพลาดในการนำเข้าไฟล์ซิงค์:\n${err.message}`);
      } finally {
        const input = document.getElementById('stockSyncFileInput');
        if (input) input.value = '';
      }
    }

    static async renderHistoryView() {
      const container = document.getElementById('stockHistoryContent');
      if (!container) return;

      try {
        const batches = await StockStorageAdapter.getAllBatches();
        if (batches.length === 0) {
          container.innerHTML = `
            <div class="action-center-card" style="text-align: center; padding: 48px 24px;">
              <div style="font-size: 3rem; margin-bottom: 12px;">📦</div>
              <h4 style="color: #fff; font-size: 1.15rem; margin-bottom: 8px;">ยังไม่มีประวัติการนำเข้า Stock Snapshot</h4>
              <p style="color: #94a3b8; font-size: 0.86rem; margin-bottom: 20px;">คุณสามารถนำเข้าไฟล์ Stock.xlsx เพื่อสร้าง Snapshot แรกของระบบได้</p>
              <button class="btn-confirm-import" onclick="window.AppRouter.navigate('/stock-import')">
                <span>➕ ไปที่หน้านำเข้าสต็อก &rarr;</span>
              </button>
            </div>
          `;
          return;
        }

        container.innerHTML = `
          <div class="diff-table-container">
            <div class="diff-table-header">
              <h4 class="diff-table-title">ประวัติการนำเข้า Stock Snapshot (${batches.length} รายการ)</h4>
              <button class="btn-cancel-import" onclick="window.AppRouter.navigate('/stock-import')">➕ นำเข้าไฟล์ใหม่</button>
            </div>
            <table class="diff-table">
              <thead>
                <tr>
                  <th>Batch ID & วันที่</th>
                  <th>ไฟล์ต้นทาง & Hash</th>
                  <th>จำนวนสินค้า</th>
                  <th>ยอด F1</th>
                  <th>ยอด F2</th>
                  <th>ยอดรวม</th>
                  <th>สถานะ</th>
                  <th style="text-align: center;">ย้อนกลับ (Rollback)</th>
                </tr>
              </thead>
              <tbody>
                ${batches.map(b => {
                  const m = b.meta || {};
                  const s = m.stats || {};
                  const dateStr = new Date(m.importedAt).toLocaleString('th-TH');
                  const isCurrent = b.batchId === (window.CURRENT_STOCK_BATCH_ID || batches[0].batchId);

                  return `
                    <tr>
                      <td>
                        <strong style="color: #fff;">${b.batchId}</strong>
                        <div style="font-size: 0.74rem; color: #94a3b8;">📅 ${dateStr}</div>
                      </td>
                      <td>
                        <div style="color: #cbd5e1;">${m.sourceFilename || 'Stock.xlsx'}</div>
                        <div style="font-size: 0.72rem; color: #64748b; font-family: monospace;">${(m.fileHash || '').substring(0, 16)}...</div>
                      </td>
                      <td>${(s.totalProducts || b.data?.length || 0).toLocaleString()}</td>
                      <td class="text-cyan">${(s.f1Total || 0).toLocaleString()}</td>
                      <td class="text-amber">${(s.f2Total || 0).toLocaleString()}</td>
                      <td style="font-weight: 700; color: #fff;">${(s.grandTotal || 0).toLocaleString()}</td>
                      <td>
                        ${isCurrent ? '<span class="status-badge-gate pass">🟢 ACTIVE</span>' : '<span class="status-badge-gate" style="color: #94a3b8;">ARCHIVED</span>'}
                      </td>
                      <td style="text-align: center;">
                        ${isCurrent ? '<span style="font-size: 0.75rem; color: #64748b;">กำลังใช้งาน</span>' : `
                          <button class="btn-cancel-import" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.StockImportController.rollback('${b.batchId}')">
                            ⏪ คืนค่าชุดนี้
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      } catch (err) {
        console.error('[Render History Error]', err);
        container.innerHTML = `<div style="color: #fb7185; padding: 24px;">ไม่สามารถโหลดประวัติการนำเข้าได้: ${err.message}</div>`;
      }
    }

    static async rollback(batchId) {
      if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการคืนค่าสต็อกไปยัง Batch ID:\n${batchId}?\n\nสต็อกหน้าร้านจะถูกเปลี่ยนกลับทันที`)) return;

      try {
        const restored = await StockStorageAdapter.rollbackToBatch(batchId);
        window.STOCK_DATABASE = restored.data;
        window.STOCK_DATA = restored.data;
        if (restored.meta) {
          window.STOCK_METADATA = restored.meta;
        }
        if (window.DataService && typeof window.DataService.setStockData === 'function') {
          window.DataService.setStockData(restored.data);
        }
        if (typeof window.syncMasterStockData === "function") {
          window.syncMasterStockData();
        }
        alert(`✓ ย้อนกลับไปยัง Stock Snapshot: ${batchId} ในเบราว์เซอร์นี้เรียบร้อยแล้ว`);
        StockImportController.renderHistoryView();
      } catch (err) {
        alert(`เกิดข้อผิดพลาดในการ Rollback: ${err.message}`);
      }
    }
  }

  window.StockImportController = new StockImportController();
  window.StockStorageAdapter = StockStorageAdapter;
  window.renderStockImportHistoryView = StockImportController.renderHistoryView;

  document.addEventListener('DOMContentLoaded', () => {
    window.StockImportController.init();
  });
})();
