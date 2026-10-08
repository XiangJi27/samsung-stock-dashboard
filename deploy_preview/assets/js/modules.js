/**
 * Samsung Branch Operations - View Modules Controller
 * Handles Promotion, Reports, Knowledge, and Settings view rendering.
 */

function renderPromotionsView() {
  const container = document.getElementById("promotionsViewContent");
  if (!container) return;

  let activeCount = 473;
  let blockedCount = 81;
  let batchId = "BATCH-LATEST";

  if (typeof window.PROMOTION_BATCH_METADATA !== "undefined" && window.PROMOTION_BATCH_METADATA?.summary) {
    activeCount = window.PROMOTION_BATCH_METADATA.summary.validatedActiveVariants || 473;
    blockedCount = window.PROMOTION_BATCH_METADATA.summary.quarantinedBlockedVariants || 81;
    batchId = window.PROMOTION_BATCH_METADATA.importBatchId || "BATCH-LATEST";
  }

  const variants = window.PROMOTION_VARIANTS || [];
  if (variants.length > 0) {
    activeCount = variants.filter(v => v.validationStatus === 'PASSED_VALIDATION' || !v.validationStatus || v.isPromotion).length;
  }

  container.innerHTML = `
    <div class="home-section">
      <div class="section-title-bar">
        <div class="section-title-group">
          <h3 class="section-title">🏷️ ระบบบริหารโปรโมชั่นสาขา (Promotion Management)</h3>
          <span class="badge-status-ready">STATUS: RULE ENGINE CERTIFIED • BATCH ${batchId}</span>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn-action-view" onclick="window.AppRouter.navigate('/promotion-import')" style="background: rgba(0, 243, 255, 0.2); border-color: #00ffff; color: #fff; font-weight: 700;">
            <span>🌐 อัปเดตโปรโมชั่น (3 ลิงก์ Google Sheets) &rarr;</span>
          </button>
          <a href="promotion_review_dashboard.html" target="_blank" class="btn-action-view" style="background: rgba(16, 185, 129, 0.15); border-color: #10b981; color: #fff; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            <span>🛡️ หน้าจอ Review ตรวจโปรโมชั่น (3 คอลัมน์) &rarr;</span>
          </a>
          <button class="btn-action-view" onclick="document.getElementById('btnAuditModal')?.click()">
            <span>🛡️ เปิดระบบ 95/5 Risk Guard</span>
          </button>
          <button class="btn-action-view" onclick="window.AppRouter.navigate('/stock')">
            <span>📦 ตรวจสต็อกพร้อมขาย &rarr;</span>
          </button>
        </div>
      </div>

      <div class="stock-summary-grid" style="margin-bottom: 24px;">
        <div class="summary-card card-emerald">
          <div class="summary-label">โปรโมชั่นที่ผ่านการรับรอง (Active)</div>
          <div class="summary-num">${activeCount} <span class="unit">รายการ</span></div>
          <div class="summary-footer">สด, รูดเต็ม, ผ่อนบัตร, SF+, Trade Up, Student, แลกซื้อ</div>
        </div>

        <div class="summary-card" style="border-top: 3px solid var(--shell-coral);">
          <div class="summary-label">โปรโมชั่นที่ถูกระงับความเสี่ยง (Blocked)</div>
          <div class="summary-num" style="color: var(--shell-coral);">${blockedCount} <span class="unit">รายการ</span></div>
          <div class="summary-footer">พบสูตรผิดพลาด #ERROR! หรือสินค้าเปิดตัวหมด</div>
        </div>

        <div class="summary-card card-cyan">
          <div class="summary-label">หมวดหมู่โปรโมชั่นหลัก</div>
          <div class="summary-num" style="font-size: 1.4rem;">6 <span class="unit">Sale Modes</span></div>
          <div class="summary-footer">Standard, SF+, Student, Trade Up, Add-On, MBO</div>
        </div>
      </div>

      <!-- Quick Guidance -->
      <div class="action-center-card" style="margin-bottom: 24px;">
        <h4 class="card-heading">📋 คำแนะนำการขายและการใช้โปรโมชั่นหน้าร้าน</h4>
        <ul style="color: #cbd5e1; font-size: 0.86rem; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li><strong>เครื่องเปล่า SM-:</strong> ใช้โปรโมชั่นมาตรฐาน ห้ามดึงโปรโมชั่นของพาส F มาใช้</li>
          <li><strong>พาส F (รหัส F-):</strong> ชุดเปิดตัวหรือจัดเซ็ตพิเศษ อาจได้รับสิทธิ์อัปเกรดความจุหรือของแถมเฉพาะรุ่น</li>
          <li><strong>Z Flip8 Trade Up:</strong> ราคา 37,900 (256GB) และ 45,900 (512GB) เป็นราคาหลังหัก Trade Up แล้ว และหากลูกค้าสละของแถมร้าน ยังคงได้รับ Power Adapter จาก Samsung ตามปกติ</li>
          <li><strong>โปรโมชั่น Student:</strong> ต้องใช้คูปอง <code style="color: var(--shell-neon-cyan); background: rgba(0,240,255,0.1); padding: 2px 6px; border-radius: 4px;">Studentcrd</code> เท่านั้น และไม่สามารถใช้ร่วมกับ SF+ หรือ Trade Up ได้</li>
          <li><strong>Tab A11+ 5G:</strong> Standard Payment ใช้ Coupon <code style="color: var(--shell-neon-cyan);">01</code> (8,990) ส่วน SF+ ใช้ Coupon <code style="color: var(--shell-neon-amber);">04</code> (9,990)</li>
          <li><strong>โปรโมชั่นแลกซื้อ (Add-on Purchase):</strong> ใช้ส่วนลด Col E (SS) + Col F (CPW) หักจากราคา RRP ตามเกณฑ์ที่กำหนด</li>
        </ul>
      </div>

      <!-- Active Promotions Table -->
      <div class="diff-table-container">
        <div class="diff-table-header" style="flex-wrap: wrap; gap: 14px;">
          <h4 class="diff-table-title">ตารางโปรโมชั่นปัจจุบันที่เปิดใช้งาน (${variants.length} รายการ)</h4>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <input type="text" id="promoListSearchInput" placeholder="🔍 ค้นหารุ่น, P/N หรือคูปอง..." style="padding: 6px 12px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.84rem; min-width: 220px;">
            <select id="promoListModeFilter" style="padding: 6px 12px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.84rem;">
              <option value="ALL">ทุก Sale Mode</option>
              <option value="AI_PROVISIONAL">⚡ โปรโมชั่นชั่วคราวจาก AI (รอ Excel ยืนยัน)</option>
              <option value="SUPPLEMENTAL_FREEBIE">🎁 ของแถมเสริมจาก AI (Path A)</option>
              <option value="STANDARD">STANDARD</option>
              <option value="SF_PLUS">SF_PLUS</option>
              <option value="ADD_ON_PURCHASE">ADD_ON_PURCHASE (แลกซื้อ)</option>
              <option value="STUDENT">STUDENT</option>
              <option value="TRADE_UP">TRADE_UP</option>
            </select>
          </div>
        </div>
        <div style="overflow-x: auto; max-height: 520px;">
          <table class="diff-table">
            <thead>
              <tr>
                <th>P/N &amp; ชื่อรุ่น</th>
                <th>ประเภทโค้ด</th>
                <th>ราคาป้าย (RRP)</th>
                <th>ส่วนลดซื้อปกติ</th>
                <th>โบนัส Trade Up</th>
                <th>ราคาก่อนประเมิน / ชำระจริง</th>
                <th>คูปอง</th>
                <th>Sale Mode</th>
                <th>สถานะการรับรอง</th>
              </tr>
            </thead>
            <tbody id="promoListTableBody">
              <!-- Rendered by filter script -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Filter & Render logic
  const renderTable = () => {
    const tbody = document.getElementById("promoListTableBody");
    if (!tbody) return;

    const query = (document.getElementById("promoListSearchInput")?.value || "").trim().toLowerCase();
    const mode = document.getElementById("promoListModeFilter")?.value || "ALL";

    let list = variants;
    if (mode === "AI_PROVISIONAL") {
      list = list.filter(v => v.promotionSourceType === "PROVISIONAL_AI_CAPTURE" && v.saleMode !== "SUPPLEMENTAL_FREEBIE");
    } else if (mode === "SUPPLEMENTAL_FREEBIE") {
      list = list.filter(v => v.saleMode === "SUPPLEMENTAL_FREEBIE");
    } else if (mode !== "ALL") {
      list = list.filter(v => v.saleMode === mode);
    }

    if (query) {
      list = list.filter(v => 
        (v.model && v.model.toLowerCase().includes(query)) ||
        (v.pn && v.pn.toLowerCase().includes(query)) ||
        (v.coupon && v.coupon.toLowerCase().includes(query)) ||
        (v.freebieNoteFromAI && v.freebieNoteFromAI.toLowerCase().includes(query))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 28px;">ไม่พบรายการโปรโมชั่นที่ตรงกับเงื่อนไข</td></tr>`;
      return;
    }

    tbody.innerHTML = list.slice(0, 150).map(item => {
      let statusBadge = '<span class="status-badge-gate pass">🟢 ACTIVE</span>';
      if (item.provisionalStatus === 'ACTIVE_PROVISIONAL') {
        const pct = item.aiConfidenceScore ? (item.aiConfidenceScore * 100).toFixed(0) : '90';
        statusBadge = `<span class="status-badge-gate" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid #f59e0b;" title="SHA-256: ${item.rawSourceMediaSha256 || '-'}">⚡ AI PROV (${pct}%)</span>`;
      } else if (item.provisionalStatus === 'AUTO_RECONCILED') {
        statusBadge = `<span class="status-badge-gate pass" title="Reconciled against: ${item.reconciledAgainstBatchId || 'Excel'}">🟢 RECONCILED</span>`;
      } else if (item.provisionalStatus === 'SOURCE_CONFLICT') {
        statusBadge = `<span class="status-badge-gate blocked" title="Delta: ฿${item.reconciliationDelta?.differenceBaht || 0}">🔴 CONFLICT</span>`;
      } else if (item.provisionalStatus === 'EXPIRED_UNRECONCILED') {
        statusBadge = `<span class="status-badge-gate" style="color: #94a3b8; background: rgba(148, 163, 184, 0.1); border: 1px solid #64748b;">⚪ EXPIRED</span>`;
      }

      const isTradeUp = item.saleMode === 'TRADE_UP';
      const isSfPlus = item.saleMode === 'SF_PLUS';
      const isStudent = item.saleMode === 'STUDENT' || item.saleMode === 'STUDENT_EXCLUSIVE';

      let stdDiscount = 0;
      let tuBonus = 0;

      if (isTradeUp) {
        stdDiscount = Number(item.standardDiscount || 0);
        tuBonus = Number(item.tradeUpBonusAmount || item.tradeUpDiscount || 0);
        if (stdDiscount === 0 && tuBonus === 0 && (item.discountValue || item.discount) > 0) {
          tuBonus = Number(item.tradeUpDiscount || (item.discountValue || item.discount) / 2);
          stdDiscount = (item.discountValue || item.discount) - tuBonus;
        } else if (stdDiscount === 0 && tuBonus > 0 && (item.discountValue || item.discount) > tuBonus) {
          stdDiscount = (item.discountValue || item.discount) - tuBonus;
        }
      } else if (isSfPlus) {
        stdDiscount = Number(item.sfPlusDiscount || item.discountValue || item.discount || 0);
      } else if (isStudent) {
        stdDiscount = Number(item.studentDiscount || item.discountValue || item.discount || 0);
      } else {
        stdDiscount = Number(item.standardDiscount || item.discountValue || item.discount || 0);
      }

      // Discount columns
      const stdDiscountHtml = stdDiscount > 0
        ? `<span class="text-coral">-฿${stdDiscount.toLocaleString()}</span>`
        : '<span style="color: #94a3b8;">-</span>';

      const tuBonusHtml = (isTradeUp && tuBonus > 0)
        ? `<strong style="color: #34d399;">-฿${tuBonus.toLocaleString()}</strong>`
        : '<span style="color: #94a3b8;">-</span>';

      // Price column
      let priceCellHtml = '';
      if (isTradeUp) {
        const priceBeforeAppraisal = (item.rrp && (stdDiscount > 0 || tuBonus > 0))
          ? (item.rrp - stdDiscount - tuBonus)
          : (item.netPrice || item.tradeUpNetPrice || 0);
        priceCellHtml = `
          <strong style="color: #34d399; font-size: 0.95rem;">฿${priceBeforeAppraisal.toLocaleString()}</strong>
          <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">ราคาก่อนหักมูลค่าเครื่องเก่า</div>
          <div style="font-size: 0.65rem; color: #6ee7b7; margin-top: 1px;">* ยังไม่หักมูลค่าเครื่องเก่าที่ประเมินในหน้าชำระเงิน</div>
        `;
      } else if (isSfPlus) {
        priceCellHtml = `
          <strong style="color: var(--neon-cyan); font-size: 0.95rem;">฿${(item.netPrice || 0).toLocaleString()}</strong>
          <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">ราคาสินค้าตามสัญญา</div>
          <div style="font-size: 0.65rem; color: #fbbf24; margin-top: 1px;">เงินดาวน์คิดแยกตามผลอนุมัติ</div>
        `;
      } else if (isStudent) {
        priceCellHtml = `
          <strong style="color: var(--neon-cyan); font-size: 0.95rem;">฿${(item.netPrice || 0).toLocaleString()}</strong>
          <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">ราคาที่ลูกค้าชำระ</div>
          <div style="font-size: 0.65rem; color: #cbd5e1; margin-top: 1px;">(สิทธิ์เฉพาะนักศึกษา)</div>
        `;
      } else {
        priceCellHtml = `
          <strong style="color: var(--neon-cyan); font-size: 0.95rem;">฿${(item.netPrice || 0).toLocaleString()}</strong>
          <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">ราคาที่ลูกค้าชำระ</div>
        `;
      }

      // Coupon column
      let couponHtml = '';
      if (isTradeUp) {
        if (item.coupon && item.coupon !== '-') {
          couponHtml = `
            <span class="type-pill" title="คูปองสำหรับส่วนลดซื้อปกติ">${item.coupon} (เฉพาะซื้อปกติ)</span>
            <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 2px;">Trade Up ไม่ใช้คูปอง</div>
          `;
        } else {
          couponHtml = `
            <span class="type-pill">-</span>
            <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 2px;">Trade Up ไม่ใช้คูปอง</div>
          `;
        }
      } else if (isStudent) {
        couponHtml = `<span class="type-pill" style="color: var(--shell-neon-cyan); background: rgba(0,240,255,0.1);">${item.coupon || 'Studentcrd'}</span>`;
      } else {
        couponHtml = `<span class="type-pill">${item.coupon || '-'}</span>`;
      }

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff;">${item.pn || '<span style="color: #94a3b8;">-</span>'}</div>
            <div style="font-size: 0.78rem; color: #cbd5e1;">${item.model}</div>
            ${item.freebieNoteFromAI ? `<div style="font-size: 0.72rem; color: #34d399; margin-top: 2px;">🎁 ${item.freebieNoteFromAI}</div>` : ''}
            ${item.provisionalStatus === 'ACTIVE_PROVISIONAL' ? `<div style="font-size: 0.70rem; color: #f59e0b; margin-top: 2px;">⚡ รอ Excel ยืนยัน • Media SHA: ${(item.rawSourceMediaSha256 || '').substring(0, 8)}...</div>` : ''}
          </td>
          <td><span class="type-pill ${item.productCodeType === 'STANDARD_SM' ? 'active' : ''}">${item.productCodeType || 'STANDARD_SM'}</span></td>
          <td>${item.rrp > 0 ? `฿${item.rrp.toLocaleString()}` : '<span style="color: #94a3b8;">-</span>'}</td>
          <td>${stdDiscountHtml}</td>
          <td>${tuBonusHtml}</td>
          <td>${priceCellHtml}</td>
          <td>${couponHtml}</td>
          <td><span class="type-pill" style="font-size: 0.72rem; ${isTradeUp ? 'color: #34d399; border-color: rgba(52, 211, 153, 0.4);' : ''}">${item.saleMode || 'STANDARD'}</span></td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  };

  document.getElementById("promoListSearchInput")?.addEventListener("input", renderTable);
  document.getElementById("promoListModeFilter")?.addEventListener("change", renderTable);
  renderTable();
}

