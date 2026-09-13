/**
 * Supabase Client Adapter for Feedback Pilot
 * Singleton instance manager using Publishable Key
 * Security: NEVER accepts Secret Key; relies strictly on RLS and Database Grants
 */

(function(window) {
  'use strict';

  class SupabaseClientAdapter {
    constructor() {
      this.client = null;
      this.config = null;
    }

    init(config = {}) {
      const runtimeConfig = window.__SUPABASE_CONFIG__ || {};
      const url = config.url || runtimeConfig.url || localStorage.getItem('samsung_pilot_supabase_url');
      const publishableKey = config.publishableKey || runtimeConfig.publishableKey || localStorage.getItem('samsung_pilot_publishable_key');

      if (!url || !publishableKey) {
        console.warn('[SupabaseAdapter] Missing URL or Publishable Key. Client running in unconfigured mode.');
        return false;
      }

      this.config = { url: url.replace(/\/+$/, ''), publishableKey };

      if (window.supabase && typeof window.supabase.createClient === 'function') {
        this.client = window.supabase.createClient(this.config.url, this.config.publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'samsung_pilot_auth_token'
          }
        });
        console.log('[SupabaseAdapter] Initialized successfully with official Supabase JS SDK.');
      } else {
        console.log('[SupabaseAdapter] Initialized in REST fallback mode.');
      }
      return true;
    }

    getClient() {
      return this.client;
    }

    getConfig() {
      return this.config;
    }

    isConfigured() {
      return !!(this.config && this.config.url && this.config.publishableKey);
    }
  }

  window.SupabaseAdapter = new SupabaseClientAdapter();
})(window);
