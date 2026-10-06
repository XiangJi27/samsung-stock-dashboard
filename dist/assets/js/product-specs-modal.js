/**
 * Product Specs Modal Integration Adapter
 * Routes spec viewing requests seamlessly to the unified Dual-Tab Drawer
 * Preserves access to live store promotions, verified identity policies, and fail-closed security.
 */
(function() {
  window.openProductSpecsModal = function(pn, model) {
    if (typeof window.openProductSpecsDrawer === "function") {
      window.openProductSpecsDrawer(pn, model || "");
    } else {
      console.warn("[Specs Modal Adapter] openProductSpecsDrawer is initializing, waiting for ready state...");
      setTimeout(() => {
        if (typeof window.openProductSpecsDrawer === "function") {
          window.openProductSpecsDrawer(pn, model || "");
        } else {
          console.error("[Specs Modal Adapter] openProductSpecsDrawer is unavailable.");
        }
      }, 100);
    }
  };
})();
