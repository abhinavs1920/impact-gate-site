import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

const directory = await mkdtemp(path.join(tmpdir(), 'impact-gate-site-tests-'));
const originalFetch = globalThis.fetch;
const delay = () => new Promise(resolve => setTimeout(resolve, 5));
try {
  const outfile = path.join(directory, 'api.mjs');
  await build({ entryPoints: ['src/dashboard/api.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
  const { WorkspaceApi, WorkspaceApiError } = await import(outfile);
  const refreshes = [];
  const identity = { currentUser: { uid: 'user-1' }, getIdToken: async refresh => { refreshes.push(refresh); return refresh ? 'fresh-token' : 'old-token'; } };
  const api = new WorkspaceApi(identity);
  let calls = 0;
  globalThis.fetch = async (_url, request) => {
    calls++;
    assert.equal(request.credentials, 'same-origin');
    assert.equal(request.headers.Authorization, calls === 1 ? 'Bearer old-token' : 'Bearer fresh-token');
    return calls === 1 ? Response.json({ error: { code: 'expired', message: 'Expired token.' } }, { status: 401 }) : Response.json({ version: 1 });
  };
  assert.deepEqual(await api.request('/api/v1/session'), { version: 1 });
  assert.deepEqual(refreshes, [false, true]);
  calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: { code: 'forbidden', message: 'No membership.' } }, { status: 403 }); };
  await assert.rejects(api.request('/api/v1/session'), error => error instanceof WorkspaceApiError && error.status === 403 && error.code === 'forbidden');
  assert.equal(calls, 1);
  calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: { code: 'expired', message: 'Expired.' } }, { status: 401 }); };
  await assert.rejects(api.request('/api/v1/session'), error => error.status === 401);
  assert.equal(calls, 2, '401 refresh stops after one retry');
  let release;
  globalThis.fetch = async () => new Promise(resolve => { release = resolve; });
  const stale = api.request('/api/v1/session'); await delay(); api.cancel(); release(Response.json({ version: 1 }));
  await assert.rejects(stale, error => error.name === 'AbortError');
  const changed = api.request('/api/v1/session'); await delay(); identity.currentUser = { uid: 'user-2' }; release(Response.json({ secret: 'user-1 data' }));
  await assert.rejects(changed, error => error.name === 'AbortError');

  const workerFile = path.join(directory, 'worker.mjs');
  await build({ entryPoints: ['src/worker.ts'], bundle: true, platform: 'node', format: 'esm', outfile: workerFile });
  const { proxyWorkspaceApi } = await import(workerFile);
  const env = { IMPACT_GATE_API_ORIGIN: 'https://api.impactgate.in', IMPACT_GATE_PROXY_SECRET: 'server-only' };
  globalThis.fetch = async (destination, request) => {
    assert.equal(new URL(destination).origin, 'https://api.impactgate.in');
    assert.equal(request.redirect, 'manual');
    assert.equal(request.headers.get('Authorization'), 'Bearer user-token');
    assert.equal(request.headers.get('X-Impact-Gate-Proxy-Secret'), 'server-only');
    assert.equal(request.headers.has('Cookie'), false);
    return Response.json({ workspaces: [] });
  };
  let response = await proxyWorkspaceApi(new Request('https://impactgate.in/api/v1/session?upstream=https://evil.example', { headers: { Authorization: 'Bearer user-token', Cookie: 'other=private' } }), env);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  response = await proxyWorkspaceApi(new Request('https://impactgate.in/api/v1/session'), { IMPACT_GATE_API_ORIGIN: 'http://evil.example' });
  assert.equal(response.status, 503);
  globalThis.fetch = async (_destination, request) => {
    assert.equal(request.headers.get('Cookie'), 'impact_gate_oauth=nonce');
    return new Response(null, { status: 303, headers: { Location: 'https://impactgate.in/onboarding?githubSelection=flow', 'Set-Cookie': 'impact_gate_oauth=; Path=/api/v1/github; Max-Age=0; HttpOnly; Secure; SameSite=Lax' } });
  };
  response = await proxyWorkspaceApi(new Request('https://impactgate.in/api/v1/github/callback?code=test', { headers: { Cookie: 'other=private; impact_gate_oauth=nonce' } }), env);
  assert.equal(response.status, 303); assert.equal(response.headers.get('Location'), '/onboarding?githubSelection=flow');
  assert.match(response.headers.get('Set-Cookie'), /^impact_gate_oauth=/);
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example/collect' } });
  response = await proxyWorkspaceApi(new Request('https://impactgate.in/api/v1/github/callback'), env);
  assert.equal(response.status, 502);
  response = await proxyWorkspaceApi(new Request('https://impactgate.in/api/v1/workspaces/one/settings', { method: 'PATCH', headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(response.status, 403);

  const mockAuth = `export class ImpactGateAuthClient { config; currentUser={uid:'u1',email:'user@example.com',providerData:[]}; ready=Promise.resolve(this.currentUser); constructor(config){this.config=config} subscribe(fn){fn({status:'signed-in',user:this.currentUser});return ()=>{}} getIdToken(){return Promise.resolve('mock-token')} isEnabled(){return true} dispose(){} signOut(){this.currentUser=null;return Promise.resolve()} } export const parseAuthConfig=x=>x; export const mountAuthPage=()=>()=>{}; export const safeReturnPath=x=>x||'/dashboard'; export const signInDestination=x=>'/sign-in?next='+encodeURIComponent(x);`;
  const result = await build({ entryPoints: ['src/dashboard/connected.ts'], bundle: true, platform: 'browser', format: 'iife', write: false, outfile: 'connected.js', plugins: [{ name: 'browser-auth-fixture', setup(b) { b.onResolve({ filter: /^\.\.\/auth$/ }, () => ({ path: 'auth', namespace: 'fixture' })); b.onResolve({ filter: /^cytoscape$/ }, () => ({ path: 'graph', namespace: 'fixture' })); b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'auth' ? mockAuth : 'export default options => { globalThis.graphFixture = options; return {on(){},destroy(){},fit(){}} }' })); } }] });
  const script = result.outputFiles.find(file => file.path.endsWith('.js')).text;
  const source = JSON.parse(await readFile('tests/fixtures/workspace.json', 'utf8'));
  class DOMFormData {
    fields = new Map();
    constructor(form) { for (const input of form.querySelectorAll('input[name],select[name],textarea[name]')) { if (input.disabled || input.type === 'checkbox' && !(input.checked ?? input.hasAttribute('checked'))) continue; const values = this.fields.get(input.name) ?? []; values.push(input.value || (input.type === 'checkbox' ? 'on' : '')); this.fields.set(input.name, values); } }
    get(name) { return this.fields.get(name)?.[0] ?? null; }
    getAll(name) { return this.fields.get(name) ?? []; }
    has(name) { return this.fields.has(name); }
  }
  class DOMForm { static [Symbol.hasInstance](node) { return node?.tagName === 'FORM'; } }
  for (const screen of ['home', 'home-empty', 'api-usage', 'dependency-graph', 'deprecation-candidates', 'repositories', 'settings', 'onboarding']) {
    const { document, window } = parseHTML(`<html data-page="${screen === 'home-empty' ? 'home' : screen}"><body><main id="workspace-content"></main><dialog class="ig-dialog"></dialog><div class="ig-toast" hidden></div></body></html>`);
    const timerIds = new Set();
    const requested = [];
    const serverSnapshot = structuredClone(source);
    if (screen === 'api-usage' || screen === 'dependency-graph') {
      const endpoint = serverSnapshot.endpoints[0];
      const fn = id => ({ id, serviceId:endpoint.serviceId, name:id, qualifiedName:id, kind:'function', source:endpoint.source, attributedRequestsInWindow:120, countsPartial:false, attributions:[{endpointId:endpoint.id,requestsInWindow:120,source:'prometheus',windowStart:'2026-10-01T00:00:00Z',windowEnd:'2026-10-02T00:00:00Z'}] });
      endpoint.runtimeCallsInWindow = 120; endpoint.runtimeRequestSource = 'prometheus';
      serverSnapshot.code = {version:1,functions:[fn('handler'),fn('normalize')],calls:[{id:'call',callerFunctionId:'handler',calleeFunctionId:'normalize',targetName:'normalize',resolution:'resolved',kind:'call',conditional:false,repeated:false,source:endpoint.source}],flows:[{endpointId:endpoint.id,entryFunctionIds:['handler'],callerFunctionIds:[],functionIds:['handler','normalize'],callIds:['call'],outboundCalls:[],status:'indexed',notes:[]}],missingRepositoryIds:[],partial:false,notes:[]};
    }
    if (screen === 'home') {
      serverSnapshot.jobs = [{id:'queued-analysis',repositoryId:'r1',type:'analyze_pull_request',status:'queued',phase:'static_analysis_queue',progress:0,error:null,createdAt:source.generatedAt,updatedAt:source.generatedAt}];
      serverSnapshot.endpoints = [0, 1, 2, 4, 5].map((count, index) => ({...source.endpoints[0],id:`e${index + 1}`,path:`/customer/v1/orders/${index + 1}`,staticCallerCount:count}));
      serverSnapshot.findings = Array.from({length:8}, (_, index) => ({
        id:`f${index + 1}`,analysisId:'analysis-1',repositoryId:'r1',pullRequestNumber:100+index,pullRequestUrl:`https://github.com/impact-gate/customer-api/pull/${100+index}`,headSha:'abc123',endpointId:'e1',endpoint:source.endpoints[0].path,consumerServiceId:null,consumerName:'customer-app',changeKind:'response_field_removed',verdict:'breaking',risk:['high','medium','low','none'][index%4],evidence:[source.endpoints[0].source],explanation:`Finding ${index + 1}`,createdAt:`2026-09-30T00:00:0${index}.000Z`,status:index === 7 ? 'closed' : 'open',
      }));
      serverSnapshot.candidates = ['strong_candidate','rare_caller','building_confidence','flagged'].map((status, index) => ({...source.candidates[0],endpointId:`e${index + 1}`,status}));
    }
    if (screen === 'home-empty') {
      for (const key of ['repositories','services','endpoints','edges','findings','candidates']) serverSnapshot[key] = [];
    }
    const runtimeWrites = [];
    let rejectRuntimeSave = true;
    const dialog = document.querySelector('.ig-dialog');
    Object.defineProperty(dialog, 'open', {get: () => dialog.hasAttribute('open')});
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {dialog.removeAttribute('open');dialog.dispatchEvent(new window.Event('close'));};
    let rejectSave = true;
    const saves = [];
    const context = { window, document, navigator: { userAgent: 'Node', doNotTrack: null }, MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } }, location: { href: `https://impactgate.in/${screen === 'onboarding' ? screen : 'dashboard'}`, origin: 'https://impactgate.in', pathname: '/dashboard', search: '', assign: () => {}, replace: () => {} }, history: { replaceState: () => {} }, sessionStorage: { getItem: () => null, setItem: () => {} }, localStorage: { setItem: () => {} }, URL, URLSearchParams, Blob, Response, Request, Headers, AbortController, DOMException, HTMLInputElement: window.HTMLInputElement, HTMLSelectElement: window.HTMLSelectElement, HTMLFormElement: DOMForm, HTMLButtonElement: window.HTMLButtonElement, HTMLElement: window.HTMLElement, Element: window.Element, FormData: DOMFormData, console,
      setTimeout: (fn, ms) => { const id = setTimeout(fn, ms); timerIds.add(id); return id; }, clearTimeout,
      fetch: async (endpoint, request = {}) => { requested.push(endpoint); if (endpoint === '/api/v1/config') return Response.json({ firebase: {}, github: { configured: true } }); assert.equal(request.headers.Authorization, 'Bearer mock-token'); if (endpoint === '/api/v1/session') return Response.json({ version: 1, user: { uid: 'u1', email: 'user@example.com', emailVerified: true }, workspaces: [{ id: 'w1', name: 'Customer workspace', role: 'owner', accountLogin: 'impact-gate', installationStatus: 'active' }], capabilities: { externalModels: false, runtimeTelemetry: true } }); if (endpoint.endsWith('/repositories/available')) return Response.json({ repositories: [] }); if (endpoint.endsWith('/settings') && request.method === 'PATCH') { const change = JSON.parse(request.body); saves.push(change); return rejectSave ? Response.json({ error: { code: 'conflict', message: 'Settings changed. Refresh before saving.' } }, { status: 409 }) : Response.json({ ...source.settings, ...change, version: 2 }); } if (endpoint.includes('/runtime/')) {
          if (request.method === 'POST' && endpoint.endsWith('/test')) return Response.json({observationCount:1,matchedEndpointCount:1,unmatchedObservationCount:0,warnings:[]});
          if (request.method === 'POST' && endpoint.endsWith('/discover')) return Response.json({provider:'prometheus',services:[{sourceService:'customer-prod',roles:['provider'],routeCount:1,suggestedServiceId:'s1',confidence:'high',reason:'Matched API routes.',candidates:[{serviceId:'s1',matchedRouteCount:1}]}],observationCount:1,autoMatchedCount:1,suggestedCount:0,unmatchedCount:0,windowStart:source.generatedAt,windowEnd:source.generatedAt,partial:false,warnings:[]});
          if (request.method === 'PUT') {
            const body=JSON.parse(request.body);runtimeWrites.push(body);
            if(rejectRuntimeSave) return Response.json({error:{code:'source_unauthorized',message:'Source credentials rejected.'}},{status:502});
            const connection={provider:'prometheus',config:body.config,status:'connected',lastSyncedAt:new Date().toISOString(),lastAttemptAt:new Date().toISOString(),error:null,observationCount:1,matchedEndpointCount:1,unmatchedObservationCount:0,windowStart:new Date(Date.now()-86400000).toISOString(),windowEnd:new Date().toISOString(),partial:false,warnings:[]};
            serverSnapshot.runtimeConnections=[connection];return Response.json({connection});
          }
          if(request.method === 'DELETE') {serverSnapshot.runtimeConnections=[];return Response.json({disconnected:true});}
          return Response.json({connection:serverSnapshot.runtimeConnections?.[0]});
        }
        return Response.json(serverSnapshot); },
    };
    vm.runInNewContext(script, context); await delay(); await delay();
    const content = document.querySelector('main').textContent;
    assert.ok(requested.includes('/api/v1/workspaces/w1/snapshot'), `${screen} loads actual workspace snapshot`);
    assert.doesNotMatch(content, /Demo workspace|sample records|billing-service|mobile-bff/);
    if (screen.startsWith('home')) {
      assert.equal(document.querySelector('h1').textContent, 'Engineering Overview');
      assert.equal(document.querySelectorAll('.ig-overview-metric').length, 5, 'Stitch summary cards remain visible');
      assert.equal(document.querySelectorAll('.ig-overview-panel').length, 3, 'Stitch analytics panels remain visible');
      assert.equal(document.querySelector('.ig-job'), null, 'job queues do not replace the dashboard overview');
      assert.doesNotMatch(content, /Analysis jobs|static_analysis_queue/);
      assert.equal(document.querySelectorAll('#recent-findings th').length, screen === 'home' ? 5 : 0);
    }
    if (screen === 'home') {
      assert.deepEqual([...document.querySelectorAll('.ig-overview-value')].map(node => node.textContent), ['1','1','5','7','4']);
      assert.deepEqual([...document.querySelectorAll('.ig-overview-ring-label strong')].map(node => node.textContent), ['7','4']);
      assert.deepEqual([...document.querySelectorAll('.ig-overview-panel:first-child .ig-overview-legend strong')].map(node => node.textContent), ['2','2','2','1']);
      assert.deepEqual([...document.querySelectorAll('.ig-overview-bar-item strong')].map(node => node.textContent), ['2','1','1','1']);
      assert.match(content, /runtime usage unknown/);
      assert.equal(document.querySelectorAll('#recent-findings tbody tr').length, 5);
      assert.equal(document.querySelector('[data-action=finding]').dataset.id, 'f7', 'recent findings sort newest first');
      document.querySelector('[data-action=toggle-findings]').click();
      assert.equal(document.querySelectorAll('#recent-findings tbody tr').length, 7);
      document.querySelector('[data-action=toggle-findings]').click();
      assert.equal(document.querySelectorAll('#recent-findings tbody tr').length, 5);
      const severity = document.querySelector('[data-filter]');
      severity.querySelector('[value=high]').selected = true;
      severity.dispatchEvent(new window.Event('change', {bubbles:true}));
      assert.equal(document.querySelectorAll('#recent-findings tbody tr').length, 2);
      assert.match(document.querySelector('.ig-overview-findings-count').textContent, /2 of 2 matching/);
      document.querySelector('[data-action=clear-filters]').click();
      assert.equal(document.querySelectorAll('#recent-findings tbody tr').length, 5);
      document.querySelector('[data-action=finding]').click();
      assert.equal(dialog.open, true);
      assert.match(dialog.textContent, /Finding 7/);
      document.querySelector('[data-action=close-dialog]').click();
    }
    if (screen === 'home-empty') {
      assert.deepEqual([...document.querySelectorAll('.ig-overview-value')].map(node => node.textContent), ['0','0','0','0','0']);
      assert.deepEqual([...document.querySelectorAll('.ig-overview-ring-label strong')].map(node => node.textContent), ['0','0']);
      assert.equal(document.querySelectorAll('.ig-overview-ring circle[stroke-dasharray]').length, 0);
      assert.match(content, /No open findings/);
      assert.equal(document.querySelector('#recent-findings .ig-button').getAttribute('href'), '/dashboard/repositories?import=1');
      assert.doesNotMatch(document.querySelector('.ig-overview').innerHTML, /NaN|Infinity/);
    }
    if (screen === 'api-usage') {
      assert.match(content, /\/customer\/v1\/orders/);
      document.querySelector('[data-action="endpoint-tab"][data-tab="flow"]').click(); await delay();
      assert.match(document.querySelector('main').textContent, /2 reachable functions/);
      assert.match(document.querySelector('main').textContent, /normalize/);
      assert.equal(context.graphFixture.elements[0].data.label, 'GET /customer/v1/orders');
    }
    if (screen === 'repositories') assert.match(content, /impact-gate\/customer-api/);
    if (screen === 'settings') assert.match(content, /Save preferences/);
    if (screen === 'dependency-graph') assert.equal(context.graphFixture.elements[0].data.label, 'customer-service');
    if (screen === 'settings') {
      const form = document.querySelector('[data-settings-form]'); form.reportValidity = () => true;
      form.querySelector('[name=retentionDays]').value = '14';
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await delay(); await delay();
      assert.equal(saves.length, 1); assert.equal(saves[0].version, 1);
      assert.match(document.querySelector('[data-save-status]').textContent, /Settings changed/);
      assert.doesNotMatch(document.querySelector('.ig-toast').textContent, /preferences saved/);
      rejectSave = false;
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await delay(); await delay();
      assert.equal(saves.length, 2); assert.equal(saves[1].version, 1, 'failed writes do not advance the saved settings version');
      assert.equal(document.querySelector('[name=retentionDays]').value, '14');
      assert.equal(document.querySelector('.ig-toast').textContent, 'Workspace preferences saved.');
      const click = element => element.dispatchEvent(new window.Event('click', {bubbles:true}));
      click(document.querySelector('[data-action=runtime-connect][data-provider=prometheus]'));
      const connectionForm = document.querySelector('[data-runtime-form]');
      connectionForm.reportValidity = () => true;
      connectionForm.querySelector('[name=baseUrl]').value = 'https://metrics.example.com';
      const authentication = connectionForm.querySelector('[name=authentication]');
      try { authentication.value = 'bearer'; } catch { Object.defineProperty(authentication, 'value', { value: 'bearer', writable: true, configurable: true }); }
      authentication.dispatchEvent(new window.Event('change', { bubbles: true }));
      connectionForm.querySelector('[name=bearerToken]').value = 'browser-entered-secret';
      connectionForm.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await delay();await delay();
      assert.match(connectionForm.querySelector('[data-save-status]').textContent,/1 matches ready/);
      assert.equal(connectionForm.querySelector('[data-runtime-source="customer-prod"]').value,'s1');
      assert.equal(serverSnapshot.runtimeConnections,undefined,'discovery does not persist connection');
      connectionForm.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await delay();await delay();
      assert.match(connectionForm.querySelector('[data-save-status]').textContent,/Source credentials rejected/);
      assert.equal(dialog.open,true,'failed save preserves connection form');
      rejectRuntimeSave=false;
      connectionForm.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await delay();await delay();
      assert.equal(dialog.open,false);
      assert.match(document.querySelector('main').textContent,/1 endpoints with observed traffic/);
      assert.deepEqual(runtimeWrites[0].config.serviceMappings,{'customer-prod':'s1'});
      click(document.querySelector('[data-action=runtime-connect][data-provider=prometheus]'));
      const editForm=document.querySelector('[data-runtime-form]');editForm.reportValidity=()=>true;
      editForm.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await delay();await delay();
      assert.equal(runtimeWrites.at(-1).credentials,undefined,'empty edit fields retain saved credentials without fetching secrets');
      click(document.querySelector('[data-action=runtime-sync][data-provider=prometheus]'));await delay();await delay();
      assert.ok(requested.some(path=>path.endsWith('/prometheus/sync')));
      click(document.querySelector('[data-action=runtime-disconnect][data-provider=prometheus]'));
      click(document.querySelector('[data-action=confirm-runtime-disconnect]'));await delay();await delay();
      assert.match(document.querySelector('main').textContent,/Not connected/);
      assert.equal(serverSnapshot.runtimeConnections.length,0);
    }
    window.dispatchEvent(new window.Event('pagehide')); timerIds.forEach(clearTimeout);
  }
  console.log('Workspace API refresh/cancellation, proxy boundaries, authenticated screens, settings saves, and runtime test/connect/edit/sync/disconnect flow passed.');
} finally { globalThis.fetch = originalFetch; await rm(directory, { recursive: true, force: true }); }
