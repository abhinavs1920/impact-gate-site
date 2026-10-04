import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const contactEmails = JSON.parse(await fs.readFile(path.join(root, 'src/data/contact-emails.json'), 'utf8'));
const iconPaths = JSON.parse(await fs.readFile(path.join(root, 'src/ui/icon-paths.json'), 'utf8'));
const icon = name => `<svg class="ig-ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`;
export const pages = [
  ['01-dashboard', '', 'Home'],
  ['02-api-usage', 'api-usage', 'API Usage'],
  ['03-dependency-graph', 'dependency-graph', 'Dependency Graph'],
  ['04-deprecation', 'deprecation-candidates', 'Deprecation Candidates'],
  ['05-repositories', 'repositories', 'Repositories'],
  ['06-settings', 'settings', 'Settings'],
];
export const accountPages = [
  ['sign-in', 'sign-in', 'Sign in'],
  ['sign-up', 'sign-up', 'Create account'],
  ['auth/email-link', 'email-link', 'Complete sign-in'],
  ['onboarding', 'onboarding', 'Connect workspace'],
  ['onboarding/github', 'github-setup', 'Connect GitHub'],
  ['github/setup', 'github-setup', 'Connect GitHub'],
];
const text = node => node?.textContent.replace(/\s+/g, ' ').trim() || '';
const action = (node, value) => { if (node) node.dataset.action = value; };
function annotate(document, slug) {
  const main = document.querySelector('main');
  main.classList.add('ig-main');
  for (const input of main.querySelectorAll('input[type="text"]')) {
    input.setAttribute('aria-label', input.getAttribute('placeholder'));
    input.dataset.search = '';
  }
  for (const button of main.querySelectorAll('button')) {
    const label = text(button).replace(/^(\w+_?\w*)\s+(?=[A-Z])/,'');
    const original = text(button);
    button.type = 'button';
    if (/Flag for deprecation/i.test(original)) action(button, 'flag');
    if (/Dependency Graph/.test(original)) action(button, 'graph');
    if (/View callers/.test(original)) action(button, 'callers');
    if (/View API Usage/.test(original)) action(button, 'api-usage');
    if (/Review findings/.test(original)) action(button, 'findings');
    if (/Review selected/.test(original)) action(button, 'review-selected');
    if (/Sort:/.test(original)) action(button, 'sort-candidates');
    if (/Re-sync permissions/.test(original)) action(button, 'installation');
    if (/Branch:/.test(original)) action(button, 'branch-info');
    if (original === 'more_vert') { action(button, 'repo-menu'); button.setAttribute('aria-label','Repository access options'); }
    if (/Mark reviewed/.test(original)) action(button, 'review');
    if (/Save preferences/.test(original)) action(button, 'save-preferences');
    if (/Import repositories/.test(original)) action(button, 'import');
    if (/Fit view/.test(original)) action(button, 'fit');
    if (/Reset/.test(original)) action(button, 'reset');
    if (/Clear filters/.test(original)) action(button, 'clear-filters');
    if (/Export/.test(original)) action(button, 'export');
    if (/Manage installation/.test(original)) action(button, 'installation');
    if (/Connect source/.test(original)) action(button, 'runtime');
    if (/Configure|^Edit$|^Manage$/.test(original)) {
      action(button, 'edit-setting');
      button.dataset.setting = text(button.closest('.p-6')?.querySelector('.font-semibold')) || label;
    }
    if (/Toggle theme/i.test(button.title)) action(button, 'theme');
    if (button.title === 'Reload repository states') action(button, 'reload');
    if (button.title === 'Zoom in') action(button, 'zoom-in');
    if (button.title === 'Zoom out') action(button, 'zoom-out');
    if (button.title === 'Reset View') action(button, 'fit');
    if (button.title === 'Fullscreen') action(button, 'fullscreen');
  }
  for (const link of main.querySelectorAll('a[href]')) {
    if (/github\.com\/example/.test(link.getAttribute('href')) || link.getAttribute('href') === '#') {
      link.href = '/review-desk';
      link.removeAttribute('target');
      link.setAttribute('aria-label', `${text(link)} — illustrative finding`);
    }
  }
  const table = main.querySelector('table');
  if (table) {
    table.classList.add('ig-table');
    const rows = [...table.querySelectorAll('tbody > tr')].filter(row => row.children.length > 1);
    rows.forEach((row, i) => {
      row.dataset.row = i;
      row.dataset.record = JSON.stringify([...row.children].map(text));
      for (const checkbox of row.querySelectorAll('input[type="checkbox"]')) checkbox.setAttribute('aria-label', `Select ${text(row.children[1])}`);
      if (slug === 'api-usage') {
        row.tabIndex = 0;
        row.setAttribute('role','button');
        row.setAttribute('aria-label', `Inspect ${text(row.children[0])} ${text(row.children[1])}`);
      }
      if (slug === 'deprecation-candidates') {
        const button = row.querySelector('button');
        action(button, 'evidence');
        if (button) button.dataset.row = i;
      }
      for (const button of row.querySelectorAll('button:not([data-action])')) {
        action(button, 'repo-details');
        button.setAttribute('aria-label', `Repository details: ${text(row.children[1])}`);
      }
    });
    const all = table.querySelector('thead input[type="checkbox"]');
    if (all) { all.dataset.selectAll = ''; all.setAttribute('aria-label','Select all visible rows'); }
    const empty = document.createElement('div');
    empty.className = 'ig-empty'; empty.hidden = true; empty.textContent = 'No sample records match your filters.';
    table.parentElement.append(empty);
  }
  if (slug === 'api-usage') {
    const panel = main.querySelector('section');
    panel.dataset.endpointPanel = '';
    const tabs = [...panel.querySelectorAll('button')].filter(button => /^(Overview|Callers|Change History)/.test(text(button)));
    tabs[0].parentElement.setAttribute('role','tablist');
    tabs.forEach((button,i) => { action(button,'tab'); button.dataset.tab = ['overview','callers','history'][i]; button.setAttribute('role','tab'); button.setAttribute('aria-selected', String(i === 0)); });
    panel.lastElementChild.dataset.tabContent = '';
    for (const button of main.querySelectorAll('button')) {
      const value = text(button);
      const match = value.match(/^(Service|Method|Criticality|Activity):/);
      if (match) {
        const select = document.createElement('select');
        select.className = `${button.className} ig-filter`;
        select.dataset.filter = match[1].toLowerCase();
        select.setAttribute('aria-label', `Filter by ${match[1].toLowerCase()}`);
        const records = [...table.querySelectorAll('[data-record]')].map(row => JSON.parse(row.dataset.record));
        const col = {Service:2,Method:0,Criticality:6}[match[1]];
        const options = col === undefined ? ['All activity','No recent callers','Never observed in sample'] : [`All ${match[1].toLowerCase()}${match[1] === 'Criticality' ? '' : 's'}`, ...new Set(records.map(row => row[col]))];
        options.forEach((option,i) => { const el = document.createElement('option'); el.value = i ? option : ''; el.textContent = option; select.append(el); });
        button.replaceWith(select);
      }
    }
    for (const element of main.querySelectorAll('span')) if (text(element) === 'Page 1 of 35') element.textContent = 'Sample page · 10 endpoints';
    // Catalog totals are illustrative; only ten sample records are available.
    const pager = table.parentElement.nextElementSibling;
    for (const button of pager?.querySelectorAll('button') || []) { button.disabled = true; button.title = 'All available sample endpoints are shown'; }
  }
  if (slug === 'deprecation-candidates') {
    const dossier = main.querySelector('td[colspan]')?.parentElement;
    if (dossier) dossier.dataset.dossier = '';
    const chips = [...main.querySelectorAll('button')].filter(button => /^(All \d|All candidates|Strong candidate|Rare caller|Building confidence)/.test(text(button)));
    chips.forEach(button => { action(button,'candidate-filter'); button.dataset.status = text(button).replace(/\s+\d+$/,'').replace(/\s*[·—-]\s*verify/,'').toLowerCase(); button.setAttribute('aria-pressed', String(button === chips[0])); });
    // Pagination on a sample must never imply there are hidden live records.
    for (const button of main.querySelectorAll('button')) if (/^(Previous|Next|[123])$/.test(text(button))) { button.disabled = true; button.title = 'All five sample candidates are shown'; }
  }
  if (slug === 'dependency-graph') {
    const canvas = main.querySelector('.blueprint-grid');
    canvas.dataset.graphCanvas = '';
    const nodes = canvas.lastElementChild;
    const svg = canvas.querySelector('svg');
    const world = document.createElement('div'); world.className = 'ig-graph-world';
    world.append(svg, nodes); canvas.append(world);
    nodes.classList.add('ig-graph-nodes');
    [...nodes.children].forEach((node,i) => {
      node.dataset.node = i;
      node.tabIndex = 0; node.setAttribute('role','button');
      node.setAttribute('aria-label', `Inspect ${text(node.querySelector('.font-code'))}`);
    });
    const inspector = canvas.nextElementSibling;
    inspector.classList.add('ig-inspector'); inspector.dataset.inspector = '';
    canvas.parentElement.classList.add('ig-graph-layout');
    const count = [...main.querySelectorAll('span')].find(el => text(el).startsWith('Showing 8 services'));
    if (count) { count.dataset.graphCount = ''; count.innerHTML = '8 sample services · 7 relationships'; }
    for (const node of main.querySelectorAll('[data-node]')) node.setAttribute('aria-label',`Inspect ${['mobile-bff','billing-service','booking-service','user-service','trainer-service','oauth-service','search-service','recommendation-service'][Number(node.dataset.node)]}`);
  }
  if (slug === 'repositories') {
    const drawer = [...document.querySelectorAll('aside')].at(-1);
    drawer.classList.add('ig-import-drawer'); drawer.dataset.drawer = ''; drawer.hidden = true;
    drawer.setAttribute('aria-label','Import repositories'); drawer.setAttribute('role','dialog'); drawer.setAttribute('aria-modal','true');
    for (const button of drawer.querySelectorAll('button')) {
      if (button.title === 'Close Drawer' || /Cancel/.test(text(button))) { action(button,'close-drawer'); button.setAttribute('aria-label','Close import drawer'); }
      if (/Review|Import|Analyze/i.test(text(button))) action(button,'review-import');
    }
    for (const checkbox of drawer.querySelectorAll('input[type="checkbox"]')) checkbox.setAttribute('aria-label', text(checkbox.closest('label')) || 'Select all available repositories');
    drawer.querySelector('input[type="text"]').setAttribute('aria-label','Filter available repositories');
    drawer.querySelector('input[type="text"]').dataset.drawerSearch = '';
    for (const span of drawer.querySelectorAll('span')) {
      if (text(span) === 'Select all (12 available)') span.textContent = 'Select all sample repositories';
      if (text(span) === 'Showing 5 of 12') span.textContent = '5 sample repositories';
    }
    for (const button of main.querySelectorAll('button')) {
      if (/Status:/.test(text(button))) { action(button,'repo-filter'); button.dataset.filter = 'status'; }
      if (/Language:/.test(text(button))) { action(button,'repo-filter'); button.dataset.filter = 'language'; }
    }
  }
  if (slug === 'settings') {
    main.querySelector('input[type="checkbox"]').setAttribute('aria-label','Model-assisted analysis');
    main.querySelector('select').setAttribute('aria-label','Analysis mode');
  }
  return main;
}

