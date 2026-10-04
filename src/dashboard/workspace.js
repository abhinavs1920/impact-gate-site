// The workspace is an illustrative preview. Browser state never represents a backend mutation.
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const page = document.documentElement.dataset.page;
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(`impact-gate-preview-${key}`)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(`impact-gate-preview-${key}`, JSON.stringify(value)); return true; } catch { return false; } };
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clean = node => node?.textContent.replace(/\s+/g,' ').trim() || '';
const records = $$('[data-record]').map(row => ({row, cells:JSON.parse(row.dataset.record)}));
let selected = records[0];
let candidateFilter = '';
let repoFilter = '';
let previousFocus;
let toastTimer;
function toast(message) {
  const target = $('.ig-toast'); target.textContent = message; target.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { target.hidden = true; },5000);
}
function modal(title, contents, onSave, saveLabel = 'Save preview preference') {
  const dialog = $('.ig-dialog'); previousFocus = document.activeElement;
  dialog.innerHTML = `<form method="dialog"><h2 id="dialog-title">${escape(title)}</h2>${contents}<div class="ig-dialog-actions"><button class="ig-button ig-button-secondary" value="cancel">Close</button>${onSave ? `<button class="ig-button" value="save">${escape(saveLabel)}</button>` : ''}</div></form>`;
  $('form',dialog).addEventListener('submit', event => {
    if (event.submitter?.value !== 'save') return;
    event.preventDefault();
    if (onSave(new FormData(event.target)) !== false) dialog.close();
  });
  dialog.showModal();
}
$('.ig-dialog').addEventListener('close', () => previousFocus?.focus());
$('.ig-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.currentTarget.close(); } });
function closeOverlays() {
  document.body.dataset.navOpen = 'false';
  $('[data-action=menu]').setAttribute('aria-expanded','false');
  const drawer = $('[data-drawer]'); if (drawer) drawer.hidden = true;
  $('.ig-backdrop').hidden = true;
  document.body.style.overflow = '';
  previousFocus?.focus();
}
function openDrawer() {
  const drawer = $('[data-drawer]');
  if (!drawer) { location.href = '/dashboard/repositories?import=1'; return; }
  closeOverlays(); previousFocus = document.activeElement;
  drawer.hidden = false; $('.ig-backdrop').hidden = false; document.body.style.overflow = 'hidden';
  $('[data-action=close-drawer]',drawer)?.focus();
  updateImportCount();
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeOverlays();
  const drawer = $('[data-drawer]');
  const overlay = drawer && !drawer.hidden ? drawer : document.body.dataset.navOpen === 'true' ? $('.ig-sidebar') : null;
  if (event.key === 'Tab' && overlay) {
    const focusable = $$('a[href],button,input,select',overlay).filter(el => !el.disabled && !el.hidden);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
function applyFilters() {
  if (!records.length) return;
  const query = ($('[data-search]')?.value || '').trim().toLowerCase();
  const filters = Object.fromEntries($$('[data-filter]').filter(el => el.tagName === 'SELECT').map(el => [el.dataset.filter, el.value]));
  let visible = 0;
  for (const record of records) {
    const c = record.cells;
    let matches = c.join(' ').toLowerCase().includes(query);
    if (page === 'api-usage') {
      if (filters.service) matches &&= c[2] === filters.service;
      if (filters.method) matches &&= c[0] === filters.method;
      if (filters.criticality) matches &&= c[6] === filters.criticality;
      if (filters.activity === 'No recent callers') matches &&= /never|no runtime/i.test(c[4]) || Number.parseInt(c[4]) >= 30;
      if (filters.activity === 'Never observed in sample') matches &&= /never/i.test(c[4]);
    }
    if (page === 'deprecation-candidates' && candidateFilter) matches &&= c.join(' ').toLowerCase().includes(candidateFilter);
    if (page === 'repositories' && repoFilter) matches &&= c.join(' ').toLowerCase().includes(repoFilter);
    record.row.hidden = !matches;
    if (matches) visible++;
  }
  $('.ig-empty').hidden = visible > 0;
  const dossier = $('[data-dossier]'); if (dossier) dossier.hidden = records[activeDossier]?.row.hidden || !dossierOpen;
  const status = $('[data-visible-count]'); if (status) status.textContent = `${visible} sample ${{'home':'findings','api-usage':'endpoints','repositories':'repositories','deprecation-candidates':'candidates'}[page] || 'records'}`;
  const all = $('[data-select-all]'); if (all) { const checks = records.filter(r => !r.row.hidden).map(r => $('input[type=checkbox]',r.row)).filter(Boolean); all.checked = checks.length > 0 && checks.every(el => el.checked); all.indeterminate = checks.some(el => el.checked) && !all.checked; }
}
let activeDossier = 0;
let dossierOpen = true;
function clearFilters() {
  $$('[data-search]').forEach(input => input.value = '');
  $$('select[data-filter]').forEach(input => input.value = '');
  candidateFilter = ''; repoFilter = '';
  $$('[data-action=candidate-filter]').forEach((button,i) => button.setAttribute('aria-pressed', String(i === 0)));
  applyFilters();
}
$$('[data-search]').forEach(input => input.addEventListener('input', page === 'dependency-graph' ? filterGraph : applyFilters));
$$('select[data-filter]').forEach(input => input.addEventListener('change', applyFilters));
const table = $('.ig-table');
if (table) {
  const headers = $$('thead th',table).map(clean);
  $$('tbody tr',table).forEach(row => $$(':scope > td',row).forEach((cell,i) => { if (!cell.hasAttribute('colspan')) cell.dataset.label = headers[i] || ''; }));
  const counter = document.createElement('p'); counter.className = 'ig-selection-status'; counter.dataset.visibleCount = ''; table.parentElement.insertAdjacentElement('afterend',counter);
}
$('[data-select-all]')?.addEventListener('change', event => {
  for (const record of records.filter(r => !r.row.hidden)) { const box = $('input[type=checkbox]',record.row); if (box) box.checked = event.target.checked; }
  applyFilters();
});
$$('.ig-table tbody input[type=checkbox]').forEach(box => box.addEventListener('change',applyFilters));

// Endpoint selection and the three inspector tabs.
const panel = $('[data-endpoint-panel]');
const originalOverview = panel ? $('[data-tab-content]',panel).innerHTML : '';
const callerNames = ['mobile-bff','booking-service','notification-service','billing-service','trainer-service','search-service','recommendation-service','oauth-service'];
function selectEndpoint(record) {
  selected = record;
  for (const {row} of records) { row.dataset.selected = String(row === record.row); row.setAttribute('aria-pressed', String(row === record.row)); }
  const c = record.cells;
  const metadata = panel.firstElementChild.firstElementChild;
  const spans = $$(':scope > span',metadata);
  spans[0].textContent = c[0]; spans[1].textContent = c[1]; spans[3].textContent = c[2];
  spans[0].className = $('td > span',record.row).className;
  spans[5].textContent = `${c[3]} callers`; spans[7].textContent = `Last sample call: ${c[4]}`;
  $('[data-tab=callers] span:last-child',panel).textContent = c[3];
  $('[data-tab=history] span:last-child',panel).textContent = record === records[0] ? '4' : '1';
  showTab('overview');
}
function showTab(tab) {
  if (!panel || !selected) return;
  $$('[data-tab]',panel).forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
  const target = $('[data-tab-content]',panel);
  const c = selected.cells;
  target.setAttribute('role','tabpanel'); target.setAttribute('aria-label',tab);
  if (tab === 'overview') {
    target.innerHTML = originalOverview;
    const values = {method:c[0],path:c[1],service:c[2],criticality:c[6],'known callers':c[3],'last observed':c[4],'last observed call':c[4],'evidence basis':c[5],evidence:c[5],confidence:c[5]};
    $$('dl > div',target).forEach(item => { const value = values[clean($('dt',item)).toLowerCase()]; if (value !== undefined) $('dd',item).textContent = value; });
    const notes = $$('p',target);
    if (selected !== records[0]) {
      notes.forEach(p => p.textContent = `Illustrative ${c[0]} endpoint owned by ${c[2]}. ${c[5]} evidence in this sample; confirm coverage before drawing conclusions.`);
      const badge = $$('span',target).find(span => clean(span) === 'Active Endpoint'); if (badge) badge.textContent = 'Sample endpoint';
    }
  } else if (tab === 'callers') {
    const count = Number(c[3]);
    target.innerHTML = `<div class="ig-detail-list"><p>Illustrative callers for <code>${escape(c[1])}</code>. Static references and runtime observations remain separate.</p>${count ? callerNames.slice(0,count).map((name,i) => `<div><strong>${escape(name)}</strong><p>${i % 2 ? 'Static reference · sample call site' : `${escape(c[5])} evidence · sample observation`}</p></div>`).join('') : '<div>No known callers in this sample. Missing telemetry does not establish that an endpoint is unused.</div>'}</div>`;
  } else {
    const history = selected === records[0] ? [['Response field removed','UserResponse.email · illustrative finding'],['Schema changed','UserResponse · illustrative change'],['Consumer evidence updated','Sample static call sites refreshed'],['Endpoint discovered','Initial sample catalog entry']] : [['Endpoint discovered',`${c[0]} ${c[1]} · sample catalog entry`]];
    target.innerHTML = `<div class="ig-detail-list"><p>Illustrative change history.</p>${history.map(([title,detail]) => `<div><strong>${escape(title)}</strong><p>${escape(detail)}</p></div>`).join('')}<a class="ig-button ig-button-secondary" href="/review-desk">Open illustrative finding</a></div>`;
  }
}
if (panel) {
  records.forEach(record => {
    record.row.addEventListener('click', () => { selectEndpoint(record); panel.scrollIntoView({block:'nearest'}); });
    record.row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEndpoint(record); panel.scrollIntoView({block:'nearest'}); } });
  });
  const endpoint = new URLSearchParams(location.search).get('endpoint');
  selectEndpoint(records.find(record => record.cells[1] === endpoint) || records[0]);
}
function flagEndpoint() {
  if (!selected) return;
  const c = selected.cells;
  modal('Flag for deprecation review', `<p><strong>${escape(c[0])} ${escape(c[1])}</strong><br>${escape(c[2])}</p><p>This adds the endpoint to your browser’s preview review queue. A flag does not establish that removal is safe.</p>`, () => {
    const existing = read('flags',[]); const flags = Array.isArray(existing) ? existing : [];
    if (!flags.some(flag => flag.path === c[1] && flag.service === c[2])) flags.push({method:c[0],path:c[1],service:c[2],callers:c[3],evidence:c[5]});
    toast(write('flags',flags) ? 'Flag saved in this browser’s preview queue.' : 'Browser storage is unavailable; the flag could not be saved.');
  }, 'Save preview flag');
}

