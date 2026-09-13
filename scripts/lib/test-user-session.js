/**
 * Session Authentication Wrapper for Supabase REST / Data API testing
 */

class TestUserSession {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.accessToken = null;
    this.user = null;
  }

  async signIn(email, password) {
    const url = `${this.baseUrl}/auth/v1/token?grant_type=password`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Sign in failed (${res.status}): ${data.msg || data.error_description || JSON.stringify(data)}`);
    }

    this.accessToken = data.access_token;
    this.user = data.user;
    return this.user;
  }

  getAuthHeaders() {
    const headers = {
      'apikey': this.apiKey
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  async get(path) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    const body = await res.text();
    let json = null;
    try { json = JSON.parse(body); } catch (e) {}
    return { status: res.status, ok: res.ok, data: json || body };
  }

  async post(path, payload) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.text();
    let json = null;
    try { json = JSON.parse(body); } catch (e) {}
    return { status: res.status, ok: res.ok, data: json || body };
  }

  async patch(path, payload) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.text();
    let json = null;
    try { json = JSON.parse(body); } catch (e) {}
    return { status: res.status, ok: res.ok, data: json || body };
  }

  async delete(path) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...this.getAuthHeaders(),
        'Prefer': 'return=representation'
      }
    });
    const body = await res.text();
    let json = null;
    try { json = JSON.parse(body); } catch (e) {}
    return { status: res.status, ok: res.ok, data: json || body };
  }
}

module.exports = { TestUserSession };
