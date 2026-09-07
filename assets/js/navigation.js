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

    // Mobile menu toggle if any
    const mobileMenuBtn = document.getElementById("btnMobileMenuToggle");
    const sidebar = document.getElementById("appSidebar");
    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener("click", () => {
        sidebar.classList.toggle("sidebar-open");
      });
    }

    // Close sidebar on navigation click (mobile)
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => {
        if (sidebar) sidebar.classList.remove("sidebar-open");
      });
    });
  }

  handleLogout() {
    if (confirm("คุณต้องการออกจากระบบหรือไม่?")) {
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