// Candidate evidence and local review state.
const dossier = $('[data-dossier]');
const dossierOriginal = dossier?.innerHTML;
function showDossier(index) {
  const record = records[index]; if (!record || !dossier) return;
  if (activeDossier === index && dossierOpen) { dossierOpen = false; dossier.hidden = true; return; }
  activeDossier = index; dossierOpen = true;
  record.row.insertAdjacentElement('afterend',dossier);
  dossier.hidden = false;
  dossier.innerHTML = dossierOriginal;
  if (index !== 0) {
    const endpoint = record.cells.find(cell => /\/v1\/|\/internal\//.test(cell)) || record.cells[1];
    const details = document.createElement('td'); details.colSpan = 7;
    details.innerHTML = `<div class="ig-detail-list"><strong>Evidence dossier: ${escape(endpoint)}</strong><p>${escape(record.cells.join(' · '))}</p><p>Illustrative evidence only. Check runtime coverage, default-branch references, dynamic dispatch, and scheduled callers before retiring an endpoint.</p><label><input type="checkbox" aria-label="Confirm caller and telemetry coverage"> I reviewed callers and telemetry coverage</label><label><input type="checkbox" aria-label="Confirm scheduled callers"> I checked scheduled and dynamic callers</label><div><button class="ig-button ig-button-secondary" data-action="callers">View callers</button> <button class="ig-button" data-action="review">Mark reviewed</button></div></div>`;
    dossier.replaceChildren(details);
  }
  updateDossierButtons();
}
function updateDossierButtons() {
  $$('[data-action=evidence]').forEach(button => { const expanded = Number(button.dataset.row) === activeDossier && dossierOpen; button.setAttribute('aria-expanded',String(expanded)); button.setAttribute('aria-label', expanded ? 'Collapse row details' : 'Expand row details'); });
}
function restoreReview() {
  if (!dossier || !read('reviewed',{})[activeDossier]) return;
  $$('input[type=checkbox]',dossier).forEach(box => box.checked = true);
  const button = $('[data-action=review]',dossier);
  if (button) { button.textContent = 'Reviewed in preview'; button.disabled = true; }
}
function markReviewed() {
  if (!dossier || dossier.hidden) { toast('Open a candidate’s evidence before marking it reviewed.'); return; }
  if (!$$('input[type=checkbox]',dossier).every(box => box.checked)) { toast('Complete both evidence checks before marking this preview reviewed.'); return; }
  const reviewed = read('reviewed',{}); reviewed[activeDossier] = true;
  if (!write('reviewed',reviewed)) { toast('Browser storage is unavailable; review state could not be saved.'); return; }
  const button = $('[data-action=review]',dossier); button.textContent = 'Reviewed in preview'; button.disabled = true;
  records[activeDossier].row.dataset.reviewed = 'true'; toast('Review saved in this browser. No endpoint has been deprecated.');
}
if (page === 'deprecation-candidates') {
  const flags = read('flags',[]);
  if (Array.isArray(flags) && flags.length) {
    const section = document.createElement('section'); section.className = 'ig-detail-list';
    section.innerHTML = `<h2>Flagged in this browser</h2><p>Preview review queue · no backend changes</p>${flags.filter(flag => flag && typeof flag.path === 'string').map(flag => `<div><strong>${escape(flag.method)} ${escape(flag.path)}</strong><p>${escape(flag.service)} · ${escape(flag.callers)} sample callers · ${escape(flag.evidence)} evidence</p><a href="/dashboard/api-usage?endpoint=${encodeURIComponent(flag.path)}">Inspect endpoint →</a></div>`).join('')}`;
    $('.ig-main').append(section);
  }
  updateDossierButtons();
  restoreReview();
}

// Graph coordinates are preserved from Stitch. One world transform moves nodes and edges together.
const canvas = $('[data-graph-canvas]');
const graphWorld = $('.ig-graph-world');
const graphNodes = $$('[data-node]');
const graphEdges = graphWorld ? $$('svg > path',graphWorld) : [];
const nodeData = [
  {name:'mobile-bff',evidence:'Runtime',relationship:'Uses',endpoints:4,callers:0,criticality:'Medium'},
  {name:'billing-service',evidence:'Static',relationship:'Impacted by change',endpoints:6,callers:1,criticality:'High'},
  {name:'booking-service',evidence:'Static',relationship:'Uses',endpoints:8,callers:6,criticality:'High'},
  {name:'user-service',evidence:'Both',relationship:'Target',endpoints:12,callers:8,criticality:'High'},
  {name:'trainer-service',evidence:'Both',relationship:'Depends on',endpoints:5,callers:5,criticality:'Medium'},
  {name:'oauth-service',evidence:'Runtime',relationship:'Depends on',endpoints:3,callers:2,criticality:'High'},
  {name:'search-service',evidence:'Static',relationship:'Depends on',endpoints:4,callers:4,criticality:'Medium'},
  {name:'recommendation-service',evidence:'Static',relationship:'External / Third party',endpoints:2,callers:0,criticality:'Low'},
];
const originalInspector = $('[data-inspector]')?.innerHTML;
let graphSelection = 3;
let zoom = 1;
let pan = {x:0,y:0};
function fitGraph() {
  if (!canvas) return;
  const scale = Math.min(canvas.clientWidth/850,(canvas.clientHeight-65)/600) * zoom;
  graphWorld.style.transform = `translate(${(canvas.clientWidth-850*scale)/2+pan.x}px,${Math.max(15,(canvas.clientHeight-600*scale)/2-20)+pan.y}px) scale(${scale})`;
}
function selectNode(index) {
  graphSelection = index;
  graphNodes.forEach((node,i) => node.setAttribute('aria-pressed',String(i === index)));
  const data = nodeData[index], inspector = $('[data-inspector]');
  if (index !== 3) {
    inspector.innerHTML = `<div class="ig-detail-list"><p>Selected sample service</p><h2>${escape(data.name)}</h2><div><strong>Repository</strong><p>${escape(data.name)}</p></div><div><strong>${data.endpoints} cataloged endpoints</strong><p>${data.callers} known sample callers</p></div><div><strong>${escape(data.evidence)} evidence</strong><p>${escape(data.relationship)} · ${escape(data.criticality)} criticality</p></div><p>Illustrative graph data. Confirm repository and telemetry coverage before assessing impact.</p><a class="ig-button ig-button-secondary" href="/dashboard/api-usage">View API Usage</a></div>`;
    return;
  }
  inspector.innerHTML = originalInspector;
  $('h2',inspector).textContent = data.name;
  const paragraphs = $$('div',inspector);
  const repo = paragraphs.find(el => el.children.length === 0 && clean(el).startsWith('repo:'));
  if (repo) repo.textContent = `repo: ${data.name}`;
  const labels = {Endpoints:`${data.endpoints} cataloged`,'Downstream Callers':`${data.callers} known`,'Evidence Type':`${data.evidence} · sample`,'Last Seen Runtime':data.evidence === 'Static' ? 'Not connected' : 'Sample observation'};
  for (const span of $$('span',inspector)) if (labels[clean(span)]) { const next = span.nextElementSibling; if (next) next.textContent = labels[clean(span)]; }
  const badge = $$('span',inspector).find(span => /^(CRITICAL|HIGH|MEDIUM|LOW)$/.test(clean(span))); if (badge) badge.textContent = data.criticality.toUpperCase();
  // Findings in the export apply only to the selected user-service sample.
  const findingsHeading = paragraphs.find(el => /^(Open Findings|Recent Findings|Impacted Callers)/i.test(clean(el)) && el.children.length === 0);
  if (findingsHeading && index !== 3) findingsHeading.parentElement.hidden = true;
  if (index === 3 && findingsHeading) findingsHeading.parentElement.hidden = false;
}
function filterGraph() {
  if (!canvas) return;
  const query = ($('[data-search]')?.value || '').trim().toLowerCase();
  const selects = $$('main select');
  const service = selects[0]?.selectedIndex ? selects[0].value : '';
  const evidence = selects[1]?.selectedIndex ? ['','Static','Runtime','Both'][selects[1].selectedIndex] : '';
  const relationship = selects[2]?.selectedIndex ? selects[2].value : '';
  const visible = nodeData.map(data => (!query || data.name.includes(query)) && (!service || data.name === service) && (!evidence || data.evidence === evidence) && (!relationship || data.relationship === relationship));
  graphNodes.forEach((node,i) => { node.hidden = !visible[i]; });
  const ends = [[0,3],[1,3],[2,3],[3,4],[3,5],[3,6],[7,3]];
  graphEdges.forEach((edge,i) => edge.style.display = visible[ends[i][0]] && visible[ends[i][1]] ? '' : 'none');
  const count = visible.filter(Boolean).length;
  $('[data-graph-count]').textContent = `${count} sample services · ${ends.filter(([a,b]) => visible[a] && visible[b]).length} relationships`;
  if (count && !visible[graphSelection]) selectNode(visible.indexOf(true));
  $('[data-inspector]').hidden = count === 0;
}
if (canvas) {
  let drag;
  canvas.addEventListener('pointerdown',event => {
    if (event.target.closest('button,[data-node]')) return;
    drag = {x:event.clientX,y:event.clientY,origin:{...pan}};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event => {
    if (!drag) return;
    pan = {x:drag.origin.x+event.clientX-drag.x,y:drag.origin.y+event.clientY-drag.y}; fitGraph();
  });
  canvas.addEventListener('pointerup',() => { drag = null; });
  canvas.addEventListener('pointercancel',() => { drag = null; });
  graphNodes.forEach((node,i) => { node.addEventListener('click',() => selectNode(i)); node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(i); } }); });
  $$('main select').forEach(select => select.addEventListener('change',filterGraph));
  new ResizeObserver(fitGraph).observe(canvas);
  selectNode(3); fitGraph();
}

