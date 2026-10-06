/**
 * Authentication Service for Feedback Pilot
 * Manages Employee Login, Session Restoration, and Role Discovery
 * Security: Uses generic error messaging; never logs passwords or tokens
 */

(function(window) {
  'use strict';

  class AuthService {
    constructor() {
      this.currentUser = null;
      this.currentProfile = null;
      this.currentRoles = [];
      this.listeners = [];
    }

    onAuthStateChange(callback) {
      if (typeof callback === 'function') {
        this.listeners.push(callback);
      }
    }

    notifyListeners(event, session) {
      for (const listener of this.listeners) {
        try {
          listener(event, session, {
            user: this.currentUser,
            profile: this.currentProfile,
            roles: this.currentRoles
          });
        } catch (e) {
          console.error('[AuthService] Listener error:', e);
        }
      }
    }

    async signIn(employeeCode, password) {
      const client = window.SupabaseAdapter?.getClient();
      if (!client) {
        throw new Error('ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล กรุณาตั้งค่าการเชื่อมต่อก่อน');
      }

      const cleanCode = (employeeCode || '').trim().toUpperCase();
      if (!cleanCode || !password) {
        throw new Error('กรุณากรอกรหัสพนักงานและรหัสผ่าน');
      }

      // Map employee code to internal store alias for Supabase Auth backend
      let loginEmail = cleanCode.toLowerCase();
      if (!loginEmail.includes('@')) {
        loginEmail = `${loginEmail}@staff.internal`;
      }

      const { data, error } = await client.auth.signInWithPassword({
        email: loginEmail,
        password: password
      });

      if (error) {
        // Generic security error message - never reveal whether employee code exists
        console.warn('[AuthService] Login failed for code:', cleanCode);
        throw new Error('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
      }

      this.currentUser = data.user;
      await this.loadProfileAndRoles();

      // Enforce Suspended Account Policy
      if (this.currentProfile && this.currentProfile.status === 'SUSPENDED') {
        await this.signOut();
        throw new Error('บัญชีนี้ถูกระงับ กรุณาติดต่อผู้จัดการร้าน');
      }

      this.notifyListeners('SIGNED_IN', data.session);

      // Central Dashboard Landing Page
      if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/login' || window.location.hash === '#/') {
        window.location.hash = '#/home';
      }

      return { user: this.currentUser, profile: this.currentProfile, roles: this.currentRoles };
    }

    async signOut() {
      const client = window.SupabaseAdapter?.getClient();
      if (client) {
        await client.auth.signOut();
      }
      this.currentUser = null;
      this.currentProfile = null;
      this.currentRoles = [];
      this.notifyListeners('SIGNED_OUT', null);
      if (window.location.hash !== '#/' && window.location.hash !== '#/login') {
        window.location.hash = '#/';
      }
    }

    async restoreSession() {
      const client = window.SupabaseAdapter?.getClient();
      if (!client) return null;

      const { data: { session } } = await client.auth.getSession();
      if (session && session.user) {
        this.currentUser = session.user;
        await this.loadProfileAndRoles();

        // Check if account has been suspended by manager
        if (this.currentProfile && this.currentProfile.status === 'SUSPENDED') {
          console.warn('[AuthService] Active session belongs to a SUSPENDED account. Forcing logout.');
          await this.signOut();
          return null;
        }

        this.notifyListeners('TOKEN_REFRESHED', session);

        // Open Dashboard if currently on root/login
        if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/login' || window.location.hash === '#/') {
          window.location.hash = '#/home';
        }

        return session;
      }
      return null;
    }

    async loadProfileAndRoles() {
      const client = window.SupabaseAdapter?.getClient();
      if (!client || !this.currentUser) return;

      try {
        // Fetch Profile
        const { data: profile, error: pError } = await client
          .from('profiles')
          .select('id, employee_code, display_name, branch_id, job_title, status')
          .eq('id', this.currentUser.id)
          .single();

        if (!pError && profile) {
          this.currentProfile = profile;
        }

        // Fetch Assigned Roles
        const { data: roles, error: rError } = await client
          .from('user_roles')
          .select('role, branch_id')
          .eq('user_id', this.currentUser.id);

        if (!rError && Array.isArray(roles)) {
          this.currentRoles = roles;
        }
      } catch (err) {
        console.error('[AuthService] Error loading user metadata:', err);
      }
    }

    getProfile() {
      return this.currentProfile;
    }

    getRoles() {
      return this.currentRoles;
    }

    isAuthenticated() {
      return !!this.currentUser;
    }
  }

  window.AuthService = new AuthService();
})(window);
