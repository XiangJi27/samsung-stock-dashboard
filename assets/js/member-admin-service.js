/**
 * Member Admin Management View Component (Ayutthaya City Park)
 * Restricted to STORE_LEADER / SYSTEM_ADMIN
 * Manages the 4-user store team:
 * - List staff accounts
 * - Add new member (calls /api/admin/members server-side endpoint)
 * - Update display name
 * - Reset temporary password
 * - Suspend / Reactivate account
 */

(function(window) {
  'use strict';

  class MemberAdminView {
    constructor() {
      this.members = [];
      this.containerEl = null;
    }

    render(targetContainer) {
      if (!targetContainer) return;
      this.containerEl = targetContainer;

      // Verify manager role
      const isLeader = window.PermissionService?.isStoreLeader() || window.PermissionService?.isSystemAdmin();
      if (!isLeader) {
        targetContainer.innerHTML = `
          <div style="padding:40px; text-align:center; color:#ef5350; font-family:inherit;">
            <h2>🚫 ไม่มีสิทธิ์เข้าถึง</h2>
            <p style="color:#848e9c;">หน้านี้สงวนไว้สำหรับผู้จัดการสาขาและผู้ดูแลระบบเท่านั้น</p>
            <button onclick="window.location.hash='#/home'" style="background:#2962ff; color:#fff; border:none; border-radius:6px; padding:10px 18px; cursor:pointer; font-weight:600;">
              กลับสู่แดชบอร์ด
            </button>
          </div>
        `;
        return;
      }

      targetContainer.innerHTML = `
        <div style="padding:24px; max-width:1100px; margin:0 auto; font-family:inherit; color:#e0e3eb;">
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
            <div>
              <h2 style="margin:0 0 6px 0; font-size:22px; font-weight:700; color:#fff;">👥 จัดการสมาชิกในสาขา</h2>
              <div style="font-size:12px; color:#848e9c;">
                สาขา: <strong style="color:#fff;">อยุธยา ซิตี้ พาร์ค</strong> | ผู้ใช้งานทั้งหมด 4 บัญชี (Invite-only)
              </div>
            </div>
            <button id="pilot-add-member-btn" style="background:linear-gradient(135deg, #2962ff, #1e88e5); color:#fff; border:none; border-radius:6px; padding:10px 18px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(41,98,255,0.3);">
              <span>➕</span> เพิ่มพนักงานใหม่
            </button>
          </div>

          <div id="pilot-member-admin-alert" style="display:none; border-radius:6px; padding:12px; font-size:13px; margin-bottom:16px;"></div>

          <!-- Members Table -->
          <div style="background:#1e222d; border:1px solid #363c4e; border-radius:10px; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
              <thead>
                <tr style="background:#131722; border-bottom:1px solid #363c4e; color:#848e9c; font-size:12px;">
                  <th style="padding:14px 16px;">รหัสพนักงาน</th>
                  <th style="padding:14px 16px;">ชื่อแสดงผล</th>
                  <th style="padding:14px 16px;">บทบาท</th>
                  <th style="padding:14px 16px;">สถานะ</th>
                  <th style="padding:14px 16px; text-align:right;">การจัดการ</th>
                </tr>
              </thead>
              <tbody id="pilot-members-tbody">
                <tr><td colspan="5" style="padding:24px; text-align:center; color:#848e9c;">กำลังโหลดข้อมูลสมาชิก...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Add Member Modal -->
          <div id="pilot-add-member-modal" style="display:none; position:fixed; inset:0; z-index:999999; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
            <div style="background:#1e222d; border:1px solid #363c4e; border-radius:12px; width:90%; max-width:440px; padding:24px; color:#e0e3eb;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="margin:0; font-size:17px; color:#fff;">➕ เพิ่มพนักงานขายใหม่</h3>
                <button id="pilot-close-add-modal" style="background:none; border:none; color:#848e9c; font-size:20px; cursor:pointer;">&times;</button>
              </div>

              <form id="pilot-add-member-form">
                <div style="margin-bottom:12px;">
                  <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px;">รหัสพนักงาน (เช่น CPW1234) *</label>
                  <input type="text" id="m-add-code" required placeholder="CPW..." style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:8px 12px; color:#fff; font-size:13px;">
                </div>
                <div style="margin-bottom:12px;">
                  <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px;">ชื่อแสดงผล (เช่น สมชาย พนักงานขาย) *</label>
                  <input type="text" id="m-add-name" required placeholder="ชื่อ-นามสกุล..." style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:8px 12px; color:#fff; font-size:13px;">
                </div>
                <div style="margin-bottom:12px;">
                  <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px;">รหัสผ่านชั่วคราว *</label>
                  <input type="password" id="m-add-password" required placeholder="ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร" style="width:100%; box-sizing:border-box; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:8px 12px; color:#fff; font-size:13px;">
                </div>
                <div style="margin-bottom:16px;">
                  <label style="display:block; font-size:12px; color:#b2b5be; margin-bottom:4px;">กำหนดบทบาทอัตโนมัติ</label>
                  <div style="background:#131722; border:1px solid #363c4e; border-radius:6px; padding:8px 12px; font-size:12px; color:#4caf50;">
                    ✓ บทบาท: <strong>MEMBER</strong> | สาขา: <strong>AYUTTHAYA_CITY_PARK</strong>
                  </div>
                </div>
                <button type="submit" id="m-add-submit-btn" style="width:100%; background:#2962ff; color:#fff; border:none; border-radius:6px; padding:10px; font-size:14px; font-weight:600; cursor:pointer;">
                  สร้างบัญชีพนักงาน
                </button>
              </form>
            </div>
          </div>
        </div>
      `;

      // Event listeners
      document.getElementById('pilot-add-member-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('pilot-add-member-modal');
        if (modal) modal.style.display = 'flex';
      });

      document.getElementById('pilot-close-add-modal')?.addEventListener('click', () => {
        const modal = document.getElementById('pilot-add-member-modal');
        if (modal) modal.style.display = 'none';
      });

      document.getElementById('pilot-add-member-form')?.addEventListener('submit', (e) => this.handleAddMember(e));

      this.loadMembers();
    }

    async loadMembers() {
      const tbody = document.getElementById('pilot-members-tbody');
      if (!tbody) return;

      const client = window.SupabaseAdapter?.getClient();
      if (!client) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#ef5350;">ยังไม่ได้เชื่อมต่อฐานข้อมูล</td></tr>';
        return;
      }

      try {
        const { data: profiles, error } = await client
          .from('profiles')
          .select('id, employee_code, display_name, branch_id, status, created_at')
          .eq('branch_id', 'AYUTTHAYA_CITY_PARK')
          .order('employee_code', { ascending: true });

        if (error) throw error;

        this.members = profiles || [];
        this.renderTableRows();
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:#ef5350;">โหลดข้อมูลไม่สำเร็จ: ${err.message}</td></tr>`;
      }
    }

    renderTableRows() {
      const tbody = document.getElementById('pilot-members-tbody');
      if (!tbody) return;

      if (this.members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:24px; text-align:center; color:#848e9c;">ไม่พบบัญชีสมาชิกในสาขา</td></tr>';
        return;
      }

      tbody.innerHTML = this.members.map(m => {
        const isSuspended = m.status === 'SUSPENDED';
        const statusBadge = isSuspended
          ? `<span style="background:#ef5350; color:#fff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px;">SUSPENDED (ระงับ)</span>`
          : `<span style="background:#4caf50; color:#fff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px;">ACTIVE (ปกติ)</span>`;

        return `
          <tr style="border-bottom:1px solid #2a2e39;">
            <td style="padding:12px 16px; font-family:monospace; font-weight:700; color:#fff;">${m.employee_code}</td>
            <td style="padding:12px 16px;">${m.display_name}</td>
            <td style="padding:12px 16px;"><span style="background:#262b3d; color:#b2b5be; font-size:11px; padding:2px 6px; border-radius:4px;">MEMBER</span></td>
            <td style="padding:12px 16px;">${statusBadge}</td>
            <td style="padding:12px 16px; text-align:right;">
              <button onclick="window.MemberAdminView?.toggleSuspend('${m.id}', '${m.status}')" style="background:#262b3d; border:1px solid #363c4e; color:${isSuspended ? '#81c784' : '#ff8a80'}; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer; margin-left:6px;">
                ${isSuspended ? 'ปลดระงับ' : 'ระงับการใช้งาน'}
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    async toggleSuspend(memberId, currentStatus) {
      const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      const confirmMsg = newStatus === 'SUSPENDED'
        ? 'ต้องการระงับการใช้งานบัญชีนี้ใช่หรือไม่? (ผู้ใช้จะถูกบังคับออกจากระบบทันที)'
        : 'ต้องการเปิดใช้งานบัญชีนี้อีกครั้งใช่หรือไม่?';

      if (!confirm(confirmMsg)) return;

      const client = window.SupabaseAdapter?.getClient();
      if (!client) return;

      try {
        const { error } = await client
          .from('profiles')
          .update({ status: newStatus })
          .eq('id', memberId);

        if (error) throw error;
        alert(`อัปเดตสถานะเป็น ${newStatus} สำเร็จ`);
        this.loadMembers();
      } catch (err) {
        alert(`ไม่สามารถเปลี่ยนสถานะได้: ${err.message}`);
      }
    }

    async handleAddMember(e) {
      e.preventDefault();
      const code = document.getElementById('m-add-code')?.value.trim().toUpperCase();
      const name = document.getElementById('m-add-name')?.value.trim();
      const password = document.getElementById('m-add-password')?.value;
      const submitBtn = document.getElementById('m-add-submit-btn');

      if (!code || !name || !password) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังสร้างบัญชีผ่าน Serverless API...';

      try {
        // Post to serverless admin endpoint
        const token = (await window.SupabaseAdapter?.getClient()?.auth.getSession())?.data?.session?.access_token;
        const res = await fetch('/api/admin/members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || ''}`
          },
          body: JSON.stringify({ employeeCode: code, displayName: name, temporaryPassword: password })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'ไม่สามารถสร้างบัญชีได้');
        }

        alert(`สร้างบัญชีพนักงาน ${code} สำเร็จแล้ว! รหัสดังกล่าวสามารถใช้ล็อกอินได้ทันที`);
        document.getElementById('pilot-add-member-form')?.reset();
        document.getElementById('pilot-add-member-modal').style.display = 'none';
        this.loadMembers();
      } catch (err) {
        alert(`แจ้งเตือน: ${err.message}\n(หมายเหตุ: การสร้างผู้ใช้ Auth ใหม่ต้องทำผ่าน Server-side Admin Endpoint ด้วย Service Role Key)`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'สร้างบัญชีพนักงาน';
      }
    }
  }

  window.MemberAdminView = new MemberAdminView();
})(window);
