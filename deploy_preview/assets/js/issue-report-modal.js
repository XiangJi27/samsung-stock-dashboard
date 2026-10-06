/**
 * Issue Report Modal Component (Tailored for 4-User Store Pilot)
 * Simplified 5-Field Form designed for store sales staff:
 * 1. พบปัญหาที่หน้าไหน (Screen / Page)
 * 2. หัวข้อปัญหา (Title)
 * 3. รายละเอียด (Description)
 * 4. ระดับผลกระทบ (Impact in human Thai terms)
 * 5. ภาพหน้าจอ (Placeholder: COMING SOON)
 * 
 * Auto-collected telemetry:
 * - Route, User Agent, Screen Size, Version, Timestamp
 */

(function(window) {
  'use strict';

  class IssueReportModal {
    constructor() {
      this.modalEl = null;
      this.fabEl = null;
    }

    render() {
      if (document.getElementById('pilot-issue-report-modal')) return;

      // 1. Floating Action Button
      const fabHtml = `
        <button id="pilot-report-fab" style="position:fixed; bottom:24px; right:24px; z-index:9998; background:linear-gradient(135deg, #2962ff, #1e88e5); color:#fff; border:none; border-radius:30px; padding:12px 22px; font-size:14px; font-weight:600; cursor:pointer; box-shadow:0 8px 24px rgba(41,98,255,0.4); display:flex; align-items:center; gap:8px; font-family:inherit; transition:transform 0.2s;">
          <span style="font-size:16px;">💬</span> รายงานปัญหา
        </button>
      `;
      document.body.insertAdjacentHTML('beforeend', fabHtml);
      this.fabEl = document.getElementById('pilot-report-fab');
      this.fabEl?.addEventListener('click', () => this.handleFabClick());

      // 2. Simplified 5-Field Modal
      const modalHtml = `
        <div id="pilot-issue-report-modal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
          <div style="background:#1e222d; border:1px solid #363c4e; border-radius:12px; width:92%; max-width:520px; max-height:92vh; overflow-y:auto; padding:24px; box-shadow:0 24px 48px rgba(0,0,0,0.6); color:#e0e3eb; font-family:inherit;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="margin:0; font-size:18px; font-weight:600; color:#fff; display:flex; align-items:center; gap:8px;">
                <span>📝</span> แจ้งปัญหาการใช้งานหน้าร้าน
              </h3>
              <button id="pilot-issue-close-btn" style="background:none; border:none; color:#848e9c; font-size:22px; cursor:pointer; padding:4px;">&times;</button>
            </div>

            <div id="pilot-issue-alert" style="display:none; border-radius:6px; padding:10px 12px; font-size:13px; margin-bottom:16px;"></div>

            <form id="pilot-issue-form">
              <!-- Field 1: พบปัญหาที่หน้าไหน -->
              <div style="margin-bottom:14px;">
                <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                  1. พบปัญหาที่หน้าไหน <span style="color:#ef5350;">*</span>
                </label>
                <select id="p-issue-page" style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:13px; outline:none;">
                  <option value="STOCK_PAGE" selected>📦 หน้าค้นหาสต็อกสินค้า (/#/stock)</option>
                  <option value="PROMO_PAGE">🏷️ หน้าโปรโมชัน (/#/promotions)</option>
                  <option value="DASHBOARD_PAGE">📊 หน้าแดชบอร์ดภาพรวม</option>
                  <option value="LOGIN_PAGE">🔑 หน้าเข้าสู่ระบบ</option>
                  <option value="OTHER_PAGE">🌐 อื่น ๆ</option>
                </select>
              </div>

              <!-- Field 2: หัวข้อปัญหา -->
              <div style="margin-bottom:14px;">
                <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                  2. หัวข้อปัญหา <span style="color:#ef5350;">*</span>
                </label>
                <input type="text" id="p-issue-title" required placeholder="เช่น รุ่น S25 Ultra สี Titanium ยอดชั้น 1 ไม่ตรง" style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:14px; outline:none;">
              </div>

              <!-- Field 3: รายละเอียด -->
              <div style="margin-bottom:14px;">
                <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                  3. รายละเอียด <span style="color:#ef5350;">*</span>
                </label>
                <textarea id="p-issue-description" rows="3" required placeholder="ระบุสิ่งที่พบเห็น หรือตัวเลขที่คิดว่าคลาดเคลื่อน..." style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:13px; outline:none; font-family:inherit;"></textarea>
              </div>

              <!-- Field 4: ระดับผลกระทบ (Human-friendly Thai) -->
              <div style="margin-bottom:14px;">
                <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                  4. ระดับผลกระทบ <span style="color:#ef5350;">*</span>
                </label>
                <select id="p-issue-severity" style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:13px; outline:none;">
                  <option value="P3_MEDIUM" selected>ใช้งานได้แต่ไม่สะดวก</option>
                  <option value="P2_HIGH">ข้อมูลอาจผิด (เช่น สต็อกหรือโปรโมชันไม่ตรง)</option>
                  <option value="P1_CRITICAL">ใช้งานต่อไม่ได้ (กระทบการขายหน้าร้านทันที)</option>
                  <option value="P4_LOW">ข้อเสนอแนะ / ปรับปรุงเล็กน้อย</option>
                </select>
              </div>

              <!-- Field 5: ภาพหน้าจอ (Disabled / Coming Soon) -->
              <div style="margin-bottom:20px;">
                <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                  5. ภาพหน้าจอประกอบ
                </label>
                <div style="padding:10px 14px; background:#131722; border:1px dashed #363c4e; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:12px; color:#848e9c;">📎 แนบรูปภาพหน้าจอหรือเอกสาร</span>
                  <span style="background:#363c4e; color:#ffb74d; font-size:10px; font-weight:700; padding:3px 8px; border-radius:4px;">
                    COMING SOON (รอเปิดระบบจัดเก็บไฟล์)
                  </span>
                </div>
              </div>

              <button type="submit" id="p-issue-submit-btn" style="width:100%; background:#2962ff; color:#fff; border:none; border-radius:6px; padding:12px; font-size:14px; font-weight:600; cursor:pointer; transition:background 0.2s;">
                ส่งรายงานปัญหา
              </button>
            </form>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      this.modalEl = document.getElementById('pilot-issue-report-modal');

      document.getElementById('pilot-issue-close-btn')?.addEventListener('click', () => this.hide());
      document.getElementById('pilot-issue-form')?.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    handleFabClick() {
      if (!window.AuthService?.isAuthenticated()) {
        window.AuthModal?.show();
        return;
      }
      this.show();
    }

    show() {
      this.render();
      if (this.modalEl) {
        this.modalEl.style.display = 'flex';
        const alertEl = document.getElementById('pilot-issue-alert');
        if (alertEl) alertEl.style.display = 'none';

        // Auto-detect current page
        const currentHash = window.location.hash || '';
        const pageSelect = document.getElementById('p-issue-page');
        if (pageSelect) {
          if (currentHash.includes('stock')) pageSelect.value = 'STOCK_PAGE';
          else if (currentHash.includes('promo')) pageSelect.value = 'PROMO_PAGE';
          else if (currentHash.includes('login')) pageSelect.value = 'LOGIN_PAGE';
          else pageSelect.value = 'DASHBOARD_PAGE';
        }

        document.getElementById('p-issue-title')?.focus();
      }
    }

    hide() {
      if (this.modalEl) {
        this.modalEl.style.display = 'none';
      }
    }

    async handleSubmit(e) {
      e.preventDefault();
      const alertEl = document.getElementById('pilot-issue-alert');
      const submitBtn = document.getElementById('p-issue-submit-btn');

      const pageMap = {
        STOCK_PAGE: 'STOCK_DATA',
        PROMO_PAGE: 'PROMOTION_DATA',
        DASHBOARD_PAGE: 'OTHER',
        LOGIN_PAGE: 'LOGIN_AUTH',
        OTHER_PAGE: 'OTHER'
      };

      const pageSelected = document.getElementById('p-issue-page')?.value || 'STOCK_PAGE';
      const category = pageMap[pageSelected] || 'OTHER';
      const title = document.getElementById('p-issue-title')?.value;
      const description = document.getElementById('p-issue-description')?.value;
      const severity = document.getElementById('p-issue-severity')?.value || 'P3_MEDIUM';

      // Auto-collected telemetry payload
      const telemetryMetadata = {
        reported_page: pageSelected,
        route_hash: window.location.hash || '#/stock',
        user_agent: navigator.userAgent,
        screen_size: `${window.innerWidth}x${window.innerHeight}`,
        app_version: 'pilot-1.0.0',
        stock_batch: window.StockDataLoader?.getMetadata?.()?.batch_id || 'LOCAL_AUG2026',
        submitted_at: new Date().toISOString()
      };

      const enrichedDescription = `${description}\n\n---\n[ระบบเก็บให้อัตโนมัติ]\nหน้า: ${telemetryMetadata.route_hash}\nขนาดจอ: ${telemetryMetadata.screen_size}\nเวลา: ${telemetryMetadata.submitted_at}`;

      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังส่งรายงาน...';
      alertEl.style.display = 'none';

      try {
        const created = await window.IssueService?.createIssue({
          title,
          category,
          severity,
          description: enrichedDescription
        });

        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(76,175,80,0.15)';
        alertEl.style.border = '1px solid #4caf50';
        alertEl.style.color = '#81c784';
        alertEl.innerHTML = `✅ ส่งรายงานสำเร็จ! รหัสปัญหา: <strong>${created?.issue_number || 'บันทึกแล้ว'}</strong>`;

        document.getElementById('pilot-issue-form')?.reset();
        setTimeout(() => this.hide(), 2000);
      } catch (err) {
        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(239,83,80,0.15)';
        alertEl.style.border = '1px solid #ef5350';
        alertEl.style.color = '#ff8a80';
        alertEl.textContent = `❌ ${err.message || 'เกิดข้อผิดพลาดในการบันทึก'}`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ส่งรายงานปัญหา';
      }
    }
  }

  window.IssueReportModal = new IssueReportModal();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.IssueReportModal.render());
  } else {
    window.IssueReportModal.render();
  }
})(window);
