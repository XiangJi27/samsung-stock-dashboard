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

    static async rollbackToBatch(batchId) {
      const targetBatch = await this.getBatchById(batchId);
      if (!targetBatch) throw new Error(`ไม่พบ Batch ID: ${batchId}`);

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
            rolledBackAt: new Date().toISOString(),
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
      let invalidCount = 0;

      for (let r = headerRow + 1; r <= range.e.r; r++) {
        const pnCell = sheetObj[XLSX.utils.encode_cell({ r, c: colMap['pn'] })];
        const rawPn = pnCell ? String(pnCell.v).trim() : '';

        if (!rawPn) continue; // Skip blank lines

        const exactPn = rawPn.toUpperCase();
        if (pnSeen.has(exactPn)) {
          duplicatePns.add(exactPn);
        }
        pnSeen.add(exactPn);

        const onHandCell = sheetObj[XLSX.utils.encode_cell({ r, c: colMap['onHand'] })];
        let onHandVal = 0;
        let isOnHandValid = true;

        if (onHandCell === undefined || onHandCell.v === null || onHandCell.v === '') {
          isOnHandValid = false;
          invalidCount++;
        } else {
          const num = Number(onHandCell.v);
          if (isNaN(num) || num < 0) {
            isOnHandValid = false;
            invalidCount++;
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
        rows
      };
    }

    static mergeSheets(sheet1Parsed, sheet2Parsed) {
      const s1Map = new Map();
      sheet1Parsed.rows.forEach(r => s1Map.set(r.pn, r));

      const s2Map = new Map();
      sheet2Parsed.rows.forEach(r => s2Map.set(r.pn, r));

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
        items: merged
      };
    }
  }

  // Stock Importer UI Controller
  class StockImportController {
    constructor() {
      this.currentStagedBatch = null;
      this.isSubmitting = false;
    }

    init() {
      this.bindEvents();
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
            batchId: b.batchId,
            sourceFilename: b.sourceFilename,
            fileHash: b.fileHash,
            importedAt: b.importedAt,
            stats: b.stats,
            storageMode: 'LOCAL_BROWSER_ONLY',
            status: 'IMPORTED'
          }
        };

        // Save to IndexedDB
        await StockStorageAdapter.saveBatch(batchRecord);

        // Update in-memory databases
        window.STOCK_DATABASE = b.mergedResult.items;
        window.STOCK_DATA = b.mergedResult.items;

        const coreItems = b.mergedResult.items.filter(it => it.includedInCoreDeviceKpi);
        const coreF1 = coreItems.reduce((acc, it) => acc + it.f1, 0);
        const coreF2 = coreItems.reduce((acc, it) => acc + it.f2, 0);

        window.STOCK_METADATA = {
          sourceType: "Manual Excel Snapshot",
          sourceFile: b.sourceFilename,
          importedAt: b.importedAt,
          recordCount: b.stats.totalProducts,
          coreDevices: {
            floor1: coreF1,
            floor2: coreF2,
            total: coreF1 + coreF2
          },
          importedInventoryTotal: b.stats.grandTotal,
          importBatchId: b.batchId,
          storageMode: 'LOCAL_BROWSER_ONLY'
        };

        // If DataService exists, update it as well
        if (window.DataService && typeof window.DataService.setStockData === 'function') {
          window.DataService.setStockData(b.mergedResult.items);
        }

        // Trigger app.js synchronization to re-render table, cards, and metrics
        if (typeof window.syncMasterStockData === "function") {
          window.syncMasterStockData();
        }

        // Update Last Sync / Snapshot label in top header
        const lastSyncLabel = document.getElementById('lastSyncTime');
        if (lastSyncLabel) {
          const nowStr = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          lastSyncLabel.textContent = `Excel Snapshot (${nowStr})`;
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

      const statusEl = document.getElementById('stockUploadStatus');
      if (statusEl) statusEl.innerHTML = '';

      const fileInput = document.getElementById('stockFileInput');
      if (fileInput) fileInput.value = '';

      const stepItems = document.querySelectorAll('#stockStepper .step-item');
      if (stepItems[0]) stepItems[0].className = 'step-item active';
      if (stepItems[1]) stepItems[1].className = 'step-item';
      if (stepItems[2]) stepItems[2].className = 'step-item';
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