function renderSettingsView() {
  const container = document.getElementById("settingsViewContent");
  if (!container) return;

  const cfg = window.APP_CONFIG || {};
  const feat = window.APP_FEATURES || {};
  const meta = window.PROMOTION_BATCH_METADATA || {};

  container.innerHTML = `
    <div class="home-section">
      <div class="section-title-bar">
        <div class="section-title-group">
          <h3 class="section-title">⚙️ ตั้งค่าและข้อมูลระบบ (System Settings & Metadata)</h3>
          <span class="badge-status-ready">READ-ONLY AUDIT MODE</span>
        </div>
      </div>

      <div class="action-center-card" style="margin-bottom: 24px;">
        <h4 class="card-heading">🏢 ข้อมูลสาขาและการติดตั้ง (Branch & Installation)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; font-size: 0.85rem;">
          <div class="meta-row"><span class="meta-label">ระบบ:</span> <strong class="meta-value">${cfg.appName}</strong></div>
          <div class="meta-row"><span class="meta-label">สาขา:</span> <strong class="meta-value">${cfg.branchName}</strong></div>
          <div class="meta-row"><span class="meta-label">รหัสสาขา:</span> <strong class="meta-value text-cyan">${cfg.branchCode}</strong></div>
          <div class="meta-row"><span class="meta-label">บริษัท:</span> <strong class="meta-value">${cfg.company}</strong></div>
          <div class="meta-row"><span class="meta-label">เวอร์ชันระบบ:</span> <strong class="meta-value">${cfg.version}</strong></div>
          <div class="meta-row"><span class="meta-label">โหมดการพิสูจน์ตัวตน:</span> <span class="badge-dev-mode">${cfg.authMode}</span></div>
        </div>
      </div>

      <div class="action-center-card" style="margin-bottom: 24px;">
        <h4 class="card-heading">📊 ข้อมูลชุดข้อมูลและแคช (Data Batch Metadata)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; font-size: 0.85rem;">
          <div class="meta-row"><span class="meta-label">Import Batch ID:</span> <strong class="meta-value text-cyan">${meta.importBatchId || "BATCH-20260907-105441"}</strong></div>
          <div class="meta-row"><span class="meta-label">นำเข้าเมื่อ:</span> <strong class="meta-value">${meta.importedAt || "2026-09-07"}</strong></div>
          <div class="meta-row"><span class="meta-label">Parser Version:</span> <strong class="meta-value">${meta.parserVersion || "2.1.0-LTR-MERGE"}</strong></div>
          <div class="meta-row"><span class="meta-label">Rule Engine Version:</span> <strong class="meta-value">${meta.ruleEngineVersion || "2.5.0-STRICT"}</strong></div>
        </div>
      </div>

      <div class="action-center-card" style="margin-bottom: 24px;">
        <h4 class="card-heading">📦 สถานะการเชื่อมต่อสต็อกและระบบภายนอก (Stock & Nimbus Status)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; font-size: 0.85rem;">
          <div class="meta-row"><span class="meta-label">Stock Auto Sync:</span> <strong class="meta-value text-coral">NOT_IMPLEMENTED</strong></div>
          <div class="meta-row"><span class="meta-label">Stock Source:</span> <strong class="meta-value text-cyan">STATIC_EXCEL_SNAPSHOT</strong></div>
          <div class="meta-row"><span class="meta-label">Nimbus API Connection:</span> <strong class="meta-value text-coral">NOT_CONFIGURED</strong></div>
          <div class="meta-row"><span class="meta-label">Reconciliation Method:</span> <strong class="meta-value">MANUAL_COMPARISON_TOOL</strong></div>
          <div class="meta-row"><span class="meta-label">Storage Adapter:</span> <span class="badge-dev-mode">LOCAL_BROWSER_ONLY (IndexedDB)</span></div>
          <div class="meta-row"><span class="meta-label">Central Persistence:</span> <strong class="meta-value text-coral">NO</strong></div>
        </div>
      </div>

      <!-- Product Specifications Audit & Update Tool -->
      <div class="action-center-card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <h4 class="card-heading" style="margin: 0;">📋 ระบบจัดการและอัปเดตสเปกสินค้า (Product Specs Manager)</h4>
          <span style="font-size: 0.76rem; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); padding: 4px 10px; border-radius: 12px;">
            ฐานข้อมูลสเปกทางการ Samsung Thailand
          </span>
        </div>
        <p style="color: #94a3b8; font-size: 0.85rem; margin: 0 0 16px 0; line-height: 1.5;">
          สแกนตรวจสอบรายการสินค้าในสต็อกว่ารุ่นใดที่ยังขาดข้อมูลสเปกทางการ และสามารถกดปุ่มดึงสเปกอัตโนมัติ (1-Click Update) ขึ้นระบบได้ทันที
        </p>

        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
          <button type="button" class="btn-cancel-import" id="btnScanMissingSpecs" onclick="window.runSpecsScan()" style="padding: 10px 18px; font-weight: 600; border-color: rgba(0, 243, 255, 0.4); color: #fff;">
            <span>🔍 สแกนหาสินค้าที่ขาดสเปกในสต็อก</span>
          </button>
          <button type="button" class="btn-confirm-import" id="btnBatchUpdateSpecs" onclick="window.runSpecsBatchUpdate()" style="padding: 10px 20px; font-weight: 700; background: linear-gradient(135deg, #00f3ff, #0284c7); color: #000; border: none; border-radius: 8px; display: none;">
            <span>⚡ ดึงสเปกที่ขาดทั้งหมดอัตโนมัติ (Batch Update)</span>
          </button>
        </div>

        <div id="specScanResultsContainer" style="font-size: 0.86rem; color: #cbd5e1;"></div>
      </div>

      <div class="action-center-card">
        <h4 class="card-heading">🚩 คุณสมบัติและฟีเจอร์ระบบ (Feature Flags)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; font-size: 0.82rem;">
          ${Object.entries(feat).map(([k, v]) => `
            <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 6px;">
              <span style="color: #cbd5e1;">${k}</span>
              <strong style="color: ${v ? '#34d399' : '#94a3b8'};">${v ? 'TRUE' : 'FALSE'}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Global Spec Audit & Update handlers for Settings View
window.runSpecsScan = function() {
  const container = document.getElementById('specScanResultsContainer');
  const btnBatch = document.getElementById('btnBatchUpdateSpecs');
  if (!container || !window.ProductSpecUpdater) return;

  const stockItems = window.masterStockData || window.STOCK_DATA || [];
  const missing = window.ProductSpecUpdater.scanMissingSpecs(stockItems);
  window._lastMissingSpecs = missing;

  if (missing.length === 0) {
    if (btnBatch) btnBatch.style.display = 'none';
    container.innerHTML = `
      <div style="padding: 14px 18px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; color: #34d399;">
        ✓ สินค้าทั้งหมดในสต็อกมีข้อมูลสเปกพร้อมใช้งานครบถ้วน 100%!
      </div>
    `;
    return;
  }

  if (btnBatch) {
    btnBatch.style.display = 'inline-flex';
    btnBatch.innerHTML = `<span>⚡ ดึงสเปกที่ขาดทั้งหมด (${missing.length} รายการ)</span>`;
  }

  let html = `
    <div style="margin-bottom: 12px; font-weight: 600; color: #fde68a;">
      ⚠️ พบสินค้าที่ยังไม่มีข้อมูลสเปกในระบบจำนวน ${missing.length} รายการ:
    </div>
    <div style="max-height: 280px; overflow-y: auto; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left; color: #94a3b8;">
            <th style="padding: 8px;">ชื่อรุ่นสินค้า</th>
            <th style="padding: 8px;">P/N</th>
            <th style="padding: 8px;">หมวดหมู่</th>
            <th style="padding: 8px; text-align: right;">การจัดการ</th>
          </tr>
        </thead>
        <tbody>
  `;

  missing.forEach((item, idx) => {
    html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
        <td style="padding: 8px; color: #fff; font-weight: 600;">${item.model}</td>
        <td style="padding: 8px; color: #94a3b8; font-family: monospace;">${item.pn || '-'}</td>
        <td style="padding: 8px; color: #cbd5e1;">${item.category || '-'}</td>
        <td style="padding: 8px; text-align: right;">
          <button type="button" class="btn-cancel-import" onclick="window.ProductSpecUpdater.handleFetchClick('${item.pn || ''}', '${encodeURIComponent(item.model || '')}', this)" style="padding: 4px 10px; font-size: 0.74rem; border-color: rgba(0,243,255,0.3); color: #38bdf8;">
            <span>⚡ ดึงสเปก</span>
          </button>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;
  container.innerHTML = html;
};

window.runSpecsBatchUpdate = async function() {
  const container = document.getElementById('specScanResultsContainer');
  const btnBatch = document.getElementById('btnBatchUpdateSpecs');
  const missing = window._lastMissingSpecs || [];
  if (!container || !btnBatch || missing.length === 0 || !window.ProductSpecUpdater) return;

  btnBatch.disabled = true;
  const origText = btnBatch.innerHTML;

  try {
    const updated = await window.ProductSpecUpdater.batchUpdateMissingSpecs(missing, (current, total, model) => {
      btnBatch.innerHTML = `<span>⏳ กำลังดึงสเปก (${current}/${total}): ${model}...</span>`;
    });

    container.innerHTML = `
      <div style="padding: 14px 18px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; color: #34d399;">
        ✓ ดึงและอัปเดตสเปกสำเร็จครบถ้วน ${updated} รายการเรียบร้อยแล้ว!
      </div>
    `;
    btnBatch.style.display = 'none';
  } catch (err) {
    container.innerHTML = `<div style="color: #f43f5e; padding: 10px;">❌ เกิดข้อผิดพลาด: ${err.message}</div>`;
  } finally {
    btnBatch.disabled = false;
    btnBatch.innerHTML = origText;
  }
};

window.renderPromotionsView = renderPromotionsView;
window.renderSettingsView = renderSettingsView;

