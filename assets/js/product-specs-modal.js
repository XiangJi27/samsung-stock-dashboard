/**
 * Product Specs Modal - Compact Version
 */
(function() {
  const CATEGORIES = {
    display: { title: 'จอแสดงผล', icon: '📱', fields: ['display.type','display.size','display.resolution','display.refreshRate','display.peakBrightness','display.protection'] },
    camera: { title: 'กล้อง', icon: '📸', fields: ['camera.rear.main','camera.rear.ultrawide','camera.rear.telephoto','camera.front.resolution','camera.video.maxResolution'] },
    performance: { title: 'ประสิทธิภาพ', icon: '⚡', fields: ['performance.chipset','performance.cpu','performance.gpu','memory.ram','memory.storage','software.os'] },
    battery: { title: 'แบตเตอรี่', icon: '🔋', fields: ['battery.capacity','battery.charging.wired','battery.charging.wireless','battery.usageHours.video','battery.usageHours.audio'] },
    connectivity: { title: 'การเชื่อมต่อ', icon: '📡', fields: ['connectivityAndBuild.network','connectivity.sim','connectivity.wifi','connectivity.bluetooth','connectivity.nfc','connectivity.usb'] },
    design: { title: 'ดีไซน์', icon: '🎨', fields: ['design.dimensions','design.weight','design.build','design.colors','design.waterResistance','sensors'] }
  };

  const getVal = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

  window.openProductSpecsModal = (pn) => {
    const db = window.PRODUCT_SPECS_DATABASE || window.PRODUCT_SPECS_PROFILES || {};
    const spec = Object.values(db).find(s => s.pn === pn || s.erpPn === pn) || 
                 (window.resolveProductSpecs ? window.resolveProductSpecs(pn) : null);
    if (!spec) return alert(`ไม่พบข้อมูลสเปค: ${pn}`);

    let modal = document.getElementById('productSpecsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'productSpecsModal';
      modal.className = 'specs-modal-overlay';
      modal.innerHTML = `<div class="specs-modal-container"><div class="specs-modal-header"><h2 id="specsModalTitle">สเปค</h2><button id="specsModalClose">✕</button></div><div id="specsIdentityBar"></div><div class="specs-tabs" id="specsTabs"></div><div class="specs-content" id="specsContent"></div><div class="specs-modal-footer"><button id="btnCloseModal">ปิด</button></div></div>`;
      document.body.appendChild(modal);
      
      const close = () => { modal.classList.remove('active'); document.body.style.overflow = ''; };
      modal.querySelector('#specsModalClose').onclick = close;
      modal.querySelector('#btnCloseModal').onclick = close;
      modal.onclick = (e) => { if (e.target === modal) close(); };
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) close(); });
    }

    const model = spec.fields?.['model.family']?.value || pn;
    document.getElementById('specsModalTitle').textContent = `สเปค ${model}`;
    document.getElementById('specsIdentityBar').innerHTML = `<div><strong>รุ่น:</strong> ${model}</div><div><strong>P/N:</strong> ${pn}</div>`;

    const tabsHtml = Object.keys(CATEGORIES).map((k, i) => 
      `<button class="specs-tab ${i===0?'active':''}" data-tab="${k}">${CATEGORIES[k].icon} ${CATEGORIES[k].title}</button>`
    ).join('');
    document.getElementById('specsTabs').innerHTML = tabsHtml;

    const renderTab = (cat) => {
      const fields = CATEGORIES[cat].fields.map(f => {
        const val = getVal(spec.fields, f)?.value || getVal(spec, f) || 'ไม่ระบุ';
        return `<div class="specs-field-row"><span>${f.split('.').pop()}</span><span>${val}</span></div>`;
      }).join('');
      document.getElementById('specsContent').innerHTML = `<h3>${CATEGORIES[cat].icon} ${CATEGORIES[cat].title}</h3>${fields}`;
    };

    document.querySelectorAll('.specs-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.specs-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTab(btn.dataset.tab);
      };
    });

    renderTab('display');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
})();
