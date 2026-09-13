/**
 * Role-Aware Navigation Controller (Store Pilot)
 * Toggles sidebar and mobile menu items according to active role:
 * - MEMBER: Sees Dashboard, Stock, Promo, Report Issue, My Issues, My Profile, Logout
 * - STORE_LEADER / SYSTEM_ADMIN: Sees all above + Stock Import, Promo Import, Member Admin, All Issues
 */

(function(window) {
  'use strict';

  class PilotNavigation {
    constructor() {
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.updateNavigation();

      window.AuthService?.onAuthStateChange(() => {
        this.updateNavigation();
      });
    }

    updateNavigation() {
      const isAuth = window.AuthService?.isAuthenticated();
      const isLeader = window.PermissionService?.isStoreLeader() || window.PermissionService?.isSystemAdmin();

      // Desktop Sidebar Items
      const stockImportLink = document.getElementById('navLinkStockImport')?.parentElement;
      const stockHistoryLink = document.getElementById('navLinkStockHistory')?.parentElement;
      const promoImportLink = document.getElementById('navLinkPromoImport')?.parentElement;
      const rulesReviewLink = document.getElementById('navLinkRulesReview')?.parentElement;
      const auditLogLink = document.getElementById('navLinkAuditLog')?.parentElement;

      // Toggle Manager-only navigation items
      const managerDisplay = (isAuth && isLeader) ? 'block' : 'none';

      if (stockImportLink) stockImportLink.style.display = managerDisplay;
      if (stockHistoryLink) stockHistoryLink.style.display = managerDisplay;
      if (promoImportLink) promoImportLink.style.display = managerDisplay;
      if (rulesReviewLink) rulesReviewLink.style.display = managerDisplay;
      if (auditLogLink) auditLogLink.style.display = managerDisplay;

      // Inject Member Admin menu item for Manager if not exists
      let memberAdminLi = document.getElementById('navItemMemberAdmin');
      if (!memberAdminLi && isAuth && isLeader) {
        const navUl = document.querySelector('.sidebar-nav-section .nav-menu-list');
        if (navUl) {
          memberAdminLi = document.createElement('li');
          memberAdminLi.id = 'navItemMemberAdmin';
          memberAdminLi.innerHTML = `
            <a href="#/admin/members" class="nav-item-link" id="navLinkMemberAdmin">
              <span class="nav-icon">👥</span>
              <span class="nav-label">จัดการสมาชิก</span>
            </a>
          `;
          navUl.appendChild(memberAdminLi);
        }
      } else if (memberAdminLi) {
        memberAdminLi.style.display = (isAuth && isLeader) ? 'block' : 'none';
      }

      // Rename menu item on screen to "📊 แดชบอร์ด"
      const homeLabel = document.querySelector('#navLinkHome .nav-label');
      if (homeLabel) {
        homeLabel.textContent = 'แดชบอร์ด';
      }
    }
  }

  window.PilotNavigation = new PilotNavigation();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.PilotNavigation.init());
  } else {
    window.PilotNavigation.init();
  }
})(window);
