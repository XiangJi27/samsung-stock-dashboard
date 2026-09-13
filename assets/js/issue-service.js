/**
 * Issue Service for Feedback Pilot
 * Handles Issue reporting, querying, and comment threads via Supabase Data API
 * Security: Server-side database triggers enforce issue_number, reporter_id, and branch_id.
 */

(function(window) {
  'use strict';

  class IssueService {
    getClient() {
      const client = window.SupabaseAdapter?.getClient();
      if (!client) throw new Error('Supabase client not initialized');
      return client;
    }

    /**
     * Create new issue report
     * Notice: Does NOT pass issue_number, reporter_id, branch_id, status
     * Database BEFORE INSERT trigger unconditionally generates and binds these!
     */
    async createIssue(issueData) {
      const client = this.getClient();

      const payload = {
        title: (issueData.title || '').trim(),
        description: (issueData.description || '').trim(),
        category: issueData.category || 'OTHER',
        severity: issueData.severity || 'P3_MEDIUM',
        expected_result: issueData.expected_result || null,
        actual_result: issueData.actual_result || null,
        reproduction_steps: issueData.reproduction_steps || null,
        reproducibility: issueData.reproducibility || 'ALWAYS',
        stock_batch_id: issueData.stock_batch_id || null,
        promotion_batch_id: issueData.promotion_batch_id || null,
        current_route: issueData.current_route || window.location.hash || '/',
        application_version: '1.0.0-pilot',
        application_commit: 'bd509ef'
      };

      if (!payload.title || !payload.description) {
        throw new Error('กรุณากรอกหัวข้อและรายละเอียดปัญหา');
      }

      const { data, error } = await client
        .from('issues')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[IssueService] Create issue error:', error);
        throw new Error(error.message || 'ไม่สามารถบันทึกการแจ้งปัญหาได้');
      }

      return data;
    }

    async getMyIssues() {
      const client = this.getClient();
      const profile = window.AuthService?.getProfile();
      if (!profile) return [];

      const { data, error } = await client
        .from('issues')
        .select('id, issue_number, title, category, severity, status, created_at, updated_at')
        .eq('reporter_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }

    async getBranchIssues() {
      const client = this.getClient();
      const profile = window.AuthService?.getProfile();
      if (!profile) return [];

      const { data, error } = await client
        .from('issues')
        .select('id, issue_number, title, category, severity, status, reporter_id, created_at, updated_at')
        .eq('branch_id', profile.branch_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }

    async getIssueComments(issueId) {
      const client = this.getClient();
      const { data, error } = await client
        .from('issue_comments')
        .select('id, author_id, comment_text, is_internal, created_at')
        .eq('issue_id', issueId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }

    async addComment(issueId, commentText, isInternal = false) {
      const client = this.getClient();
      const profile = window.AuthService?.getProfile();
      if (!profile) throw new Error('กรุณาเข้าสู่ระบบก่อนแสดงความคิดเห็น');

      const payload = {
        issue_id: issueId,
        author_id: profile.id,
        comment_text: (commentText || '').trim(),
        is_internal: !!isInternal
      };

      if (!payload.comment_text) {
        throw new Error('กรุณากรอกข้อความ');
      }

      const { data, error } = await client
        .from('issue_comments')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  window.IssueService = new IssueService();
})(window);
