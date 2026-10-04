import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

const result = await build({ entryPoints: ['src/dashboard/code-flow.ts'], bundle: true, platform: 'browser', format: 'esm', write: false,
  plugins: [{ name: 'graph-fixture', setup(builder) {
    builder.onResolve({ filter: /^cytoscape$/ }, () => ({ path: 'graph', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export default options => { globalThis.codeGraphOptions = options; return {on(){},destroy(){}}; }` }));
  } }],
});
const { renderCodeFlow, renderFunctionInventory, mountCodeFlow } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const source = { repositoryId: 'repo', filePath: 'src/handler.ts', line: 12, sha: 'a'.repeat(40), url: 'https://github.com/org/api/blob/aaaa/src/handler.ts#L12' };
const endpoint = { id: 'orders', serviceId: 'service', method: 'GET', path: '/orders', runtimeCallsInWindow: 120, runtimeRequestSource: 'prometheus' };
const fn = (id, extra = {}) => ({ id, name: id, qualifiedName: id, serviceId: 'service', kind: 'function', source, attributedRequestsInWindow: 120, countsPartial: false,
  attributions: [{ endpointId: 'orders', requestsInWindow: 120, source: 'prometheus', windowStart: '2026-10-01T00:00:00Z', windowEnd: '2026-10-02T00:00:00Z' }], ...extra });
const snapshot = { endpoints: [endpoint], services: [{ id: 'service', name: 'Order service' }], code: {
  version: 1, functions: [fn('handler'), fn('shared'), fn('unused', { attributedRequestsInWindow: null, countsPartial: true, attributions: [] })],
  calls: [{ id: 'helper', callerFunctionId: 'handler', calleeFunctionId: 'shared', targetName: 'shared', resolution: 'resolved', kind: 'call', conditional: true, repeated: false, source },
    { id: 'dynamic', callerFunctionId: 'shared', calleeFunctionId: null, targetName: '<unknown>', resolution: 'unresolved', kind: 'call', conditional: false, repeated: false, source }],
  flows: [{ endpointId: 'orders', entryFunctionIds: ['handler'], functionIds: ['handler', 'shared'], callIds: ['helper', 'dynamic'], callerFunctionIds: [], outboundCalls: [], status: 'partial', notes: ['Dynamic dispatch remains unresolved.'] }], missingRepositoryIds: [],
} };
let document = parseHTML(`<html><body>${renderCodeFlow(snapshot, endpoint)}</body></html>`).document;
assert.match(document.body.textContent, /2 reachable functions/);
assert.match(document.body.textContent, /120 API requests/);
assert.match(document.body.textContent, /measured function invocations/);
assert.match(document.body.textContent, /unresolved boundary/);
assert.equal(document.querySelector('[data-code-flow]').dataset.codeFlow, 'orders');
assert.equal(document.querySelectorAll('a[href*="blob/"]').length, 4);
globalThis.document = document;
mountCodeFlow(snapshot, document.querySelector('[data-code-flow]'), document.querySelector('[data-code-inspector]'));
assert.equal(globalThis.codeGraphOptions.elements[0].data.label, 'GET /orders');
assert.ok(globalThis.codeGraphOptions.elements.some(element => element.data.id === 'boundary:dynamic'));
assert.ok(globalThis.codeGraphOptions.elements.some(element => element.data.id === 'helper' && element.data.conditional === 'yes'));
document = parseHTML(`<html><body>${renderFunctionInventory(snapshot)}</body></html>`).document;
assert.equal(document.querySelector('#function-usage').getAttribute('aria-labelledby'),'function-usage-title');
assert.equal(document.querySelectorAll('tbody tr').length, 3);
assert.match(document.querySelector('tbody tr:last-child').textContent, /Unknown/);
assert.equal(parseHTML(renderFunctionInventory(snapshot, 'shared')).document.querySelectorAll('tbody tr').length, 1);
const malicious = structuredClone(snapshot);
malicious.code.functions[0].qualifiedName = '<img src=x onerror=alert(1)>';
malicious.code.functions[0].source.url = 'javascript:alert(1)';
document = parseHTML(renderCodeFlow(malicious, endpoint)).document;
assert.equal(document.querySelector('img'), null);
assert.equal(document.querySelector('a[href^="javascript:"]'), null);
assert.match(renderCodeFlow({ ...snapshot, code: undefined }, endpoint), /reindex/i);
const many = structuredClone(snapshot); many.code.functions = Array.from({length:201}, (_, index) => fn(`f${index}`));
document = parseHTML(renderFunctionInventory(many, '', 2)).document;
assert.equal(document.querySelectorAll('tbody tr').length, 1);
assert.match(document.querySelector('.ig-card').textContent, /201–201 of 201/);
delete globalThis.document;
delete globalThis.codeGraphOptions;
console.log('Code flow graph, function request attribution, unknown usage, source links, and escaped code evidence passed.');
