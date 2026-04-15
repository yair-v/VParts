pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  theme: localStorage.getItem('vparts-theme') || 'dark',
  currentCatalogId: null,
  currentOrderId: null,
  currentDocType: 'none',
  currentDocName: '',
  currentDocPath: '',
  currentPdf: null,
  currentPage: 1,
  totalPages: 0,
  pdfScale: 1.25,
  parts: [],
  hotspots: [],
  orderLines: [],
  selectedPartId: null,
  addHotspotMode: false,
  draggingHotspotId: null,
  imageObjectUrl: null
};

const els = {
  body: document.body,
  workspaceTitle: document.getElementById('workspaceTitle'),
  statusText: document.getElementById('statusText'),
  documentInfo: document.getElementById('documentInfo'),
  pdfFile: document.getElementById('pdfFile'),
  imageFile: document.getElementById('imageFile'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  newWorkspaceBtn: document.getElementById('newWorkspaceBtn'),
  parseCurrentPageBtn: document.getElementById('parseCurrentPageBtn'),
  parseAllPagesBtn: document.getElementById('parseAllPagesBtn'),
  dedupePartsBtn: document.getElementById('dedupePartsBtn'),
  catalogsList: document.getElementById('catalogsList'),
  ordersList: document.getElementById('ordersList'),
  partsScopeSelect: document.getElementById('partsScopeSelect'),
  saveCatalogBtn: document.getElementById('saveCatalogBtn'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  fitViewBtn: document.getElementById('fitViewBtn'),
  addHotspotModeBtn: document.getElementById('addHotspotModeBtn'),
  viewerStage: document.getElementById('viewerStage'),
  documentImage: document.getElementById('documentImage'),
  pdfCanvas: document.getElementById('pdfCanvas'),
  pdfMagnifier: document.getElementById('pdfMagnifier'),
  magnifierCanvas: document.getElementById('magnifierCanvas'),
  hotspotPartSelect: document.getElementById('hotspotPartSelect'),
  clearHotspotsBtn: document.getElementById('clearHotspotsBtn'),
  partsJson: document.getElementById('partsJson'),
  loadPartsBtn: document.getElementById('loadPartsBtn'),
  selectedPartCard: document.getElementById('selectedPartCard'),
  partsList: document.getElementById('partsList'),
  catalogNameInput: document.getElementById('catalogNameInput'),
  orderNumberInput: document.getElementById('orderNumberInput'),
  orderDateInput: document.getElementById('orderDateInput'),
  requesterInput: document.getElementById('requesterInput'),
  departmentInput: document.getElementById('departmentInput'),
  addDepartmentBtn: document.getElementById('addDepartmentBtn'),
  machineNameInput: document.getElementById('machineNameInput'),
  supplierEmailInput: document.getElementById('supplierEmailInput'),
  generalNotesInput: document.getElementById('generalNotesInput'),
  lineQtyInput: document.getElementById('lineQtyInput'),
  lineUrgencyInput: document.getElementById('lineUrgencyInput'),
  lineNotesInput: document.getElementById('lineNotesInput'),
  addLineBtn: document.getElementById('addLineBtn'),
  removeSelectedHotspotBtn: document.getElementById('removeSelectedHotspotBtn'),
  saveOrderBtn: document.getElementById('saveOrderBtn'),
  printOrderBtn: document.getElementById('printOrderBtn'),
  emailOrderBtn: document.getElementById('emailOrderBtn'),
  exportOrderBtn: document.getElementById('exportOrderBtn'),
  clearOrderBtn: document.getElementById('clearOrderBtn'),
  orderLines: document.getElementById('orderLines'),
  printRoot: document.getElementById('printRoot')
};

const pdfCtx = els.pdfCanvas.getContext('2d');
const magnifierCtx = els.magnifierCanvas.getContext('2d');

els.orderDateInput.value = new Date().toISOString().slice(0, 10);

function formatDateIL(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function setTheme(theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  els.body.classList.remove('theme-dark', 'theme-light');
  els.body.classList.add(`theme-${state.theme}`);
  localStorage.setItem('vparts-theme', state.theme);
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeName(name, fallback) {
  return String(name || fallback || '').trim() || fallback;
}

function getDocumentLabel() {
  if (!state.currentDocName) return 'טרם נטען מסמך';
  if (state.currentDocType === 'pdf') {
    return `${state.currentDocName} • עמוד ${state.currentPage}/${state.totalPages} • זום ${Math.round(state.pdfScale * 100)}%`;
  }
  return state.currentDocName;
}

function updateHeader() {
  const title = els.catalogNameInput.value.trim() || 'קטלוג חדש';
  els.workspaceTitle.textContent = title;
  els.documentInfo.textContent = getDocumentLabel();
  els.zoomResetBtn.textContent = `${Math.round(state.pdfScale * 100)}%`;
}

function getFilteredParts() {
  if (els.partsScopeSelect.value === 'all' || state.currentDocType !== 'pdf') return state.parts;
  return state.parts.filter(part => Number(part.page || 1) === state.currentPage);
}

async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const orders = await window.vparts.listOrders();
  const yearOrders = orders.filter(o => String(o.order_number || '').startsWith(year + '-'));
  let max = 0;
  yearOrders.forEach(o => {
    const num = parseInt(String(o.order_number || '').split('-')[1] || '0', 10);
    if (num > max) max = num;
  });
  return `${year}-${String(max + 1).padStart(4, '0')}`;
}

const departmentsKey = 'vparts-departments';
function getDepartments() {
  try {
    return JSON.parse(localStorage.getItem(departmentsKey) || '["מעבדה","שירות","תפעול"]');
  } catch {
    return ['מעבדה', 'שירות', 'תפעול'];
  }
}
function saveDepartments(list) {
  localStorage.setItem(departmentsKey, JSON.stringify(list));
}
function renderDepartments(selectedValue = '') {
  const list = getDepartments();
  els.departmentInput.innerHTML = list
    .map(dep => `<option value="${escapeHtml(dep)}">${escapeHtml(dep)}</option>`)
    .join('');
  if (selectedValue && list.includes(selectedValue)) {
    els.departmentInput.value = selectedValue;
  }
}

function renderCatalogsList(catalogs) {
  if (!catalogs.length) {
    els.catalogsList.innerHTML = `<div class="meta-text">אין קטלוגים שמורים עדיין</div>`;
    return;
  }
  els.catalogsList.innerHTML = catalogs.map(c => `
    <div class="sidebar-item" data-catalog-id="${c.id}">
      <div class="part-title">${escapeHtml(c.name)}</div>
      <div class="meta-text">${escapeHtml(c.document_name || '-')} • ${c.parts_count || 0} חלקים</div>
    </div>
  `).join('');
  els.catalogsList.querySelectorAll('[data-catalog-id]').forEach(item => {
    item.addEventListener('click', async () => loadCatalog(Number(item.dataset.catalogId)));
  });
}

function renderOrdersList(orders) {
  if (!orders.length) {
    els.ordersList.innerHTML = `<div class="meta-text">אין הזמנות שמורות עדיין</div>`;
    return;
  }
  els.ordersList.innerHTML = orders.map(o => `
    <div class="sidebar-item" data-order-id="${o.id}">
      <div class="part-title">${escapeHtml(o.order_number)}</div>
      <div class="meta-text">${formatDateIL(o.order_date || o.created_at)} • ${escapeHtml(o.requester || '-')} • ${o.lines_count || 0} שורות</div>
    </div>
  `).join('');
  els.ordersList.querySelectorAll('[data-order-id]').forEach(item => {
    item.addEventListener('click', async () => loadOrder(Number(item.dataset.orderId)));
  });
}

async function refreshSidebars() {
  renderCatalogsList(await window.vparts.listCatalogs());
  renderOrdersList(await window.vparts.listOrders());
}

function clearImageObjectUrl() {
  if (state.imageObjectUrl) {
    URL.revokeObjectURL(state.imageObjectUrl);
    state.imageObjectUrl = null;
  }
}

function resetWorkspace({ keepOrders = false } = {}) {
  state.currentCatalogId = null;
  state.currentDocType = 'none';
  state.currentDocName = '';
  state.currentDocPath = '';
  state.currentPdf = null;
  state.currentPage = 1;
  state.totalPages = 0;
  state.pdfScale = 1.25;
  state.parts = [];
  state.hotspots = [];
  state.selectedPartId = null;
  state.addHotspotMode = false;
  state.draggingHotspotId = null;
  clearImageObjectUrl();

  if (!keepOrders) {
    state.currentOrderId = null;
    state.orderLines = [];
    els.orderDateInput.value = new Date().toISOString().slice(0, 10);
    els.requesterInput.value = '';
    els.machineNameInput.value = '';
    els.supplierEmailInput.value = '';
    els.generalNotesInput.value = '';
    renderDepartments();
  }

  els.catalogNameInput.value = '';
  els.partsJson.value = '[]';
  els.documentImage.style.display = 'none';
  els.documentImage.src = '';
  els.pdfCanvas.style.display = 'none';
  hideMagnifier();
  updateHeader();
  renderParts();
  renderSelectedPart();
  renderHotspots();
  renderOrderLines();
  setStatus('מוכן לעבודה');
}

async function loadPdfFromBuffer(arrayBuffer, displayName) {
  state.currentPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  state.currentDocType = 'pdf';
  state.currentDocName = displayName;
  state.totalPages = state.currentPdf.numPages;
  state.currentPage = 1;
  state.pdfScale = 1.25;
  await renderPdfPage(state.currentPage);
  updateHeader();
}

function loadImageFromBuffer(arrayBuffer, mimeType, displayName) {
  clearImageObjectUrl();
  const blob = new Blob([arrayBuffer], { type: mimeType || 'image/png' });
  state.imageObjectUrl = URL.createObjectURL(blob);
  state.currentDocType = 'image';
  state.currentDocName = displayName;
  state.currentPdf = null;
  state.totalPages = 1;
  state.currentPage = 1;
  els.documentImage.src = state.imageObjectUrl;
  els.documentImage.style.display = 'block';
  els.pdfCanvas.style.display = 'none';
  updateHeader();
  renderHotspots();
}

async function renderPdfPage(pageNumber) {
  if (!state.currentPdf) return;
  const page = await state.currentPdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: state.pdfScale });
  els.pdfCanvas.width = viewport.width;
  els.pdfCanvas.height = viewport.height;
  await page.render({ canvasContext: pdfCtx, viewport }).promise;
  els.pdfCanvas.style.display = 'block';
  els.documentImage.style.display = 'none';
  updateHeader();
  renderHotspots();
  renderParts();
}

function buildLinesFromTextItems(items) {
  const rows = [];
  const sorted = [...items].sort((a, b) => {
    const ay = Math.round(a.transform[5]);
    const by = Math.round(b.transform[5]);
    if (Math.abs(by - ay) > 2) return by - ay;
    return a.transform[4] - b.transform[4];
  });

  for (const item of sorted) {
    const y = Math.round(item.transform[5]);
    let row = rows.find(r => Math.abs(r.y - y) <= 2);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x: item.transform[4], str: item.str });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map(r => r.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function inferType(description) {
  const d = description.toUpperCase();
  if (d.includes('ASSY') || d.includes('ASSEMBLY')) return 'ASSEMBLY';
  if (d.includes('FASCIA')) return 'FASCIA';
  if (d.includes('BRACKET')) return 'BRACKET';
  if (d.includes('COVER')) return 'COVER';
  if (d.includes('PANEL')) return 'PANEL';
  return 'AUTO';
}

function parsePartLine(line) {
  const pnMatch = line.match(/\b\d{3}-\d{6,}\b/);
  if (!pnMatch) return null;

  const pn = pnMatch[0];
  let before = line.slice(0, pnMatch.index).trim();
  let after = line.slice((pnMatch.index || 0) + pn.length).trim();
  let partRef = '';

  const numberMatch = before.match(/(?:^|\s)(\d{1,3})(?:\s|$)/);
  if (numberMatch) {
    partRef = numberMatch[1];
    before = before.replace(numberMatch[0], ' ').trim();
  }

  let description = [before, after].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  description = description.replace(/^[\-\–\—:|]+/, '').trim();

  if (!description || description.length < 3) return null;
  if (/^page\b/i.test(description)) return null;

  return {
    partRef: partRef || '',
    pn,
    description,
    type: inferType(description)
  };
}

async function extractPartsForPage(pageNumber) {
  if (!state.currentPdf) return [];
  const page = await state.currentPdf.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const rawLines = buildLinesFromTextItems(textContent.items);
  const found = [];
  const seen = new Set();

  for (const line of rawLines) {
    const parsed = parsePartLine(line);
    if (!parsed) continue;
    const key = `${pageNumber}__${parsed.pn}__${parsed.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      id: `client-${pageNumber}-${found.length + 1}-${Date.now()}`,
      clientId: `client-${pageNumber}-${found.length + 1}-${Date.now()}`,
      page: pageNumber,
      partRef: parsed.partRef || String(found.length + 1),
      pn: parsed.pn,
      description: parsed.description,
      type: parsed.type || 'AUTO'
    });
  }

  return found;
}

function normalizeParts(parts) {
  return parts.map((part, index) => ({
    id: part.id || `client-${index + 1}-${Date.now()}`,
    clientId: part.clientId || part.id || `client-${index + 1}-${Date.now()}`,
    page: Number(part.page || 1),
    partRef: String(part.partRef || part.part || index + 1),
    pn: String(part.pn || ''),
    description: String(part.description || ''),
    type: String(part.type || '')
  })).filter(part => part.pn);
}

function renderParts() {
  const filtered = getFilteredParts();
  els.partsJson.value = JSON.stringify(filtered, null, 2);
  els.partsList.innerHTML = filtered.map(part => `
    <div class="part-item ${String(part.id) === String(state.selectedPartId) ? 'active' : ''}" data-part-id="${part.id}">
      <div class="part-row">
        <div>
          <div class="part-title">#${escapeHtml(part.partRef || part.id)} • ${escapeHtml(part.description)}</div>
          <div class="part-sub">PN: ${escapeHtml(part.pn)} • סוג: ${escapeHtml(part.type || '-')}</div>
        </div>
        <div class="page-chip">עמוד ${part.page || 1}</div>
      </div>
    </div>
  `).join('');

  els.partsList.querySelectorAll('[data-part-id]').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.dataset.partId;
      const part = state.parts.find(p => String(p.id) === String(id));
      if (!part) return;
      state.selectedPartId = part.id;
      if (state.currentDocType === 'pdf' && Number(part.page || 1) !== state.currentPage) {
        state.currentPage = Number(part.page || 1);
        await renderPdfPage(state.currentPage);
      }
      renderParts();
      renderSelectedPart();
      renderHotspots();
      setStatus(`נבחר חלק ${part.partRef || part.id}`);
    });

    item.addEventListener('dblclick', () => {
      const part = state.parts.find(p => String(p.id) === String(item.dataset.partId));
      if (!part) return;
      state.selectedPartId = part.id;
      addSelectedPartToOrder();
    });
  });

  const options = filtered.map(part =>
    `<option value="${part.id}">עמוד ${part.page || 1} • #${escapeHtml(part.partRef)} • ${escapeHtml(part.pn)}</option>`
  ).join('');
  els.hotspotPartSelect.innerHTML = options || '<option value="">אין חלקים</option>';
}

function renderSelectedPart() {
  const part = state.parts.find(p => String(p.id) === String(state.selectedPartId));
  if (!part) {
    els.selectedPartCard.innerHTML = `
      <div><strong>חלק נבחר:</strong> טרם נבחר</div>
      <div><strong>עמוד:</strong> -</div>
      <div><strong>PN:</strong> -</div>
      <div><strong>תיאור:</strong> -</div>
    `;
    return;
  }
  els.selectedPartCard.innerHTML = `
    <div><strong>חלק נבחר:</strong> ${escapeHtml(part.partRef || part.id)}</div>
    <div><strong>עמוד:</strong> ${part.page || 1}</div>
    <div><strong>PN:</strong> ${escapeHtml(part.pn)}</div>
    <div><strong>תיאור:</strong> ${escapeHtml(part.description)}</div>
  `;
}

function visibleHotspots() {
  const page = state.currentDocType === 'pdf' ? state.currentPage : 1;
  return state.hotspots.filter(h => Number(h.page || 1) === page);
}

function renderHotspots() {
  els.viewerStage.querySelectorAll('.hotspot').forEach(el => el.remove());
  visibleHotspots().forEach(hs => {
    const part = state.parts.find(p => String(p.id) === String(hs.partClientId || hs.partId));
    const el = document.createElement('div');
    el.className = `hotspot ${String(state.selectedPartId) === String(hs.partClientId || hs.partId) ? 'active' : ''}`;
    el.style.left = `${hs.x}%`;
    el.style.top = `${hs.y}%`;
    el.dataset.hotspotId = hs.id;
    el.textContent = part?.partRef || '?';

    el.addEventListener('click', () => {
      if (!part) return;
      state.selectedPartId = part.id;
      renderSelectedPart();
      renderParts();
      renderHotspots();
    });

    el.addEventListener('pointerdown', (e) => {
      state.draggingHotspotId = hs.id;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointerup', () => {
      state.draggingHotspotId = null;
    });

    els.viewerStage.appendChild(el);
  });
}

function renderOrderLines() {
  if (!state.orderLines.length) {
    els.orderLines.innerHTML = `<div class="meta-text">אין שורות הזמנה עדיין</div>`;
    return;
  }

  els.orderLines.innerHTML = state.orderLines.map((line, index) => `
    <div class="order-line">
      <div class="part-row">
        <div>
          <div class="part-title">${index + 1}. ${escapeHtml(line.pn)}</div>
          <div class="part-sub">${escapeHtml(line.description)} • כמות ${line.qty} • ${escapeHtml(line.urgency)}</div>
          <div class="part-sub">${escapeHtml(line.notes || '-')}</div>
        </div>
        <button class="btn btn-danger" data-line-id="${line.lineId}" style="padding:8px 10px;">מחק</button>
      </div>
    </div>
  `).join('');

  els.orderLines.querySelectorAll('[data-line-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.orderLines = state.orderLines.filter(line => line.lineId !== btn.dataset.lineId);
      renderOrderLines();
    });
  });
}

