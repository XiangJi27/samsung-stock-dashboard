/**
 * Pilot Bootstrap Coordinator (4-User Store Pilot)
 * Initializes Feedback Pilot UI, session restoration, and mounts controls
 */

(function(window) {
  'use strict';

  class PilotBootstrap {
    constructor() {
      this.initialized = false;
    }

    async init() {
      if (this.initialized) return;
      this.initialized = true;

      console.log('[PilotBootstrap] Initializing Samsung Store Feedback Pilot...');

      // 1. Initialize Supabase Client Adapter
      if (window.SupabaseAdapter) {
        window.SupabaseAdapter.init();
      }

      // 2. Mount User Status Bar (Header)
      if (window.UserStatusBar) {
        window.UserStatusBar.render();
      }

      // 3. Mount Issue Report FAB & Modal
      if (window.IssueReportModal) {
        window.IssueReportModal.render();
      }

      // 4. Add "ติดตามปัญหา" (Issue List) button to User Status Bar
      this.injectIssueListButton();

      // 5. Restore active session (30-day persistent session support)
      if (window.AuthService) {
        try {
          const session = await window.AuthService.restoreSession();
          if (session) {
            console.log('[PilotBootstrap] Session restored successfully.');
          }
        } catch (e) {
          console.log('[PilotBootstrap] No previous active session found.');
        }

        window.AuthService.onAuthStateChange((event) => {
          this.updateIssueListButtonVisibility();
        });
      }

      this.updateIssueListButtonVisibility();
    }

    injectIssueListButton() {
      const statusContainer = document.getElementById('pilot-user-status-container');
      if (!statusContainer || document.getElementById('pilot-header-issues-btn')) return;

      const issuesBtn = document.createElement('button');
      issuesBtn.id = 'pilot-header-issues-btn';
      issuesBtn.innerHTML = '<span>📋</span> ติดตามปัญหา';
      issuesBtn.style.cssText = 'background:#1e222d; border:1px solid #363c4e; color:#b2b5be; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:none; align-items:center; gap:6px; transition:border-color 0.2s;';
      
      issuesBtn.addEventListener('click', () => {
        if (!window.AuthService?.isAuthenticated()) {
          window.AuthModal?.show();
          return;
        }
        window.IssueListView?.show();
      });

      statusContainer.insertBefore(issuesBtn, statusContainer.firstChild);
    }

    updateIssueListButtonVisibility() {
      const btn = document.getElementById('pilot-header-issues-btn');
      if (btn) {
        const isAuth = window.AuthService?.isAuthenticated();
        btn.style.display = isAuth ? 'inline-flex' : 'none';
      }
    }
  }

  window.PilotBootstrap = new PilotBootstrap();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.PilotBootstrap.init());
  } else {
    window.PilotBootstrap.init();
  }
})(window);
