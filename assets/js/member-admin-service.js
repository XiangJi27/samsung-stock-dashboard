/**
 * Member Admin Management Service & View Controller (Ayutthaya City Park)
 * Restricted to STORE_LEADER / SYSTEM_ADMIN
 * 
 * Provides full end-to-end administration:
 * - listMembers(): Fetch all branch staff with last sign in timestamp
 * - createMember(): Add new staff with role/branch enforcement
 * - updateDisplayName(): Rename staff display name
 * - resetPassword(): Set new temporary password with security verification
 * - suspendMember(): Suspend staff account with reason (Self-suspend protected)
 * - reactivateMember(): Reactivate suspended staff account
 * - renderPage(): Render responsive dashboard, summary cards, and modals
 */

(function(window) {
  'use strict';

  class MemberAdminService {
    constructor() {
      this.members = [];
      this.filteredMembers = [];
      this.searchQuery = '';
      this.statusFilter = 'ALL';
      this.containerEl = null;
      this.activeMember = null; // Currently selected member for modal actions
      this.isLoading = false;
    }

    // Helper to get active admin access token
    async getAccessToken() {
      try {
        const client = window.SupabaseAdapter?.getClient();
        if (client) {
          const { data } = await client.auth.getSession();
          if (data?.session?.access_token) {
            return data.session.access_token;
          }
        }
      } catch (e) {
        console.warn('[MemberAdminService] Failed to retrieve session access token:', e.message);
      }
      return null;
    }

    // ------------------------------------------------------------------------
    // API CLIENT METHODS
    // ------------------------------------------------------------------------

    async listMembers() {
      const token = await this.getAccessToken();
      const res = await fetch('/api/admin/members', {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ไม่สามารถดึงรายชื่อสมาชิกได้');
      }
      return data.members || [];
    }

    async createMember(payload) {
      const token = await this.getAccessToken();
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ไม่สามารถสร้างบัญชีพนักงานได้');
      }
      return data;
    }

    async updateDisplayName(memberId, displayName) {
      const token = await this.getAccessToken();
      const res = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ displayName })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ไม่สามารถแก้ไขชื่อได้');
      }
      return data;
    }

    async resetPassword(memberId, temporaryPassword, confirmation) {
      const token = await this.getAccessToken();
      const res = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ temporaryPassword, confirmation })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
      }
      return data;
    }

    async suspendMember(memberId, reason) {
      const token = await this.getAccessToken();
      const res = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ reason })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ไม่สามารถระงับบัญชีได้');
      }
      return data;
    }

    async reactivateMember(memberId) {
      const token = await this.getAccessToken();
      const res = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ไม่สามารถเปิดใช้งานบัญชีได้');
      }
      return data;
    }

    // ------------------------------------------------------------------------
    // UI RENDERING & VIEW LIFECYCLE
    // ------------------------------------------------------------------------

    render(targetContainer) {
      return this.renderPage(targetContainer);
    }

    renderPage(targetContainer) {
      const container = targetContainer || document.getElementById('view-admin-members');
      if (!container) return;
      this.containerEl = container;

      // Role check: Only SYSTEM_ADMIN or STORE_LEADER permitted
      const isLeader = window.PermissionService?.isStoreLeader() || window.PermissionService?.isSystemAdmin();
      if (!isLeader) {
        container.innerHTML = `
          <div style="padding: 48px 24px; text-align: center; color: #ef5350; font-family: inherit;">
            <div style="font-size: 48px; margin-bottom: 12px;">🚫</div>
            <h2 style="margin: 0 0 8px 0; color: #fff;">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
            <p style="color: #848e9c; margin-bottom: 24px;">หน้านี้สงวนไว้สำหรับผู้จัดการสาขาและผู้ดูแลระบบเท่านั้น</p>
            <button onclick="window.location.hash='#/home'" style="background: #2962ff; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer; font-weight: 600;">
              กลับสู่แดชบอร์ดหลัก
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="pilot-admin-wrapper" style="padding: 24px; max-width: 1200px; margin: 0 auto; font-family: inherit; color: #e0e3eb;">
          
          <!-- Top Bar -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                <span style="font-size: 24px;">👥</span>
                <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #fff;">จัดการสมาชิกในสาขา</h2>
                <span style="background: rgba(41,98,255,0.15); border: 1px solid rgba(41,98,255,0.3); color: #82b1ff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px;">
                  AYUTTHAYA CITY PARK
                </span>
              </div>
              <div style="font-size: 13px; color: #848e9c;">
                ระบบบริหารจัดการบัญชีพนักงาน สิทธิ์การเข้าถึง และการรีเซ็ตรหัสผ่านประจำสาขา
              </div>
            </div>

            <div style="display: flex; gap: 10px;">
              <button id="btn-admin-refresh" style="background: #1e222d; border: 1px solid #363c4e; color: #b2b5be; border-radius: 6px; padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <span>🔄</span> รีเฟรช
              </button>
              <button id="btn-admin-add-member" style="background: linear-gradient(135deg, #2962ff, #1e88e5); color: #fff; border: none; border-radius: 6px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(41,98,255,0.3);">
                <span>➕</span> เพิ่มสมาชิกใหม่
              </button>
            </div>
          </div>

          <!-- Alert Banner -->
          <div id="admin-member-banner" style="display: none; border-radius: 8px; padding: 14px 18px; font-size: 13px; margin-bottom: 20px; line-height: 1.5;"></div>

          <!-- Summary Stats Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: #1e222d; border: 1px solid #363c4e; border-radius: 10px; padding: 18px;">
              <div style="font-size: 12px; color: #848e9c; margin-bottom: 6px; font-weight: 600;">สมาชิกทั้งหมด</div>
              <div id="stat-total-members" style="font-size: 28px; font-weight: 700; color: #fff;">-</div>
              <div style="font-size: 11px; color: #848e9c; margin-top: 4px;">บัญชีที่ลงทะเบียนในสาขา</div>
            </div>
            <div style="background: #1e222d; border: 1px solid rgba(76,175,80,0.3); border-radius: 10px; padding: 18px;">
              <div style="font-size: 12px; color: #81c784; margin-bottom: 6px; font-weight: 600;">สมาชิกที่ใช้งานอยู่</div>
              <div id="stat-active-members" style="font-size: 28px; font-weight: 700; color: #4caf50;">-</div>
              <div style="font-size: 11px; color: #848e9c; margin-top: 4px;">สถานะ ACTIVE</div>
            </div>
            <div style="background: #1e222d; border: 1px solid rgba(239,83,80,0.3); border-radius: 10px; padding: 18px;">
              <div style="font-size: 12px; color: #e57373; margin-bottom: 6px; font-weight: 600;">สมาชิกที่ถูกระงับ</div>
              <div id="stat-suspended-members" style="font-size: 28px; font-weight: 700; color: #ef5350;">-</div>
              <div style="font-size: 11px; color: #848e9c; margin-top: 4px;">สถานะ SUSPENDED</div>
            </div>
            <div style="background: #1e222d; border: 1px solid #363c4e; border-radius: 10px; padding: 18px;">
              <div style="font-size: 12px; color: #848e9c; margin-bottom: 6px; font-weight: 600;">เข้าสู่ระบบล่าสุด</div>
              <div id="stat-latest-signin" style="font-size: 14px; font-weight: 700; color: #90caf9; margin-top: 8px; line-height: 1.4;">-</div>
              <div style="font-size: 11px; color: #848e9c; margin-top: 6px;">ความเคลื่อนไหวในสาขา</div>
            </div>
          </div>

          <!-- Controls: Search & Filter -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; flex-wrap: wrap;">
            <div style="position: relative; flex: 1; max-width: 400px; min-width: 260px;">
              <input type="text" id="admin-search-input" placeholder="🔍 ค้นหาด้วยชื่อหรือรหัสพนักงาน..." style="width: 100%; box-sizing: border-box; background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 9px 12px 9px 34px; color: #fff; font-size: 13px;">
              <span style="position: absolute; left: 10px; top: 10px; color: #848e9c; pointer-events: none;">🔍</span>
            </div>

            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size: 12px; color: #848e9c;">ตัวกรอง:</span>
              <button class="filter-btn active" data-filter="ALL" style="background: #2962ff; color: #fff; border: none; border-radius: 4px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">ทั้งหมด</button>
              <button class="filter-btn" data-filter="ACTIVE" style="background: #1e222d; color: #b2b5be; border: 1px solid #363c4e; border-radius: 4px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">ใช้งานอยู่</button>
              <button class="filter-btn" data-filter="SUSPENDED" style="background: #1e222d; color: #b2b5be; border: 1px solid #363c4e; border-radius: 4px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">ถูกระงับ</button>
            </div>
          </div>

          <!-- Members Table Container -->
          <div style="background: #1e222d; border: 1px solid #363c4e; border-radius: 10px; overflow-x: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="background: #131722; border-bottom: 1px solid #363c4e; color: #848e9c; font-size: 12px;">
                  <th style="padding: 14px 16px; font-weight: 600;">รหัสพนักงาน</th>
                  <th style="padding: 14px 16px; font-weight: 600;">ชื่อแสดงผล</th>
                  <th style="padding: 14px 16px; font-weight: 600;">บทบาท</th>
                  <th style="padding: 14px 16px; font-weight: 600;">สถานะ</th>
                  <th style="padding: 14px 16px; font-weight: 600;">เข้าสู่ระบบล่าสุด</th>
                  <th style="padding: 14px 16px; font-weight: 600; text-align: right;">การจัดการ</th>
                </tr>
              </thead>
              <tbody id="pilot-members-tbody">
                <tr><td colspan="6" style="padding: 32px; text-align: center; color: #848e9c;">กำลังโหลดข้อมูลสมาชิก...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Modals Mount Point -->
          <div id="pilot-member-modals-container"></div>
        </div>
      `;

      this.bindEvents();
      this.refresh();
    }

    bindEvents() {
      // Add member button
      document.getElementById('btn-admin-add-member')?.addEventListener('click', () => {
        this.openAddMemberModal();
      });

      // Refresh button
      document.getElementById('btn-admin-refresh')?.addEventListener('click', () => {
        this.refresh();
      });

      // Search input
      document.getElementById('admin-search-input')?.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.applyFiltersAndRender();
      });

      // Status filter buttons
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = '#1e222d';
            b.style.color = '#b2b5be';
            b.style.border = '1px solid #363c4e';
          });
          btn.classList.add('active');
          btn.style.background = '#2962ff';
          btn.style.color = '#fff';
          btn.style.border = 'none';
          this.statusFilter = btn.dataset.filter || 'ALL';
          this.applyFiltersAndRender();
        });
      });
    }

    async refresh() {
      const tbody = document.getElementById('pilot-members-tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 32px; text-align: center; color: #848e9c;">🔄 กำลังโหลดข้อมูลสมาชิก...</td></tr>';
      }

      this.isLoading = true;
      try {
        const members = await this.listMembers();
        this.members = members;
        this.updateSummaryCards();
        this.applyFiltersAndRender();
      } catch (err) {
        console.error('[MemberAdminService] Refresh error:', err);
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="6" style="padding: 32px; text-align: center; color: #ef5350;">
                <div style="margin-bottom: 8px; font-weight: 600;">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>
                <div style="font-size: 12px; color: #848e9c; margin-bottom: 16px;">${err.message}</div>
                <button onclick="window.MemberAdminService.refresh()" style="background: #2962ff; color: #fff; border: none; border-radius: 4px; padding: 6px 14px; font-size: 12px; cursor: pointer;">
                  ลองใหม่อีกครั้ง
                </button>
              </td>
            </tr>
          `;
        }
      } finally {
        this.isLoading = false;
      }
    }

    updateSummaryCards() {
      const total = this.members.length;
      const active = this.members.filter(m => m.status === 'ACTIVE').length;
      const suspended = this.members.filter(m => m.status === 'SUSPENDED').length;

      // Find latest sign in
      let latestDate = null;
      let latestUser = null;
      this.members.forEach(m => {
        if (m.lastSignInAt) {
          const d = new Date(m.lastSignInAt);
          if (!latestDate || d > latestDate) {
            latestDate = d;
            latestUser = m;
          }
        }
      });

      const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setEl('stat-total-members', total);
      setEl('stat-active-members', active);
      setEl('stat-suspended-members', suspended);

      if (latestDate && latestUser) {
        const formatted = this.formatDateThai(latestDate);
        setEl('stat-latest-signin', `${latestUser.displayName} (${formatted})`);
      } else {
        setEl('stat-latest-signin', 'ยังไม่มีการเข้าสู่ระบบ');
      }
    }

    applyFiltersAndRender() {
      let filtered = [...this.members];

      // Status filter
      if (this.statusFilter !== 'ALL') {
        filtered = filtered.filter(m => m.status === this.statusFilter);
      }

      // Search query
      if (this.searchQuery) {
        const q = this.searchQuery;
        filtered = filtered.filter(m => {
          const code = (m.employeeCode || '').toLowerCase();
          const name = (m.displayName || '').toLowerCase();
          return code.includes(q) || name.includes(q);
        });
      }

      this.filteredMembers = filtered;
      this.renderTableRows();
    }

    renderTableRows() {
      const tbody = document.getElementById('pilot-members-tbody');
      if (!tbody) return;

      if (this.filteredMembers.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="padding: 40px; text-align: center; color: #848e9c;">
              🔍 ไม่พบข้อมูลสมาชิกตามเงื่อนไขที่ค้นหา
            </td>
          </tr>
        `;
        return;
      }

      // Current authenticated user ID (to prevent self-suspend)
      const currentUserId = window.AuthService?.currentUser?.id;

      tbody.innerHTML = this.filteredMembers.map(m => {
        const isSuspended = m.status === 'SUSPENDED';
        const isSelf = currentUserId && m.id === currentUserId;

        // Role badge styling
        const isLeader = m.role === 'STORE_LEADER' || m.role === 'SYSTEM_ADMIN';
        const roleBadge = isLeader
          ? `<span style="background: rgba(255,179,0,0.15); border: 1px solid rgba(255,179,0,0.4); color: #ffb300; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">ผู้จัดการร้าน / Admin</span>`
          : `<span style="background: rgba(41,98,255,0.15); border: 1px solid rgba(41,98,255,0.3); color: #82b1ff; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">พนักงานขาย (Member)</span>`;

        // Status badge
        const statusBadge = isSuspended
          ? `<span style="background: rgba(239,83,80,0.15); border: 1px solid rgba(239,83,80,0.4); color: #ef5350; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">SUSPENDED (ระงับ)</span>`
          : `<span style="background: rgba(76,175,80,0.15); border: 1px solid rgba(76,175,80,0.4); color: #4caf50; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">ACTIVE (ปกติ)</span>`;

        // Last sign in format
        const lastSignInText = m.lastSignInAt
          ? this.formatDateThai(new Date(m.lastSignInAt))
          : '<span style="color: #64748b;">ยังไม่เคยเข้าสู่ระบบ</span>';

        return `
          <tr style="border-bottom: 1px solid #262b3d; transition: background 0.2s;" onmouseover="this.style.background='#222736'" onmouseout="this.style.background='transparent'">
            <td style="padding: 14px 16px;">
              <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: #fff; background: #131722; border: 1px solid #363c4e; padding: 3px 8px; border-radius: 4px;">
                ${m.employeeCode}
              </span>
              ${isSelf ? '<span style="font-size: 10px; color: #90caf9; margin-left: 6px; font-weight: 600;">(คุณ)</span>' : ''}
            </td>
            <td style="padding: 14px 16px; font-weight: 600; color: #fff;">
              ${m.displayName}
            </td>
            <td style="padding: 14px 16px;">
              ${roleBadge}
            </td>
            <td style="padding: 14px 16px;">
              ${statusBadge}
            </td>
            <td style="padding: 14px 16px; font-size: 12px; color: #b2b5be;">
              ${lastSignInText}
            </td>
            <td style="padding: 14px 16px; text-align: right;">
              <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                <!-- Rename -->
                <button onclick="window.MemberAdminService.openRenameModal('${m.id}')" title="แก้ไขชื่อแสดงผล" style="background: #262b3d; border: 1px solid #363c4e; color: #90caf9; border-radius: 4px; padding: 5px 9px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <span>✏️</span> แก้ชื่อ
                </button>
                <!-- Reset Password -->
                <button onclick="window.MemberAdminService.openResetPasswordModal('${m.id}')" title="รีเซ็ตรหัสผ่านชั่วคราว" style="background: #262b3d; border: 1px solid #363c4e; color: #ffb74d; border-radius: 4px; padding: 5px 9px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <span>🔑</span> รีเซ็ตรหัส
                </button>
                <!-- Suspend / Reactivate -->
                ${isSuspended ? `
                  <button onclick="window.MemberAdminService.openReactivateModal('${m.id}')" title="เปิดใช้งานบัญชีอีกครั้ง" style="background: rgba(76,175,80,0.15); border: 1px solid rgba(76,175,80,0.4); color: #81c784; border-radius: 4px; padding: 5px 9px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <span>✅</span> เปิดใช้งาน
                  </button>
                ` : `
                  <button onclick="window.MemberAdminService.openSuspendModal('${m.id}')" ${isSelf ? 'disabled title="ไม่สามารถระงับบัญชีที่กำลังใช้งานอยู่ได้"' : 'title="ระงับการใช้งาน"'} style="background: rgba(239,83,80,0.12); border: 1px solid rgba(239,83,80,0.35); color: ${isSelf ? '#555' : '#ef5350'}; border-radius: 4px; padding: 5px 9px; font-size: 12px; cursor: ${isSelf ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; gap: 4px; opacity: ${isSelf ? '0.4' : '1'};">
                    <span>🚫</span> ระงับ
                  </button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // ------------------------------------------------------------------------
    // MODAL DIALOGS CONTROLLERS
    // ------------------------------------------------------------------------

    openAddMemberModal() {
      this.renderModal(`
        <div style="background: #1e222d; border: 1px solid #363c4e; border-radius: 12px; width: 92%; max-width: 460px; padding: 24px; color: #e0e3eb; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span>➕</span> เพิ่มพนักงานขายใหม่
            </h3>
            <button onclick="window.MemberAdminService.closeModal()" style="background: none; border: none; color: #848e9c; font-size: 22px; cursor: pointer;">&times;</button>
          </div>

          <div id="modal-alert-box" style="display: none; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px;"></div>

          <form id="form-admin-add-member" onsubmit="window.MemberAdminService.submitAddMember(event)">
            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 12px; color: #b2b5be; margin-bottom: 5px; font-weight: 600;">รหัสพนักงาน (เช่น CPW1234) *</label>
              <input type="text" id="add-m-code" required placeholder="CPW..." style="width: 100%; box-sizing: border-box; background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 9px 12px; color: #fff; font-size: 13px;">
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 12px; color: #b2b5be; margin-bottom: 5px; font-weight: 600;">ชื่อแสดงผล (เช่น สิทธิชัย พนักงานขาย) *</label>
              <input type="text" id="add-m-name" required placeholder="ชื่อ-นามสกุล..." style="width: 100%; box-sizing: border-box; background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 9px 12px; color: #fff; font-size: 13px;">
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 12px; color: #b2b5be; margin-bottom: 5px; font-weight: 600;">รหัสผ่านชั่วคราว *</label>
              <input type="password" id="add-m-password" required placeholder="อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข" style="width: 100%; box-sizing: border-box; background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 9px 12px; color: #fff; font-size: 13px;">
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 12px; color: #b2b5be; margin-bottom: 5px; font-weight: 600;">ยืนยันรหัสผ่านชั่วคราว *</label>
              <input type="password" id="add-m-confirm" required placeholder="พิมพ์รหัสผ่านชั่วคราวอีกครั้ง" style="width: 100%; box-sizing: border-box; background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 9px 12px; color: #fff; font-size: 13px;">
            </div>

            <div style="background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #848e9c; margin-bottom: 18px; line-height: 1.5;">
              🔒 <strong>ระบบกำหนดอัตโนมัติ:</strong><br>
              • บทบาท: <span style="color: #4caf50; font-weight: 600;">MEMBER</span> (พนักงานขาย)<br>
              • สาขา: <span style="color: #fff;">อยุธยา ซิตี้ พาร์ค</span><br>
              • สถานะ: <span style="color: #4caf50; font-weight: 600;">ACTIVE</span>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button type="button" onclick="window.MemberAdminService.closeModal()" style="background: #262b3d; border: 1px solid #363c4e; color: #b2b5be; border-radius: 6px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;">
                ยกเลิก
              </button>
              <button type="submit" id="btn-submit-add-member" style="background: #2962ff; color: #fff; border: none; border-radius: 6px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer;">
                บันทึกสร้างสมาชิก
              </button>
            </div>
          </form>
        </div>
      `);
    }

    async submitAddMember(e) {
      e.preventDefault();
      const code = document.getElementById('add-m-code')?.value.trim().toUpperCase();
      const name = document.getElementById('add-m-name')?.value.trim();
      const password = document.getElementById('add-m-password')?.value;
      const confirm = document.getElementById('add-m-confirm')?.value;
      const btn = document.getElementById('btn-submit-add-member');

      if (password !== confirm) {
        this.showModalAlert('รหัสผ่านชั่วคราวและการยืนยันไม่ตรงกัน', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'กำลังสร้างบัญชี...';

      try {
        const res = await this.createMember({
          employeeCode: code,
          displayName: name,
          temporaryPassword: password,
          confirmation: confirm
        });

        this.closeModal();
        this.showBanner(
          `✅ <strong>เพิ่มสมาชิกเรียบร้อยแล้ว:</strong> ${code} (${name})<br>` +
          `กรุณาส่งรหัสพนักงานและรหัสผ่านชั่วคราวให้สมาชิกโดยตรง`,
          'success'
        );
        this.refresh();
      } catch (err) {
        this.showModalAlert(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'บันทึกสร้างสมาชิก';
      }
    }

    openRenameModal(memberId) {
      const member = this.members.find(m => m.id === memberId);
      if (!member) return;

      this.renderModal(`
        <div style="background: #1e222d; border: 1px solid #363c4e; border-radius: 12px; width: 92%; max-width: 420px; padding: 24px; color: #e0e3eb; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span>✏️</span> แก้ไขชื่อแสดงผล
            </h3>
            <button onclick="window.MemberAdminService.closeModal()" style="background: none; border: none; color: #848e9c; font-size: 22px; cursor: pointer;">&times;</button>
          </div>

          <div id="modal-alert-box" style="display: none; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px;"></div>

          <div style="background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #848e9c; margin-bottom: 16px;">
            รหัสพนักงาน: <strong style="color: #fff;">${member.employeeCode}</strong>
          </div>

          <form onsubmit="window.MemberAdminService.submitRename(event, '${member.id}')">
            <div style="margin-bottom: 18px;">
              <label style="display: block; font-size: 12px; color: #b2b5be; margin-bottom: 5px; font-weight: 600;">ชื่อแสดงผลใหม่ *</label>
              <input type="text" id="rename-m-name" required value="${member.displayName}" style="width: 100%; box-sizing: border-box; background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 9px 12px; color: #fff; font-size: 13px;">
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button type="button" onclick="window.MemberAdminService.closeModal()" style="background: #262b3d; border: 1px solid #363c4e; color: #b2b5be; border-radius: 6px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;">
                ยกเลิก
              </button>
              <button type="submit" id="btn-submit-rename" style="background: #2962ff; color: #fff; border: none; border-radius: 6px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer;">
                บันทึกชื่อใหม่
              </button>
            </div>
          </form>
        </div>
      `);
    }

    async submitRename(e, memberId) {
      e.preventDefault();
      const newName = document.getElementById('rename-m-name')?.value.trim();
      const btn = document.getElementById('btn-submit-rename');

      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';

      try {
        await this.updateDisplayName(memberId, newName);
        this.closeModal();
        this.showBanner(`✅ แก้ไขชื่อแสดงผลเป็น "${newName}" เรียบร้อยแล้ว`, 'success');
        this.refresh();
      } catch (err) {
        this.showModalAlert(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'บันทึกชื่อใหม่';
      }
    }

    openResetPasswordModal(memberId) {
      const member = this.members.find(m => m.id === memberId);
      if (!member) return;

      this.renderModal(`
        <div style="background: #1e222d; border: 1px solid #363c4e; border-radius: 12px; width: 92%; max-width: 440px; padding: 24px; color: #e0e3eb; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span>🔑</span> รีเซ็ตรหัสผ่านชั่วคราว
            </h3>
            <button onclick="window.MemberAdminService.closeModal()" style="background: none; border: none; color: #848e9c; font-size: 22px; cursor: pointer;">&times;</button>
          </div>

          <div id="modal-alert-box" style="display: none; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px;"></div>

          <div style="background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #848e9c; margin-bottom: 16px;">
            พนักงาน: <strong style="color: #fff;">${member.displayName}</strong> (${member.employeeCode})
          </div>

          <form onsubmit="window.MemberAdminService.submitResetPassword(event, '${member.id}')">
            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 12px; color: #b2b5be; margin-bottom: 5px; font-weight: 600;">รหัสผ่านชั่วคราวใหม่ *</label>
              <input type="password" id="reset-m-password" required placeholder="อย่างน้อย 8 ตัวอักษร มีตัวอักษรและตัวเลข" style="width: 100%; box-sizing: border-box; background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 9px 12px; color: #fff; font-size: 13px;">
            </div>

            <div style="margin-bottom: 18px;">
              <label style="display: block; font-size: 12px; color: #b2b5be; margin-bottom: 5px; font-weight: 600;">ยืนยันรหัสผ่านชั่วคราวใหม่ *</label>
              <input type="password" id="reset-m-confirm" required placeholder="พิมพ์รหัสผ่านอีกครั้ง" style="width: 100%; box-sizing: border-box; background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 9px 12px; color: #fff; font-size: 13px;">
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button type="button" onclick="window.MemberAdminService.closeModal()" style="background: #262b3d; border: 1px solid #363c4e; color: #b2b5be; border-radius: 6px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;">
                ยกเลิก
              </button>
              <button type="submit" id="btn-submit-reset-pw" style="background: #ff9800; color: #1e222d; border: none; border-radius: 6px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer;">
                ยืนยันตั้งรหัสใหม่
              </button>
            </div>
          </form>
        </div>
      `);
    }

    async submitResetPassword(e, memberId) {
      e.preventDefault();
      const pw = document.getElementById('reset-m-password')?.value;
      const confirm = document.getElementById('reset-m-confirm')?.value;
      const btn = document.getElementById('btn-submit-reset-pw');

      if (pw !== confirm) {
        this.showModalAlert('รหัสผ่านชั่วคราวใหม่และการยืนยันไม่ตรงกัน', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'กำลังรีเซ็ต...';

      try {
        await this.resetPassword(memberId, pw, confirm);
        this.closeModal();
        this.showBanner(
          `🔑 <strong>รีเซ็ตรหัสผ่านชั่วคราวเรียบร้อยแล้ว</strong><br>` +
          `กรุณาส่งรหัสผ่านใหม่ให้สมาชิกโดยตรง`,
          'success'
        );
      } catch (err) {
        this.showModalAlert(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ยืนยันตั้งรหัสใหม่';
      }
    }

    openSuspendModal(memberId) {
      const member = this.members.find(m => m.id === memberId);
      if (!member) return;

      this.renderModal(`
        <div style="background: #1e222d; border: 1px solid #ef5350; border-radius: 12px; width: 92%; max-width: 440px; padding: 24px; color: #e0e3eb; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; color: #ef5350; display: flex; align-items: center; gap: 8px;">
              <span>🚫</span> ระงับการใช้งานบัญชี
            </h3>
            <button onclick="window.MemberAdminService.closeModal()" style="background: none; border: none; color: #848e9c; font-size: 22px; cursor: pointer;">&times;</button>
          </div>

          <div id="modal-alert-box" style="display: none; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px;"></div>

          <div style="background: rgba(239,83,80,0.1); border: 1px solid rgba(239,83,80,0.3); border-radius: 6px; padding: 12px; font-size: 13px; color: #ff8a80; margin-bottom: 16px; line-height: 1.5;">
            ⚠️ <strong>ต้องการระงับบัญชีนี้ใช่หรือไม่?</strong><br>
            ผู้ใช้ <strong>${member.displayName}</strong> (${member.employeeCode}) จะถูกบังคับออกจากระบบทันที และไม่สามารถล็อกอินได้จนกว่าจะได้รับการเปิดใช้งานใหม่
          </div>

          <form onsubmit="window.MemberAdminService.submitSuspend(event, '${member.id}')">
            <div style="margin-bottom: 18px;">
              <label style="display: block; font-size: 12px; color: #b2b5be; margin-bottom: 5px; font-weight: 600;">เหตุผลในการระงับ *</label>
              <textarea id="suspend-m-reason" required rows="3" placeholder="ระบุเหตุผล เช่น ย้ายสาขา, พักงาน, ลาออก..." style="width: 100%; box-sizing: border-box; background: #131722; border: 1px solid #363c4e; border-radius: 6px; padding: 9px 12px; color: #fff; font-size: 13px; font-family: inherit; resize: none;"></textarea>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button type="button" onclick="window.MemberAdminService.closeModal()" style="background: #262b3d; border: 1px solid #363c4e; color: #b2b5be; border-radius: 6px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;">
                ยกเลิก
              </button>
              <button type="submit" id="btn-submit-suspend" style="background: #d32f2f; color: #fff; border: none; border-radius: 6px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer;">
                ยืนยันระงับบัญชี
              </button>
            </div>
          </form>
        </div>
      `);
    }

    async submitSuspend(e, memberId) {
      e.preventDefault();
      const reason = document.getElementById('suspend-m-reason')?.value.trim();
      const btn = document.getElementById('btn-submit-suspend');

      btn.disabled = true;
      btn.textContent = 'กำลังดำเนินการ...';

      try {
        await this.suspendMember(memberId, reason);
        this.closeModal();
        this.showBanner(`🚫 ระงับการใช้งานบัญชีเรียบร้อยแล้ว`, 'warning');
        this.refresh();
      } catch (err) {
        this.showModalAlert(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ยืนยันระงับบัญชี';
      }
    }

    openReactivateModal(memberId) {
      const member = this.members.find(m => m.id === memberId);
      if (!member) return;

      this.renderModal(`
        <div style="background: #1e222d; border: 1px solid #4caf50; border-radius: 12px; width: 92%; max-width: 440px; padding: 24px; color: #e0e3eb; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; color: #81c784; display: flex; align-items: center; gap: 8px;">
              <span>✅</span> เปิดใช้งานบัญชีอีกครั้ง
            </h3>
            <button onclick="window.MemberAdminService.closeModal()" style="background: none; border: none; color: #848e9c; font-size: 22px; cursor: pointer;">&times;</button>
          </div>

          <div id="modal-alert-box" style="display: none; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px;"></div>

          <div style="background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.3); border-radius: 6px; padding: 12px; font-size: 13px; color: #c8e6c9; margin-bottom: 18px; line-height: 1.5;">
            ต้องการเปิดใช้งานบัญชี <strong>${member.displayName}</strong> (${member.employeeCode}) อีกครั้งใช่หรือไม่?<br>
            เมื่อเปิดใช้งานแล้ว สมาชิกจะสามารถเข้าสู่ระบบและใช้งานแอปพลิเคชันได้ตามปกติ
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" onclick="window.MemberAdminService.closeModal()" style="background: #262b3d; border: 1px solid #363c4e; color: #b2b5be; border-radius: 6px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;">
              ยกเลิก
            </button>
            <button type="button" id="btn-submit-reactivate" onclick="window.MemberAdminService.submitReactivate('${member.id}')" style="background: #2e7d32; color: #fff; border: none; border-radius: 6px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer;">
              ยืนยันเปิดใช้งาน
            </button>
          </div>
        </div>
      `);
    }

    async submitReactivate(memberId) {
      const btn = document.getElementById('btn-submit-reactivate');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'กำลังเปิดใช้งาน...';
      }

      try {
        await this.reactivateMember(memberId);
        this.closeModal();
        this.showBanner(`✅ เปิดใช้งานบัญชีเรียบร้อยแล้ว สมาชิกสามารถเข้าสู่ระบบได้ตามปกติ`, 'success');
        this.refresh();
      } catch (err) {
        this.showModalAlert(err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'ยืนยันเปิดใช้งาน';
        }
      }
    }

    renderModal(contentHtml) {
      const container = document.getElementById('pilot-member-modals-container');
      if (!container) return;

      container.innerHTML = `
        <div id="pilot-member-active-modal" style="position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;">
          ${contentHtml}
        </div>
      `;
    }

    closeModal() {
      const modal = document.getElementById('pilot-member-active-modal');
      if (modal) modal.remove();
    }

    showModalAlert(message, type = 'error') {
      const box = document.getElementById('modal-alert-box');
      if (!box) return;

      const isErr = type === 'error';
      box.style.background = isErr ? 'rgba(239,83,80,0.15)' : 'rgba(76,175,80,0.15)';
      box.style.border = isErr ? '1px solid #ef5350' : '1px solid #4caf50';
      box.style.color = isErr ? '#ef5350' : '#4caf50';
      box.innerHTML = `${isErr ? '⚠️' : '✓'} ${message}`;
      box.style.display = 'block';
    }

    showBanner(message, type = 'success') {
      const banner = document.getElementById('admin-member-banner');
      if (!banner) return;

      const isErr = type === 'error';
      const isWarn = type === 'warning';
      
      let bg = 'rgba(76,175,80,0.15)';
      let border = '1px solid #4caf50';
      let color = '#a5d6a7';

      if (isErr) {
        bg = 'rgba(239,83,80,0.15)';
        border = '1px solid #ef5350';
        color = '#ef5350';
      } else if (isWarn) {
        bg = 'rgba(255,152,0,0.15)';
        border = '1px solid #ff9800';
        color = '#ffb74d';
      }

      banner.style.background = bg;
      banner.style.border = border;
      banner.style.color = color;
      banner.innerHTML = message;
      banner.style.display = 'block';

      // Auto scroll to top of wrapper
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Auto dismiss after 8 seconds
      setTimeout(() => {
        if (banner) banner.style.display = 'none';
      }, 8000);
    }

    formatDateThai(dateObj) {
      if (!dateObj || isNaN(dateObj.getTime())) return '-';
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const day = dateObj.getDate();
      const month = thaiMonths[dateObj.getMonth()];
      const year = dateObj.getFullYear() + 543;
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const mins = String(dateObj.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${year}, ${hours}:${mins} น.`;
    }
  }

  window.MemberAdminService = new MemberAdminService();
  window.MemberAdminView = window.MemberAdminService; // Backwards-compatible alias
})(window);
