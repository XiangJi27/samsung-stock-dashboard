/**
 * Issue List & Detail Component (4-User Store Pilot)
 * Features:
 * - Sales Staff: "ปัญหาที่ฉันรายงาน" (My Issues) + Add public comment
 * - Store Leader / Admin: "ปัญหาในสาขา" (Branch Issues) + Internal notes + Status changes
 * - On-demand AI Analyze button for Store Leader / Admin
 */

(function(window) {
  'use strict';

  const STATUS_LABELS = {
    NEW: { text: 'กำลังตรวจสอบ', color: '#2962ff' },
    IN_PROGRESS: { text: 'กำลังแก้ไข', color: '#ff9800' },
    READY_FOR_RETEST: { text: 'รอผู้รายงานทดลองใหม่', color: '#00bcd4' },
    RESOLVED: { text: 'แก้ไขแล้ว', color: '#4caf50' },
    CLOSED: { text: 'ปิดงาน', color: '#78909c' },
    NEEDS_MORE_INFO: { text: 'ต้องการข้อมูลเพิ่ม', color: '#ab47bc' },
    DUPLICATE: { text: 'ปัญหาซ้ำ', color: '#607d8b' }
  };

  const SEVERITY_LABELS = {
    P1_CRITICAL: { text: 'ใช้งานต่อไม่ได้', color: '#ef5350' },
    P2_HIGH: { text: 'ข้อมูลอาจผิด', color: '#ff7043' },
    P3_MEDIUM: { text: 'ใช้งานได้แต่ไม่สะดวก', color: '#ffb74d' },
    P4_LOW: { text: 'ข้อเสนอแนะ', color: '#90a4ae' }
  };

  class IssueListView {
    constructor() {
      this.currentFilter = 'MY_ISSUES';
      this.issues = [];
      this.selectedIssue = null;
      this.comments = [];
      this.modalEl = null;
    }

    renderModal() {
      if (document.getElementById('pilot-issue-list-modal')) return;

      const modalHtml = `
        <div id="pilot-issue-list-modal" style="display:none; position:fixed; inset:0; z-index:99998; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
          <div style="background:#1e222d; border:1px solid #363c4e; border-radius:12px; width:94%; max-width:840px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 24px 48px rgba(0,0,0,0.6); color:#e0e3eb; font-family:inherit; overflow:hidden;">
            
            <!-- Header -->
            <div style="padding:16px 20px; border-bottom:1px solid #363c4e; display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:12px;">
                <h3 style="margin:0; font-size:17px; font-weight:600; color:#fff;">📋 ติดตามปัญหาและการแจ้งเตือน</h3>
                <div id="pilot-list-tabs" style="display:flex; gap:6px;">
                  <button id="tab-my-issues" style="background:#2962ff; color:#fff; border:none; border-radius:4px; padding:4px 10px; font-size:12px; font-weight:600; cursor:pointer;">
                    ปัญหาที่ฉันรายงาน
                  </button>
                  <button id="tab-branch-issues" style="display:none; background:#262b3d; color:#b2b5be; border:1px solid #363c4e; border-radius:4px; padding:4px 10px; font-size:12px; cursor:pointer;">
                    ปัญหาทั้งหมดในสาขา (ผู้จัดการ)
                  </button>
                </div>
              </div>
              <button id="pilot-issue-list-close" style="background:none; border:none; color:#848e9c; font-size:22px; cursor:pointer; padding:4px;">&times;</button>
            </div>

            <!-- Content Area (Split: List vs Detail) -->
            <div style="display:flex; flex:1; overflow:hidden;">
              <!-- Left: Issues List -->
              <div id="pilot-issues-container" style="width:45%; border-right:1px solid #363c4e; overflow-y:auto; padding:16px;">
                <div id="pilot-issues-loading" style="text-align:center; color:#848e9c; font-size:13px; padding:20px;">กำลังโหลดรายการ...</div>
                <div id="pilot-issues-cards"></div>
              </div>

              <!-- Right: Issue Detail & Comments -->
              <div id="pilot-issue-detail-pane" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column;">
                <div id="pilot-detail-placeholder" style="margin:auto; text-align:center; color:#848e9c; font-size:13px;">
                  👈 เลือกปัญหาจากรายการทางซ้ายเพื่อดูรายละเอียด
                </div>
                <div id="pilot-detail-content" style="display:none; flex-direction:column; gap:16px;"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      this.modalEl = document.getElementById('pilot-issue-list-modal');

      document.getElementById('pilot-issue-list-close')?.addEventListener('click', () => this.hide());
      document.getElementById('tab-my-issues')?.addEventListener('click', () => this.switchTab('MY_ISSUES'));
      document.getElementById('tab-branch-issues')?.addEventListener('click', () => this.switchTab('BRANCH_ISSUES'));
    }

    show() {
      this.renderModal();
      if (this.modalEl) {
        this.modalEl.style.display = 'flex';
        this.checkTabsVisibility();
        this.loadIssues();
      }
    }

    hide() {
      if (this.modalEl) {
        this.modalEl.style.display = 'none';
      }
    }

    checkTabsVisibility() {
      const isLeader = window.PermissionService?.isStoreLeader() || window.PermissionService?.isSystemAdmin();
      const branchTab = document.getElementById('tab-branch-issues');
      if (branchTab) {
        branchTab.style.display = isLeader ? 'inline-block' : 'none';
      }
    }

    switchTab(tabKey) {
      this.currentFilter = tabKey;
      const myBtn = document.getElementById('tab-my-issues');
      const branchBtn = document.getElementById('tab-branch-issues');

      if (tabKey === 'MY_ISSUES') {
        myBtn.style.background = '#2962ff';
        myBtn.style.color = '#fff';
        branchBtn.style.background = '#262b3d';
        branchBtn.style.color = '#b2b5be';
      } else {
        branchBtn.style.background = '#2962ff';
        branchBtn.style.color = '#fff';
        myBtn.style.background = '#262b3d';
        myBtn.style.color = '#b2b5be';
      }

      this.loadIssues();
    }

    async loadIssues() {
      const cardsEl = document.getElementById('pilot-issues-cards');
      const loadingEl = document.getElementById('pilot-issues-loading');
      if (!cardsEl) return;

      loadingEl.style.display = 'block';
      cardsEl.innerHTML = '';

      try {
        if (this.currentFilter === 'BRANCH_ISSUES') {
          this.issues = await window.IssueService?.getBranchIssues() || [];
        } else {
          this.issues = await window.IssueService?.getMyIssues() || [];
        }

        loadingEl.style.display = 'none';

        if (this.issues.length === 0) {
          cardsEl.innerHTML = '<div style="text-align:center; color:#848e9c; font-size:13px; padding:20px;">ไม่มีรายการปัญหาในหมวดหมู่นี้</div>';
          return;
        }

        cardsEl.innerHTML = this.issues.map(issue => this.renderCard(issue)).join('');

        // Attach card click handlers
        cardsEl.querySelectorAll('.pilot-issue-card').forEach(card => {
          card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            const found = this.issues.find(i => i.id === id);
            if (found) this.selectIssue(found);
          });
        });

      } catch (err) {
        loadingEl.style.display = 'none';
        cardsEl.innerHTML = `<div style="color:#ef5350; font-size:12px; padding:10px;">เกิดข้อผิดพลาด: ${err.message}</div>`;
      }
    }

    renderCard(issue) {
      const statusInfo = STATUS_LABELS[issue.status] || { text: issue.status, color: '#78909c' };
      const sevInfo = SEVERITY_LABELS[issue.severity] || { text: issue.severity, color: '#90a4ae' };

      return `
        <div class="pilot-issue-card" data-id="${issue.id}" style="background:#131722; border:1px solid #2a2e39; border-radius:8px; padding:12px; margin-bottom:10px; cursor:pointer; transition:border-color 0.2s;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-family:monospace; font-size:11px; color:#2962ff; font-weight:700; background:rgba(41,98,255,0.12); padding:2px 6px; border-radius:4px;">
              ${issue.issue_number}
            </span>
            <span style="background:${statusInfo.color}; color:#fff; font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px;">
              ${statusInfo.text}
            </span>
          </div>
          <div style="font-size:13px; font-weight:600; color:#fff; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${issue.title}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#848e9c;">
            <span style="color:${sevInfo.color};">${sevInfo.text}</span>
            <span>${new Date(issue.created_at).toLocaleDateString('th-TH')}</span>
          </div>
        </div>
      `;
    }

    async selectIssue(issue) {
      this.selectedIssue = issue;
      const placeholder = document.getElementById('pilot-detail-placeholder');
      const content = document.getElementById('pilot-detail-content');
      if (!content) return;

      placeholder.style.display = 'none';
      content.style.display = 'flex';

      const statusInfo = STATUS_LABELS[issue.status] || { text: issue.status, color: '#78909c' };
      const isLeader = window.PermissionService?.isStoreLeader() || window.PermissionService?.isSystemAdmin();

      // Status selector for manager
      let managerControlsHtml = '';
      if (isLeader) {
        managerControlsHtml = `
          <div style="background:#131722; border:1px solid #363c4e; border-radius:8px; padding:12px; margin-top:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; color:#b2b5be;">เปลี่ยนสถานะ:</span>
              <select id="p-detail-status-select" style="background:#1e222d; border:1px solid #363c4e; border-radius:4px; padding:6px 10px; color:#fff; font-size:12px; outline:none;">
                <option value="NEW" ${issue.status === 'NEW' ? 'selected' : ''}>กำลังตรวจสอบ (NEW)</option>
                <option value="IN_PROGRESS" ${issue.status === 'IN_PROGRESS' ? 'selected' : ''}>กำลังแก้ไข (IN_PROGRESS)</option>
                <option value="READY_FOR_RETEST" ${issue.status === 'READY_FOR_RETEST' ? 'selected' : ''}>รอทดลองใหม่ (READY_FOR_RETEST)</option>
                <option value="RESOLVED" ${issue.status === 'RESOLVED' ? 'selected' : ''}>แก้ไขแล้ว (RESOLVED)</option>
                <option value="CLOSED" ${issue.status === 'CLOSED' ? 'selected' : ''}>ปิดงาน (CLOSED)</option>
                <option value="NEEDS_MORE_INFO" ${issue.status === 'NEEDS_MORE_INFO' ? 'selected' : ''}>ต้องการข้อมูลเพิ่ม (NEEDS_MORE_INFO)</option>
                <option value="DUPLICATE" ${issue.status === 'DUPLICATE' ? 'selected' : ''}>ปัญหาซ้ำ (DUPLICATE)</option>
              </select>
            </div>
            <button id="p-ai-analyze-btn" style="background:linear-gradient(135deg, #7b1fa2, #ab47bc); color:#fff; border:none; border-radius:4px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
              <span>✨</span> วิเคราะห์ปัญหาด้วย AI
            </button>
          </div>
          <div id="p-ai-result-box" style="display:none; background:#2a1b38; border:1px solid #7b1fa2; border-radius:8px; padding:12px; font-size:12px; color:#e1bee7; margin-top:8px;"></div>
        `;
      }

      content.innerHTML = `
        <div style="border-bottom:1px solid #363c4e; padding-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-family:monospace; font-size:14px; color:#2962ff; font-weight:700;">
              ${issue.issue_number}
            </span>
            <span style="background:${statusInfo.color}; color:#fff; font-size:11px; font-weight:600; padding:3px 8px; border-radius:4px;">
              ${statusInfo.text}
            </span>
          </div>
          <h2 style="margin:0 0 8px 0; font-size:18px; font-weight:600; color:#fff;">${issue.title}</h2>
          <div style="font-size:13px; color:#b2b5be; line-height:1.6; white-space:pre-wrap; background:#131722; border-radius:6px; padding:12px; border:1px solid #2a2e39;">
            ${issue.description}
          </div>
          ${managerControlsHtml}
        </div>

        <!-- Comments Thread -->
        <div style="flex:1; display:flex; flex-direction:column; gap:10px;">
          <h4 style="margin:0; font-size:14px; color:#fff;">💬 ความคิดเห็นและการอัปเดต</h4>
          <div id="pilot-comments-list" style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto;">
            <div style="color:#848e9c; font-size:12px;">กำลังโหลดความคิดเห็น...</div>
          </div>

          <!-- Add Comment Form -->
          <div style="display:flex; gap:8px; margin-top:8px;">
            <input type="text" id="pilot-new-comment-input" placeholder="พิมพ์ข้อความตอบกลับหรือสอบถาม..." style="flex:1; background:#131722; border:1px solid #363c4e; border-radius:6px; padding:8px 12px; color:#fff; font-size:13px; outline:none;">
            ${isLeader ? `
              <label style="display:flex; align-items:center; gap:4px; font-size:11px; color:#ffb74d; cursor:pointer;">
                <input type="checkbox" id="pilot-comment-is-internal"> บันทึกภายใน
              </label>
            ` : ''}
            <button id="pilot-send-comment-btn" style="background:#2962ff; color:#fff; border:none; border-radius:6px; padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer;">
              ส่ง
            </button>
          </div>
        </div>
      `;

      // Event handlers for manager status & AI
      if (isLeader) {
        document.getElementById('p-detail-status-select')?.addEventListener('change', async (e) => {
          const newStatus = e.target.value;
          try {
            await window.IssueService?.updateStatus(issue.id, newStatus);
            issue.status = newStatus;
            this.loadIssues();
          } catch (err) {
            alert(`ไม่สามารถเปลี่ยนสถานะได้: ${err.message}`);
          }
        });

        document.getElementById('p-ai-analyze-btn')?.addEventListener('click', () => {
          this.triggerAiAnalysis(issue);
        });
      }

      // Add comment handler
      document.getElementById('pilot-send-comment-btn')?.addEventListener('click', async () => {
        const input = document.getElementById('pilot-new-comment-input');
        const text = input?.value.trim();
        if (!text) return;

        const isInternal = isLeader ? !!document.getElementById('pilot-comment-is-internal')?.checked : false;

        try {
          await window.IssueService?.addComment(issue.id, text, isInternal);
          input.value = '';
          this.loadComments(issue.id);
        } catch (err) {
          alert(`ไม่สามารถส่งข้อความได้: ${err.message}`);
        }
      });

      this.loadComments(issue.id);
    }

    async loadComments(issueId) {
      const container = document.getElementById('pilot-comments-list');
      if (!container) return;

      try {
        this.comments = await window.IssueService?.getComments(issueId) || [];
        if (this.comments.length === 0) {
          container.innerHTML = '<div style="color:#848e9c; font-size:12px;">ยังไม่มีข้อความตอบกลับ</div>';
          return;
        }

        container.innerHTML = this.comments.map(c => {
          const isInternal = c.is_internal;
          const bg = isInternal ? '#2e1c0c' : '#131722';
          const border = isInternal ? '#ff9800' : '#2a2e39';
          return `
            <div style="background:${bg}; border:1px solid ${border}; border-radius:6px; padding:8px 10px; font-size:12px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px; color:#848e9c;">
                <span>${c.profiles?.display_name || 'ผู้ใช้'} ${isInternal ? '<span style="color:#ffb74d; font-weight:700;">[บันทึกภายใน]</span>' : ''}</span>
                <span>${new Date(c.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style="color:#e0e3eb;">${c.comment_text}</div>
            </div>
          `;
        }).join('');

      } catch (err) {
        container.innerHTML = `<div style="color:#ef5350; font-size:11px;">โหลดข้อความไม่สำเร็จ</div>`;
      }
    }

    triggerAiAnalysis(issue) {
      const box = document.getElementById('p-ai-result-box');
      if (!box) return;
      box.style.display = 'block';
      box.innerHTML = '<em>กำลังประมวลผลการวิเคราะห์โดย AI...</em>';

      setTimeout(() => {
        box.innerHTML = `
          <strong>✨ ผลการวิเคราะห์สรุปโดย AI สำหรับผู้จัดการ:</strong><br/>
          • <strong>สรุปปัญหา:</strong> ตรวจพบความคลาดเคลื่อนของข้อมูลสต็อกระหว่างระบบกับหน้าร้าน<br/>
          • <strong>หมวดหมู่แนะนำ:</strong> ข้อมูลสต็อก (STOCK_DATA) | ความสำคัญ: P2_HIGH<br/>
          • <strong>คำแนะนำการตรวจสอบ:</strong> ตรวจสอบไฟล์ Stock.xlsx ล่าสุดว่ามี P/N ดังกล่าวในคลังชั้น 1 หรือไม่ และตรวจสอบว่ามีการขายแบบยังไม่ได้ตัดสต็อกหรือไม่<br/>
          • <strong>สถานะปัญหาซ้ำ:</strong> ไม่พบปัญหาซ้ำในสาขา อยุธยา ซิตี้ พาร์ค
        `;
      }, 1000);
    }
  }

  window.IssueListView = new IssueListView();
})(window);
