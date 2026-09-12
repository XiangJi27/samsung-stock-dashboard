/**
 * Samsung Branch Operations - Hash Router & Route Guard
 * 100% Vercel-friendly static client-side router without 404 reload issues.
 */

class AppRouter {
  constructor() {
    this.routes = {
      "/login": { title: "เข้าสู่ระบบ • Samsung Branch Operations", isProtected: false, viewId: "view-login" },
      "/home": { title: "ภาพรวมสาขา • Samsung Branch Operations", isProtected: true, viewId: "view-home" },
      "/stock": { title: "สต็อกสาขา • Samsung Branch Operations", isProtected: true, viewId: "view-stock" },
      "/promotions": { title: "โปรโมชั่นสาขา • Samsung Branch Operations", isProtected: true, viewId: "view-promotions" },
      "/promotion-import": { title: "นำเข้าราคาและโปรโมชั่น • Samsung Branch Operations", isProtected: true, viewId: "view-promotion-import" },
      "/stock-import": { title: "นำเข้าสต็อกจาก Excel • Samsung Branch Operations", isProtected: true, viewId: "view-stock-import" },
      "/stock-import-history": { title: "ประวัติการนำเข้าสต็อก • Samsung Branch Operations", isProtected: true, viewId: "view-stock-import-history" },
      "/reports": { title: "รายงานสาขา • Samsung Branch Operations", isProtected: true, viewId: "view-reports" },
      "/knowledge": { title: "คลังความรู้สาขา • Samsung Branch Operations", isProtected: true, viewId: "view-knowledge" },
      "/settings": { title: "ตั้งค่าระบบ • Samsung Branch Operations", isProtected: true, viewId: "view-settings" }
    };

    this.currentRoute = null;
    this.init();
  }

  init() {
    window.addEventListener("hashchange", () => this.handleRouting());
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", () => this.handleRouting());
    } else {
      this.handleRouting();
    }
  }

  /**
   * Normalize current hash to route path.
   */
  getHashPath() {
    const hash = window.location.hash || "";
    if (!hash || hash === "#" || hash === "#/") {
      return "/";
    }
    // Remove leading '#'
    const path = hash.replace(/^#/, "");
    // Clean query params if any
    return path.split("?")[0] || "/";
  }

  /**
   * Programmatic navigation.
   */
  navigate(path) {
    window.location.hash = `#${path}`;
  }

  /**
   * Route Guard & View Switcher
   */
  async handleRouting() {
    let path = this.getHashPath();

    // Default root handling
    if (path === "/" || !this.routes[path]) {
      const isAuthed = window.AuthService.isAuthenticated();
      path = isAuthed ? "/home" : "/login";
      this.navigate(path);
      return;
    }

    const routeConfig = this.routes[path];

    // ROUTE GUARD: Check authentication
    const isAuthed = window.AuthService.isAuthenticated();
    if (routeConfig.isProtected && !isAuthed) {
      console.info("[Route Guard] Unauthorized access to protected route:", path, "-> Redirecting to /login");
      this.navigate("/login");
      return;
    }

    // Redirect to home if already logged in and visiting login page
    if (path === "/login" && isAuthed) {
      this.navigate("/home");
      return;
    }

    // DATA LOADING GATE: Load datasets on demand only after user is authenticated
    if (routeConfig.isProtected && isAuthed && window.DataLoader) {
      await window.DataLoader.loadAuthenticatedDatasets();
    }

    this.currentRoute = path;
    document.title = routeConfig.title;

    // Switch active view container
    this.activateView(routeConfig.viewId, path);

    // Update Application Shell visibility (Login page has no sidebar/header)
    this.updateShellLayout(path);

    // Update Navigation Active State
    if (window.AppNavigation) {
      window.AppNavigation.setActiveRoute(path);
    }

    // Trigger page-specific logic
    this.dispatchRouteAction(path);
  }

  /**
   * Show target view and hide all others safely.
   */
  activateView(activeViewId, path) {
    const views = document.querySelectorAll(".app-view");
    views.forEach(view => {
      if (view.id === activeViewId) {
        view.classList.remove("hidden-view");
        view.classList.add("active-view");
      } else {
        view.classList.remove("active-view");
        view.classList.add("hidden-view");
      }
    });

    // Announce to accessibility readers
    const liveRegion = document.getElementById("a11y-route-announcer");
    if (liveRegion && this.routes[path]) {
      liveRegion.textContent = `เปิดหน้า ${this.routes[path].title}`;
    }
  }

  /**
   * Toggle top-nav / sidebar visibility depending on route (hide on /login).
   */
  updateShellLayout(path) {
    const isLogin = path === "/login";
    const shellNav = document.getElementById("appSidebar");
    const shellHeader = document.getElementById("appTopHeader");
    const mobileBottomNav = document.getElementById("mobileBottomNav");
    const mainContainer = document.querySelector(".app-layout-main");

    if (shellNav) shellNav.classList.toggle("hidden-shell", isLogin);
    if (shellHeader) shellHeader.classList.toggle("hidden-shell", isLogin);
    if (mobileBottomNav) mobileBottomNav.classList.toggle("hidden-shell", isLogin);
    if (mainContainer) mainContainer.classList.toggle("auth-mode-layout", isLogin);
  }

  /**
   * Route-specific initialization hooks.
   */
  dispatchRouteAction(path) {
    if (path === "/home" && typeof window.renderHomeView === "function") {
      window.renderHomeView();
    } else if (path === "/stock" && typeof window.renderData === "function") {
      // Re-trigger stock rendering
      window.renderData();
    } else if (path === "/promotions" && typeof window.renderPromotionsView === "function") {
      window.renderPromotionsView();
    } else if (path === "/settings" && typeof window.renderSettingsView === "function") {
      window.renderSettingsView();
    } else if (path === "/stock-import-history" && typeof window.renderStockImportHistoryView === "function") {
      window.renderStockImportHistoryView();
    } else if (path === "/stock-import" && window.StockImportController && typeof window.StockImportController.handleRouteEnter === "function") {
      window.StockImportController.handleRouteEnter();
    }
  }
}

window.AppRouter = new AppRouter();
