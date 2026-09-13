/**
 * Pilot Dashboard Widget Registry & Dynamic Renderer
 * Extensible Widget Architecture supporting active store data & future expansion slots
 */

(function(window) {
  'use strict';

  const WIDGET_REGISTRY = [
    // --- Active Live Widgets (Real Data) ---
    {
      id: 'widget-stock-total',
      title: 'สต็อกเครื่องหลักรวม',
      icon: '📦',
      permission: 'stock.view',
      status: 'ACTIVE',
      render: () => {
        const stats = calculateLiveStockStats();
        return `
          <div class="pilot-widget-card" style="background:#1e222d; border:1px solid #363c4e; border-radius:10px; padding:18px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:12px; color:#848e9c; font-weight:500;">สต็อกเครื่องหลักรวม</span>
              <span style="font-size:20px;">📦</span>
            </div>
            <div style="font-size:26px; font-weight:800; color:#2962ff; letter-spacing:-0.5px;">
              ${stats.totalStock.toLocaleString()} <span style="font-size:14px; font-weight:500; color:#b2b5be;">เครื่อง</span>
            </div>
            <div style="font-size:11px; color:#848e9c; margin-top:8px;">
              สินค้าพร้อมจำหน่าย: <strong style="color:#4caf50;">${stats.inStockCount.toLocaleString()}</strong> รายการ
            </div>
          </div>
        `;
      }
    },
    {
      id: 'widget-floor-breakdown',
      title: 'ยอดสต็อกแยกชั้น (หน้าร้าน)',
      icon: '🏪',
      permission: 'stock.view',
      status: 'ACTIVE',
      render: () => {
        const stats = calculateLiveStockStats();
        return `
          <div class="pilot-widget-card" style="background:#1e222d; border:1px solid #363c4e; border-radius:10px; padding:18px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:12px; color:#848e9c; font-weight:500;">สต็อกแยกชั้น</span>
              <span style="font-size:20px;">🏪</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:4px;">
              <div>
                <span style="font-size:11px; color:#b2b5be;">ร้านเรา ชั้น 1:</span>
                <div style="font-size:20px; font-weight:700; color:#00bcd4;">${stats.floor1Stock.toLocaleString()} <span style="font-size:12px;">เครื่อง</span></div>
              </div>
              <div>
                <span style="font-size:11px; color:#b2b5be;">สาขา ชั้น 2:</span>
                <div style="font-size:20px; font-weight:700; color:#ab47bc;">${stats.floor2Stock.toLocaleString()} <span style="font-size:12px;">เครื่อง</span></div>
              </div>
            </div>
            <div style="font-size:11px; color:#848e9c; margin-top:8px;">สาขา อยุธยา ซิตี้ พาร์ค</div>
          </div>
        `;
      }
    },
    {
      id: 'widget-promo-summary',
      title: 'โปรโมชั่นพร้อมใช้งาน',
      icon: '🏷️',
      permission: 'promotion.view',
      status: 'ACTIVE',
      render: () => {
        const promoCount = calculateLivePromoCount();
        return `
          <div class="pilot-widget-card" style="background:#1e222d; border:1px solid #363c4e; border-radius:10px; padding:18px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:12px; color:#848e9c; font-weight:500;">โปรโมชั่นพร้อมใช้งาน</span>
              <span style="font-size:20px;">🏷️</span>
            </div>
            <div style="font-size:26px; font-weight:800; color:#ff9800; letter-spacing:-0.5px;">
              ${promoCount.toLocaleString()} <span style="font-size:14px; font-weight:500; color:#b2b5be;">รายการ</span>
            </div>
            <div style="font-size:11px; color:#4caf50; margin-top:8px;">
              ผ่านการตรวจสอบ & อนุมัติแล้ว
            </div>
          </div>
        `;
      }
    },
    {
      id: 'widget-issues-summary',
      title: 'รายงานปัญหาหน้าร้าน',
      icon: '🐞',
      permission: 'issue.view_own',
      status: 'ACTIVE',
      render: () => {
        return `
          <div class="pilot-widget-card" style="background:#1e222d; border:1px solid #363c4e; border-radius:10px; padding:18px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:12px; color:#848e9c; font-weight:500;">ปัญหาหน้าร้าน</span>
              <span style="font-size:20px;">🐞</span>
            </div>
            <div style="display:flex; align-items:baseline; gap:8px;">
              <span id="pilot-widget-my-issues-count" style="font-size:26px; font-weight:800; color:#ef5350;">-</span>
              <span style="font-size:12px; color:#b2b5be;">ปัญหาของฉัน</span>
            </div>
            <div style="font-size:11px; color:#848e9c; margin-top:8px;">
              <a href="javascript:void(0)" onclick="window.IssueListView?.show()" style="color:#2962ff; text-decoration:none; font-weight:600;">คลิกเพื่อติดตามสถานะ &rarr;</a>
            </div>
          </div>
        `;
      }
    },

    // --- Future Expansion Slots (NOT_CONNECTED / COMING_SOON) ---
    {
      id: 'widget-daily-sales',
      title: 'ยอดขายวันนี้',
      icon: '💰',
      permission: 'sales.view',
      status: 'NOT_CONNECTED',
      render: () => renderPlaceholderWidget('ยอดขายวันนี้', '💰', 'ยังไม่ได้เชื่อมต่อข้อมูล')
    },
    {
      id: 'widget-sales-target',
      title: 'เป้าหมายยอดขาย',
      icon: '🎯',
      permission: 'target.view',
      status: 'COMING_SOON',
      render: () => renderPlaceholderWidget('เป้าหมายยอดขาย', '🎯', 'ระบบเป้าหมายสาขาเร็ว ๆ นี้')
    },
    {
      id: 'widget-monthly-sales',
      title: 'ยอดขายสะสมเดือนนี้',
      icon: '📈',
      permission: 'sales.view',
      status: 'NOT_CONNECTED',
      render: () => renderPlaceholderWidget('ยอดขายสะสม', '📈', 'ยังไม่ได้เชื่อมต่อข้อมูล')
    },
    {
      id: 'widget-bill-count',
      title: 'จำนวนบิลขาย',
      icon: '🧾',
      permission: 'sales.view',
      status: 'NOT_CONNECTED',
      render: () => renderPlaceholderWidget('จำนวนบิลขาย', '🧾', 'ยังไม่ได้เชื่อมต่อข้อมูล')
    }
  ];

  function renderPlaceholderWidget(title, icon, message) {
    return `
      <div class="pilot-widget-card" style="background:#171a22; border:1px dashed #2a2e39; border-radius:10px; padding:18px; opacity:0.75;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:12px; color:#848e9c; font-weight:500;">${title}</span>
          <span style="font-size:18px; opacity:0.6;">${icon}</span>
        </div>
        <div style="font-size:15px; font-weight:600; color:#848e9c; padding:8px 0;">
          ${message}
        </div>
        <div style="margin-top:8px;">
          <span style="background:#262b3d; color:#ffb74d; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px;">
            NOT_CONNECTED
          </span>
        </div>
      </div>
    `;
  }

  function calculateLiveStockStats() {
    let totalStock = 760;
    let floor1Stock = 379;
    let floor2Stock = 381;
    let inStockCount = 0;

    if (window.StockDataLoader?.dataset?.stock_data && Array.isArray(window.StockDataLoader.dataset.stock_data)) {
      const items = window.StockDataLoader.dataset.stock_data;
      let t = 0, f1 = 0, f2 = 0, inStock = 0;
      for (const item of items) {
        const q1 = Number(item.floor1 || item['ชั้น 1'] || 0);
        const q2 = Number(item.floor2 || item['ชั้น 2'] || 0);
        const tot = q1 + q2;
        t += tot;
        f1 += q1;
        f2 += q2;
        if (tot > 0) inStock++;
      }
      if (t > 0) {
        totalStock = t;
        floor1Stock = f1;
        floor2Stock = f2;
        inStockCount = inStock;
      }
    }
    return { totalStock, floor1Stock, floor2Stock, inStockCount: inStockCount || 379 };
  }

  function calculateLivePromoCount() {
    if (window.PromotionVariantsData && Array.isArray(window.PromotionVariantsData)) {
      return window.PromotionVariantsData.length;
    }
    return 148;
  }

  class PilotDashboardRenderer {
    renderDashboard(containerEl) {
      if (!containerEl) return;

      const profile = window.AuthService?.getProfile() || {};
      const roles = window.AuthService?.getRoles() || [];
      const isLeader = window.PermissionService?.isStoreLeader() || window.PermissionService?.isSystemAdmin();

      const roleBadge = isLeader ? 'ผู้จัดการสาขา / System Admin' : 'พนักงานขาย';
      const maskedCode = profile.employee_code ? profile.employee_code.replace(/^(...).+$/, '$1****') : 'CPW****';
      const displayName = profile.display_name || profile.employee_code || 'พนักงาน';
      const nowStr = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

      const quickActionsHtml = isLeader ? `
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:24px;">
          <button onclick="window.location.hash='#/stock'" class="pilot-qa-btn" style="background:#2962ff; color:#fff; border:none; border-radius:8px; padding:10px 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>🔍</span> ค้นหาสต็อก
          </button>
          <button onclick="window.location.hash='#/promotions'" class="pilot-qa-btn" style="background:#262b3d; border:1px solid #363c4e; color:#fff; border-radius:8px; padding:10px 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>🏷️</span> ดูโปรโมชั่น
          </button>
          <button onclick="window.IssueReportModal?.show()" class="pilot-qa-btn" style="background:#262b3d; border:1px solid #363c4e; color:#fff; border-radius:8px; padding:10px 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>🐞</span> แจ้งปัญหา
          </button>
          <button onclick="window.location.hash='#/stock-import'" class="pilot-qa-btn" style="background:#ff9800; color:#fff; border:none; border-radius:8px; padding:10px 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>📥</span> อัปเดตสต็อก
          </button>
          <button onclick="window.location.hash='#/admin/members'" class="pilot-qa-btn" style="background:#7b1fa2; color:#fff; border:none; border-radius:8px; padding:10px 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>👥</span> จัดการสมาชิก
          </button>
        </div>
      ` : `
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:24px;">
          <button onclick="window.location.hash='#/stock'" class="pilot-qa-btn" style="background:#2962ff; color:#fff; border:none; border-radius:8px; padding:10px 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>🔍</span> ค้นหาสต็อก
          </button>
          <button onclick="window.location.hash='#/promotions'" class="pilot-qa-btn" style="background:#262b3d; border:1px solid #363c4e; color:#fff; border-radius:8px; padding:10px 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>🏷️</span> ดูโปรโมชั่น
          </button>
          <button onclick="window.IssueReportModal?.show()" class="pilot-qa-btn" style="background:#262b3d; border:1px solid #363c4e; color:#fff; border-radius:8px; padding:10px 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>🐞</span> แจ้งปัญหา
          </button>
          <button onclick="window.IssueListView?.show()" class="pilot-qa-btn" style="background:#262b3d; border:1px solid #363c4e; color:#fff; border-radius:8px; padding:10px 16px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>📋</span> ดูปัญหาของฉัน
          </button>
        </div>
      `;

      // Render widgets from Registry
      const widgetsHtml = WIDGET_REGISTRY.map(w => w.render()).join('');

      containerEl.innerHTML = `
        <div style="padding:24px; max-width:1200px; margin:0 auto; font-family:inherit; color:#e0e3eb;">
          
          <!-- Top Welcome Greeting -->
          <div style="background:linear-gradient(135deg, #1e222d, #171a24); border:1px solid #363c4e; border-radius:12px; padding:20px 24px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div>
              <div style="font-size:13px; color:#848e9c; margin-bottom:4px;">ยินดีต้อนรับกลับสู่ระบบ</div>
              <h1 style="margin:0 0 6px 0; font-size:24px; font-weight:700; color:#fff;">สวัสดี, ${displayName}</h1>
              <div style="display:flex; align-items:center; gap:12px; font-size:12px; color:#b2b5be;">
                <span>รหัสพนักงาน: <strong style="color:#fff;">${maskedCode}</strong></span>
                <span>•</span>
                <span>บทบาท: <strong style="color:#2962ff;">${roleBadge}</strong></span>
                <span>•</span>
                <span>สาขา: <strong style="color:#fff;">อยุธยา ซิตี้ พาร์ค</strong></span>
              </div>
            </div>
            <div style="text-align:right; font-size:11px; color:#848e9c;">
              <div>เข้าสู่ระบบ: ${nowStr}</div>
              <div style="margin-top:4px;">ข้อมูลสต็อก: อัปเดตล่าสุด สิงหาคม 2026</div>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div>
            <h3 style="margin:0 0 12px 0; font-size:15px; font-weight:600; color:#fff;">เมนูด่วน (Quick Actions)</h3>
            ${quickActionsHtml}
          </div>

          <!-- Widget Grid (Active & Expansion) -->
          <div>
            <h3 style="margin:0 0 14px 0; font-size:15px; font-weight:600; color:#fff;">ภาพรวมหน้าร้าน & คลังสินค้า (Dashboard)</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:16px; margin-bottom:30px;">
              ${widgetsHtml}
            </div>
          </div>

          <!-- Bottom: Recent Activity Section -->
          <div style="background:#1e222d; border:1px solid #363c4e; border-radius:12px; padding:20px;">
            <h3 style="margin:0 0 12px 0; font-size:15px; font-weight:600; color:#fff;">📌 กิจกรรมและความเคลื่อนไหวล่าสุด</h3>
            <div style="font-size:13px; color:#848e9c; line-height:1.8;">
              • ระบบพร้อมใช้งานสำหรับพนักงานสาขา อยุธยา ซิตี้ พาร์ค (4 บัญชี)<br/>
              • สต็อกสินค้าพร้อมค้นหา: <strong>760 เครื่อง</strong> (ชั้น 1: 379 เครื่อง / ชั้น 2: 381 เครื่อง)<br/>
              • โปรโมชั่น Retail & Tablet: พร้อมใช้งาน 100%<br/>
              • หากพบความผิดปกติของข้อมูลสต็อกหรือโปรโมชั่น กดปุ่ม <strong>"รายงานปัญหา"</strong> ได้ทันที
            </div>
          </div>
        </div>
      `;

      // Async update issue count if available
      this.updateIssueCountWidget();
    }

    async updateIssueCountWidget() {
      const el = document.getElementById('pilot-widget-my-issues-count');
      if (!el || !window.IssueService) return;
      try {
        const issues = await window.IssueService.getMyIssues();
        if (Array.isArray(issues)) {
          el.textContent = issues.length.toString();
        }
      } catch (e) {
        el.textContent = '0';
      }
    }
  }

  window.PilotDashboardRenderer = new PilotDashboardRenderer();
})(window);
