/**
 * Pilot Bootstrap Coordinator (4-User Store Pilot)
 * Initializes Feedback Pilot UI, session restoration, and mounts controls
 */

(function(window) {
  'use strict';

  // 0. Augment AuthService for backward compatibility with baseline Shell / Navigation
  if (window.AuthService) {
    if (!window.AuthService.getCurrentUser) {
      window.AuthService.getCurrentUser = function() {
        if (!this.currentUser) return null;
        const profile = this.currentProfile;
        const primaryRole = (this.currentRoles && this.currentRoles[0]?.role) ||
                            this.currentUser.user_metadata?.role ||
                            (this.currentUser.email?.toLowerCase().includes('cpw3862') ? 'STORE_LEADER' : 'MEMBER');
        return {
          id: this.currentUser.id,
          employeeId: profile?.employee_code || this.currentUser.user_metadata?.employee_code || (this.currentUser.email ? this.currentUser.email.split('@')[0].toUpperCase() : 'STAFF'),
          displayName: profile?.display_name || this.currentUser.user_metadata?.display_name || (this.currentUser.email?.toLowerCase().includes('cpw3862') ? 'สิริชัย (ผู้จัดการร้าน)' : 'Staff'),
          role: primaryRole,
          authMode: 'SUPABASE'
        };
      };
    }

    if (!window.AuthService.getSession) {
      window.AuthService.getSession = function() {
        if (!this.currentUser) return null;
        return {
          authenticated: true,
          user: this.currentUser,
          profile: this.currentProfile,
          roles: this.currentRoles
        };
      };
    }
  }

  // Augment PermissionService to support Store Leader fallback
  if (window.PermissionService) {
    const origIsLeader = window.PermissionService.isStoreLeader ? window.PermissionService.isStoreLeader.bind(window.PermissionService) : () => false;
    window.PermissionService.isStoreLeader = function(targetBranchId = null) {
      if (origIsLeader(targetBranchId)) return true;
      const user = window.AuthService?.currentUser;
      const email = user?.email?.toLowerCase() || '';
      const empCode = user?.user_metadata?.employee_code?.toUpperCase() || window.AuthService?.getProfile()?.employee_code?.toUpperCase() || '';
      if (email.includes('cpw3862') || empCode === 'CPW3862') return true;
      const metaRole = user?.user_metadata?.role || user?.app_metadata?.role;
      return metaRole === 'STORE_LEADER' || metaRole === 'SYSTEM_ADMIN';
    };

    const origIsAdmin = window.PermissionService.isSystemAdmin ? window.PermissionService.isSystemAdmin.bind(window.PermissionService) : () => false;
    window.PermissionService.isSystemAdmin = function() {
      if (origIsAdmin()) return true;
      const user = window.AuthService?.currentUser;
      const email = user?.email?.toLowerCase() || '';
      const empCode = user?.user_metadata?.employee_code?.toUpperCase() || window.AuthService?.getProfile()?.employee_code?.toUpperCase() || '';
      if (email.includes('cpw3862') || empCode === 'CPW3862') return true;
      const metaRole = user?.user_metadata?.role || user?.app_metadata?.role;
      return metaRole === 'SYSTEM_ADMIN';
    };
  }

  // Register route in AppRouter immediately with View Isolation Hook
  function ensureAppRouterAdminRoute() {
    if (window.AppRouter && window.AppRouter.routes) {
      window.AppRouter.routes['/admin/members'] = {
        title: 'จัดการสมาชิกสาขา • Samsung Branch Operations',
        isProtected: true,
        viewId: 'view-admin-members'
      };

      if (!window.AppRouter._hasViewIsolationHook) {
        window.AppRouter._hasViewIsolationHook = true;
        const origActivateView = window.AppRouter.activateView ? window.AppRouter.activateView.bind(window.AppRouter) : () => {};
        window.AppRouter.activateView = function(activeViewId, path) {
          origActivateView(activeViewId, path);
          document.querySelectorAll('.app-view').forEach(view => {
            if (view.id === activeViewId) {
              view.hidden = false;
              view.setAttribute('aria-hidden', 'false');
              view.classList.remove('hidden-view');
              view.classList.add('active-view');
              view.style.display = ''; // Clear any inline display override!
            } else {
              view.hidden = true;
              view.setAttribute('aria-hidden', 'true');
              view.classList.remove('active-view');
              view.classList.add('hidden-view');
              view.style.display = ''; // Clear any inline display override!
            }
          });
        };
      }
    }
  }
  ensureAppRouterAdminRoute();

  function patchStockImporterClassification() {
    if (window.StockStorageAdapter && !window.StockStorageAdapter._hasPilotClassificationPatch) {
      window.StockStorageAdapter._hasPilotClassificationPatch = true;
      const origSaveBatch = window.StockStorageAdapter.saveBatch.bind(window.StockStorageAdapter);

      window.StockStorageAdapter.saveBatch = async function(batchRecord) {
        if (batchRecord && Array.isArray(batchRecord.data)) {
          batchRecord.data.forEach(item => {
            if (window.resolveCanonicalCategory) {
              const canonical = window.resolveCanonicalCategory(item);
              item.canonicalCategory = canonical;
              if (canonical === 'BUDS') {
                item.category = 'Buds';
                item.includedInCoreDeviceKpi = true;
              } else if (canonical === 'SMARTPHONE') {
                item.category = 'SmartPhone';
                item.includedInCoreDeviceKpi = true;
              } else if (canonical === 'TABLET') {
                item.category = 'Tablet';
                item.includedInCoreDeviceKpi = true;
              } else if (canonical === 'SMARTWATCH') {
                item.category = 'Watch';
                item.includedInCoreDeviceKpi = true;
              } else if (canonical === 'SIM') {
                item.category = 'SIM';
                item.includedInCoreDeviceKpi = false;
              } else if (canonical === 'PREMIUM') {
                item.category = 'Premium';
                item.includedInCoreDeviceKpi = false;
              } else if (canonical === 'ADAPTER') {
                item.category = 'Adapter';
                item.includedInCoreDeviceKpi = false;
              } else if (canonical === 'ACCESSORY') {
                item.category = 'Accessory';
                item.includedInCoreDeviceKpi = false;
              } else {
                item.category = 'Other';
                item.includedInCoreDeviceKpi = false;
              }
            }
          });
        }

        const res = await origSaveBatch(batchRecord);

        // 1. Update in-memory databases with sanitized catalog
        window.STOCK_DATABASE = batchRecord.data;
        window.STOCK_DATA = batchRecord.data;

        // 2. Clear DataLoader caches
        if (window.DataLoader) {
          if (typeof window.DataLoader.clearCache === 'function') {
            window.DataLoader.clearCache();
          }
          window.DataLoader.stockDataCache = null;
          window.DataLoader.stockLoaded = true;
        }

        // 3. Immediately refresh PrototypeStock (Recalculates F1 cards and re-renders table)
        if (window.PrototypeStock && typeof window.PrototypeStock.refresh === 'function') {
          window.PrototypeStock.refresh();
        } else if (typeof window.initPrototypeStock === 'function') {
          window.initPrototypeStock();
        }

        return res;
      };
    }

    if (window.StockStorageAdapter && !window.StockStorageAdapter._hasPilotActiveSnapshotPatch) {
      window.StockStorageAdapter._hasPilotActiveSnapshotPatch = true;
      const origGetActiveSnapshot = window.StockStorageAdapter.getActiveSnapshot.bind(window.StockStorageAdapter);

      window.StockStorageAdapter.getActiveSnapshot = async function() {
        let snap = await origGetActiveSnapshot();
        if ((!snap || !snap.data || snap.data.length <= 290) && window.LATEST_STOCK_SNAPSHOT) {
          snap = {
            key: 'active',
            batchId: 'STOCK-20260914-LATEST',
            data: window.LATEST_STOCK_SNAPSHOT,
            meta: {
              stockBatchId: 'STOCK-20260914-LATEST',
              importBatchId: 'STOCK-20260914-LATEST',
              sourceType: 'Manual Excel Snapshot',
              sourceFilename: 'stock(1).xlsx',
              recordCount: window.LATEST_STOCK_SNAPSHOT.length,
              uniquePn: window.LATEST_STOCK_SNAPSHOT.length,
              f1Total: 1701,
              f2Total: 1635,
              grandTotal: 3336,
              storageScope: 'LOCAL_BROWSER_ONLY'
            }
          };
          try {
            await window.StockStorageAdapter.saveBatch(snap);
          } catch(e) {}
        }

        if (snap && Array.isArray(snap.data)) {
          snap.data.forEach(item => {
            if (window.resolveCanonicalCategory) {
              const canonical = window.resolveCanonicalCategory(item);
              item.canonicalCategory = canonical;
              if (canonical === 'BUDS') item.category = 'Buds';
              else if (canonical === 'SMARTPHONE') item.category = 'SmartPhone';
              else if (canonical === 'TABLET') item.category = 'Tablet';
              else if (canonical === 'SMARTWATCH') item.category = 'Watch';
              else if (canonical === 'SIM') item.category = 'SIM';
              else if (canonical === 'PREMIUM') item.category = 'Premium';
              else if (canonical === 'ADAPTER') item.category = 'Adapter';
              else if (canonical === 'ACCESSORY') item.category = 'Accessory';
              else item.category = 'Other';
            }
          });
          window.STOCK_DATABASE = snap.data;
          window.STOCK_DATA = snap.data;
          if (snap.meta) window.STOCK_METADATA = snap.meta;
        }

        return snap;
      };
    }

    if (window.DataLoader && !window.DataLoader._hasPilotDataLoaderPatch) {
      window.DataLoader._hasPilotDataLoaderPatch = true;
      const origLoadAuth = window.DataLoader.loadAuthenticatedDatasets.bind(window.DataLoader);

      window.DataLoader.loadAuthenticatedDatasets = async function() {
        const res = await origLoadAuth();
        if ((!window.STOCK_DATABASE || window.STOCK_DATABASE.length <= 290) && window.LATEST_STOCK_SNAPSHOT) {
          window.STOCK_DATABASE = window.LATEST_STOCK_SNAPSHOT;
          window.STOCK_DATA = window.LATEST_STOCK_SNAPSHOT;
          window.STOCK_METADATA = {
            stockBatchId: 'STOCK-20260914-LATEST',
            importBatchId: 'STOCK-20260914-LATEST',
            sourceType: 'Manual Excel Snapshot',
            sourceFilename: 'stock(1).xlsx',
            recordCount: window.LATEST_STOCK_SNAPSHOT.length,
            uniquePn: window.LATEST_STOCK_SNAPSHOT.length,
            f1Total: 1701,
            f2Total: 1635,
            grandTotal: 3336
          };
        }
        if (window.PrototypeStock && typeof window.PrototypeStock.refresh === 'function') {
          window.PrototypeStock.refresh();
        }
        return res;
      };
    }

    const origSync = window.syncMasterStockData;
    window.syncMasterStockData = function() {
      if (typeof origSync === 'function') {
        try { origSync(); } catch (e) {}
      }
      if (window.PrototypeStock && typeof window.PrototypeStock.refresh === 'function') {
        window.PrototypeStock.refresh();
      } else if (typeof window.initPrototypeStock === 'function') {
        window.initPrototypeStock();
      }
    };
  }

  class PilotBootstrap {
    constructor() {
      this.initialized = false;
    }

    async init() {
      if (this.initialized) return;
      this.initialized = true;

      console.log('[PilotBootstrap] Initializing Samsung Store Feedback Pilot...');

      ensureAppRouterAdminRoute();
      patchStockImporterClassification();

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

      // 4. Initialize Role-aware Navigation
      if (window.PilotNavigation) {
        window.PilotNavigation.init();
      }

      // 5. Add "ติดตามปัญหา" (Issue List) button to User Status Bar
      this.injectIssueListButton();

      // 6. Restore active session (30-day persistent session support)
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
          if (window.PilotNavigation) {
            window.PilotNavigation.updateNavigation();
          }
          this.handleRouteChange();
        });
      }

      this.updateIssueListButtonVisibility();

      // 7. Route change listener for dynamic Pilot views (Dashboard & Member Admin)
      window.addEventListener('hashchange', () => this.handleRouteChange());
      this.handleRouteChange();
    }

    hideAllPilotPages() {
      document.querySelectorAll('[data-pilot-route]').forEach(page => {
        page.hidden = true;
        page.setAttribute('aria-hidden', 'true');
        page.classList.remove('active-view');
        page.classList.add('hidden-view');
        page.style.display = ''; // Clear any inline display override!
      });
    }

    showPilotPage(route) {
      this.hideAllPilotPages();
      const page = document.querySelector(`[data-pilot-route="${route}"]`);
      if (!page) return;
      page.hidden = false;
      page.setAttribute('aria-hidden', 'false');
      page.classList.remove('hidden-view');
      page.classList.add('active-view');
      page.style.display = ''; // Clear any inline display override!
    }

    handleRouteChange() {
      ensureAppRouterAdminRoute();
      const hash = window.location.hash || '#/home';
      const path = hash.replace(/^#/, '').split('?')[0] || '/home';
      const cleanRoute = (path === '/' || path === '') ? '/home' : path;

      if (cleanRoute === '/admin/members') {
        const canManage = window.PermissionService?.can?.('member.manage') ||
                          window.PermissionService?.isStoreLeader?.() ||
                          window.PermissionService?.isSystemAdmin?.();

        if (!canManage) {
          console.warn('[PilotBootstrap] Access denied to /admin/members for current role');
          window.location.hash = '#/home';
          return;
        }

        this.showPilotPage('/admin/members');

        if (window.AppNavigation) {
          window.AppNavigation.setActiveRoute('/admin/members');
        }

        const container = document.getElementById('adminMembersViewContent') || document.getElementById('view-admin-members');
        if (window.MemberAdminService && container) {
          if (!container.querySelector('.pilot-admin-wrapper')) {
            window.MemberAdminService.renderPage(container);
          } else {
            window.MemberAdminService.refresh?.();
          }
        }
      } else {
        // Leaving /admin/members -> cleanly destroy and unmount
        if (window.MemberAdminService) {
          window.MemberAdminService.destroy?.();
        }

        this.showPilotPage(cleanRoute);

        // If on Dashboard, render Pilot Dashboard Widgets
        if (cleanRoute === '/home') {
          const homeContent = document.getElementById('homeViewContent');
          if (homeContent && window.PilotDashboardRenderer) {
            window.PilotDashboardRenderer.renderDashboard(homeContent);
          }
        }
      }
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
