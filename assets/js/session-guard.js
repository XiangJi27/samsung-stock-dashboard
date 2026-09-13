/**
 * Session Guard & Lifecycle Monitor
 * Coordinates automatic session restoration on app boot and monitors token lifecycle.
 */

(function(window) {
  'use strict';

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

      this.initialized = true;
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
