/**
 * Employee Auth Modal Component
 * Displays clean login dialog requesting Employee Code and Password
 */

(function(window) {
  'use strict';

  class AuthModal {
    constructor() {
      this.modalEl = null;
    }

    render() {
      if (document.getElementById('pilot-auth-modal')) return;

      const modalHtml = `
        <div id="pilot-auth-modal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
          <div style="background:#1e222d; border:1px solid #363c4e; border-radius:12px; width:90%; max-width:400px; padding:28px; box-shadow:0 20px 40px rgba(0,0,0,0.5); color:#e0e3eb; font-family:inherit;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
              <h3 style="margin:0; font-size:18px; font-weight:600; color:#fff; display:flex; align-items:center; gap:8px;">
                <span>🔐</span> เข้าสู่ระบบพนักงาน
              </h3>
              <button id="pilot-auth-close-btn" style="background:none; border:none; color:#848e9c; font-size:20px; cursor:pointer; padding:4px;">&times;</button>
            </div>
            
            <p style="font-size:13px; color:#848e9c; margin-top:0; margin-bottom:20px;">
              Samsung Branch Operations System<br>
              <span style="font-size:11px; color:#2962ff;">สาขาอยุธยา ซิตี้ พาร์ค (Pilot Mode)</span>
            </p>

            <div id="pilot-auth-error" style="display:none; background:rgba(239,83,80,0.15); border:1px solid #ef5350; border-radius:6px; padding:10px 12px; font-size:13px; color:#ff8a80; margin-bottom:16px;"></div>

            <form id="pilot-auth-form">
              <div style="margin-bottom:16px;">
                <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:6px; font-weight:500;">รหัสพนักงาน (Employee Code)</label>
                <input type="text" id="pilot-auth-emp-code" placeholder="เช่น CPW3862" required style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:14px; outline:none; text-transform:uppercase;">
              </div>

              <div style="margin-bottom:20px;">
                <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:6px; font-weight:500;">รหัสผ่าน</label>
                <input type="password" id="pilot-auth-password" placeholder="••••••••" required style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:14px; outline:none;">
              </div>

              <button type="submit" id="pilot-auth-submit-btn" style="width:100%; background:#2962ff; color:#fff; border:none; border-radius:6px; padding:12px; font-size:14px; font-weight:600; cursor:pointer; transition:background 0.2s;">
                เข้าสู่ระบบ
              </button>
            </form>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      this.modalEl = document.getElementById('pilot-auth-modal');

      document.getElementById('pilot-auth-close-btn')?.addEventListener('click', () => this.hide());
      document.getElementById('pilot-auth-form')?.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    show() {
      this.render();
      if (this.modalEl) {
        this.modalEl.style.display = 'flex';
        document.getElementById('pilot-auth-error').style.display = 'none';
        document.getElementById('pilot-auth-emp-code')?.focus();
      }
    }

    hide() {
      if (this.modalEl) {
        this.modalEl.style.display = 'none';
      }
    }

    async handleSubmit(e) {
      e.preventDefault();
      const codeInput = document.getElementById('pilot-auth-emp-code');
      const passInput = document.getElementById('pilot-auth-password');
      const errorEl = document.getElementById('pilot-auth-error');
      const submitBtn = document.getElementById('pilot-auth-submit-btn');

      const code = codeInput?.value?.trim();
      const password = passInput?.value;

      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังตรวจสอบ...';

      try {
        await window.AuthService?.signIn(code, password);
        this.hide();
        passInput.value = '';
      } catch (err) {
        errorEl.textContent = err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
        errorEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'เข้าสู่ระบบ';
      }
    }
  }

  window.AuthModal = new AuthModal();
})(window);
