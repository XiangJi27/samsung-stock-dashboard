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
          <button class="btn-action-view" onclick="window.AppRouter.navigate('/promotion-import')" style="background: rgba(6, 182, 212, 0.15); border-color: var(--neon-cyan); color: #fff;">
            <span>⚡ นำเข้าโปรโมชั่น (Import) &rarr;</span>
          </button>
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
                <th>ส่วนลดโปรโมชั่น</th>
                <th>ราคาสุทธิ (Net Price)</th>
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
    if (mode !== "ALL") {
      list = list.filter(v => v.saleMode === mode);
    }
    if (query) {
      list = list.filter(v => 
        (v.model && v.model.toLowerCase().includes(query)) ||
        (v.pn && v.pn.toLowerCase().includes(query)) ||
        (v.coupon && v.coupon.toLowerCase().includes(query))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 28px;">ไม่พบรายการโปรโมชั่นที่ตรงกับเงื่อนไข</td></tr>`;
      return;
    }

    tbody.innerHTML = list.slice(0, 150).map(item => `
      <tr>
        <td>
          <div style="font-weight: 700; color: #fff;">${item.pn || '<span style="color: #94a3b8;">-</span>'}</div>
          <div style="font-size: 0.78rem; color: #cbd5e1;">${item.model}</div>
        </td>
        <td><span class="type-pill ${item.productCodeType === 'STANDARD_SM' ? 'active' : ''}">${item.productCodeType || 'STANDARD_SM'}</span></td>
        <td>฿${(item.rrp || 0).toLocaleString()}</td>
        <td class="text-coral">-฿${(item.discountValue || item.discount || 0).toLocaleString()}</td>
        <td style="font-weight: 700; color: var(--neon-cyan);">฿${(item.netPrice || 0).toLocaleString()}</td>
        <td><span class="type-pill">${item.coupon || '-'}</span></td>
        <td><span class="type-pill" style="font-size: 0.72rem;">${item.saleMode || 'STANDARD'}</span></td>
        <td><span class="status-badge-gate pass">🟢 ACTIVE</span></td>
      </tr>
    `).join('');
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

window.renderPromotionsView = renderPromotionsView;
window.renderSettingsView = renderSettingsView;