function buildOrderSummaryText() {
  const header = [
    `מספר הזמנה: ${els.orderNumberInput.value || '-'}`,
    `תאריך: ${formatDateIL(els.orderDateInput.value)}`,
    `שם המזמין: ${els.requesterInput.value || '-'}`,
    `מחלקה: ${els.departmentInput.value || '-'}`,
    `מכשיר / דגם: ${els.machineNameInput.value || '-'}`,
    `הערות כלליות: ${els.generalNotesInput.value || '-'}`,
    '',
    'שורות הזמנה:'
  ];
  const lines = state.orderLines.map((line, index) =>
    `${index + 1}. PN ${line.pn} | ${line.description} | כמות ${line.qty} | דחיפות ${line.urgency} | הערה ${line.notes || '-'}`
  );
  return [...header, ...lines].join('\n');
}

function renderPrintTemplate() {
  els.printRoot.innerHTML = `
    <div style="padding:24px;font-family:Arial;direction:rtl;">
      <h1>טופס הזמנת חלקים</h1>
      <div>מספר הזמנה: ${escapeHtml(els.orderNumberInput.value || '-')}</div>
      <div>תאריך: ${escapeHtml(formatDateIL(els.orderDateInput.value))}</div>
      <div>שם המזמין: ${escapeHtml(els.requesterInput.value || '-')}</div>
      <div>מחלקה: ${escapeHtml(els.departmentInput.value || '-')}</div>
      <div>מכשיר / דגם: ${escapeHtml(els.machineNameInput.value || '-')}</div>
      <div>הערות כלליות: ${escapeHtml(els.generalNotesInput.value || '-')}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr>
            <th style="border:1px solid #000;padding:8px;">#</th>
            <th style="border:1px solid #000;padding:8px;">PN</th>
            <th style="border:1px solid #000;padding:8px;">שם החלק</th>
            <th style="border:1px solid #000;padding:8px;">כמות</th>
            <th style="border:1px solid #000;padding:8px;">דחיפות</th>
            <th style="border:1px solid #000;padding:8px;">הערה</th>
          </tr>
        </thead>
        <tbody>
          ${state.orderLines.map((line, index) => `
            <tr>
              <td style="border:1px solid #000;padding:8px;">${index + 1}</td>
              <td style="border:1px solid #000;padding:8px;">${escapeHtml(line.pn)}</td>
              <td style="border:1px solid #000;padding:8px;">${escapeHtml(line.description)}</td>
              <td style="border:1px solid #000;padding:8px;">${line.qty}</td>
              <td style="border:1px solid #000;padding:8px;">${escapeHtml(line.urgency)}</td>
              <td style="border:1px solid #000;padding:8px;">${escapeHtml(line.notes || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function printOrder() {
  if (!state.orderLines.length) {
    alert('אין שורות להזמנה.');
    return;
  }
  renderPrintTemplate();
  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>Print</title></head><body>${els.printRoot.innerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

function addSelectedPartToOrder() {
  const part = state.parts.find(p => String(p.id) === String(state.selectedPartId));
  if (!part) {
    alert('בחר חלק קודם.');
    return;
  }
  state.orderLines.push({
    lineId: `line-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    partId: part.id,
    pn: part.pn,
    description: part.description,
    qty: Math.max(1, Number(els.lineQtyInput.value || 1)),
    urgency: els.lineUrgencyInput.value,
    notes: els.lineNotesInput.value.trim()
  });
  els.lineQtyInput.value = 1;
  els.lineUrgencyInput.value = 'רגיל';
  els.lineNotesInput.value = '';
  renderOrderLines();
}

async function saveCurrentCatalog() {
  const catalogName = safeName(els.catalogNameInput.value, 'קטלוג ללא שם');
  if (!state.currentDocPath) {
    alert('יש לטעון מסמך לפני שמירת קטלוג.');
    return;
  }

  const payload = {
    id: state.currentCatalogId,
    name: catalogName,
    documentName: state.currentDocName,
    documentType: state.currentDocType,
    documentPath: state.currentDocPath,
    themeMode: state.theme,
    parts: state.parts.map((part) => ({
      clientId: part.clientId || part.id,
      page: part.page,
      partRef: part.partRef,
      pn: part.pn,
      description: part.description,
      type: part.type
    })),
    hotspots: state.hotspots.map((hotspot) => ({
      partClientId: hotspot.partClientId || hotspot.partId,
      page: hotspot.page,
      x: hotspot.x,
      y: hotspot.y
    }))
  };

  const saved = await window.vparts.saveCatalog(payload);
  state.currentCatalogId = saved.id;
  await loadCatalog(saved.id);
  await refreshSidebars();
  setStatus('הקטלוג נשמר למסד');
}

async function saveCurrentOrder() {
  if (!state.orderLines.length) {
    alert('אין שורות הזמנה לשמירה.');
    return;
  }

  const saved = await window.vparts.saveOrder({
    id: state.currentOrderId,
    orderNumber: safeName(els.orderNumberInput.value, 'ORD-NEW'),
    orderDate: els.orderDateInput.value,
    requester: els.requesterInput.value.trim(),
    department: els.departmentInput.value.trim(),
    machineName: els.machineNameInput.value.trim(),
    supplierEmail: els.supplierEmailInput.value.trim(),
    generalNotes: els.generalNotesInput.value.trim(),
    status: 'draft',
    lines: state.orderLines
  });

  state.currentOrderId = saved.id;
  await refreshSidebars();
  setStatus('ההזמנה נשמרה למסד');
}

async function loadCatalog(id) {
  const catalog = await window.vparts.getCatalog(id);
  if (!catalog) return;

  resetWorkspace({ keepOrders: true });
  state.currentCatalogId = catalog.id;
  els.catalogNameInput.value = catalog.name || '';
  if (catalog.theme_mode) setTheme(catalog.theme_mode);
  state.parts = normalizeParts((catalog.parts || []).map(p => ({
    id: p.id,
    clientId: p.id,
    page: p.page,
    partRef: p.part_ref,
    pn: p.pn,
    description: p.description,
    type: p.type
  })));

  state.hotspots = (catalog.hotspots || []).map(h => ({
    id: `db-hotspot-${h.id}`,
    partId: h.part_id,
    partClientId: h.part_id,
    page: h.page,
    x: h.x,
    y: h.y
  }));

  state.currentDocType = catalog.document_type || 'none';
  state.currentDocName = catalog.document_name || '';
  state.currentDocPath = catalog.document_path || '';

  if (state.currentDocPath) {
    const read = await window.vparts.readDocument({ filePath: state.currentDocPath });
    if (read.ok) {
      const ext = (state.currentDocName.split('.').pop() || '').toLowerCase();
      if (state.currentDocType === 'pdf') {
        await loadPdfFromBuffer(read.buffer, state.currentDocName);
      } else {
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        loadImageFromBuffer(read.buffer, mimeType, state.currentDocName);
      }
    } else {
      setStatus('המסמך המקורי לא נמצא, אך הקטלוג נטען מהמסד');
    }
  }

  renderParts();
  renderSelectedPart();
  renderHotspots();
  updateHeader();
  setStatus(`הקטלוג "${catalog.name}" נטען`);
}

async function loadOrder(id) {
  const order = await window.vparts.getOrder(id);
  if (!order) return;
  state.currentOrderId = order.id;
  els.orderNumberInput.value = order.order_number || '';
  els.orderDateInput.value = order.order_date || new Date().toISOString().slice(0, 10);
  els.requesterInput.value = order.requester || '';
  renderDepartments(order.department || '');
  els.departmentInput.value = order.department || '';
  els.machineNameInput.value = order.machine_name || '';
  els.supplierEmailInput.value = order.supplier_email || '';
  els.generalNotesInput.value = order.general_notes || '';
  state.orderLines = (order.lines || []).map(line => ({
    lineId: `db-line-${line.id}`,
    partId: line.part_id,
    pn: line.pn,
    description: line.description,
    qty: line.qty,
    urgency: line.urgency,
    notes: line.notes
  }));
  renderOrderLines();
  setStatus(`ההזמנה "${order.order_number}" נטענה`);
}

function parsePartsFromJsonEditor() {
  try {
    state.parts = normalizeParts(JSON.parse(els.partsJson.value));
    renderParts();
    renderSelectedPart();
    renderHotspots();
    setStatus(`נטענו ${state.parts.length} חלקים מהטקסט`);
  } catch (error) {
    alert('JSON לא תקין: ' + error.message);
  }
}

function dedupeParts() {
  const map = new Map();
  for (const part of state.parts) {
    const key = `${part.page}__${part.pn}__${part.description}`;
    if (!map.has(key)) map.set(key, part);
  }
  state.parts = Array.from(map.values()).map((part, index) => ({
    ...part,
    id: `client-dedupe-${index + 1}-${Date.now()}`,
    clientId: `client-dedupe-${index + 1}-${Date.now()}`
  }));
  renderParts();
  renderSelectedPart();
  renderHotspots();
  setStatus(`נוקו כפילויות. נשארו ${state.parts.length} חלקים`);
}

async function parseCurrentPage() {
  if (!state.currentPdf) {
    alert('יש לטעון PDF קודם.');
    return;
  }
  const detected = await extractPartsForPage(state.currentPage);
  const others = state.parts.filter(part => Number(part.page || 1) !== state.currentPage);
  state.parts = normalizeParts([...others, ...detected]);
  renderParts();
  renderSelectedPart();
  renderHotspots();
  setStatus(`זוהו ${detected.length} חלקים בעמוד ${state.currentPage}`);
}

async function parseAllPages() {
  if (!state.currentPdf) {
    alert('יש לטעון PDF קודם.');
    return;
  }
  const all = [];
  for (let page = 1; page <= state.totalPages; page++) {
    const pageParts = await extractPartsForPage(page);
    all.push(...pageParts);
  }
  state.parts = normalizeParts(all);
  renderParts();
  renderSelectedPart();
  renderHotspots();
  setStatus(`זוהו ${state.parts.length} חלקים בכל המסמך`);
}

async function handlePdfFile(file) {
  if (!file) return;
  const buffer = await file.arrayBuffer();
  const stored = await window.vparts.storeDocument({ fileName: file.name, buffer });
  state.currentDocPath = stored.path;
  await loadPdfFromBuffer(buffer, file.name);
  setStatus(`נטען PDF: ${file.name}`);
}

async function handleImageFile(file) {
  if (!file) return;
  const buffer = await file.arrayBuffer();
  const stored = await window.vparts.storeDocument({ fileName: file.name, buffer });
  state.currentDocPath = stored.path;
  const mimeType = file.type || 'image/png';
  loadImageFromBuffer(buffer, mimeType, file.name);
  setStatus(`נטענה תמונה: ${file.name}`);
}

function addHotspotAt(x, y, partId) {
  state.hotspots.push({
    id: `hotspot-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    partId,
    partClientId: partId,
    page: state.currentDocType === 'pdf' ? state.currentPage : 1,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100
  });
  renderHotspots();
  setStatus('נוספה נקודה למסמך');
}

function removeSelectedHotspot() {
  if (!state.selectedPartId) {
    alert('בחר חלק קודם.');
    return;
  }
  const currentPage = state.currentDocType === 'pdf' ? state.currentPage : 1;
  const before = state.hotspots.length;
  state.hotspots = state.hotspots.filter(h =>
    !(String(h.partClientId || h.partId) === String(state.selectedPartId) && Number(h.page || 1) === currentPage)
  );
  if (before === state.hotspots.length) {
    alert('לא נמצאה נקודה של החלק הנבחר בעמוד הנוכחי.');
    return;
  }
  renderHotspots();
}

function clearHotspots() {
  state.hotspots = [];
  renderHotspots();
}

function clampZoom(value) {
  return Math.min(3.5, Math.max(0.6, value));
}

async function setZoom(newZoom) {
  state.pdfScale = clampZoom(newZoom);
  if (state.currentDocType === 'pdf' && state.currentPdf) {
    await renderPdfPage(state.currentPage);
  } else {
    updateHeader();
  }
}

async function changeZoom(delta) {
  await setZoom(state.pdfScale + delta);
}

function showMagnifier(event) {
  if (state.currentDocType !== 'pdf' || !event.altKey || els.pdfCanvas.style.display === 'none') {
    hideMagnifier();
    return;
  }

  const canvasRect = els.pdfCanvas.getBoundingClientRect();
  const inside =
    event.clientX >= canvasRect.left &&
    event.clientX <= canvasRect.right &&
    event.clientY >= canvasRect.top &&
    event.clientY <= canvasRect.bottom;

  if (!inside) {
    hideMagnifier();
    return;
  }

  const magSize = 380;
  const zoomFactor = 2.8;
  const sourceSize = magSize / zoomFactor;

  els.magnifierCanvas.width = magSize;
  els.magnifierCanvas.height = magSize;

  const x = ((event.clientX - canvasRect.left) / canvasRect.width) * els.pdfCanvas.width;
  const y = ((event.clientY - canvasRect.top) / canvasRect.height) * els.pdfCanvas.height;

  magnifierCtx.clearRect(0, 0, magSize, magSize);
  magnifierCtx.imageSmoothingEnabled = false;
  magnifierCtx.drawImage(
    els.pdfCanvas,
    x - sourceSize / 2,
    y - sourceSize / 2,
    sourceSize,
    sourceSize,
    0,
    0,
    magSize,
    magSize
  );

  magnifierCtx.strokeStyle = 'rgba(43,127,255,0.8)';
  magnifierCtx.lineWidth = 2;
  magnifierCtx.beginPath();
  magnifierCtx.moveTo(magSize / 2, 0);
  magnifierCtx.lineTo(magSize / 2, magSize);
  magnifierCtx.moveTo(0, magSize / 2);
  magnifierCtx.lineTo(magSize, magSize / 2);
  magnifierCtx.stroke();

  let left = event.clientX + 26;
  let top = event.clientY - magSize / 2;
  const maxLeft = window.innerWidth - magSize - 12;
  const maxTop = window.innerHeight - magSize - 12;
  left = Math.max(12, Math.min(left, maxLeft));
  top = Math.max(12, Math.min(top, maxTop));

  els.pdfMagnifier.style.left = `${left}px`;
  els.pdfMagnifier.style.top = `${top}px`;
  els.pdfMagnifier.classList.remove('hidden');
}

function hideMagnifier() {
  els.pdfMagnifier.classList.add('hidden');
}

els.themeToggleBtn.addEventListener('click', () => {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
});

els.newWorkspaceBtn.addEventListener('click', async () => {
  resetWorkspace();
  els.orderNumberInput.value = await generateOrderNumber();
  renderDepartments();
});

els.pdfFile.addEventListener('change', async () => {
  const file = els.pdfFile.files[0];
  await handlePdfFile(file);
});

els.imageFile.addEventListener('change', async () => {
  const file = els.imageFile.files[0];
  await handleImageFile(file);
});

els.parseCurrentPageBtn.addEventListener('click', parseCurrentPage);
els.parseAllPagesBtn.addEventListener('click', parseAllPages);
els.dedupePartsBtn.addEventListener('click', dedupeParts);
els.partsScopeSelect.addEventListener('change', renderParts);
els.loadPartsBtn.addEventListener('click', parsePartsFromJsonEditor);
els.saveCatalogBtn.addEventListener('click', saveCurrentCatalog);
els.saveOrderBtn.addEventListener('click', saveCurrentOrder);
els.addLineBtn.addEventListener('click', addSelectedPartToOrder);
els.removeSelectedHotspotBtn.addEventListener('click', removeSelectedHotspot);
els.clearHotspotsBtn.addEventListener('click', clearHotspots);

els.addDepartmentBtn.addEventListener('click', () => {
  const current = getDepartments();
  const name = prompt('שם מחלקה חדשה:');
  if (!name || !name.trim()) return;
  const clean = name.trim();
  if (!current.includes(clean)) {
    current.push(clean);
    saveDepartments(current);
  }
  renderDepartments(clean);
});

els.prevPageBtn.addEventListener('click', async () => {
  if (!state.currentPdf || state.currentPage <= 1) return;
  state.currentPage -= 1;
  await renderPdfPage(state.currentPage);
});
els.nextPageBtn.addEventListener('click', async () => {
  if (!state.currentPdf || state.currentPage >= state.totalPages) return;
  state.currentPage += 1;
  await renderPdfPage(state.currentPage);
});
els.zoomInBtn.addEventListener('click', async () => changeZoom(0.15));
els.zoomOutBtn.addEventListener('click', async () => changeZoom(-0.15));
els.zoomResetBtn.addEventListener('click', async () => setZoom(1.25));
els.fitViewBtn.addEventListener('click', () => {
  els.viewerStage.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
});
els.addHotspotModeBtn.addEventListener('click', () => {
  state.addHotspotMode = true;
  setStatus('מצב הוספת נקודה פעיל. לחץ על המסמך.');
});

els.viewerStage.addEventListener('click', (e) => {
  if (!state.addHotspotMode) return;
  if (!els.hotspotPartSelect.value) {
    alert('אין חלקים לבחור מהם.');
    return;
  }
  const rect = els.viewerStage.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  addHotspotAt(x, y, els.hotspotPartSelect.value);
  state.addHotspotMode = false;
});

els.viewerStage.addEventListener('pointermove', (e) => {
  showMagnifier(e);

  if (!state.draggingHotspotId) return;
  const rect = els.viewerStage.getBoundingClientRect();
  const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
  const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
  state.hotspots = state.hotspots.map(h =>
    h.id === state.draggingHotspotId ? { ...h, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 } : h
  );
  renderHotspots();
});

els.viewerStage.addEventListener('pointerleave', hideMagnifier);
window.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') hideMagnifier();
});

els.viewerStage.addEventListener('wheel', async (e) => {
  if (state.currentDocType !== 'pdf' || !state.currentPdf) return;

  if (e.ctrlKey) {
    e.preventDefault();
    await changeZoom(e.deltaY > 0 ? -0.08 : 0.08);
    return;
  }

  e.preventDefault();
  if (e.deltaY > 0 && state.currentPage < state.totalPages) {
    state.currentPage += 1;
    await renderPdfPage(state.currentPage);
  } else if (e.deltaY < 0 && state.currentPage > 1) {
    state.currentPage -= 1;
    await renderPdfPage(state.currentPage);
  }
}, { passive: false });

els.clearOrderBtn.addEventListener('click', async () => {
  state.currentOrderId = null;
  state.orderLines = [];
  renderOrderLines();
  els.orderNumberInput.value = await generateOrderNumber();
});

els.exportOrderBtn.addEventListener('click', async () => {
  if (!state.orderLines.length) {
    alert('אין שורות להזמנה.');
    return;
  }
  const defaultName = `${safeName(els.orderNumberInput.value, 'order')}.txt`;
  await window.vparts.saveTextExport({ defaultName, text: buildOrderSummaryText() });
});

els.emailOrderBtn.addEventListener('click', () => {
  if (!state.orderLines.length) {
    alert('אין שורות להזמנה.');
    return;
  }
  const to = els.supplierEmailInput.value.trim();
  const subject = encodeURIComponent(`הזמנת חלקים ${els.orderNumberInput.value || ''}`.trim());
  const body = encodeURIComponent(buildOrderSummaryText());
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
});

els.printOrderBtn.addEventListener('click', printOrder);

async function loadOrderNumberIfNeeded() {
  if (!els.orderNumberInput.value.trim()) {
    els.orderNumberInput.value = await generateOrderNumber();
  }
}

(async function init() {
  setTheme(state.theme);
  renderDepartments();
  await loadOrderNumberIfNeeded();
  await refreshSidebars();
  renderParts();
  renderSelectedPart();
  renderHotspots();
  renderOrderLines();
  updateHeader();
  setStatus('המערכת מוכנה');
})();