// Repository import is a reviewable local preview, with no pretend indexing job.
const drawer = $('[data-drawer]');
function availableImports() { return drawer ? $$('label',drawer).filter(label => $('input[type=checkbox]',label) && !/select all/i.test(clean(label))) : []; }
function updateImportCount() {
  if (!drawer) return;
  const labels = availableImports();
  const selectedCount = labels.filter(label => $('input',label).checked).length;
  const button = $('[data-action=review-import]',drawer);
  if (button) { button.textContent = `Review services (${selectedCount})`; button.disabled = selectedCount === 0; }
  const all = $$('input[type=checkbox]',drawer)[0];
  if (all && labels.length) { all.checked = labels.every(label => $('input',label).checked); all.indeterminate = selectedCount > 0 && selectedCount < labels.length; }
  const footer = drawer.lastElementChild.firstElementChild;
  if (footer) { footer.firstElementChild.textContent = `${selectedCount} repositories selected`; footer.lastElementChild.textContent = `${labels.length} sample repositories`; }
}
function reviewImport() {
  const labels = availableImports().filter(label => $('input',label).checked);
  if (!labels.length) return;
  const repos = labels.map(label => clean($('.font-mono',label)) || clean(label).split(' ')[0]);
  modal('Review service mapping', `<p>${repos.length} repositories selected. Confirm the service name for each repository.</p>${repos.map((name,i) => `<label>${escape(name)}<input name="service-${i}" value="${escape(name)}" required maxlength="80"></label>`).join('')}<p>This preview saves your selection locally. Static analysis and database sync need a connected backend.</p>`, data => {
    const imports = repos.map((repo,i) => ({repo,service:String(data.get(`service-${i}`)).trim(),status:'Selected for import'}));
    if (imports.some(item => !item.service)) return false;
    const saved = write('imports',imports); closeOverlays(); previousFocus = $('main [data-action=import]'); renderImportSelection(); toast(saved ? 'Repository selection saved locally. Analysis has not started.' : 'Browser storage is unavailable; the selection could not be saved.');
  },'Save preview selection');
}
function renderImportSelection() {
  if (page !== 'repositories') return;
  $('.ig-import-summary')?.remove();
  const imports = read('imports',[]); if (!Array.isArray(imports) || !imports.length) return;
  const section = document.createElement('section'); section.className = 'ig-import-summary';
  section.innerHTML = `<h2>Selected for import</h2><p>Saved in this browser · awaiting backend connection</p><div class="ig-detail-list">${imports.filter(item => item && typeof item.repo === 'string').map(item => `<div><strong>${escape(item.repo)}</strong><p>Service: ${escape(item.service)} · ${escape(item.status)}</p></div>`).join('')}</div>`;
  $('.ig-main').append(section);
}
if (drawer) {
  drawer.addEventListener('change',event => {
    const boxes = $$('input[type=checkbox]',drawer);
    if (event.target === boxes[0]) for (const label of availableImports().filter(label => !label.hidden)) $('input',label).checked = event.target.checked;
    updateImportCount();
  });
  $('[data-drawer-search]',drawer).addEventListener('input',event => { const query = event.target.value.toLowerCase(); availableImports().forEach(label => label.hidden = !clean(label).toLowerCase().includes(query)); });
  renderImportSelection();
  if (new URLSearchParams(location.search).get('import') === '1') openDrawer();
}

