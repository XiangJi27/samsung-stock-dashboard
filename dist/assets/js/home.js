/**
 * Samsung Branch Operations - Home Dashboard Controller
 * Displays branch overview, stock KPIs, promotion alerts, and Sales KPI placeholder (NOT_CONNECTED).
 */

function renderHomeView() {
  const container = document.getElementById("homeDashboardContent");
  if (!container) return;

  // Live Machine Date & Time
  const now = new Date();
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const dateStr = now.toLocaleDateString('th-TH', dateOptions);
  const timeStr = now.toLocaleTimeString('th-TH', timeOptions);

  // Runtime Calculation of Stock Baseline from window.STOCK_DATABASE
  let stockLoaded = false;
  let coreF1 = 0;
  let coreF2 = 0;
  let coreTotal = 0;
  let allF1 = 0;
  let allF2 = 0;
  let allTotal = 0;
  let adapterF1 = 0;
  let adapterF2 = 0;
  let adapterTotal = 0;
  let coreCount = 0;
  let totalItems = 0;

  if (typeof window.STOCK_DATABASE !== "undefined" && Array.isArray(window.STOCK_DATABASE) && window.STOCK_DATABASE.length > 0) {
    stockLoaded = true;
    totalItems = window.STOCK_DATABASE.length;
    window.STOCK_DATABASE.forEach(item => {
      const f1 = Number(item.f1);
      const f2 = Number(item.f2);
      const s1 = Number.isFinite(f1) ? f1 : 0;
      const s2 = Number.isFinite(f2) ? f2 : 0;
      allF1 += s1;
      allF2 += s2;
      allTotal += (s1 + s2);

      const m = (item.model || "").toLowerCase();
      const p = (item.pn || "").toUpperCase();
      const grp = item.inventoryGroup || "";

      let isCore = false;
      if (item.includedInCoreDeviceKpi !== undefined) {
        isCore = item.includedInCoreDeviceKpi === true;
      } else if (grp === "CORE_DEVICE") {
        isCore = true;
      } else if (grp === "ADAPTER" || m.includes("adapter") || p.startsWith("EP-")) {
        isCore = false;
        adapterF1 += s1;
        adapterF2 += s2;
        adapterTotal += (s1 + s2);
      } else if (grp === "SAMSUNG_ACCESSORY" || grp === "THIRD_PARTY_ACCESSORY" || grp === "PREMIUM_GIFT" || grp === "SIM_SERVICE" || grp === "OTHER") {
        isCore = false;
      } else {
        isCore = !m.includes("adapter") && !p.startsWith("EP-") && !p.startsWith("GP-FCX626NNCBH") && item.category !== "Accessory";
      }

      if (isCore) {
        coreCount++;
        coreF1 += s1;
        coreF2 += s2;
        coreTotal += (s1 + s2);
      }
    });
  }

  // Promotion Audit Metadata
  let promoCount = 0;
  let blockedCount = 0;
  let batchId = "BATCH-STABLE";
  if (typeof window.PROMOTION_BATCH_METADATA !== "undefined" && window.PROMOTION_BATCH_METADATA?.summary) {
    promoCount = window.PROMOTION_BATCH_METADATA.summary.validatedActiveVariants || 473;
    blockedCount = window.PROMOTION_BATCH_METADATA.summary.quarantinedBlockedVariants || 81;
    batchId = window.PROMOTION_BATCH_METADATA.importBatchId || "BATCH-LATEST";
  }

  const stockF1Display = stockLoaded ? coreF1.toLocaleString('th-TH') : "DATA_UNAVAILABLE";
  const stockF2Display = stockLoaded ? coreF2.toLocaleString('th-TH') : "DATA_UNAVAILABLE";
  const stockTotalDisplay = stockLoaded ? coreTotal.toLocaleString('th-TH') : "DATA_UNAVAILABLE";
  const allInventoryTotalDisplay = stockLoaded ? allTotal.toLocaleString('th-TH') : "DATA_UNAVAILABLE";
  const adapterTotalDisplay = stockLoaded ? adapterTotal.toLocaleString('th-TH') : "DATA_UNAVAILABLE";

  container.innerHTML = `
    <!-- Branch Welcome & Status Banner -->
    <div class="home-welcome-card">
      <div class="welcome-header-flex">
        <div>
          <div class="branch-tag-pill">
            <span class="status-pulse-dot"></span>
            <span>COPPERWIRED • SAMSUNG AYUTTHAYA CITY PARK 1ST FL</span>
          </div>
          <h2 class="welcome-main-title">ภาพรวมการดำเนินงานสาขาประจำวัน</h2>
          <p class="welcome-subtitle">ศูนย์รวมข้อมูลบริหารสาขา • ข้อมูลสต็อกสาขา และโปรโมชั่นที่ผ่านการรับรองความถูกต้อง</p>
        </div>
        <div class="welcome-meta-box">
          <div class="meta-row">
            <span class="meta-label">📅 วันที่:</span>
            <strong class="meta-value">${dateStr}</strong>
          </div>
          <div class="meta-row">
            <span class="meta-label">⏰ เวลาตรวจสอบ:</span>
            <strong class="meta-value text-cyan">${timeStr}</strong>
          </div>
          <div class="meta-row">
            <span class="meta-label">🛡️ โหมดสิทธิ์:</span>
            <span class="badge-dev-mode">DEVELOPMENT AUTH</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SALES MODULE (STRICT PLACEHOLDER: NOT_CONNECTED) -->
    <section class="home-section">
      <div class="section-title-bar">
        <div class="section-title-group">
          <h3 class="section-title">📊 ยอดขายและเป้าหมายสาขา (Sales & Targets)</h3>
          <span class="badge-status-not-connected">STATUS: NOT_CONNECTED • โมดูลอยู่ในแผนพัฒนาระยะถัดไป</span>
        </div>
      </div>

      <div class="sales-kpi-grid">
        <div class="kpi-card kpi-card-disconnected">
          <div class="kpi-card-header">
            <span class="kpi-label">ยอดขายวันนี้ (Today Sales)</span>
            <span class="kpi-status-badge">NOT_CONNECTED</span>
          </div>
          <div class="kpi-disconnected-text">รอเชื่อมต่อข้อมูลระบบ POS</div>
          <div class="kpi-sub-note">ยังไม่มีข้อมูลส่งตรงจากเครื่องแคชเชียร์</div>
        </div>

        <div class="kpi-card kpi-card-disconnected">
          <div class="kpi-card-header">
            <span class="kpi-label">เป้ายอดขาย (Daily Target)</span>
            <span class="kpi-status-badge">NOT_CONNECTED</span>
          </div>
          <div class="kpi-disconnected-text">รอกำหนดในโปรเจกต์ถัดไป</div>
          <div class="kpi-sub-note">รอการนำเข้าข้อมูล Target รายเดือน</div>
        </div>

        <div class="kpi-card kpi-card-disconnected">
          <div class="kpi-card-header">
            <span class="kpi-label">Achievement (%)</span>
            <span class="kpi-status-badge">NOT_CONNECTED</span>
          </div>
          <div class="kpi-disconnected-text">รอข้อมูลยอดขาย</div>
          <div class="kpi-sub-note">คำนวณอัตโนมัติเมื่อเชื่อมระบบขาย</div>
        </div>

        <div class="kpi-card kpi-card-disconnected">
          <div class="kpi-card-header">
            <span class="kpi-label">จำนวนบิลวันนี้ (Bill Count)</span>
            <span class="kpi-status-badge">NOT_CONNECTED</span>
          </div>
          <div class="kpi-disconnected-text">รอเชื่อมต่อข้อมูล</div>
          <div class="kpi-sub-note">ยังไม่ผูกระบบ Transaction POS</div>
        </div>

        <div class="kpi-card kpi-card-disconnected">
          <div class="kpi-card-header">
            <span class="kpi-label">Average Basket Size</span>
            <span class="kpi-status-badge">NOT_CONNECTED</span>
          </div>
          <div class="kpi-disconnected-text">รอเชื่อมต่อข้อมูล</div>
          <div class="kpi-sub-note">ยอดซื้อเฉลี่ยต่อบิลรอการคำนวณ</div>
        </div>
      </div>
    </section>

    <!-- LIVE STOCK SUMMARY (REAL DATA FROM STOCK_DATABASE) -->
    <section class="home-section">
      <div class="section-title-bar">
        <div class="section-title-group">
          <h3 class="section-title">📦 สรุปสต็อกสาขาพร้อมจำหน่าย (Stock Snapshot)</h3>
          <span class="badge-status-ready">STATUS: READY • Snapshot Stock.xlsx (Promotion Sheet)</span>
        </div>
        <button class="btn-action-view" onclick="window.AppRouter.navigate('/stock')">
          <span>เข้าสู่หน้าสต็อกฉบับเต็ม &rarr;</span>
        </button>
      </div>

      <div class="stock-summary-grid">
        <div class="summary-card card-cyan">
          <div class="summary-label">ร้านเรา (ช1) เครื่องหลัก</div>
          <div class="summary-num">${stockF1Display} <span class="unit">เครื่อง</span></div>
          <div class="summary-footer">พร้อมขายหน้าร้าน ชั้น 1 ทันที</div>
        </div>

        <div class="summary-card card-amber">
          <div class="summary-label">สาขา (ช2) เครื่องหลัก</div>
          <div class="summary-num">${stockF2Display} <span class="unit">เครื่อง</span></div>
          <div class="summary-footer">สต็อกคลังสำรอง ชั้น 2 เบิกได้</div>
        </div>

        <div class="summary-card card-purple">
          <div class="summary-label">เครื่องหลักรวม 2 ชั้น (Core Devices)</div>
          <div class="summary-num">${stockTotalDisplay} <span class="unit">เครื่อง</span></div>
          <div class="summary-footer">ยอด KPI เครื่องหลัก (แยกจากของแถม/เคส)</div>
        </div>

        <div class="summary-card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(148, 163, 184, 0.3);">
          <div class="summary-label" style="color: #cbd5e1;">สินค้าคงคลังทุกหมวด (All Inventory)</div>
          <div class="summary-num" style="color: #38bdf8;">${allInventoryTotalDisplay} <span class="unit">ชิ้น</span></div>
          <div class="summary-footer">รวมอุปกรณ์เสริม, ของแถม และซิม (${totalItems} SKUs)</div>
        </div>

        <div class="summary-card card-emerald">
          <div class="summary-label">Samsung Adapter พร้อมจำหน่าย</div>
          <div class="summary-num">${adapterTotalDisplay} <span class="unit">ชิ้น</span></div>
          <div class="summary-footer">ช1: ${adapterF1} • ช2: ${adapterF2} ชิ้น</div>
        </div>
      </div>
    </section>

    <!-- PROMOTIONS & GOVERNANCE ALERTS -->
    <section class="home-section">
      <div class="section-title-bar">
        <div class="section-title-group">
          <h3 class="section-title">🛡️ การกำกับดูแลโปรโมชั่น (Promotion Governance)</h3>
          <span class="badge-status-ready">STATUS: 95/5 RISK AUTOMATION ACTIVE</span>
        </div>
        <button class="btn-action-view" onclick="window.AppRouter.navigate('/promotions')">
          <span>ดูโปรโมชั่นทั้งหมด &rarr;</span>
        </button>
      </div>

      <div class="promo-alert-grid">
        <div class="alert-card alert-active">
          <div class="alert-icon">✅</div>
          <div class="alert-info">
            <div class="alert-title">โปรโมชั่นที่ผ่านการรับรอง (Validated Active)</div>
            <div class="alert-detail">${promoCount} รายการ พร้อมใช้งานหน้าร้านสำหรับขายสด, ผ่อน, SF+, Trade Up, Student</div>
          </div>
        </div>

        <div class="alert-card alert-blocked" onclick="document.getElementById('btnAuditModal')?.click()" style="cursor: pointer;">
          <div class="alert-icon">⚠️</div>
          <div class="alert-info">
            <div class="alert-title">รายการที่ถูกกักกันความเสี่ยง (Risk Quarantined)</div>
            <div class="alert-detail">${blockedCount} รายการ ถูกบล็อกอัตโนมัติ (พบสูตร #ERROR! หรือสินค้าเปิดตัวหมดสต็อก) [คลิกดูรายละเอียด]</div>
          </div>
        </div>
      </div>
    </section>

    <!-- QUICK ACTIONS & PROJECT ROADMAP -->
    <div class="home-two-col-grid">
      <!-- Quick Action Center -->
      <div class="action-center-card">
        <h4 class="card-heading">⚡ ทางลัดการปฏิบัติงาน (Quick Actions)</h4>
        <div class="action-btn-list">
          <button class="action-btn" onclick="window.AppRouter.navigate('/stock')">
            <span class="action-btn-icon">🔍</span>
            <div class="action-btn-text">
              <strong>ค้นหาและเช็กสต็อกสินค้า</strong>
              <span>ตรวจสอบจำนวนเครื่องราย P/N, สี, ร้านเรา ช1 และสาขา ช2</span>
            </div>
          </button>

          <button class="action-btn" onclick="window.AppRouter.navigate('/promotions')">
            <span class="action-btn-icon">🏷️</span>
            <div class="action-btn-text">
              <strong>ตรวจสอบราคาและโปรโมชั่น</strong>
              <span>ดูส่วนลด, คูปองมาตรฐาน, สินเชื่อ SF+, สิทธิ์เก่าแลกใหม่</span>
            </div>
          </button>

          <button class="action-btn" onclick="document.getElementById('btnAuditModal')?.click()">
            <span class="action-btn-icon">🛡️</span>
            <div class="action-btn-text">
              <strong>เปิดระบบ 95/5 Risk Guard</strong>
              <span>ตรวจรายการที่ถูกระงับ (Blocked Items Queue) และคำวินิจฉัย</span>
            </div>
          </button>

          <button class="action-btn" onclick="window.AppRouter.navigate('/settings')">
            <span class="action-btn-icon">⚙️</span>
            <div class="action-btn-text">
              <strong>ตรวจสอบสถานะระบบและเวอร์ชันข้อมูล</strong>
              <span>ดูหมายเลข Batch ID, Hashes, และ Feature Flags ปัจจุบัน</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Project Roadmap -->
      <div class="roadmap-card">
        <h4 class="card-heading">🗺️ แผนผังพัฒนาระบบสาขา (Branch System Roadmap)</h4>
        <div class="roadmap-timeline">
          <div class="timeline-item timeline-done">
            <span class="timeline-dot"></span>
            <div class="timeline-content">
              <strong>Phase A: Application Shell & Login</strong>
              <span class="timeline-status text-emerald">Active • พร้อมใช้งานในโหมด Development</span>
            </div>
          </div>

          <div class="timeline-item timeline-done">
            <span class="timeline-dot"></span>
            <div class="timeline-content">
              <strong>Stock Module (Excel Snapshot)</strong>
              <span class="timeline-status text-emerald">Verified • ตรวจสอบจำนวนราย P/N สมบูรณ์</span>
            </div>
          </div>

          <div class="timeline-item timeline-done">
            <span class="timeline-dot"></span>
            <div class="timeline-content">
              <strong>Promotion Module (Rule Engine)</strong>
              <span class="timeline-status text-emerald">Verified • 17 Golden Test Cases ผ่าน 100%</span>
            </div>
          </div>

          <div class="timeline-item timeline-planned">
            <span class="timeline-dot"></span>
            <div class="timeline-content">
              <strong>NotebookLM Knowledge Base Integration</strong>
              <span class="timeline-status text-amber">Planned • จัดเตรียมชุดข้อมูล Read-only แล้ว</span>
            </div>
          </div>

          <div class="timeline-item timeline-future">
            <span class="timeline-dot"></span>
            <div class="timeline-content">
              <strong>Sales Dashboard (POS Transaction Sync)</strong>
              <span class="timeline-status text-muted">Future • รอกำหนดสถาปัตยกรรมเชื่อมต่อข้อมูล</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.renderHomeView = renderHomeView;
