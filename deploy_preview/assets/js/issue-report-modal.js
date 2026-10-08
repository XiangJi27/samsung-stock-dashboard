/**
 * Unified Store Assistant & Issue Report Modal
 * Tailored for Samsung Branch Operations (Ayutthaya City Park)
 * 
 * Features:
 * 1. Tab 1: ✨ ถาม AI ผู้ช่วย (Gemini Assistant) - Grounded in Branch Stock, Promotions, and Specs
 *    - 30-message soft limit warning bar with [➕ เริ่มแชทใหม่] button (allows continuing chat)
 *    - 🗑️ ล้างหน้าจอ (Quick reset button for sales staff at modal header)
 *    - Multi-modal support (attach photos of leaflets, barcodes, specs)
 *    - 30-day auto-purge for chat history in localStorage
 * 2. Tab 2: 📝 รายงานปัญหาหน้าร้าน (5-Field Issue Report Form)
 */

(function(window) {
  'use strict';

  const STORAGE_KEY_ACTIVE = 'samsung_gemini_active_chat';
  const STORAGE_KEY_HISTORY = 'samsung_gemini_chat_history';
  const MAX_HISTORY_DAYS = 30;
  const SOFT_MESSAGE_LIMIT = 30;

  class StoreAssistantModal {
    constructor() {
      this.modalEl = null;
      this.fabEl = null;
      this.activeTab = 'gemini'; // 'gemini' | 'issue'
      this.messages = [];
      this.attachedImage = null; // { mimeType, data }
      this.isGenerating = false;
      this.initCleanup();
    }

    /**
     * Purge sessions older than 30 days to keep storage lean and clean
     */
    initCleanup() {
      try {
        const rawHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (rawHistory) {
          const history = JSON.parse(rawHistory);
          const cutoff = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
          const filtered = Array.isArray(history) 
            ? history.filter(item => item.timestamp && item.timestamp > cutoff).slice(-20)
            : [];
          localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(filtered));
        }
      } catch (e) {
        console.warn('[StoreAssistant] History cleanup warning:', e);
      }
    }

    render() {
      if (document.getElementById('pilot-assistant-modal')) return;

      // 1. Floating Action Button (Vibrant & High Visibility)
      const fabHtml = `
        <button id="pilot-report-fab" class="pilot-report-fab" style="position:fixed; bottom:24px; right:24px; z-index:998; background:linear-gradient(135deg, #2563eb, #7c3aed); color:#fff; border:none; border-radius:30px; padding:12px 22px; font-size:14px; font-weight:600; cursor:pointer; box-shadow:0 8px 24px rgba(37,99,235,0.45); display:flex; align-items:center; gap:8px; font-family:inherit; transition:transform 0.2s, box-shadow 0.2s;">
          <span style="font-size:16px;">✨</span> ถาม AI ผู้ช่วย & แจ้งปัญหา
        </button>
      `;
      document.body.insertAdjacentHTML('beforeend', fabHtml);
      this.fabEl = document.getElementById('pilot-report-fab');
      this.fabEl?.addEventListener('click', () => this.handleFabClick());

      // 2. Main Tabbed Modal Window
      const modalHtml = `
        <div id="pilot-assistant-modal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.72); backdrop-filter:blur(6px); align-items:center; justify-content:center;">
          <div style="background:#131722; border:1px solid #363c4e; border-radius:14px; width:94%; max-width:680px; height:88vh; max-height:820px; display:flex; flex-direction:column; box-shadow:0 24px 60px rgba(0,0,0,0.7); color:#e0e3eb; font-family:inherit; overflow:hidden;">
            
            <!-- Modal Header with Quick Action [🗑️ ล้างหน้าจอ] -->
            <div style="padding:14px 20px; background:#1e222d; border-bottom:1px solid #2a2e39; display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:20px; background:linear-gradient(135deg,#38bdf8,#818cf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">✨</span>
                <div>
                  <h3 style="margin:0; font-size:16px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
                    Samsung Store Assistant
                    <span style="font-size:11px; font-weight:500; background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:2px 8px; border-radius:10px;">
                      อยุธยา ซิตี้ พาร์ค
                    </span>
                  </h3>
                </div>
              </div>

              <!-- Top Right Controls: Clear Screen & Close -->
              <div style="display:flex; align-items:center; gap:8px;">
                <button id="btn-quick-clear-screen" title="ล้างหน้าจอเพื่อรับลูกค้ารายใหม่" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; border-radius:8px; padding:6px 12px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; transition:background 0.2s;">
                  <span>🗑️</span> <span class="hide-mobile">ล้างหน้าจอ</span>
                </button>
                <button id="pilot-assistant-close-btn" style="background:none; border:none; color:#94a3b8; font-size:24px; cursor:pointer; padding:4px 8px; line-height:1;">&times;</button>
              </div>
            </div>

            <!-- Tab Switcher Navigation -->
            <div style="display:flex; background:#181b24; border-bottom:1px solid #2a2e39; padding:0 16px;">
              <button id="tab-btn-gemini" style="flex:1; padding:12px 16px; background:none; border:none; border-bottom:3px solid #38bdf8; color:#38bdf8; font-weight:700; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>✨</span> ถาม AI ผู้ช่วย (Gemini)
              </button>
              <button id="tab-btn-issue" style="flex:1; padding:12px 16px; background:none; border:none; border-bottom:3px solid transparent; color:#94a3b8; font-weight:600; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>📝</span> รายงานปัญหาหน้าร้าน
              </button>
            </div>

            <!-- Tab 1: Gemini Assistant Body -->
            <div id="tab-content-gemini" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
              
              <!-- Soft Limit Notice Banner (Shows when message count >= 30) -->
              <div id="gemini-soft-limit-banner" style="display:none; background:linear-gradient(90deg, rgba(245,158,11,0.18), rgba(217,119,6,0.12)); border-bottom:1px solid rgba(245,158,11,0.35); padding:10px 16px; font-size:13px; color:#fde68a; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:16px;">💡</span>
                  <span><strong>บทสนทนานี้เริ่มยาวแล้ว</strong> เริ่มหัวข้อใหม่เพื่อความรวดเร็วและแม่นยำของ AI</span>
                </div>
                <button id="btn-banner-new-chat" style="background:#f59e0b; color:#000; border:none; border-radius:6px; padding:5px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
                  ➕ เริ่มแชทใหม่
                </button>
              </div>

              <!-- Toast notification on screen clear -->
              <div id="gemini-toast" style="display:none; background:rgba(16,185,129,0.2); border:1px solid #10b981; color:#6ee7b7; padding:8px 14px; font-size:13px; text-align:center;"></div>

              <!-- Chat Messages Stream Container -->
              <div id="gemini-messages-container" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:14px;">
                <!-- Initial Welcome Message -->
                <div class="assistant-msg-bubble" style="align-self:flex-start; max-width:88%; background:#1e222d; border:1px solid #2a2e39; border-radius:12px 12px 12px 2px; padding:12px 16px; font-size:13.5px; line-height:1.6; color:#e2e8f0;">
                  <div style="font-weight:700; color:#38bdf8; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                    <span>🤖</span> AI ผู้ช่วยพนักงานขาย (อยุธยา ซิตี้ พาร์ค)
                  </div>
                  สวัสดีครับทีมงาน! พร้อมช่วยเช็คสต็อกตัวเครื่อง (ชั้น 1 / ชั้น 2), ราคาโปรโมชัน หรือสเปกทางการสำหรับบริการลูกค้าหน้าร้านได้ทันทีครับ
                  <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">
                    <button class="quick-chip" onclick="window.StoreAssistantModal.sendQuickQuery('เช็คสต็อก Galaxy S25 Ultra มีสีอะไรบ้าง ชั้น 1 มีของไหม')">📦 เช็คสต็อก S25 Ultra</button>
                    <button class="quick-chip" onclick="window.StoreAssistantModal.sendQuickQuery('โปรโมชันและส่วนลด Galaxy S25 Series ปัจจุบันมีอะไรบ้าง')">🏷️ โปรโมชัน S25 Series</button>
                    <button class="quick-chip" onclick="window.StoreAssistantModal.sendQuickQuery('สเปก Galaxy A55 5G กับโปรโมชันผ่อนชำระ')">⚡ สเปก & โปร A55 5G</button>
                    <button class="quick-chip" onclick="window.StoreAssistantModal.sendQuickQuery('เงื่อนไขการผ่อน Samsung Finance+ สำหรับลูกค้าหน้าร้าน')">📱 ผ่อน Samsung Finance+</button>
                  </div>
                </div>
              </div>

              <!-- Image Attachment Preview Bar -->
              <div id="gemini-image-preview-bar" style="display:none; padding:8px 16px; background:#1a1e29; border-top:1px solid #2a2e39; align-items:center; gap:10px;">
                <img id="gemini-preview-img" src="" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid #38bdf8;" />
                <span id="gemini-preview-name" style="font-size:12px; color:#cbd5e1; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">ภาพแนบ</span>
                <button id="btn-remove-attached-image" style="background:none; border:none; color:#f87171; font-size:16px; cursor:pointer; padding:4px;">✕</button>
              </div>

              <!-- Chat Input Bar -->
              <div style="padding:12px 16px; background:#181b24; border-top:1px solid #2a2e39; display:flex; align-items:center; gap:10px;">
                <!-- Attach Image Button -->
                <input type="file" id="gemini-image-file-input" accept="image/jpeg,image/png,image/webp" style="display:none;" />
                <button type="button" id="btn-attach-image" title="แนบภาพโบรชัวร์ บาร์โค้ด หรือสเปก" style="background:#242936; border:1px solid #363c4e; color:#94a3b8; border-radius:8px; padding:10px 12px; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;">
                  📎
                </button>

                <!-- Query Input -->
                <input 
                  type="text" 
                  id="gemini-chat-input" 
                  placeholder="พิมพ์คำถามเกี่ยวกับสต็อก, โปรโมชัน หรือสเปก..." 
                  style="flex:1; background:#0f1219; border:1px solid #363c4e; border-radius:8px; padding:11px 14px; color:#fff; font-size:13.5px; outline:none;" 
                />

                <!-- Send Button -->
                <button 
                  type="button" 
                  id="btn-send-gemini" 
                  style="background:linear-gradient(135deg, #2563eb, #38bdf8); color:#fff; border:none; border-radius:8px; padding:11px 18px; font-weight:700; font-size:13.5px; cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap;">
                  <span>ส่ง</span> ➤
                </button>
              </div>

              <!-- Message Counter Bar -->
              <div style="padding:4px 16px; background:#131722; font-size:11px; color:#64748b; display:flex; justify-content:space-between; align-items:center;">
                <span id="gemini-counter-text">เซสชันปัจจุบัน: 0 ข้อความ (รีเซ็ตได้ทุกเมื่อด้วย 🗑️ ล้างหน้าจอ)</span>
                <span id="gemini-model-badge" style="color:#38bdf8;">Google Gemini 2.0 Flash</span>
              </div>
            </div>

            <!-- Tab 2: Issue Report Body (Preserving 5-Field Form) -->
            <div id="tab-content-issue" style="flex:1; display:none; flex-direction:column; overflow-y:auto; padding:20px;">
              <div id="pilot-issue-alert" style="display:none; border-radius:6px; padding:10px 12px; font-size:13px; margin-bottom:16px;"></div>

              <form id="pilot-issue-form" style="display:flex; flex-direction:column; gap:14px;">
                <!-- Field 1: พบปัญหาที่หน้าไหน -->
                <div>
                  <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                    1. พบปัญหาที่หน้าไหน <span style="color:#ef5350;">*</span>
                  </label>
                  <select id="p-issue-page" style="width:100%; box-sizing:border-box; background:#0f1219; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:13px; outline:none;">
                    <option value="STOCK_PAGE" selected>📦 หน้าค้นหาสต็อกสินค้า (/#/stock)</option>
                    <option value="PROMO_PAGE">🏷️ หน้าโปรโมชัน (/#/promotions)</option>
                    <option value="DASHBOARD_PAGE">📊 หน้าแดชบอร์ดภาพรวม</option>
                    <option value="LOGIN_PAGE">🔑 หน้าเข้าสู่ระบบ</option>
                    <option value="OTHER_PAGE">🌐 อื่น ๆ</option>
                  </select>
                </div>

                <!-- Field 2: หัวข้อปัญหา -->
                <div>
                  <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                    2. หัวข้อปัญหา <span style="color:#ef5350;">*</span>
                  </label>
                  <input type="text" id="p-issue-title" required placeholder="เช่น รุ่น S25 Ultra สี Titanium ยอดชั้น 1 ไม่ตรง" style="width:100%; box-sizing:border-box; background:#0f1219; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:14px; outline:none;">
                </div>

                <!-- Field 3: รายละเอียด -->
                <div>
                  <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                    3. รายละเอียด <span style="color:#ef5350;">*</span>
                  </label>
                  <textarea id="p-issue-description" rows="3" required placeholder="ระบุสิ่งที่พบเห็น หรือตัวเลขที่คิดว่าคลาดเคลื่อน..." style="width:100%; box-sizing:border-box; background:#0f1219; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:13px; outline:none; font-family:inherit;"></textarea>
                </div>

                <!-- Field 4: ระดับผลกระทบ -->
                <div>
                  <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                    4. ระดับผลกระทบ <span style="color:#ef5350;">*</span>
                  </label>
                  <select id="p-issue-severity" style="width:100%; box-sizing:border-box; background:#0f1219; border:1px solid #363c4e; border-radius:6px; padding:10px 12px; color:#fff; font-size:13px; outline:none;">
                    <option value="P3_MEDIUM" selected>ใช้งานได้แต่ไม่สะดวก</option>
                    <option value="P2_HIGH">ข้อมูลอาจผิด (เช่น สต็อกหรือโปรโมชันไม่ตรง)</option>
                    <option value="P1_CRITICAL">ใช้งานต่อไม่ได้ (กระทบการขายหน้าร้านทันที)</option>
                    <option value="P4_LOW">ข้อเสนอแนะ / ปรับปรุงเล็กน้อย</option>
                  </select>
                </div>

                <!-- Field 5: ภาพหน้าจอ -->
                <div>
                  <label style="display:block; font-size:13px; color:#b2b5be; margin-bottom:5px; font-weight:500;">
                    5. ภาพหน้าจอประกอบ
                  </label>
                  <div style="padding:10px 14px; background:#0f1219; border:1px dashed #363c4e; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; color:#848e9c;">📎 แนบรูปภาพหน้าจอหรือเอกสาร</span>
                    <span style="background:#363c4e; color:#ffb74d; font-size:10px; font-weight:700; padding:3px 8px; border-radius:4px;">
                      COMING SOON
                    </span>
                  </div>
                </div>

                <button type="submit" id="p-issue-submit-btn" style="width:100%; background:#2563eb; color:#fff; border:none; border-radius:6px; padding:12px; font-size:14px; font-weight:600; cursor:pointer; transition:background 0.2s;">
                  ส่งรายงานปัญหา
                </button>
              </form>
            </div>

          </div>
        </div>

        <style>
          .quick-chip {
            background: rgba(56, 189, 248, 0.08);
            border: 1px solid rgba(56, 189, 248, 0.25);
            color: #38bdf8;
            border-radius: 16px;
            padding: 4px 10px;
            font-size: 11.5px;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
          }
          .quick-chip:hover {
            background: rgba(56, 189, 248, 0.2);
            border-color: #38bdf8;
          }
          .user-msg-bubble {
            align-self: flex-end;
            max-width: 85%;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            color: #fff;
            border-radius: 12px 12px 2px 12px;
            padding: 10px 14px;
            font-size: 13.5px;
            line-height: 1.5;
            box-shadow: 0 4px 12px rgba(37,99,235,0.25);
          }
          .assistant-msg-bubble {
            align-self: flex-start;
            max-width: 88%;
            background: #1e222d;
            border: 1px solid #2a2e39;
            border-radius: 12px 12px 12px 2px;
            padding: 12px 16px;
            font-size: 13.5px;
            line-height: 1.6;
            color: #e2e8f0;
          }
          .citation-card {
            margin-top: 10px;
            padding: 8px 12px;
            background: rgba(15, 23, 42, 0.65);
            border: 1px solid rgba(56, 189, 248, 0.2);
            border-radius: 6px;
            font-size: 12px;
            color: #94a3b8;
          }
          @media (max-width: 600px) {
            .hide-mobile { display: none; }
          }
        </style>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      this.modalEl = document.getElementById('pilot-assistant-modal');

      this.bindEvents();
      this.loadSavedMessages();
    }

    bindEvents() {
      // Close & Clear
      document.getElementById('pilot-assistant-close-btn')?.addEventListener('click', () => this.hide());
      document.getElementById('btn-quick-clear-screen')?.addEventListener('click', () => this.clearScreen());
      document.getElementById('btn-banner-new-chat')?.addEventListener('click', () => this.clearScreen());

      // Tab Switchers
      document.getElementById('tab-btn-gemini')?.addEventListener('click', () => this.switchTab('gemini'));
      document.getElementById('tab-btn-issue')?.addEventListener('click', () => this.switchTab('issue'));

      // Gemini Inputs
      const chatInput = document.getElementById('gemini-chat-input');
      const sendBtn = document.getElementById('btn-send-gemini');
      chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
      sendBtn?.addEventListener('click', () => this.handleSendMessage());

      // Image Attachment
      const attachBtn = document.getElementById('btn-attach-image');
      const fileInput = document.getElementById('gemini-image-file-input');
      attachBtn?.addEventListener('click', () => fileInput?.click());
      fileInput?.addEventListener('change', (e) => this.handleImageSelect(e));
      document.getElementById('btn-remove-attached-image')?.addEventListener('click', () => this.clearAttachedImage());

      // Issue Form
      document.getElementById('pilot-issue-form')?.addEventListener('submit', (e) => this.handleIssueSubmit(e));
    }

    switchTab(tab) {
      this.activeTab = tab;
      const tabGeminiBtn = document.getElementById('tab-btn-gemini');
      const tabIssueBtn = document.getElementById('tab-btn-issue');
      const tabGeminiContent = document.getElementById('tab-content-gemini');
      const tabIssueContent = document.getElementById('tab-content-issue');

      if (tab === 'gemini') {
        tabGeminiBtn.style.borderBottomColor = '#38bdf8';
        tabGeminiBtn.style.color = '#38bdf8';
        tabIssueBtn.style.borderBottomColor = 'transparent';
        tabIssueBtn.style.color = '#94a3b8';

        tabGeminiContent.style.display = 'flex';
        tabIssueContent.style.display = 'none';
        document.getElementById('gemini-chat-input')?.focus();
      } else {
        tabIssueBtn.style.borderBottomColor = '#38bdf8';
        tabIssueBtn.style.color = '#38bdf8';
        tabGeminiBtn.style.borderBottomColor = 'transparent';
        tabGeminiBtn.style.color = '#94a3b8';

        tabIssueContent.style.display = 'flex';
        tabGeminiContent.style.display = 'none';
        document.getElementById('p-issue-title')?.focus();
      }
    }

    handleFabClick() {
      if (!window.AuthService?.isAuthenticated()) {
        window.AuthModal?.show();
        return;
      }
      this.show();
    }

    show(tab = 'gemini') {
      this.render();
      if (this.modalEl) {
        this.modalEl.style.display = 'flex';
        this.switchTab(tab);

        // Auto-detect current page for issue form
        const currentHash = window.location.hash || '';
        const pageSelect = document.getElementById('p-issue-page');
        if (pageSelect) {
          if (currentHash.includes('stock')) pageSelect.value = 'STOCK_PAGE';
          else if (currentHash.includes('promo')) pageSelect.value = 'PROMO_PAGE';
          else if (currentHash.includes('login')) pageSelect.value = 'LOGIN_PAGE';
          else pageSelect.value = 'DASHBOARD_PAGE';
        }
      }
    }

    hide() {
      if (this.modalEl) {
        this.modalEl.style.display = 'none';
      }
    }

    /**
     * 🗑️ Quick Clear Screen for Sales Staff (Ready for next customer immediately)
     */
    clearScreen() {
      // Archive current session if it has messages
      if (this.messages.length > 0) {
        try {
          const rawHistory = localStorage.getItem(STORAGE_KEY_HISTORY) || '[]';
          const history = JSON.parse(rawHistory);
          history.push({
            timestamp: Date.now(),
            messagesCount: this.messages.length,
            firstQuery: this.messages[0]?.text || '',
            dateStr: new Date().toLocaleString('th-TH')
          });
          localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(-20)));
        } catch (e) {
          console.warn('[StoreAssistant] Archiving error:', e);
        }
      }

      this.messages = [];
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
      this.clearAttachedImage();

      // Reset messages container to welcome view
      const container = document.getElementById('gemini-messages-container');
      if (container) {
        container.innerHTML = `
          <div class="assistant-msg-bubble" style="align-self:flex-start; max-width:88%; background:#1e222d; border:1px solid #2a2e39; border-radius:12px 12px 12px 2px; padding:12px 16px; font-size:13.5px; line-height:1.6; color:#e2e8f0;">
            <div style="font-weight:700; color:#38bdf8; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
              <span>🤖</span> AI ผู้ช่วยพนักงานขาย (อยุธยา ซิตี้ พาร์ค)
            </div>
            ✨ หน้าต่างพร้อมรับลูกค้ารายใหม่แล้วครับ! พิมพ์เช็คสต็อกสินค้า, โปรโมชัน หรือสเปกทางการได้ทันที
            <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">
              <button class="quick-chip" onclick="window.StoreAssistantModal.sendQuickQuery('เช็คสต็อก Galaxy S25 Ultra มีสีอะไรบ้าง ชั้น 1 มีของไหม')">📦 เช็คสต็อก S25 Ultra</button>
              <button class="quick-chip" onclick="window.StoreAssistantModal.sendQuickQuery('โปรโมชันและส่วนลด Galaxy S25 Series ปัจจุบันมีอะไรบ้าง')">🏷️ โปรโมชัน S25 Series</button>
              <button class="quick-chip" onclick="window.StoreAssistantModal.sendQuickQuery('สเปก Galaxy A55 5G กับโปรโมชันผ่อนชำระ')">⚡ สเปก & โปร A55 5G</button>
              <button class="quick-chip" onclick="window.StoreAssistantModal.sendQuickQuery('เงื่อนไขการผ่อน Samsung Finance+ สำหรับลูกค้าหน้าร้าน')">📱 ผ่อน Samsung Finance+</button>
            </div>
          </div>
        `;
      }

      this.updateCounter();

      // Show friendly confirmation toast
      const toast = document.getElementById('gemini-toast');
      if (toast) {
        toast.textContent = '✨ ล้างหน้าจอเรียบร้อย พร้อมบริการลูกค้ารายใหม่ทันที!';
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2200);
      }

      document.getElementById('gemini-chat-input')?.focus();
    }

    updateCounter() {
      const banner = document.getElementById('gemini-soft-limit-banner');
      const counterText = document.getElementById('gemini-counter-text');

      const count = this.messages.length;
      if (counterText) {
        counterText.textContent = `เซสชันปัจจุบัน: ${count} ข้อความ ${count >= SOFT_MESSAGE_LIMIT ? '(แนะนำเริ่มแชทใหม่)' : ''}`;
      }

      // Check soft limit (30 messages)
      if (banner) {
        if (count >= SOFT_MESSAGE_LIMIT) {
          banner.style.display = 'flex';
        } else {
          banner.style.display = 'none';
        }
      }
    }

    sendQuickQuery(query) {
      const input = document.getElementById('gemini-chat-input');
      if (input) {
        input.value = query;
        this.handleSendMessage();
      }
    }

    handleImageSelect(e) {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP)');
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const dataUrl = loadEvt.target.result;
        this.attachedImage = {
          mimeType: file.type,
          data: dataUrl,
          name: file.name
        };

        const previewBar = document.getElementById('gemini-image-preview-bar');
        const previewImg = document.getElementById('gemini-preview-img');
        const previewName = document.getElementById('gemini-preview-name');
        if (previewBar && previewImg && previewName) {
          previewImg.src = dataUrl;
          previewName.textContent = file.name;
          previewBar.style.display = 'flex';
        }
      };
      reader.readAsDataURL(file);
    }

    clearAttachedImage() {
      this.attachedImage = null;
      const previewBar = document.getElementById('gemini-image-preview-bar');
      const fileInput = document.getElementById('gemini-image-file-input');
      if (previewBar) previewBar.style.display = 'none';
      if (fileInput) fileInput.value = '';
    }

    loadSavedMessages() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_ACTIVE);
        if (saved) {
          this.messages = JSON.parse(saved);
          if (Array.isArray(this.messages) && this.messages.length > 0) {
            const container = document.getElementById('gemini-messages-container');
            if (container) {
              container.innerHTML = '';
              this.messages.forEach(m => {
                this.appendMessageBubble(m.role, m.text, m.image, false);
              });
            }
          }
        }
      } catch (e) {
        console.warn('[StoreAssistant] Loading saved messages error:', e);
      }
      this.updateCounter();
    }

    saveActiveMessages() {
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(this.messages.slice(-50)));
      } catch (e) {
        console.warn('[StoreAssistant] Saving active messages error:', e);
      }
    }

    appendMessageBubble(role, text, image = null, scroll = true) {
      const container = document.getElementById('gemini-messages-container');
      if (!container) return;

      const bubble = document.createElement('div');
      if (role === 'user') {
        bubble.className = 'user-msg-bubble';
        let html = '';
        if (image) {
          html += `<img src="${image.data || image}" style="max-width:180px; max-height:140px; border-radius:6px; margin-bottom:6px; display:block;" />`;
        }
        html += `<div>${this.escapeHtml(text)}</div>`;
        bubble.innerHTML = html;
      } else {
        bubble.className = 'assistant-msg-bubble';
        bubble.innerHTML = this.formatAssistantResponse(text);
      }

      container.appendChild(bubble);
      if (scroll) {
        container.scrollTop = container.scrollHeight;
      }
    }

    escapeHtml(str) {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    formatAssistantResponse(text) {
      let formatted = text || '';

      // Extract citation if present
      let citation = '';
      const citeMatch = formatted.match(/(📌\s*ข้อมูลอ้างอิง:?[\s\S]*$)/i);
      if (citeMatch) {
        citation = citeMatch[1];
        formatted = formatted.replace(citeMatch[0], '').trim();
      }

      // Convert line breaks and simple markdown
      formatted = this.escapeHtml(formatted);
      formatted = formatted.replace(/\[(.*?)\]\((.*?)\)/g, (match, label, url) => {
        return `<a href="${url}" onclick="window.PilotAssistantModal?.hide();" style="color:#38bdf8; text-decoration:underline; font-weight:700;">${label}</a>`;
      });
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
      formatted = formatted.replace(/\n\s*-\s*/g, '<br>• ');
      formatted = formatted.replace(/\n/g, '<br>');

      let resultHtml = `
        <div style="font-weight:700; color:#38bdf8; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
          <span>🤖</span> ผู้ช่วยประจำสาขา อยุธยา ซิตี้ พาร์ค
        </div>
        <div>${formatted}</div>
      `;

      if (citation) {
        resultHtml += `
          <div class="citation-card">
            ${this.escapeHtml(citation).replace(/\n/g, '<br>')}
          </div>
        `;
      }

      return resultHtml;
    }

    async handleSendMessage() {
      if (this.isGenerating) return;

      const input = document.getElementById('gemini-chat-input');
      const query = input?.value?.trim();
      const imageToSend = this.attachedImage;

      if (!query && !imageToSend) return;

      // Optional client key override from localStorage (if empty, server uses branch central key)
      const apiKey = localStorage.getItem('samsung_gemini_api_key') || '';

      // Append user bubble
      this.appendMessageBubble('user', query, imageToSend);
      this.messages.push({
        role: 'user',
        text: query,
        image: imageToSend ? imageToSend.data : null
      });

      // Clear input and attachment
      if (input) input.value = '';
      this.clearAttachedImage();
      this.updateCounter();
      this.saveActiveMessages();

      // Show typing indicator
      const container = document.getElementById('gemini-messages-container');
      const typingBubble = document.createElement('div');
      typingBubble.id = 'gemini-typing-bubble';
      typingBubble.className = 'assistant-msg-bubble';
      typingBubble.innerHTML = `
        <div style="color:#38bdf8; font-weight:600; display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span>
          กำลังค้นหาสต็อกสาขา โปรโมชัน และวิเคราะห์ด้วย Gemini...
        </div>
      `;
      container?.appendChild(typingBubble);
      container.scrollTop = container.scrollHeight;

      this.isGenerating = true;

      try {
        const response = await fetch('/api/gemini-assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-key': apiKey
          },
          body: JSON.stringify({
            query: query,
            apiKey: apiKey,
            model: localStorage.getItem('samsung_gemini_model') || 'auto',
            messages: this.messages.slice(-10),
            image: imageToSend
          })
        });

        typingBubble.remove();

        const data = await response.json();
        if (response.ok && data.success) {
          const replyText = data.text;
          this.appendMessageBubble('model', replyText);
          this.messages.push({
            role: 'model',
            text: replyText
          });
          if (data.model) {
            const modelBadge = document.getElementById('gemini-model-badge');
            if (modelBadge) modelBadge.textContent = `Google ${data.model}`;
          }
          this.saveActiveMessages();
          this.updateCounter();
        } else {
          const errDetail = data.message || data.error || 'ไม่สามารถติดต่อ AI ได้';
          if (data.error === 'NO_API_KEY') {
            this.appendMessageBubble('model', `⚠️ **ยังไม่ได้ตั้งค่า Google Gemini API Key สำหรับสาขา**\n\nหากท่านเป็นผู้ดูแลระบบ (Admin / Store Leader) สามารถเข้าไปบันทึกคีย์ส่วนกลางได้ที่เมนู [⚙️ ตั้งค่าระบบ (#/settings)](#/settings)\n\nเพื่อให้ทุกอุปกรณ์และพนักงานทุกคนสามารถใช้งานร่วมกันได้ทันทีครับ`);
          } else {
            this.appendMessageBubble('model', `❌ เกิดข้อผิดพลาด: ${errDetail}`);
          }
        }
      } catch (err) {
        typingBubble.remove();
        this.appendMessageBubble('model', `❌ ข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`);
      } finally {
        this.isGenerating = false;
        input?.focus();
      }
    }

    async handleIssueSubmit(e) {
      e.preventDefault();
      const alertEl = document.getElementById('pilot-issue-alert');
      const submitBtn = document.getElementById('p-issue-submit-btn');

      const pageMap = {
        STOCK_PAGE: 'STOCK_DATA',
        PROMO_PAGE: 'PROMOTION_DATA',
        DASHBOARD_PAGE: 'OTHER',
        LOGIN_PAGE: 'LOGIN_AUTH',
        OTHER_PAGE: 'OTHER'
      };

      const pageSelected = document.getElementById('p-issue-page')?.value || 'STOCK_PAGE';
      const category = pageMap[pageSelected] || 'OTHER';
      const title = document.getElementById('p-issue-title')?.value;
      const description = document.getElementById('p-issue-description')?.value;
      const severity = document.getElementById('p-issue-severity')?.value || 'P3_MEDIUM';

      const telemetryMetadata = {
        reported_page: pageSelected,
        route_hash: window.location.hash || '#/stock',
        user_agent: navigator.userAgent,
        screen_size: `${window.innerWidth}x${window.innerHeight}`,
        app_version: 'pilot-1.0.0',
        stock_batch: window.StockDataLoader?.getMetadata?.()?.batch_id || 'LOCAL_AUG2026',
        submitted_at: new Date().toISOString()
      };

      const enrichedDescription = `${description}\n\n---\n[ระบบเก็บให้อัตโนมัติ]\nหน้า: ${telemetryMetadata.route_hash}\nขนาดจอ: ${telemetryMetadata.screen_size}\nเวลา: ${telemetryMetadata.submitted_at}`;

      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังส่งรายงาน...';
      alertEl.style.display = 'none';

      try {
        const created = await window.IssueService?.createIssue({
          title,
          category,
          severity,
          description: enrichedDescription
        });

        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(76,175,80,0.15)';
        alertEl.style.border = '1px solid #4caf50';
        alertEl.style.color = '#81c784';
        alertEl.innerHTML = `✅ ส่งรายงานสำเร็จ! รหัสปัญหา: <strong>${created?.issue_number || 'บันทึกแล้ว'}</strong>`;

        document.getElementById('pilot-issue-form')?.reset();
        setTimeout(() => this.hide(), 2000);
      } catch (err) {
        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(239,83,80,0.15)';
        alertEl.style.border = '1px solid #ef5350';
        alertEl.style.color = '#ff8a80';
        alertEl.textContent = `❌ ${err.message || 'เกิดข้อผิดพลาดในการบันทึก'}`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ส่งรายงานปัญหา';
      }
    }
  }

  // Bind to window for global access
  window.StoreAssistantModal = new StoreAssistantModal();
  window.IssueReportModal = window.StoreAssistantModal; // Backward compatibility alias

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.StoreAssistantModal.render());
  } else {
    window.StoreAssistantModal.render();
  }
})(window);