// Generate equivalent dark colors for the exported utility rules using homepage tokens.
function darkUtilities(css) {
  const mappings = {
    background: {'ffffff':'161f2c','f8f9fb':'101722','f8f9fc':'101722','f8fafd':'101722','fafbfc':'1d2939','fcfdfe':'1d2939','f2f4f6':'1d2939','f1f3f6':'1d2939','f1f5f9':'1d2939','edeef0':'253448','eef1f4':'253448','dfe0ff':'2b3152'},
    color: {'191c1e':'e8edf4','0d1e38':'e8edf4','535f6f':'aab6c5','475569':'aab6c5','8896a6':'aab6c5','2b3ac4':'adb5ff','0419af':'c1c7ff'},
    border: {'e0e4ea':'344154','e2e5eb':'344154','c6c5d7':'64748a','a6aeba':'64748a'},
  };
  const overrides = postcss.root();
  postcss.parse(css).walkRules(rule => {
    if (rule.parent.type !== 'root' || /:root|^\*|^::|^html|^body/.test(rule.selector)) return;
    const clone = postcss.rule({selector: rule.selector.split(',').map(selector => `html[data-theme="dark"] ${selector.trim()}`).join(',')});
    rule.walkDecls(decl => {
      const kind = decl.prop.includes('background') ? 'background' : decl.prop.includes('border-color') ? 'border' : decl.prop === 'color' ? 'color' : '';
      if (!kind) return;
      let value = decl.value;
      for (const [hex,replacement] of Object.entries(mappings[kind])) {
        const rgb = hex.match(/../g).map(c => parseInt(c,16)).join(' ');
        const next = replacement.match(/../g).map(c => parseInt(c,16)).join(' ');
        value = value.replaceAll(`#${hex}`, `#${replacement}`).replaceAll(rgb, next);
      }
      if (value !== decl.value) clone.append(decl.clone({value}));
    });
    if (clone.nodes.length) overrides.append(clone);
  });
  return overrides.toString();
}
export async function buildDashboard(outDir = path.join(root,'dist')) {
  const assetDir = path.join(outDir,'assets');
  await fs.mkdir(assetDir,{recursive:true});
  const sharedCSS = await fs.readFile(path.join(root,'src/dashboard/workspace.css'),'utf8');
  const bundled = await build({entryPoints:[path.join(root,'src/dashboard/connected.ts')],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,write:false,outfile:'workspace.js'});
  const client = bundled.outputFiles.find(file => file.path.endsWith('.js')).text;
  const clientCSS = bundled.outputFiles.find(file => file.path.endsWith('.css'))?.text || '';
  const hash = value => createHash('sha256').update(value).digest('hex').slice(0,10);
  const clientName = `workspace-${hash(client)}.js`;
  await fs.writeFile(path.join(assetDir,clientName),client);
  const connectedCSSName = `workspace-connected-${hash(clientCSS)}.css`;
  await fs.writeFile(path.join(assetDir,connectedCSSName),`${sharedCSS}\n${clientCSS}`);
  const sourceHome = await fs.readFile(path.join(root,'src/dashboard/designs/01-dashboard.html'),'utf8');
  const home = parseHTML(sourceHome).document;
  const sidebar = home.querySelector('aside');
  sidebar.classList.add('ig-sidebar'); sidebar.id = 'workspace-nav';
  sidebar.querySelector('nav').setAttribute('aria-label','Workspace navigation');
  sidebar.querySelector('nav').insertAdjacentHTML('beforeend', `<a href="/dashboard/dependency-graph#function-usage">${icon('code')}<span>Function usage</span></a>`);
  sidebar.querySelector('nav').insertAdjacentHTML('beforeend', `<a href="/docs">${icon('book')}<span>Documentation</span></a>`);
  sidebar.firstElementChild.firstElementChild.outerHTML = `<a class="ig-brand" href="/" aria-label="Impact Gate homepage"><img src="/favicon.svg" width="32" height="32" alt=""/><strong>Impact Gate</strong></a>`;
  sidebar.insertAdjacentHTML('beforeend', `<div class="ig-sidebar-bottom"><span>Authenticated workspace</span><label class="ig-sidebar-workspaces" data-workspace-switcher hidden>Workspace<select class="ig-workspace-picker" data-workspace-picker aria-label="Choose workspace" hidden></select></label><a href="mailto:${contactEmails.support}">${icon('help')}Contact support</a><a href="/contact">Contact the team</a><button type="button" data-analytics-toggle>Usage analytics</button><a href="/">Back to website ↗</a></div>`);
  for (const [key,slug,title] of pages) {
    const source = await fs.readFile(path.join(root,`src/dashboard/designs/${key}.html`),'utf8');
    const {document} = parseHTML(source);
    const configScript = document.querySelector('#tailwind-config')?.textContent;
    const sandbox = {tailwind:{config:{}}};
    if (configScript) vm.runInNewContext(configScript,sandbox,{timeout:1000});
    const main = document.querySelector('main');
    main.classList.add('ig-main');
    main.innerHTML = '<div class="ig-state" role="status"><h1>Loading your workspace</h1><p>Checking your session and fetching authorized data.</p><span class="ig-load-icon" aria-hidden="true"></span></div>';
    const nav = parseHTML(`<body>${sidebar.outerHTML}</body>`).document.querySelector('aside');
    nav.querySelectorAll('nav a').forEach(link => {
      link.className = 'ig-nav-link';
      if (link.getAttribute('href') === `/dashboard${slug ? `/${slug}` : ''}`) { link.classList.add('is-active'); link.setAttribute('aria-current','page'); }
    });
  const body = `<a href="#workspace-content" class="ig-skip">Skip to content</a>${nav.outerHTML}<div class="ig-app"><header class="ig-topbar"><div class="ig-breadcrumb"><button type="button" class="ig-icon ig-menu" data-action="menu" aria-label="Open navigation" aria-controls="workspace-nav" aria-expanded="false">${icon('menu')}</button><span class="ig-breadcrumb-brand">Impact Gate <span>/</span></span><span class="ig-page-title" title="${title}">${title}</span><span class="ig-demo">Loading session</span></div><div class="ig-top-actions"><select class="ig-workspace-picker" data-workspace-picker aria-label="Choose workspace" hidden></select><button type="button" class="ig-button ig-button-secondary" data-action="add-workspace" hidden>Add GitHub account or organization</button><a class="ig-button ig-import-link" href="/dashboard/repositories?import=1">+ Import repositories</a><button type="button" class="ig-icon" data-action="theme" aria-label="Switch to dark theme" title="Switch theme">${icon('moon')}</button><button type="button" class="ig-icon" data-action="notifications" aria-label="Notifications" title="Recent activity">${icon('bell')}</button><a class="ig-profile" href="/dashboard/settings" aria-label="Account settings"><b>…</b><span>Account</span></a><button type="button" class="ig-button ig-button-secondary" data-action="sign-out">Sign out</button></div></header>${main.outerHTML.replace('<main','<main id="workspace-content" tabindex="-1"')}<footer class="ig-footer"><span>Authenticated workspace</span><nav aria-label="Workspace help"><a href="mailto:${contactEmails.support}">Support</a><a href="mailto:${contactEmails.privacy}">Privacy</a><a href="mailto:${contactEmails.security}">Security</a><span>Warn-only</span></nav></footer></div><div class="ig-backdrop" data-action="close-overlays" hidden></div><dialog class="ig-dialog" aria-labelledby="dialog-title"></dialog><div class="ig-toast" role="status" aria-live="polite" hidden></div>`;
    const config = {...sandbox.tailwind.config, content:[{raw:source + body,extension:'html'}],plugins:[forms,containerQueries]};
    const compiled = await postcss([tailwind(config)]).process('@tailwind base;\n@tailwind components;\n@tailwind utilities;',{from:undefined});
    const inlineStyles = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n');
    const css = `${compiled.css}\n${inlineStyles}\n${darkUtilities(compiled.css)}\n${sharedCSS}\n${clientCSS}`;
    const cssName = `workspace-${key}-${hash(css)}.css`;
    await fs.writeFile(path.join(assetDir,cssName),css);
    const themeInit = `(function(){try{var t=localStorage.getItem('impact-gate-theme')||'system';document.documentElement.dataset.theme=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches)?'dark':'light'}catch{}})()`;
    const html = `<!doctype html><html lang="en" data-page="${slug || 'home'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="description" content="Impact Gate ${title} workspace."><title>${title === 'Home' ? 'Engineering Overview' : title} | Impact Gate</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;family=Libre+Caslon+Text:wght@400;700&amp;display=swap"><link rel="stylesheet" href="/assets/${cssName}"><script>${themeInit}</script><script type="module" src="/assets/${clientName}"></script></head><body class="ig-workspace">${body}</body></html>`;
    const output = path.join(outDir,slug ? `dashboard/${slug}.html` : 'dashboard.html');
    await fs.mkdir(path.dirname(output),{recursive:true});
    await fs.writeFile(output,html);
  }
  for (const [pathname,page,title] of accountPages) {
    const themeInit = `(function(){try{var t=localStorage.getItem('impact-gate-theme')||'system';document.documentElement.dataset.theme=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches)?'dark':'light'}catch{}})()`;
    const setup = page === 'onboarding' || page === 'github-setup';
    const body = setup ? `<div class="ig-onboarding-shell"><a href="#workspace-content" class="ig-skip">Skip to content</a><header class="ig-topbar ig-onboarding-topbar"><a class="ig-onboarding-brand" href="/" aria-label="Impact Gate home"><img src="/favicon.svg" width="32" height="32" alt=""><strong>Impact Gate</strong></a><div class="ig-actions"><button type="button" class="ig-icon" data-action="theme" aria-label="Switch to dark theme">${icon('moon')}</button><a href="/dashboard" class="ig-button ig-button-secondary">Dashboard</a><button type="button" class="ig-button ig-button-secondary" data-action="sign-out">Sign out</button></div></header><main id="workspace-content" class="ig-main" tabindex="-1"></main><footer class="ig-footer"><span>Impact Gate workspace setup</span><a href="mailto:${contactEmails.pilot}">Pilot & onboarding help</a><button type="button" data-analytics-toggle>Usage analytics</button></footer></div><dialog class="ig-dialog" aria-labelledby="dialog-title"></dialog><div class="ig-toast" role="status" aria-live="polite" hidden></div>` : '<div id="auth-root"></div>';
    const html = `<!doctype html><html lang="en" data-page="${page}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${title} | Impact Gate</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Libre+Caslon+Text:wght@400;700&display=swap"><link rel="stylesheet" href="/assets/${connectedCSSName}"><script>${themeInit}</script><script type="module" src="/assets/${clientName}"></script></head><body class="ig-workspace">${body}</body></html>`;
    const output = path.join(outDir,`${pathname}.html`); await fs.mkdir(path.dirname(output),{recursive:true}); await fs.writeFile(output,html);
  }
  console.log(`Built ${pages.length} Stitch workspace pages with local CSS and JavaScript.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildDashboard();
