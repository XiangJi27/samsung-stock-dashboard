/**
 * Issue List Viewer Component
 * Displays filtered list of issues (My Issues vs Branch Issues)
 */

(function(window) {
  'use strict';

  class IssueListView {
    constructor() {
      this.currentFilter = 'MY_ISSUES';
    }

    renderCard(issue) {
      let statusColor = '#2962ff';
      if (issue.status === 'RESOLVED' || issue.status === 'CLOSED') statusColor = '#4caf50';
      else if (issue.status === 'IN_PROGRESS') statusColor = '#ff9800';
      else if (issue.status === 'NEEDS_MORE_INFO') statusColor = '#ab47bc';

      let sevColor = '#78909c';
      if (issue.severity === 'P1_CRITICAL') sevColor = '#ef5350';
      else if (issue.severity === 'P2_HIGH') sevColor = '#ff7043';

      return `
        <div style="background:#1e222d; border:1px solid #363c4e; border-radius:8px; padding:16px; margin-bottom:12px; transition:border-color 0.2s;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <span style="font-family:monospace; font-size:12px; color:#2962ff; font-weight:700; background:rgba(41,98,255,0.1); padding:2px 6px; border-radius:4px;">
                ${issue.issue_number}
              </span>
              <span style="margin-left:8px; font-size:11px; color:#848e9c;">${issue.category}</span>
            </div>
            <div style="display:flex; gap:6px;">
              <span style="background:${sevColor}; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">
                ${issue.severity}
              </span>
              <span style="background:${statusColor}; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">
                ${issue.status}
              </span>
            </div>
          </div>
          <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:600; color:#fff;">${issue.title}</h4>
          <div style="font-size:11px; color:#848e9c; margin-top:10px; display:flex; justify-content:space-between;">
            <span>รายงานเมื่อ: ${new Date(issue.created_at).toLocaleString('th-TH')}</span>
            <button class="pilot-view-issue-btn" data-id="${issue.id}" style="background:none; border:none; color:#2962ff; font-size:12px; cursor:pointer; font-weight:600; padding:0;">
              ดูรายละเอียด & ข้อความ &rarr;
            </button>
          </div>
        </div>
      `;
    }
  }

  window.IssueListView = new IssueListView();
})(window);
