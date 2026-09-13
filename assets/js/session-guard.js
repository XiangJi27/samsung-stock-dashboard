/**
 * Session Guard & Route Access Control
 * Enforces role-based route boundaries and monitors token lifecycle.
 * Restricted routes for Store Leader / Admin:
 * - #/admin/members
 * - #/stock-import
 * - #/promotion-import
 * - #/issues/branch
 */

(function(window) {
  'use strict';

  const RESTRICTED_MANAGER_ROUTES = [
    '#/admin/members',
    '#/stock-import',
    '#/promotion-import',
    '#/issues/branch'
  ];

  class SessionGuard {
    constructor() {
      this.initialized = false;
    }

    async bootstrap() {
      if (this.initialized) return;

      // 1. Initialize Supabase Adapter
      const configured = window.SupabaseAdapter?.init();
      if (!configured) {
        console.info('[SessionGuard] Supabase adapter not configured yet. Awaiting credentials.');
        return;
      }

      // 2. Restore Session if available in storage
      try {
        const session = await window.AuthService?.restoreSession();
        if (session) {
          console.info('[SessionGuard] Active employee session restored successfully.');
        } else {
          console.info('[SessionGuard] No active session found.');
        }
      } catch (err) {
        console.warn('[SessionGuard] Session restore failed:', err);
      }

      // 3. Attach Route Protection listener
      window.addEventListener('hashchange', () => this.checkRouteAccess());
      this.checkRouteAccess();

      this.initialized = true;
    }

    checkRouteAccess() {
      const currentHash = window.location.hash || '#/home';

      // Check if trying to access manager-only route
      const isRestricted = RESTRICTED_MANAGER_ROUTES.some(r => currentHash.startsWith(r));
      if (!isRestricted) return;

      const isAuth = window.AuthService?.isAuthenticated();
      if (!isAuth) {
        console.warn('[SessionGuard] Unauthenticated access to restricted route:', currentHash);
        window.location.hash = '#/';
        window.AuthModal?.show();
        return;
      }

      const isLeader = window.PermissionService?.isStoreLeader() || window.PermissionService?.isSystemAdmin();
      if (!isLeader) {
        console.warn('[SessionGuard] Unauthorized route access attempted by MEMBER:', currentHash);
        this.showAccessDeniedToast();
        window.location.hash = '#/home';
      }
    }

    showAccessDeniedToast() {
      let toast = document.getElementById('pilot-access-denied-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pilot-access-denied-toast';
        toast.style.cssText = 'position:fixed; bottom:80px; left:50%; transform:translateX(-50%); z-index:999999; background:#ef5350; color:#fff; padding:10px 20px; border-radius:8px; font-size:13px; font-weight:600; box-shadow:0 4px 16px rgba(0,0,0,0.4); display:flex; align-items:center; gap:8px; font-family:inherit; transition:opacity 0.3s;';
        document.body.appendChild(toast);
      }
      toast.innerHTML = '<span>🚫</span> คุณไม่มีสิทธิ์เข้าถึงหน้านี้';
      toast.style.display = 'flex';
      toast.style.opacity = '1';

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 300);
      }, 2500);
    }
  }

  window.SessionGuard = new SessionGuard();

  // Auto-bootstrap on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.SessionGuard.bootstrap());
  } else {
    window.SessionGuard.bootstrap();
  }
})(window);
