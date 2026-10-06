/**
 * User Status Bar Component (4-User Store Pilot)
 * Displays active salesperson / manager info, branch, and logout button
 */

(function(window) {
  'use strict';

  class UserStatusBar {
    constructor() {
      this.containerEl = null;
    }

    render() {
      let target = document.getElementById('pilot-user-status-container');
      if (!target) {
        target = document.createElement('div');
        target.id = 'pilot-user-status-container';
        target.style.cssText = 'position:fixed; top:12px; right:16px; z-index:9999; display:flex; align-items:center; gap:8px; font-family:inherit;';
        document.body.appendChild(target);
      }
      this.containerEl = target;
      this.updateView();

      window.AuthService?.onAuthStateChange(() => {
        this.updateView();
      });
    }

    updateView() {
      if (!this.containerEl) return;

      const profile = window.AuthService?.getProfile();
      const roles = window.AuthService?.getRoles() || [];
      const isAuthenticated = window.AuthService?.isAuthenticated();

      if (!isAuthenticated || !profile) {
        this.containerEl.innerHTML = `
          <button id="pilot-header-login-btn" style="background:#2962ff; color:#fff; border:none; border-radius:6px; padding:6px 14px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(41,98,255,0.3);">
            <span>🔐</span> เข้าสู่ระบบ (พนักงาน)
          </button>
        `;
        document.getElementById('pilot-header-login-btn')?.addEventListener('click', () => {
          window.AuthModal?.show();
        });
        return;
      }

      // Format Roles display for store pilot
      const hasAdmin = roles.some(r => r.role === 'SYSTEM_ADMIN');
      const hasLeader = roles.some(r => r.role === 'STORE_LEADER');
      
      let badgeHtml = '';
      if (hasAdmin && hasLeader) {
        badgeHtml = `<span style="background:#ab47bc; color:#fff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px;">ผู้จัดการสาขา / Admin</span>`;
      } else if (hasLeader) {
        badgeHtml = `<span style="background:#ff9800; color:#fff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px;">ผู้จัดการสาขา</span>`;
      } else {
        badgeHtml = `<span style="background:#26a69a; color:#fff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px;">พนักงานขาย</span>`;
      }

      this.containerEl.innerHTML = `
        <div style="background:#1e222d; border:1px solid #363c4e; border-radius:8px; padding:6px 14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.3); color:#e0e3eb; font-size:12px;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-weight:600; color:#fff;">${profile.display_name || profile.employee_code}</span>
              ${badgeHtml}
            </div>
            <span style="font-size:10px; color:#848e9c;">สาขา อยุธยา ซิตี้ พาร์ค</span>
          </div>
          <button id="pilot-header-logout-btn" title="ออกจากระบบ" style="background:#262b3d; border:1px solid #363c4e; color:#b2b5be; border-radius:4px; padding:5px 10px; font-size:11px; cursor:pointer; transition:background 0.2s;">
            ออกจากระบบ
          </button>
        </div>
      `;

      document.getElementById('pilot-header-logout-btn')?.addEventListener('click', () => {
        window.AuthService?.signOut();
      });
    }
  }

  window.UserStatusBar = new UserStatusBar();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.UserStatusBar.render());
  } else {
    window.UserStatusBar.render();
  }
})(window);
