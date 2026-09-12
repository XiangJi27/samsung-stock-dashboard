/**
 * Samsung Branch Operations - Google Sheet Stock Sync Engine (Mode B)
 * Client-Side Published CSV Ingestion with Strict Header Validation,
 * 10-Second Fetch Timeout, Error Resilience, and Automated Fallback to IndexedDB.
 *
 * Rules & Contract:
 * - Protocol: Direct browser fetch() of Google Sheet 'Publish to web' CSV.
 * - Required Columns: P/N, F1, F2, Total (case-insensitive aliases supported).
 * - Mismatch Policy: If required headers are missing, return SHEET_STRUCTURE_MISMATCH
 *   and NEVER attempt heuristic mapping. Extra columns are permitted.
 * - Safety & Fallback: If fetch fails or sheet is invalid, fall back to the latest
 *   active snapshot in IndexedDB. Never overwrite active data without diff preview.
 */

(function(root) {
  'use strict';

  const STORAGE_KEY_URL = 'samsung_stock_google_sheet_csv_url';
  const STORAGE_KEY_LAST_SYNC = 'samsung_stock_sheet_last_synced';
  const STORAGE_KEY_AUTO_PUBLISH = 'samsung_stock_sheet_auto_publish_opt_in';
  const DEFAULT_TIMEOUT_MS = 10000;

  // Header Aliases for Strict Normalization
  const HEADER_ALIASES = {
    pn: ['P/N', 'PN', 'PART NUMBER', 'PARTNUMBER', 'SKU', 'PART_NUMBER', 'ITEM_NO'],
    f1: ['F1', 'FLOOR 1', 'FLOOR1', 'STORE 1', 'STORE1', 'ช1', 'ชั้น 1', 'ชั้น1', 'F1_ON_HAND', 'F1 ON HAND'],
    f2: ['F2', 'FLOOR 2', 'FLOOR2', 'STORE 2', 'STORE2', 'ช2', 'ชั้น 2', 'ชั้น2', 'F2_ON_HAND', 'F2 ON HAND'],
    total: ['TOTAL', 'GRAND TOTAL', 'GRANDTOTAL', 'รวม', 'ยอดรวม', 'TOTAL_ON_HAND', 'TOTAL ON HAND']
  };

  const OPTIONAL_ALIASES = {
    description: ['DESCRIPTION', 'MODEL', 'PRODUCT NAME', 'ชื่อรุ่น', 'รายการ'],
    category1: ['CAT1', 'CATEGORY 1', 'CATEGORY', 'หมวดหมู่'],
    category2: ['CAT2', 'CATEGORY 2', 'SUBCATEGORY'],
    brand: ['BRAND', 'แบรนด์'],
    price99: ['PRICE 99', 'PRICE99', 'RRP', 'SRP', 'ราคาป้าย']
  };

  class GoogleSheetStockSync {
    /**
     * Validate headers of the Google Sheet CSV against required columns.
     * Strict policy: Must have P/N, F1, F2, Total. Never guess. Extra columns allowed.
     * @param {string[]} headers - Raw header strings
     * @returns {Object} Validation result with error or column mapping
     */
    static validateSheetStructure(headers) {
      if (!Array.isArray(headers) || headers.length === 0) {
        return {
          valid: false,
          errorCode: 'SHEET_STRUCTURE_MISMATCH',
          reason: 'ไม่พบคอลัมน์ในแถวหัวตาราง (Header Row ว่างเปล่า)',
          missingColumns: ['P/N', 'F1', 'F2', 'Total'],
          presentColumns: [],
          extraColumns: []
        };
      }

      const cleanHeaders = headers.map(h => (h !== undefined && h !== null ? String(h).trim() : ''));
      const upperHeaders = cleanHeaders.map(h => h.toUpperCase());

      const columnMap = {};
      const matchedIndices = new Set();

      // Match Required Headers
      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        let foundIdx = -1;
        for (let i = 0; i < upperHeaders.length; i++) {
          if (matchedIndices.has(i)) continue;
          const h = upperHeaders[i];
          if (aliases.includes(h)) {
            foundIdx = i;
            break;
          }
        }
        if (foundIdx !== -1) {
          columnMap[key] = cleanHeaders[foundIdx];
          matchedIndices.add(foundIdx);
        }
      }

      // Check Missing Required Columns
      const missingKeys = [];
      if (!columnMap.pn) missingKeys.push('P/N (หรือ PN)');
      if (!columnMap.f1) missingKeys.push('F1 (ชั้น 1)');
      if (!columnMap.f2) missingKeys.push('F2 (ชั้น 2)');
      if (!columnMap.total) missingKeys.push('Total (ยอดรวม)');

      if (missingKeys.length > 0) {
        // Collect extra unrecognized columns
        const extraCols = cleanHeaders.filter((_, idx) => !matchedIndices.has(idx));
        return {
          valid: false,
          errorCode: 'SHEET_STRUCTURE_MISMATCH',
          reason: `โครงสร้างคอลัมน์ไม่ตรงตามที่ระบบกำหนด ขาดคอลัมน์: ${missingKeys.join(', ')}`,
          missingColumns: missingKeys,
          presentColumns: cleanHeaders,
          extraColumns: extraCols
        };
      }

      // Match Optional Headers
      for (const [key, aliases] of Object.entries(OPTIONAL_ALIASES)) {
        for (let i = 0; i < upperHeaders.length; i++) {
          if (matchedIndices.has(i)) continue;
          const h = upperHeaders[i];
          if (aliases.includes(h)) {
            columnMap[key] = cleanHeaders[i];
            matchedIndices.add(i);
            break;
          }
        }
      }

      const extraCols = cleanHeaders.filter((_, idx) => !matchedIndices.has(idx));

      return {
        valid: true,
        columnMap,
        missingColumns: [],
        presentColumns: cleanHeaders,
        extraColumns: extraCols
      };
    }

    /**
     * Parse raw CSV text safely.
     * Uses PapaParse if available; otherwise falls back to RFC-4180 lightweight parser.
     * @param {string} csvText - Raw CSV text content
     * @returns {Object} Parsed items and metadata
     */
    static parseCsvContent(csvText) {
      if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
        const err = new Error('ไม่พบข้อมูลใน Google Sheet (ไฟล์ว่างเปล่า 0 แถว)');
        err.code = 'SHEET_EMPTY_ERROR';
        throw err;
      }

      let parsedRows = [];
      let headers = [];

      if (typeof Papa !== 'undefined' && Papa.parse) {
        const result = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: 'greedy',
          transformHeader: h => String(h || '').trim()
        });
        if (result.errors && result.errors.length > 0) {
          console.warn('[GoogleSheetStockSync] PapaParse warning/errors:', result.errors);
        }
        headers = result.meta && result.meta.fields ? result.meta.fields : [];
        parsedRows = result.data || [];
      } else {
        // Built-in RFC-4180 CSV Fallback Parser
        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length > 0) {
          headers = GoogleSheetStockSync.splitCsvLine(lines[0]);
          for (let i = 1; i < lines.length; i++) {
            const vals = GoogleSheetStockSync.splitCsvLine(lines[i]);
            const rowObj = {};
            headers.forEach((h, idx) => {
              rowObj[h] = vals[idx] !== undefined ? vals[idx] : '';
            });
            parsedRows.push(rowObj);
          }
        }
      }

      if (parsedRows.length === 0) {
        const err = new Error('ไม่พบแถวข้อมูลสินค้าใน Google Sheet (มีเฉพาะหัวตารางหรือว่างเปล่า)');
        err.code = 'SHEET_EMPTY_ERROR';
        throw err;
      }

      // Structure Validation
      const struct = this.validateSheetStructure(headers);
      if (!struct.valid) {
        const err = new Error(struct.reason);
        err.code = struct.errorCode;
        err.structure = struct;
        throw err;
      }

      const map = struct.columnMap;
      const rows = [];
      const warnings = [];
      const pnSeen = new Set();
      const duplicatePns = new Set();

      let f1Total = 0;
      let f2Total = 0;

      for (let i = 0; i < parsedRows.length; i++) {
        const rawRow = parsedRows[i];
        const rowNum = i + 2; // +1 for 0-index, +1 for header line

        const rawPn = rawRow[map.pn] !== undefined ? String(rawRow[map.pn]).trim() : '';
        if (!rawPn) {
          // Check if row has any values
          const hasAnyVal = Object.values(rawRow).some(v => v !== undefined && String(v).trim().length > 0);
          if (hasAnyVal) {
            warnings.push({
              type: 'MISSING_PN',
              row: rowNum,
              message: `แถว ${rowNum}: พบข้อมูลสต็อกแต่ไม่มีรหัส P/N (ระบบข้ามแถวนี้)`
            });
          }
          continue;
        }

        const exactPn = rawPn.toUpperCase();
        if (pnSeen.has(exactPn)) {
          duplicatePns.add(exactPn);
          warnings.push({
            type: 'DUPLICATE_PN',
            row: rowNum,
            pn: exactPn,
            message: `แถว ${rowNum}: พบรหัส P/N '${exactPn}' ซ้ำกับแถวก่อนหน้าใน Google Sheet`
          });
        }
        pnSeen.add(exactPn);

        // Parse F1, F2
        let f1 = Number(rawRow[map.f1]);
        if (isNaN(f1) || f1 < 0) {
          warnings.push({
            type: 'INVALID_F1',
            row: rowNum,
            pn: exactPn,
            message: `แถว ${rowNum} (${exactPn}): ยอด F1 ไม่ถูกต้อง ('${rawRow[map.f1]}') ปรับเป็น 0`
          });
          f1 = 0;
        } else {
          f1 = Math.floor(f1);
        }

        let f2 = Number(rawRow[map.f2]);
        if (isNaN(f2) || f2 < 0) {
          warnings.push({
            type: 'INVALID_F2',
            row: rowNum,
            pn: exactPn,
            message: `แถว ${rowNum} (${exactPn}): ยอด F2 ไม่ถูกต้อง ('${rawRow[map.f2]}') ปรับเป็น 0`
          });
          f2 = 0;
        } else {
          f2 = Math.floor(f2);
        }

        // Parse Total with Arithmetic Integrity
        let declaredTotal = Number(rawRow[map.total]);
        const computedTotal = f1 + f2;
        if (isNaN(declaredTotal) || declaredTotal !== computedTotal) {
          if (!isNaN(declaredTotal)) {
            warnings.push({
              type: 'TOTAL_ARITHMETIC_FIX',
              row: rowNum,
              pn: exactPn,
              message: `แถว ${rowNum} (${exactPn}): ยอดรวมในชีต (${declaredTotal}) != f1+f2 (${f1}+${f2}) -> ระบบคำนวณใหม่เป็น ${computedTotal}`
            });
          }
          declaredTotal = computedTotal;
        }

        f1Total += f1;
        f2Total += f2;

        const desc = map.description && rawRow[map.description] ? String(rawRow[map.description]).trim() : exactPn;
        const cat1 = map.category1 && rawRow[map.category1] ? String(rawRow[map.category1]).trim() : '';
        const brand = map.brand && rawRow[map.brand] ? String(rawRow[map.brand]).trim() : 'Samsung';
        const price99Val = map.price99 && rawRow[map.price99] ? Number(rawRow[map.price99]) : 0;

        // Determine inventory scope
        let scope = 'OTHER';
        const brandUpper = brand.toUpperCase();
        const cat1Upper = cat1.toUpperCase();
        const descUpper = desc.toUpperCase();

        if (cat1Upper.includes('PREMIUM') || cat1Upper.includes('GIFT') || descUpper.includes('PREMIUM')) {
          scope = 'PREMIUM_GIFT';
        } else if (cat1Upper.includes('SIM') || descUpper.includes('SIM')) {
          scope = 'SIM_SERVICE';
        } else if (brandUpper.includes('SAMSUNG') || exactPn.startsWith('SM-') || exactPn.startsWith('F-')) {
          if (exactPn.startsWith('EP-') || exactPn.startsWith('EF-') || exactPn.startsWith('GP-') || exactPn.startsWith('ET-')) {
            scope = 'SAMSUNG_ACCESSORY';
          } else {
            scope = 'CORE_DEVICE';
          }
        } else if (cat1Upper.includes('ACC') || cat1Upper.includes('CASE') || cat1Upper.includes('AUDIO')) {
          scope = 'THIRD_PARTY_ACCESSORY';
        }

        const isCore = (scope === 'CORE_DEVICE');
        let categoryLabel = 'Accessory';
        if (isCore) {
          if (cat1Upper.includes('TABLET') || descUpper.includes('TAB')) categoryLabel = 'Tablet';
          else if (cat1Upper.includes('WATCH') || descUpper.includes('WATCH')) categoryLabel = 'Watch';
          else categoryLabel = 'SmartPhone';
        }

        rows.push({
          pn: exactPn,
          model: desc,
          description: desc,
          category: categoryLabel,
          category1: cat1,
          category2: '',
          category3: '',
          brand: brand,
          srp: isNaN(price99Val) ? 0 : price99Val,
          stockReferencePrice: isNaN(price99Val) ? 0 : price99Val,
          f1: f1,
          f2: f2,
          total: computedTotal,
          stock_f1: f1,
          stock_f2: f2,
          stock_total: computedTotal,
          inventoryGroup: scope,
          includedInCoreDeviceKpi: isCore,
          sourceSheet: 'GoogleSheet_CSV',
          sourceLocation: (f1 > 0 && f2 > 0) ? 'BOTH_FLOORS' : (f1 > 0 ? 'FLOOR_1_ONLY' : 'FLOOR_2_ONLY'),
          rowNumber: rowNum
        });
      }

      rows.sort((a, b) => a.pn.localeCompare(b.pn));

      return {
        success: true,
        headers,
        totalRows: rows.length,
        uniquePns: pnSeen.size,
        duplicatePns: Array.from(duplicatePns),
        f1Total,
        f2Total,
        grandTotal: f1Total + f2Total,
        warnings,
        items: rows,
        structure: struct
      };
    }

    /**
     * Fetch Google Sheet published CSV with 10s timeout and error classification.
     * @param {string} publishedCsvUrl - Public Google Sheet CSV URL
     * @param {Object} options - { timeoutMs: 10000 }
     * @returns {Promise<Object>} Result object with items and stats
     */
    static async fetchGoogleSheetCsv(publishedCsvUrl, options = {}) {
      const url = (publishedCsvUrl || this.getStoredSheetUrl() || '').trim();
      if (!url) {
        const err = new Error('ยังไม่ได้ระบุลิงก์ Google Sheet CSV กรุณาตั้งค่าลิงก์ในหน้าจอก่อนกดซิงค์');
        err.code = 'URL_NOT_CONFIGURED';
        throw err;
      }

      if (!/^https?:\/\//i.test(url)) {
        const err = new Error('URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย https:// หรือ http://');
        err.code = 'INVALID_URL_SCHEME';
        throw err;
      }

      const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await fetch(url, {
          signal: controller.signal,
          cache: 'no-cache',
          headers: { 'Accept': 'text/csv, text/plain, */*' }
        });
      } catch (networkErr) {
        clearTimeout(timer);
        if (networkErr.name === 'AbortError') {
          const timeoutErr = new Error(`การเชื่อมต่อไปยัง Google Sheet หมดเวลา (เกิน ${timeoutMs / 1000} วินาที) กรุณาตรวจสอบสัญญาณอินเทอร์เน็ต`);
          timeoutErr.code = 'FETCH_TIMEOUT';
          throw timeoutErr;
        }
        const fetchErr = new Error(`ไม่สามารถเชื่อมต่อ Google Sheet ได้ (เน็ตเวิร์กมีปัญหา หรือติด CORS): ${networkErr.message}`);
        fetchErr.code = 'NETWORK_ERROR';
        throw fetchErr;
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const statusErr = new Error(`เซิร์ฟเวอร์ Google ตอบกลับสถานะข้อผิดพลาด HTTP ${response.status} (${response.statusText || 'เข้าถึงไม่ได้'}) โปรดตรวจว่าชีตถูกตั้งค่า Publish to web เป็น CSV หรือไม่`);
        statusErr.code = 'HTTP_ERROR';
        statusErr.httpStatus = response.status;
        throw statusErr;
      }

      const csvText = await response.text();

      // Compute SHA-256 of downloaded content
      let contentHash = '';
      try {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(csvText));
        contentHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        contentHash = `hash-${Date.now()}`;
      }

      const parsed = this.parseCsvContent(csvText);
      parsed.sourceUrl = url;
      parsed.contentHash = contentHash;
      parsed.fetchedAt = new Date().toISOString();

      return parsed;
    }

    /**
     * Convert Google Sheet Sync Result into Staged Batch for StockImportController Diff Preview.
     */
    static createStagedBatchFromSync(syncResult, currentStockList = []) {
      const currentMap = new Map();
      (currentStockList || []).forEach(item => {
        const key = (item.pn || item.sku || '').trim().toUpperCase();
        if (key) currentMap.set(key, item);
      });

      let changedCount = 0;
      let unchangedCount = 0;
      let newCount = 0;

      const diffItems = syncResult.items.map(newItem => {
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

      const batchId = `STOCK-GSHEET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      return {
        batchId,
        sourceType: 'GOOGLE_SHEET_CSV_SYNC',
        sourceFilename: 'Google_Sheet_Stock_Sync.csv',
        fileHash: syncResult.contentHash,
        importedAt: syncResult.fetchedAt,
        mergedResult: {
          totalUniqueProducts: syncResult.totalRows,
          f1Total: syncResult.f1Total,
          f2Total: syncResult.f2Total,
          grandTotal: syncResult.grandTotal,
          items: syncResult.items,
          warnings: syncResult.warnings
        },
        diffItems,
        warnings: syncResult.warnings || [],
        stats: {
          totalProducts: syncResult.totalRows,
          f1Total: syncResult.f1Total,
          f2Total: syncResult.f2Total,
          grandTotal: syncResult.grandTotal,
          newCount,
          changedCount,
          unchangedCount
        }
      };
    }

    /**
     * Fallback RFC-4180 CSV splitter for simple quoted rows
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

    static getStoredSheetUrl() {
      try {
        return localStorage.getItem(STORAGE_KEY_URL) || (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_SHEET_STOCK_CSV_URL) || '';
      } catch (e) {
        return '';
      }
    }

    static setStoredSheetUrl(url) {
      try {
        localStorage.setItem(STORAGE_KEY_URL, String(url || '').trim());
        return true;
      } catch (e) {
        console.warn('Could not store Google Sheet URL:', e);
        return false;
      }
    }

    static getLastSyncTime() {
      try {
        return localStorage.getItem(STORAGE_KEY_LAST_SYNC) || null;
      } catch (e) {
        return null;
      }
    }

    static setLastSyncTime(isoStr) {
      try {
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, isoStr || new Date().toISOString());
      } catch (e) {
        // ignore
      }
    }
  }

  root.GoogleSheetStockSync = GoogleSheetStockSync;

})(typeof window !== 'undefined' ? window : global);
