/**
 * Pilot Runtime Public Configuration Loader
 * Manages Supabase URL and Publishable Key for Feedback Pilot (Client-Side Safe)
 * IMPORTANT: NEVER store Service Role Key or Secret Key here.
 */

(function(window) {
  'use strict';

  // Default configuration or local overrides
  const defaultConfig = {
    // If configured via environment / build injection:
    supabaseUrl: window.__ENV_SUPABASE_URL || localStorage.getItem('PILOT_SUPABASE_URL') || '',
    supabasePublishableKey: window.__ENV_SUPABASE_PUBLISHABLE_KEY || localStorage.getItem('PILOT_SUPABASE_KEY') || '',
    branchId: 'AYUTTHAYA_CITY_PARK',
    branchName: 'อยุธยา ซิตี้ พาร์ค',
    version: '1.0.0-pilot'
  };

  class PilotConfig {
    constructor() {
      this.config = { ...defaultConfig };
    }

    get(key) {
      return this.config[key];
    }

    set(key, value) {
      this.config[key] = value;
      if (key === 'supabaseUrl') localStorage.setItem('PILOT_SUPABASE_URL', value);
      if (key === 'supabasePublishableKey') localStorage.setItem('PILOT_SUPABASE_KEY', value);
    }

    isConfigured() {
      return !!(this.config.supabaseUrl && this.config.supabasePublishableKey);
    }
  }

  window.PilotRuntimeConfig = new PilotConfig();
})(window);
