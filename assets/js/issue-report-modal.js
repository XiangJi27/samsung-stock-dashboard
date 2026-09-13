/**
 * Issue Report Modal Component
 * Floating Action Button and Modal Form for reporting bugs, stock, and promo issues
 * Security Note: Image Attachment upload is disabled (COMING SOON) until Storage RLS is implemented.
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
        <button id="pilot-report-fab" style="position:fixed; bottom:24px; right:24px; z-index:9998; background:linear-gradient(135deg, #2962ff, #1e88e5); color:#fff; border:none; border-radius:30px; padding:12px 20px; font-size:14px; font-weight:600; cursor:pointer; box-shadow:0 8px 24px rgba(41,98,255,0.4); display:flex; align-items:center; gap:8px; font-family:inherit; transition:transform 0.2s;">
          <span style="font-size:16px;">💬</span> แจ้งปัญหา / ฟีดแบ็ก
        </button>
      `;
      document.body.insertAdjacentHTML('beforeend', fabHtml);
      this.fabEl = document.getElementById('pilot-report-fab');
      this.fabEl?.addEventListener('click', () => this.handleFabClick());

      // 2. Report Modal Dialog
      const modalHtml = `
        <div id="pilot-issue-report-modal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
          <div style="background:#1e222d; border:1px solid #363c4e; border-radius:12px; width:92%; max-width:560px; max-height:90vh; overflow-y:auto; padding:24px; box-shadow:0 24px 48px rgba(0,0,0,0.6); color:#e0e3eb; font-family:inherit;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="margin:0; font-size:18px; font-weight:600; color:#fff; display:flex; align-items:center; gap:8px;">
                <span>📝</span> รายงานปัญหาหรือข้อเสนอแนะ
              </h3>
              <button id="pilot-issue-close-btn" style="background:none; border:none; color:#848e9c; font-size:20px; cursor:pointer; padding:4px;">&times;</button>
            </div>

            <div id="pilot-issue-alert" style="display:none; border-radius:6px; padding:10px 12px; font-size:13px; margin-bottom:16px;"></div>

            <form id="pilot-issue-form">
              <div style="margin-bottom:14px;">
                <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px; font-weight:500;">หัวข้อปัญหา <span style="color:#ef5350;">*</span></label>
                <input type="text" id="p-issue-title" required placeholder="ระบุปัญหาที่พบสั้น ๆ ให้เข้าใจง่าย" style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:14px; outline:none;">
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                <div>
                  <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px; font-weight:500;">หมวดหมู่</label>
                  <select id="p-issue-category" style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:13px; outline:none;">
                    <option value="STOCK_DATA">ข้อมูลสต็อก (STOCK_DATA)</option>
                    <option value="PROMOTION_DATA">โปรโมชัน (PROMOTION_DATA)</option>
                    <option value="TRADE_UP">เทรดอัป (TRADE_UP)</option>
                    <option value="SF_PLUS">Samsung Finance+ (SF_PLUS)</option>
                    <option value="LOGIN_AUTH">การเข้าสู่ระบบ (LOGIN_AUTH)</option>
                    <option value="DISPLAY_MOBILE">การแสดงผลมือถือ (DISPLAY_MOBILE)</option>
                    <option value="OTHER" selected>อื่น ๆ (OTHER)</option>
                  </select>
                </div>
                <div>
                  <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px; font-weight:500;">ความเร่งด่วน</label>
                  <select id="p-issue-severity" style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:13px; outline:none;">
                    <option value="P4_LOW">P4 - เล็กน้อย (Low)</option>
                    <option value="P3_MEDIUM" selected>P3 - ปานกลาง (Medium)</option>
                    <option value="P2_HIGH">P2 - สำคัญ (High)</option>
                    <option value="P1_CRITICAL">P1 - วิกฤต กระทบการขาย (Critical)</option>
                  </select>
                </div>
              </div>

              <div style="margin-bottom:14px;">
                <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px; font-weight:500;">รายละเอียดปัญหา <span style="color:#ef5350;">*</span></label>
                <textarea id="p-issue-description" rows="3" required placeholder="อธิบายรายละเอียดสิ่งที่เกิดขึ้น..." style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:13px; outline:none; font-family:inherit;"></textarea>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                <div>
                  <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px; font-weight:500;">ผลลัพธ์ที่คาดหวัง</label>
                  <input type="text" id="p-issue-expected" placeholder="สิ่งที่ควรจะเป็น" style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:8px 10px; color:#fff; font-size:13px; outline:none;">
                </div>
                <div>
                  <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px; font-weight:500;">ผลลัพธ์ที่เกิดขึ้นจริง</label>
                  <input type="text" id="p-issue-actual" placeholder="สิ่งที่ปรากฏจริง" style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:8px 10px; color:#fff; font-size:13px; outline:none;">
                </div>
              </div>

              <!-- Attachments Disabled Notice as per Governance -->
              <div style="margin-bottom:18px; padding:10px 12px; background:#131722; border:1px dashed #363c4e; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:#848e9c;">📎 แนบภาพถ่ายหน้าจอ</span>
                <span style="background:#363c4e; color:#ffb74d; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px;">
                  COMING SOON (รอเปิด Private Storage)
                </span>
              </div>

              <button type="submit" id="p-issue-submit-btn" style="width:100%; background:#2962ff; color:#fff; border:none; border-radius:6px; padding:12px; font-size:14px; font-weight:600; cursor:pointer; transition:background 0.2s;">
                บันทึกและส่งรายงาน
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

      const data = {
        title: document.getElementById('p-issue-title')?.value,
        category: document.getElementById('p-issue-category')?.value,
        severity: document.getElementById('p-issue-severity')?.value,
        description: document.getElementById('p-issue-description')?.value,
        expected_result: document.getElementById('p-issue-expected')?.value,
        actual_result: document.getElementById('p-issue-actual')?.value
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังบันทึกรายงาน...';
      alertEl.style.display = 'none';

      try {
        const created = await window.IssueService?.createIssue(data);
        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(76,175,80,0.15)';
        alertEl.style.border = '1px solid #4caf50';
        alertEl.style.color = '#81c784';
        alertEl.innerHTML = `✅ บันทึกรายงานสำเร็จ! รหัสปัญหา: <strong>${created.issue_number}</strong>`;

        document.getElementById('pilot-issue-form')?.reset();
        setTimeout(() => this.hide(), 2500);
      } catch (err) {
        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(239,83,80,0.15)';
        alertEl.style.border = '1px solid #ef5350';
        alertEl.style.color = '#ff8a80';
        alertEl.textContent = `❌ ${err.message || 'เกิดข้อผิดพลาดในการบันทึก'}`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'บันทึกและส่งรายงาน';
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
