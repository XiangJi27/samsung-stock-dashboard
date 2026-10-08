/**
 * Samsung Branch Operations - Google Sheet Stock Sync Engine (Mode B)
 * Dual-Tab (Stock1 / Stock2) & Pre-Merged Published CSV Ingestion Engine.
 *
 * Rules & Contract:
 * - Protocols supported:
 *   1) Direct Google Spreadsheet URL: fetches 'Stock1' and 'Stock2' tabs via gviz CSV export.
 *   2) Dual Published CSV URLs: fetches Stock1 (Floor 1) and Stock2 (Floor 2) published links.
 *   3) Single Combined CSV: legacy published link with P/N, F1, F2 columns.
 * - Header Detection: Dynamically scans rows 0 to 15 to locate native Copperwired headers
 *   (Cat1, Brand, Price 99, P/N, On Hand), automatically skipping rows 1-3.
 * - Zero Re-categorization: Maps Cat1, Cat2, Cat3, Brand directly from source.
 * - Safety & Fallback: Diff preview before committing; never overwrite active data blindly.
 */

(function(root) {
  'use strict';

  const STORAGE_KEY_URL = 'samsung_stock_google_sheet_csv_url';
  const STORAGE_KEY_URL2 = 'samsung_stock_google_sheet_csv_url_s2';
  const STORAGE_KEY_LAST_SYNC = 'samsung_stock_sheet_last_synced';
  const STORAGE_KEY_AUTO_PUBLISH = 'samsung_stock_sheet_auto_publish_opt_in';
  const DEFAULT_TIMEOUT_MS = 10000;

  // Embedded default URLs for Ayutthaya City Park branch
  const DEFAULT_URL_STOCK1 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQdXINDBDeqjdYB_Z0gDeN1tO9mV8XnRrKjop8hMT-rn6uXElUPAbLkxuDKphtub2MRVDdKV5AmUIcd/pub?gid=787572414&single=true&output=csv';
  const DEFAULT_URL_STOCK2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQdXINDBDeqjdYB_Z0gDeN1tO9mV8XnRrKjop8hMT-rn6uXElUPAbLkxuDKphtub2MRVDdKV5AmUIcd/pub?gid=86580790&single=true&output=csv';

  class GoogleSheetStockSync {
    /**
     * Parse a single CSV line adhering to RFC-4180 quotes.
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
     * Unified Device Classifier matching Ayutthaya City Park Branch Inventory Rules:
     * - Smartphone: 237 (Cat1 'Smart Phones' or SM-S, SM-A, SM-F, F-A, F-N, F-S)
     * - Tablet: 43 (Cat1 'Computer and Tablet' + Tab BOM keyboard covers F-X)
     * - Watch: 70 (Cat1 'Smart Watch' + Fit3 SM-R3)
     * - Buds: 51 (Cat1 'Audio' Samsung + SM-R4, SM-R5, SM-R6)
     * - SIM: Service, Insurance and Warranty / SIM
     * - Premium: Premium / Free Gift
     * - Accessory: All cases, films, adapters, 3rd party audio
     */
    static classifyDevice(pn, cat1, brand, desc) {
      const pnu = String(pn || '').toUpperCase();
      const c1u = String(cat1 || '').toUpperCase();
      const bu = String(brand || '').toUpperCase();
      const du = String(desc || '').toUpperCase();

      // 1. Premium & Free Gift
      if (c1u.includes('PREMIUM') || c1u.includes('GIFT') || du.includes('PREMIUM') || du.includes('GIFT') || du.includes('FREE') || du.startsWith('[PM]') || pnu.startsWith('PM') || pnu.startsWith('PREMIUM') || pnu.startsWith('Z-')) {
        return { category: 'Premium', scope: 'PREMIUM_GIFT', isCore: false };
      }

      // 2. SIM Service
      if (c1u.includes('SERVICE') || c1u.includes('SIM') || du.includes('SIM') || du.includes('(AIS)') || pnu.startsWith('SIM-') || pnu.startsWith('3IN1') || pnu.startsWith('PRE2POST') || pnu.startsWith('SI87')) {
        return { category: 'SIM', scope: 'SIM_SERVICE', isCore: false };
      }

      // 3. Accessory brands & standard Samsung accessory prefixes
      if (du.startsWith('[CS]') || du.includes('FOCUS') || du.includes('HISHIELD') || du.includes('MERCURY') ||
          du.includes('UGREEN') || du.includes('PISEN') || du.includes('JISULIFE') || du.includes('SANDISK') ||
          du.includes('BELKIN') || du.includes('ADAM') || du.includes('SOUNDCORE') || du.includes('AIR PURIFIER') ||
          pnu.startsWith('EP-') || pnu.startsWith('EF-') || pnu.startsWith('GP-') || pnu.startsWith('ET-') ||
          pnu.startsWith('EJ-') || pnu.startsWith('EE-') || pnu.startsWith('SSG-')) {
        return { category: 'Accessory', scope: 'SAMSUNG_ACCESSORY', isCore: false };
      }

      // 4. Galaxy Buds
      if (pnu.startsWith('SM-R4') || pnu.startsWith('SM-R5') || pnu.startsWith('SM-R6') ||
          ((c1u === 'AUDIO' || du.includes('BUDS')) && bu.includes('SAMSUNG') && !du.includes('CASE') && !du.includes('COVER'))) {
        if (du.includes('CASE') || du.includes('COVER')) {
          return { category: 'Accessory', scope: 'SAMSUNG_ACCESSORY', isCore: false };
        }
        return { category: 'Buds', scope: 'CORE_DEVICE', isCore: true };
      }

      // 5. Galaxy Watch & Fit (SM-L*, SM-R8*, SM-R9*, SM-R3*)
      if (pnu.startsWith('SM-L') || pnu.startsWith('SM-R8') || pnu.startsWith('SM-R9') || pnu.startsWith('SM-R3') || c1u === 'SMART WATCH' ||
          ((du.includes('WATCH') || du.includes('FIT')) && !du.includes('BAND') && !du.includes('STRAP') && !du.includes('CASE') && !du.includes('COVER') && !du.includes('BEZEL'))) {
        return { category: 'Watch', scope: 'CORE_DEVICE', isCore: true };
      }

      // 6. Galaxy Tablet (SM-X*, F-X*, Cat1 Computer and Tablet)
      if (pnu.startsWith('SM-X') || pnu.startsWith('F-X') || c1u === 'COMPUTER AND TABLET' ||
          ((c1u.includes('TABLET') || du.includes('TAB ') || du.includes('TABLET') || du.includes('GALAXY TAB')) &&
           !du.includes('CASE') && !du.includes('COVER') && !du.includes('FILM') && !du.includes('GLASS') && !du.includes('TG') && !du.includes('PEN') && !du.includes('SLEEVE') && !du.includes('STAND'))) {
        return { category: 'Tablet', scope: 'CORE_DEVICE', isCore: true };
      }

      // 7. Smartphone (Cat1 Smart Phones or SM-S, SM-A, SM-F, F-A, F-N, F-S)
      if (c1u === 'SMART PHONES' || pnu.startsWith('SM-S') || pnu.startsWith('SM-A') || pnu.startsWith('SM-F') ||
          pnu.startsWith('F-A') || pnu.startsWith('F-N') || pnu.startsWith('F-S') ||
          (du.includes('GALAXY') && (du.includes(' A') || du.includes(' S') || du.includes('FOLD') || du.includes('FLIP')))) {
        if (!du.includes('CASE') && !du.includes('COVER') && !du.includes('FILM') && !du.includes('GLASS') && !du.includes('RING') && !du.includes('STAND') && !du.includes('BAG')) {
          return { category: 'SmartPhone', scope: 'CORE_DEVICE', isCore: true };
        }
        return { category: 'Accessory', scope: 'SAMSUNG_ACCESSORY', isCore: false };
      }

      return { category: 'Accessory', scope: 'THIRD_PARTY_ACCESSORY', isCore: false };
    }

    /**
     * Parse raw CSV text of a single sheet (e.g. Stock1 or Stock2 or Combined).
     * Automatically scans rows 0 to 15 to locate the header row.
     */
    static parseSingleSheetCsv(csvText, sheetLabel = 'Stock') {
      if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
        const err = new Error(`ไม่พบข้อมูลในชีต ${sheetLabel} (เนื้อหาว่างเปล่า)`);
        err.code = 'SHEET_EMPTY_ERROR';
        throw err;
      }

      const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
      let headerRowIdx = -1;
      let headers = [];

      for (let r = 0; r < Math.min(15, lines.length); r++) {
        const rawCols = this.splitCsvLine(lines[r]).map(c => c.replace(/^"|"$/g, '').trim().toUpperCase());
        if (rawCols.includes('P/N') && (rawCols.includes('ON HAND') || rawCols.includes('ONHAND') || rawCols.includes('F1') || rawCols.includes('CAT1') || rawCols.includes('STOCK1'))) {
          headerRowIdx = r;
          headers = this.splitCsvLine(lines[r]).map(c => c.replace(/^"|"$/g, '').trim());
          break;
        }
      }

      if (headerRowIdx === -1) {
        // Fallback: try checking line 0 if it has P/N or PN
        const firstCols = this.splitCsvLine(lines[0]).map(c => c.replace(/^"|"$/g, '').trim().toUpperCase());
        if (firstCols.some(c => c === 'P/N' || c === 'PN' || c === 'PART NUMBER')) {
          headerRowIdx = 0;
          headers = this.splitCsvLine(lines[0]).map(c => c.replace(/^"|"$/g, '').trim());
        } else {
          const err = new Error(`ไม่พบแถวหัวตาราง (Header) ที่มีคอลัมน์ P/N ในชีต ${sheetLabel}`);
          err.code = 'SHEET_STRUCTURE_MISMATCH';
          throw err;
        }
      }

      const colMap = {};
      headers.forEach((h, idx) => {
        const u = h.toUpperCase();
        if (u === 'CAT1' || u === 'CATEGORY 1' || u === 'CATEGORY' || u === 'หมวดหมู่') colMap['cat1'] = idx;
        else if (u === 'CAT2' || u === 'CATEGORY 2' || u === 'SUBCATEGORY') colMap['cat2'] = idx;
        else if (u === 'CAT3' || u === 'CATEGORY 3') colMap['cat3'] = idx;
        else if (u === 'BRAND' || u === 'แบรนด์') colMap['brand'] = idx;
        else if (u.includes('PRICE 99') || u === 'PRICE99' || u === 'RRP' || u === 'SRP' || u === 'ราคาปกติ' || u === 'PRICE') colMap['price99'] = idx;
        else if (u === 'P/N' || u === 'PN' || u === 'PART NUMBER' || u === 'PART_NUMBER' || u === 'SKU') colMap['pn'] = idx;
        else if (u.includes('KOAN SKU')) colMap['koanSku'] = idx;
        else if (u.includes('APPLE PART')) colMap['applePart'] = idx;
        else if (['DESCRIPTION', 'ITEM DESCRIPTION', 'PRODUCT DESCRIPTION', 'PRODUCT NAME', 'MODEL', 'ชื่อรุ่น', 'รายการ', 'รายละเอียด'].includes(u)) colMap['desc'] = idx;
        else if (['ON HAND', 'ONHAND', 'F1', 'FLOOR 1', 'STOCK1', 'STOCK 1', 'ช1', 'ชั้น 1'].includes(u)) colMap['onHand'] = idx;
        else if (['F2', 'FLOOR 2', 'STOCK2', 'STOCK 2', 'ช2', 'ชั้น 2'].includes(u)) colMap['f2'] = idx;
        else if (u.includes('ON B/R')) colMap['onBr'] = idx;
        else if (u.includes('ON ALLOC')) colMap['onAlloc'] = idx;
        else if (u.includes('ON T/F')) colMap['onTf'] = idx;
      });

      if (colMap['pn'] === undefined) {
        const err = new Error(`ไม่พบคอลัมน์ P/N ในแถวหัวตารางของ ${sheetLabel}`);
        err.code = 'SHEET_STRUCTURE_MISMATCH';
        throw err;
      }

      const isPreMerged = (colMap['f2'] !== undefined);
      const items = new Map();
      const duplicatePns = new Set();
      const warnings = [];

      for (let r = headerRowIdx + 1; r < lines.length; r++) {
        const cols = this.splitCsvLine(lines[r]).map(c => c.replace(/^"|"$/g, '').trim());
        if (!cols || cols.length <= colMap['pn']) continue;
        const rawPn = cols[colMap['pn']];
        if (!rawPn) continue;
        const pn = rawPn.toUpperCase();

        const ohRaw = colMap['onHand'] !== undefined && cols[colMap['onHand']] !== undefined ? cols[colMap['onHand']] : '0';
        let oh = parseInt(parseFloat(ohRaw.replace(/,/g, '')) || 0, 10);
        if (isNaN(oh) || oh < 0) oh = 0;

        let f2Val = 0;
        if (isPreMerged && colMap['f2'] !== undefined && cols[colMap['f2']] !== undefined) {
          f2Val = parseInt(parseFloat(cols[colMap['f2']].replace(/,/g, '')) || 0, 10);
          if (isNaN(f2Val) || f2Val < 0) f2Val = 0;
        }

        const cat1 = colMap['cat1'] !== undefined && cols[colMap['cat1']] ? cols[colMap['cat1']] : '';
        const cat2 = colMap['cat2'] !== undefined && cols[colMap['cat2']] ? cols[colMap['cat2']] : '';
        const cat3 = colMap['cat3'] !== undefined && cols[colMap['cat3']] ? cols[colMap['cat3']] : '';
        const brand = colMap['brand'] !== undefined && cols[colMap['brand']] ? cols[colMap['brand']] : 'Samsung';
        const desc = colMap['desc'] !== undefined && cols[colMap['desc']] ? cols[colMap['desc']] : pn;
        const p99 = colMap['price99'] !== undefined && cols[colMap['price99']] ? (parseFloat(cols[colMap['price99']].replace(/,/g, '')) || 0) : 0;
        const koan = colMap['koanSku'] !== undefined && cols[colMap['koanSku']] ? cols[colMap['koanSku']] : '';
        const apple = colMap['applePart'] !== undefined && cols[colMap['applePart']] ? cols[colMap['applePart']] : '';

        if (items.has(pn)) {
          duplicatePns.add(pn);
          const existing = items.get(pn);
          existing.onHand += oh;
          if (isPreMerged) existing.f2 += f2Val;
          if ((!existing.p99 || existing.p99 === 0) && p99 > 0) existing.p99 = p99;
          if ((!existing.desc || existing.desc === pn) && desc && desc !== pn) existing.desc = desc;
          warnings.push({
            type: 'DUPLICATE_PN',
            row: r + 1,
            pn: pn,
            message: `${sheetLabel} แถว ${r + 1}: พบรหัส P/N '${pn}' ซ้ำ -> รวมยอดสต็อกเข้าด้วยกันอัตโนมัติ`
          });
          continue;
        }

        items.set(pn, {
          pn,
          onHand: oh,
          f2: f2Val,
          cat1,
          cat2,
          cat3,
          brand,
          desc,
          p99,
          koanSku: koan,
          applePart: apple,
          isPreMerged,
          rowNumber: r + 1
        });
      }

      return {
        sheetLabel,
        items,
        isPreMerged,
        headers,
        totalRows: items.size,
        duplicatePns: Array.from(duplicatePns),
        warnings
      };
    }

    /**
     * Merge Stock1 and Stock2 parsed items into unified inventory dataset.
     */
    static mergeParsedSheets(s1Result, s2Result = null) {
      const s1Map = s1Result.items;
      const s2Map = s2Result ? s2Result.items : new Map();

      const allPns = new Set([...s1Map.keys(), ...s2Map.keys()]);
      const merged = [];
      const allWarnings = [
        ...(s1Result.warnings || []),
        ...(s2Result ? s2Result.warnings : [])
      ];

      let f1Total = 0;
      let f2Total = 0;
      let matchedCount = 0;
      let s1OnlyCount = 0;
      let s2OnlyCount = 0;

      allPns.forEach(pn => {
        const r1 = s1Map.get(pn);
        const r2 = s2Map.get(pn);
        const ref = r1 || r2;

        let f1 = 0;
        let f2 = 0;

        if (s1Result.isPreMerged && r1) {
          f1 = r1.onHand;
          f2 = r1.f2;
          if (f1 > 0 && f2 > 0) matchedCount++;
          else if (f1 > 0) s1OnlyCount++;
          else s2OnlyCount++;
        } else if (r1 && r2) {
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

        const { category, scope, isCore } = this.classifyDevice(pn, ref.cat1, ref.brand, ref.desc);

        // Resolve Product Color
        let color = '';
        if (typeof root.resolveProductColor === 'function') {
          color = root.resolveProductColor(ref);
        } else if (typeof root.extractColorFromDescription === 'function') {
          color = root.extractColorFromDescription(ref.desc);
        }

        const itemObj = {
          pn: pn,
          model: ref.desc || pn,
          description: ref.desc || pn,
          color: color,
          category: category,
          canonicalCategory: category,
          category1: ref.cat1 || category,
          category2: ref.cat2 || '',
          category3: ref.cat3 || '',
          brand: ref.brand || 'Samsung',
          koanSku: ref.koanSku || '',
          applePart: ref.applePart || '',
          srp: ref.p99 || 0,
          stockReferencePrice: ref.p99 || 0,
          f1: f1,
          f2: f2,
          total: f1 + f2,
          stock_f1: f1,
          stock_f2: f2,
          stock_total: f1 + f2,
          inventoryGroup: scope,
          includedInCoreDeviceKpi: isCore,
          sourceSheet: s2Result ? 'Stock1 + Stock2 (Dual-Sheet Sync)' : (s1Result.isPreMerged ? 'GoogleSheet_Combined_CSV' : 'Stock1 (Floor 1 Only)'),
          sourceLocation: (f1 > 0 && f2 > 0) ? 'BOTH_FLOORS' : (f1 > 0 ? 'FLOOR_1_ONLY' : 'FLOOR_2_ONLY')
        };

        merged.push(itemObj);
      });

      merged.sort((a, b) => a.pn.localeCompare(b.pn));

      return {
        success: true,
        totalRows: merged.length,
        uniquePns: allPns.size,
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

    /**
     * Fetch a raw URL with timeout and error classification.
     */
    static async fetchUrlCsv(url, options = {}) {
      const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

      // 1. Direct browser fetch
      let directFailed = false;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-cache',
            headers: { 'Accept': 'text/csv, text/plain, */*' }
          });
          clearTimeout(timer);
          if (response.ok) {
            return await response.text();
          }
        } finally {
          clearTimeout(timer);
        }
      } catch (directErr) {
        directFailed = true;
        console.warn('[GoogleSheetStockSync] Direct fetch failed (likely CORS), attempting proxy fallback:', directErr.message);
      }

      // 2. Serverless proxy fallback (/api/sheet-proxy)
      try {
        const proxyUrl = `/api/sheet-proxy?url=${encodeURIComponent(url)}`;
        const proxyController = new AbortController();
        const proxyTimer = setTimeout(() => proxyController.abort(), timeoutMs);
        try {
          const proxyRes = await fetch(proxyUrl, {
            signal: proxyController.signal,
            cache: 'no-cache'
          });
          clearTimeout(proxyTimer);
          if (proxyRes.ok) {
            return await proxyRes.text();
          }
          const errJson = await proxyRes.json().catch(() => ({}));
          if (errJson && errJson.error) {
            throw new Error(errJson.error);
          }
        } finally {
          clearTimeout(proxyTimer);
        }
      } catch (proxyErr) {
        console.warn('[GoogleSheetStockSync] Proxy fallback error:', proxyErr.message);
        if (proxyErr.message && !proxyErr.message.includes('fetch')) {
          throw proxyErr;
        }
      }

      throw new Error('ไม่สามารถเชื่อมต่อ Google Sheet ได้ กรุณาตรวจสอบว่าชีตตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์มีสิทธิ์ดู" หรือ Publish to web เรียบร้อยแล้ว');
    }

    /**
     * Fetch Google Sheet stock supporting:
     * 1. Google Spreadsheet Link: extracts ID and fetches 'Stock1' and 'Stock2' via gviz
     * 2. Dual Published URLs: fetches { url1, url2 }
     * 3. Single Published URL: fetches url, parses as combined or Stock1
     */
    static async fetchGoogleSheetCsv(urlInput, options = {}) {
      let url1 = '';
      let url2 = '';

      if (typeof urlInput === 'object' && urlInput !== null) {
        url1 = (urlInput.url1 || urlInput.url || '').trim();
        url2 = (urlInput.url2 || urlInput.stock2Url || '').trim();
      } else {
        url1 = String(urlInput || this.getStoredSheetUrl() || '').trim();
        url2 = String(this.getStoredSheetUrl2() || '').trim();
      }

      if (!url1) {
        const err = new Error('ยังไม่ได้ระบุลิงก์ Google Sheet กรุณาใส่ลิงก์ก่อนกดรีเฟรช');
        err.code = 'URL_NOT_CONFIGURED';
        throw err;
      }

      // Check if url1 is a standard Google Spreadsheet URL (e.g. /spreadsheets/d/{ID}/...)
      const matchDoc = url1.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const isPublishedDoc = url1.includes('/pub') || url1.includes('/d/e/2PACX-');

      let s1Text = '';
      let s2Text = '';
      let isDualSheetMode = false;

      // MODE 1: Standard Google Spreadsheet URL (Auto-fetch Stock1 + Stock2 tabs)
      if (matchDoc && !isPublishedDoc && !url2) {
        const docId = matchDoc[1];
        const s1GvizUrl = `https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv&sheet=Stock1`;
        const s2GvizUrl = `https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv&sheet=Stock2`;

        try {
          const [res1, res2] = await Promise.all([
            this.fetchUrlCsv(s1GvizUrl, options),
            this.fetchUrlCsv(s2GvizUrl, options)
          ]);
          s1Text = res1;
          s2Text = res2;
          isDualSheetMode = true;
        } catch (dualErr) {
          console.warn('[GoogleSheetStockSync] Dual gviz fetch (Stock1/Stock2) had issue, falling back to direct URL:', dualErr);
          // Fall back to direct fetch of url1
          s1Text = await this.fetchUrlCsv(url1, options);
        }
      }
      // MODE 2: Explicit Two URLs (Stock1 + Stock2)
      else if (url1 && url2) {
        const [res1, res2] = await Promise.all([
          this.fetchUrlCsv(url1, options),
          this.fetchUrlCsv(url2, options)
        ]);
        s1Text = res1;
        s2Text = res2;
        isDualSheetMode = true;
      }
      // MODE 3: Single Published CSV URL
      else {
        s1Text = await this.fetchUrlCsv(url1, options);
      }

      // Parse sheets
      const s1Parsed = this.parseSingleSheetCsv(s1Text, 'Stock1 (ชั้น 1)');
      let s2Parsed = null;

      if (isDualSheetMode && s2Text) {
        try {
          s2Parsed = this.parseSingleSheetCsv(s2Text, 'Stock2 (ชั้น 2)');
        } catch (s2Err) {
          console.warn('[GoogleSheetStockSync] Could not parse Stock2, continuing with Stock1:', s2Err);
        }
      }

      const mergedResult = this.mergeParsedSheets(s1Parsed, s2Parsed);

      // Compute Hash
      let contentHash = '';
      try {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(s1Text + (s2Text || '')));
        contentHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        contentHash = `hash-${Date.now()}`;
      }

      mergedResult.sourceUrl = url1;
      mergedResult.sourceUrl2 = url2 || '';
      mergedResult.contentHash = contentHash;
      mergedResult.fetchedAt = new Date().toISOString();

      return mergedResult;
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

        const prevF1 = curr ? Number(curr.f1 || curr.floor1 || 0) : 0;
        const prevF2 = curr ? Number(curr.f2 || curr.floor2 || 0) : 0;
        const prevTotal = curr ? Number(curr.total || 0) : 0;

        return {
          ...newItem,
          inventoryScope: newItem.inventoryGroup || 'ACCESSORY',
          prevF1,
          prevF2,
          prevTotal,
          currentF1: prevF1,
          currentF2: prevF2,
          currentTotal: prevTotal,
          diffF1,
          diffF2,
          diffTotal,
          isNew,
          isChanged,
          registrationStatus: isNew ? 'PENDING_PRODUCT_REVIEW' : 'VERIFIED_ACTIVE',
          riskFlags: [],
          diffType: isNew ? 'NEW_SKU' : (isChanged ? 'QUANTITY_CHANGED' : 'IDENTICAL')
        };
      });

      const batchId = `GBS-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const sourceFilename = syncResult.sourceUrl2 ? 'GoogleSheet (Stock1 + Stock2)' : 'GoogleSheet (Live)';

      const stats = {
        totalProducts: syncResult.totalRows,
        f1Total: syncResult.f1Total,
        f2Total: syncResult.f2Total,
        grandTotal: syncResult.grandTotal,
        changedCount,
        newCount,
        unchangedCount
      };

      return {
        batchId,
        sourceMode: 'MODE_B_GOOGLE_SHEET',
        sourceFilename,
        fileHash: syncResult.contentHash,
        importedAt: syncResult.fetchedAt,
        sourceFileHash: syncResult.contentHash,
        sourceUrl: syncResult.sourceUrl,
        diffItems: diffItems,
        items: diffItems,
        mergedResult: syncResult,
        warnings: syncResult.warnings || [],
        stats: stats,
        meta: {
          schemaVersion: '2.0.0',
          batchId,
          importedAt: syncResult.fetchedAt,
          sourceFileName: sourceFilename,
          sourceFilename: sourceFilename,
          sourceFileHash: syncResult.contentHash,
          sourceMode: 'MODE_B_GOOGLE_SHEET',
          totalSKUs: syncResult.totalRows,
          f1Total: syncResult.f1Total,
          f2Total: syncResult.f2Total,
          grandTotal: syncResult.grandTotal,
          changedCount,
          newCount,
          unchangedCount,
          warnings: syncResult.warnings || [],
          status: 'ACTIVE_SNAPSHOT',
          stats: stats
        },
        data: syncResult.items
      };
    }

    static getStoredSheetUrl() {
      try {
        return localStorage.getItem(STORAGE_KEY_URL) || (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_SHEET_STOCK_CSV_URL) || DEFAULT_URL_STOCK1;
      } catch (e) {
        return DEFAULT_URL_STOCK1;
      }
    }

    static setStoredSheetUrl(url) {
      try {
        const clean = String(url || '').trim();
        localStorage.setItem(STORAGE_KEY_URL, clean);
        fetch('/api/branch-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stockUrls: { f1: clean } })
        }).catch(() => {});
        return true;
      } catch (e) {
        return false;
      }
    }

    static getStoredSheetUrl2() {
      try {
        return localStorage.getItem(STORAGE_KEY_URL2) || (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_SHEET_STOCK_CSV_URL_S2) || DEFAULT_URL_STOCK2;
      } catch (e) {
        return DEFAULT_URL_STOCK2;
      }
    }

    static setStoredSheetUrl2(url) {
      try {
        const clean = String(url || '').trim();
        localStorage.setItem(STORAGE_KEY_URL2, clean);
        fetch('/api/branch-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stockUrls: { f2: clean } })
        }).catch(() => {});
        return true;
      } catch (e) {
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

    /**
     * Singleton live sync promise to avoid redundant concurrent network calls.
     */
    static _activeSyncPromise = null;
    static _hasCompletedSync = false;

    /**
     * Ensures live stock is fetched from Google Sheet before initial UI render (Zero-Flicker Gate).
     */
    static async ensureLiveSynced(maxWaitMs = 4000) {
      if (this._hasCompletedSync) return true;
      const syncPromise = this.performLiveSync({ isBackgroundSync: true });
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), maxWaitMs));
      return Promise.race([syncPromise, timeoutPromise]);
    }

    /**
     * Performs direct live sync from Google Sheet and activates it into the system state.
     * Used by background auto-sync across all branch devices.
     */
    static performLiveSync(options = {}) {
      if (this._hasCompletedSync && !options.force) {
        return Promise.resolve({ success: true, alreadySynced: true });
      }
      if (this._activeSyncPromise) {
        return this._activeSyncPromise;
      }

      this._activeSyncPromise = (async () => {
        try {
          const url1 = options.url1 || this.getStoredSheetUrl();
          const url2 = options.url2 || this.getStoredSheetUrl2();
          if (!url1) {
            throw new Error('Google Sheet URL is not configured');
          }

          console.info('[GoogleSheetStockSync] Starting background live sync...');
          const syncResult = await this.fetchGoogleSheetCsv({ url1, url2 });
          if (!syncResult || !Array.isArray(syncResult.items) || syncResult.items.length === 0) {
            throw new Error('Google Sheet returned no items');
          }

          const currentStockList = (typeof window !== 'undefined' && (window.STOCK_DATA || window.STOCK_DATABASE)) || [];
          const staged = this.createStagedBatchFromSync(syncResult, currentStockList);

          const batchId = staged.batchId;
          const coreItems = syncResult.items.filter(it => it.includedInCoreDeviceKpi);
          const coreF1 = coreItems.reduce((acc, it) => acc + (it.f1 || 0), 0);
          const coreF2 = coreItems.reduce((acc, it) => acc + (it.f2 || 0), 0);

          const batchRecord = {
            batchId: batchId,
            data: syncResult.items,
            meta: {
              stockBatchId: batchId,
              importBatchId: batchId,
              batchId: batchId,
              importedAt: syncResult.fetchedAt,
              sourceFilename: staged.sourceFilename,
              sourceFileHash: staged.fileHash,
              uniquePn: syncResult.totalRows,
              f1Total: syncResult.f1Total,
              f2Total: syncResult.f2Total,
              grandTotal: syncResult.grandTotal,
              coreDevices: {
                floor1: coreF1,
                floor2: coreF2,
                total: coreF1 + coreF2
              },
              storageScope: 'GOOGLE_SHEET_LIVE_SYNC',
              storageMode: 'GOOGLE_SHEET_LIVE_SYNC',
              schemaVersion: '2.0.0',
              applicationVersion: '20260907-b2',
              stats: staged.stats,
              status: 'ACTIVE'
            }
          };

          // Persist to IndexedDB
          if (typeof root !== 'undefined' && root.StockStorageAdapter && typeof root.StockStorageAdapter.saveBatch === 'function') {
            try {
              await root.StockStorageAdapter.saveBatch(batchRecord);
            } catch (e) {
              console.warn('[GoogleSheetStockSync] Failed to save batch to IndexedDB:', e);
            }
          }

          // Update in-memory state
          if (typeof root !== 'undefined') {
            root.STOCK_DATABASE = syncResult.items;
            root.STOCK_DATA = syncResult.items;
            root.LATEST_STOCK_SNAPSHOT = syncResult.items;
            root.CONFIRMED_LOCAL_SNAPSHOT = batchRecord;
            root.STOCK_METADATA = batchRecord.meta;
            root.PILOT_STOCK_METADATA = batchRecord.meta;
            root.STOCK_SNAPSHOT_STATUS = 'GOOGLE_SHEET_LIVE_SYNC';

            if (root.DataService && typeof root.DataService.setStockData === 'function') {
              root.DataService.setStockData(syncResult.items);
            }

            if (root.PrototypeStock && typeof root.PrototypeStock.refresh === 'function') {
              root.PrototypeStock.refresh();
            } else if (typeof root.initPrototypeStock === 'function') {
              root.initPrototypeStock();
            } else if (typeof root.syncMasterStockData === 'function') {
              root.syncMasterStockData();
            }

            if (typeof root.updateStockImportBanner === 'function') {
              root.updateStockImportBanner('GOOGLE_SHEET_LIVE_SYNC', batchRecord.meta);
            }

            const importTimeFormatted = syncResult.fetchedAt ? syncResult.fetchedAt.replace('T', ' ').substring(0, 19) : '';
            const lastSyncLabel = document.getElementById('lastSyncTime');
            if (lastSyncLabel && importTimeFormatted) {
              lastSyncLabel.textContent = `Google Sheet (${importTimeFormatted})`;
            }

            this.setLastSyncTime(syncResult.fetchedAt);
          }

          this._hasCompletedSync = true;
          console.info(`[GoogleSheetStockSync] Live sync complete: ${syncResult.totalRows} items, F1: ${syncResult.f1Total}, F2: ${syncResult.f2Total}, Grand Total: ${syncResult.grandTotal}`);
          return {
            success: true,
            batchId,
            totalProducts: syncResult.totalRows,
            f1Total: syncResult.f1Total,
            f2Total: syncResult.f2Total,
            grandTotal: syncResult.grandTotal
          };
        } finally {
          this._activeSyncPromise = null;
        }
      })();

      return this._activeSyncPromise;
    }
  }

  root.GoogleSheetStockSync = GoogleSheetStockSync;

})(typeof window !== 'undefined' ? window : global);