// Local settings are explicit about which integrations are still disconnected.
let preferences = read('preferences',{model:false,retention:'90',criticality:'Service ownership',notifications:'GitHub PR comments'});
if (!preferences || typeof preferences !== 'object') preferences = {};
if (page === 'settings') $('main input[type=checkbox]').checked = Boolean(preferences.model);
function editSetting(button) {
  const name = button.dataset.setting || 'Workspace preference';
  if (/Repository Sync/i.test(name)) { location.href = '/dashboard/repositories'; return; }
  if (/Workspace Access/i.test(name)) { modal('Workspace access','<p>This demo has one illustrative owner. Members and roles become available when account authentication is connected.</p>'); return; }
  const key = /Retention/i.test(name) ? 'retention' : /Criticality/i.test(name) ? 'criticality' : 'notifications';
  const choices = key === 'retention' ? [['30','30 days'],['90','90 days'],['180','180 days']] : key === 'criticality' ? [['Service ownership','Service ownership'],['Consumer count','Consumer count'],['Manual review','Manual review']] : [['GitHub PR comments','GitHub PR comments'],['Disabled','Disabled in preview']];
  modal(name, `<p>Choose a preference for this browser’s preview workspace.</p><label>${escape(name)}<select name="value">${choices.map(([value,label]) => `<option value="${escape(value)}" ${preferences[key] === value ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label>`, data => { preferences[key] = data.get('value'); toast('Preference updated. Use Save preferences to store it locally.'); });
}
function exportGraph() {
  const data = nodeData.map((node,i) => ({...node,visible:!graphNodes[i].hidden}));
  const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([JSON.stringify({illustrative:true,services:data},null,2)],{type:'application/json'}));
  link.href = url; link.download = 'impact-gate-sample-graph.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
document.addEventListener('click',event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  switch (button.dataset.action) {
    case 'theme': {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('impact-gate-theme',theme); } catch { /* Apply the theme even without storage. */ }
      $('[data-action=theme] .material-symbols-outlined').textContent = theme === 'dark' ? 'dark_mode' : 'light_mode'; break;
    }
    case 'menu': {
      if (document.body.dataset.navOpen === 'true') { closeOverlays(); break; }
      previousFocus = button; document.body.dataset.navOpen = 'true'; button.setAttribute('aria-expanded','true'); $('.ig-backdrop').hidden = false; document.body.style.overflow = 'hidden'; $('.ig-sidebar a').focus(); break;
    }
    case 'notifications': modal('Notifications','<p>This illustrative workspace has 6 sample findings. Live alerts will appear after GitHub and analysis data are connected.</p><a class="ig-button ig-button-secondary" href="/review-desk">Open illustrative finding</a>'); break;
    case 'close-overlays': case 'close-drawer': closeOverlays(); break;
    case 'import': openDrawer(); break;
    case 'review-import': reviewImport(); break;
    case 'tab': showTab(button.dataset.tab); break;
    case 'flag': flagEndpoint(); break;
    case 'graph': location.href = '/dashboard/dependency-graph'; break;
    case 'api-usage': location.href = '/dashboard/api-usage'; break;
    case 'findings': location.href = '/review-desk'; break;
    case 'callers': {
      if (page === 'deprecation-candidates') { const record = records[activeDossier]; const endpoint = record.cells.find(cell => /\/v1\/|\/internal\//.test(cell))?.match(/\/\S+/)?.[0]; location.href = `/dashboard/api-usage?endpoint=${encodeURIComponent(endpoint || '/v1/legacy/profile')}`; }
      else location.href = '/dashboard/api-usage'; break;
    }
    case 'review': markReviewed(); break;
    case 'review-selected': {
      const index = records.findIndex(record => $('input[type=checkbox]',record.row)?.checked && !record.row.hidden);
      if (index < 0) { toast('Select a candidate to review its evidence.'); break; }
      dossierOpen = false; showDossier(index); restoreReview(); dossier.scrollIntoView({block:'nearest'}); break;
    }
    case 'sort-candidates': {
      const tbody = $('.ig-table tbody');
      const descending = button.dataset.descending !== 'true'; button.dataset.descending = String(descending);
      [...records].sort((a,b) => (Number(a.cells[3].match(/\d+/)?.[0] || 0)-Number(b.cells[3].match(/\d+/)?.[0] || 0))*(descending ? -1 : 1)).forEach(record => tbody.append(record.row));
      records[activeDossier].row.insertAdjacentElement('afterend',dossier);
      button.textContent = descending ? 'Sort: Most callers' : 'Sort: Fewest callers'; break;
    }
    case 'evidence': showDossier(Number(button.dataset.row)); restoreReview(); break;
    case 'candidate-filter': candidateFilter = button.dataset.status.startsWith('all') ? '' : button.dataset.status.replace(/\s*·.*/,''); $$('[data-action=candidate-filter]').forEach(el => el.setAttribute('aria-pressed',String(el === button))); applyFilters(); break;
    case 'clear-filters': clearFilters(); break;
    case 'reset': clearFilters(); if (canvas) { $$('main select').forEach(el => el.selectedIndex = 0); zoom=1; pan={x:0,y:0}; filterGraph(); fitGraph(); } break;
    case 'fit': zoom=1; pan={x:0,y:0}; fitGraph(); break;
    case 'zoom-in': zoom=Math.min(2.5,zoom+.2); fitGraph(); break;
    case 'zoom-out': zoom=Math.max(.5,zoom-.2); fitGraph(); break;
    case 'fullscreen': if (document.fullscreenElement) document.exitFullscreen(); else canvas.parentElement.requestFullscreen().catch(() => toast('Fullscreen is unavailable in this browser.')); break;
    case 'export': exportGraph(); break;
    case 'reload': toast('Sample repository states refreshed. Live sync is not connected.'); break;
    case 'repo-filter': {
      const statuses = ['', 'Indexed','Indexing','Failed','Pending']; repoFilter = statuses[(statuses.indexOf(repoFilter)+1)%statuses.length]; button.textContent = `Status: ${repoFilter || 'All'}`; applyFilters(); break;
    }
    case 'branch-info': modal('Tracked branch','<p>All sample repositories track main. Branch configuration will be available after the backend is connected.</p>'); break;
    case 'repo-menu': modal('Repository access','<p>This demo installation contains sample repositories. Manage installation permissions in a connected workspace.</p><a class="ig-button ig-button-secondary" href="/dashboard/settings">Open settings</a>'); break;
    case 'repo-details': { const record = records.find(item => item.row.contains(button)); modal('Repository details',`<p>${escape(record.cells.join(' · '))}</p><p>Illustrative repository state. Live sync, retry, and removal become available with the backend connection.</p>`); break; }
    case 'save-preferences': preferences.model = $('main input[type=checkbox]').checked; toast(write('preferences',preferences) ? 'Preview preferences saved in this browser.' : 'Browser storage is unavailable; preferences could not be saved.'); break;
    case 'edit-setting': editSetting(button); break;
    case 'installation': modal('GitHub App installation','<p>This is an illustrative installation for demo-org. Live installation management becomes available when account authentication and the GitHub App connection are configured.</p>'); break;
    case 'runtime': modal('Connect runtime evidence','<p>No runtime source is connected to this workspace. Gateway logs and distributed traces will supply observed caller activity once the integration is configured.</p><p>Static references alone cannot establish runtime usage.</p>'); break;
  }
});
applyFilters();
