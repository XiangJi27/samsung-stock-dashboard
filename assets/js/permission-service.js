/**
 * Permission Service for Feedback Pilot
 * Provides UX role evaluations for UI rendering and feature visibility.
 * IMPORTANT: Client-side permission checks are strictly for UX/UI convenience.
 * PostgreSQL Row Level Security (RLS) and Triggers enforce actual database security.
 */

(function(window) {
  'use strict';

  class PermissionService {
    isSystemAdmin() {
      const roles = window.AuthService?.getRoles() || [];
      return roles.some(r => r.role === 'SYSTEM_ADMIN');
    }

    isStoreLeader(targetBranchId = null) {
      const roles = window.AuthService?.getRoles() || [];
      if (this.isSystemAdmin()) return true;
      return roles.some(r => {
        if (r.role !== 'STORE_LEADER') return false;
        if (!targetBranchId) return true;
        return r.branch_id === targetBranchId || r.branch_id === null;
      });
    }

    isSupport() {
      const roles = window.AuthService?.getRoles() || [];
      if (this.isSystemAdmin()) return true;
      return roles.some(r => r.role === 'SUPPORT');
    }

    isAuditor() {
      const roles = window.AuthService?.getRoles() || [];
      if (this.isSystemAdmin()) return true;
      return roles.some(r => r.role === 'AUDITOR');
    }

    canViewInternalComments(issue) {
      if (this.isSystemAdmin()) return true;
      const profile = window.AuthService?.getProfile();
      if (!profile || !issue) return false;

      if (this.isStoreLeader(issue.branch_id)) return true;
      if (this.isSupport() && issue.assigned_to === profile.id) return true;
      return false;
    }

    canVerifyIssue(issue) {
      if (this.isSystemAdmin()) return true;
      if (!issue) return false;
      return this.isStoreLeader(issue.branch_id);
    }

    canAssignIssue(issue) {
      if (this.isSystemAdmin()) return true;
      if (!issue) return false;
      return this.isStoreLeader(issue.branch_id) || this.isSupport();
    }
  }

  window.PermissionService = new PermissionService();
})(window);
