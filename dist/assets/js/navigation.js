/**
 * Samsung Branch Operations - Navigation Controller
 * Handles sidebar, mobile bottom nav, active state, breadcrumbs, and logout.
 */

class AppNavigation {
  constructor() {
    this.navLinks = [];
    this.init();
  }

  init() {
    document.addEventListener("DOMContentLoaded", () => {
      this.bindEvents();
      this.updateUserInfo();
    });
  }

  bindEvents() {
    // Logout buttons
    const logoutBtns = document.querySelectorAll(".btn-action-logout");
    logoutBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleLogout();
      });
    });

    // Mobile menu toggle, close button & backdrop
    const mobileMenuBtn = document.getElementById("btnMobileMenuToggle");
    const sidebarCloseBtn = document.getElementById("btnSidebarClose");
    const sidebarBackdrop = document.getElementById("sidebarBackdrop");
    const sidebar = document.getElementById("appSidebar");

    const openSidebar = () => {
      if (sidebar) sidebar.classList.add("sidebar-open");
      if (sidebarBackdrop) sidebarBackdrop.classList.add("active");
      if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "true");
    };

    const closeSidebar = () => {
      if (sidebar) sidebar.classList.remove("sidebar-open");
      if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
      if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "false");
    };

    this.openSidebar = openSidebar;
    this.closeSidebar = closeSidebar;

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (sidebar && sidebar.classList.contains("sidebar-open")) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSidebar();
      });
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener("click", (e) => {
        e.preventDefault();
        closeSidebar();
      });
    }

    // Close sidebar on navigation click (both sidebar links and bottom nav items)
    document.querySelectorAll(".nav-item-link, .mobile-nav-item, .nav-link").forEach(link => {
      link.addEventListener("click", () => {
        closeSidebar();
      });
    });

    // Close sidebar on route hash change
    window.addEventListener("hashchange", () => {
      closeSidebar();
    });

    // Close sidebar on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebar && sidebar.classList.contains("sidebar-open")) {
        closeSidebar();
      }
    });
  }

  handleLogout() {
    if (confirm("คุณต้องการออกจากระบบหรือไม่?")) {
      if (window.DataLoader) {
        window.DataLoader.purgeMemoryDatasets();
      }
      window.AuthService.signOut();
      window.AppRouter.navigate("/login");
    }
  }

  setActiveRoute(path) {
    const allLinks = document.querySelectorAll(".nav-item-link, .mobile-nav-item");
    allLinks.forEach(link => {
      const href = link.getAttribute("href") || "";
      const targetPath = href.replace(/^#/, "");
      if (targetPath === path) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
    });

    // Update Header Breadcrumb
    const breadcrumbEl = document.getElementById("headerBreadcrumbCurrent");
    if (breadcrumbEl && window.AppRouter.routes[path]) {
      const cleanTitle = window.AppRouter.routes[path].title.split(" • ")[0];
      breadcrumbEl.textContent = cleanTitle;
    }

    this.updateUserInfo();
  }

  updateUserInfo() {
    const user = window.AuthService.getCurrentUser();
    const userDisplayEls = document.querySelectorAll(".current-user-display");
    userDisplayEls.forEach(el => {
      if (user) {
        el.textContent = user.displayName;
      } else {
        el.textContent = "ยังไม่ได้เข้าสู่ระบบ";
      }
    });

    const userRoleEls = document.querySelectorAll(".current-user-role");
    userRoleEls.forEach(el => {
      if (user) {
        el.textContent = user.role || "STAFF";
      }
    });
  }
}

window.AppNavigation = new AppNavigation();
