/**
 * Samsung Branch Operations - Authentication Adapter Layer
 * Development Mode: Uses purely per-tab sessionStorage with zero network leakage.
 * Strictly NO passwords stored, NO hardcoded real credentials.
 */

class DevelopmentAuthAdapter {
  constructor(sessionKey) {
    this.sessionKey = sessionKey || "samsung_branch_session_v1";
  }

  /**
   * Attempt sign in with Employee ID and Password.
   * In Development mode: Non-empty validation only, creates development session.
   */
  async signIn(employeeId, password) {
    const trimmedId = (employeeId || "").trim();
    const trimmedPw = (password || "").trim();

    if (!trimmedId) {
      return { success: false, error: "กรุณากรอกรหัสพนักงาน" };
    }
    if (!trimmedPw) {
      return { success: false, error: "กรุณากรอกรหัสผ่าน" };
    }

    // Create safe Development Session (Zero password storage)
    const sessionObj = {
      authenticated: true,
      authMode: "DEVELOPMENT",
      employeeId: trimmedId,
      displayName: `Staff (${trimmedId})`,
      role: "STORE_LEADER",
      signedInAt: new Date().toISOString(),
      sessionVersion: "1.0"
    };

    try {
      sessionStorage.setItem(this.sessionKey, JSON.stringify(sessionObj));
      return { success: true, session: sessionObj };
    } catch (err) {
      return { success: false, error: "ไม่สามารถบันทึกเซสชันในเบราว์เซอร์ได้" };
    }
  }

  /**
   * Terminate session and remove all auth data from sessionStorage.
   */
  signOut() {
    try {
      sessionStorage.removeItem(this.sessionKey);
    } catch (e) {
      console.warn("Error removing session:", e);
    }
  }

  /**
   * Retrieve current session with schema validation.
   */
  getSession() {
    try {
      const raw = sessionStorage.getItem(this.sessionKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.authenticated === true && parsed.sessionVersion === "1.0") {
        return parsed;
      }
      // Corrupt or invalid session schema
      this.signOut();
      return null;
    } catch (e) {
      this.signOut();
      return null;
    }
  }

  /**
   * Check if user is currently authenticated in this tab.
   */
  isAuthenticated() {
    return this.getSession() !== null;
  }

  /**
   * Get current user info.
   */
  getCurrentUser() {
    const s = this.getSession();
    return s ? { displayName: s.displayName, employeeId: s.employeeId, role: s.role, authMode: s.authMode } : null;
  }
}

// Enterprise Adapters Placeholder (For future IT integration)
class EntraAuthAdapter {
  async signIn() { throw new Error("Entra ID authentication requires enterprise approval."); }
  signOut() {}
  getSession() { return null; }
  isAuthenticated() { return false; }
}

class SupabaseAuthAdapter {
  async signIn() { throw new Error("Supabase authentication not configured."); }
  signOut() {}
  getSession() { return null; }
  isAuthenticated() { return false; }
}

// Instantiate Active Auth Service
window.AuthService = new DevelopmentAuthAdapter(window.APP_CONFIG?.sessionKey || "samsung_branch_session_v1");
