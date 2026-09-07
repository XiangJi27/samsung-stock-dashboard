/**
 * Samsung Branch Operations - Global Configuration & Feature Flags
 * Frozen immutable runtime configuration.
 */
const CONFIG = Object.freeze({
  appName: "Samsung Branch Operations",
  systemSubtitle: "ระบบบริหารข้อมูลสต็อก โปรโมชั่น และการดำเนินงานสาขา",
  branchName: "Samsung Ayutthaya City Park 1st Floor",
  branchCode: "CPW-AYUTTHAYA-CITY-PARK",
  company: "Copperwired Public Company Limited",
  version: "2026.09-v1",
  sessionKey: "samsung_branch_session_v1",
  authMode: "DEVELOPMENT",
  defaultRoute: "/home",
  loginRoute: "/login"
});

const FEATURES = Object.freeze({
  demoAuthentication: true,
  enterpriseAuthentication: false,

  homeDashboard: true,
  salesDashboard: false, // Strictly false in Phase A: NOT_CONNECTED
  stockDashboard: true,
  promotionDashboard: true,
  reportsModule: false,  // Coming Soon
  notebookKnowledge: false, // Planned
  settingsModule: true,

  posCopy: false,
  posIntegration: false,
  nimbusIntegration: false,
  autoLogin: false,
  browserAutomation: false
});

window.APP_CONFIG = CONFIG;
window.APP_FEATURES = FEATURES;
