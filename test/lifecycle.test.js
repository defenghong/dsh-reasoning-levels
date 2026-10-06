import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../index.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  let ready; const cleanups = []; let edits = 0; const errors = [];
  const cleanup = () => { for (const dispose of cleanups.splice(0)) dispose?.(); };
  const entry = { options: { name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers: { 'cctq-plus': { api: 'openai-completions', models: [{ id: 'gpt-6.1-sol' }] } } } } };
  const ctx = {
    root: { loader: { await: () => new Promise(resolve => { ready = resolve; }) } },
    effect(fn) { cleanups.push(fn()); },
    configEditor: { entries: () => [entry], async edit(row, change) { edits++; row.options.config = change(row.options.config); } },
    logger: { info() {}, error(error) { errors.push(error); } },
  };
  return { ctx, entry, errors, ready: () => ready(), dispose: () => cleanup(), edits: () => edits };
}
test('waits for loader and skips disposed activation', async () => {
  const h = harness(); apply(h.ctx); assert.equal(h.edits(), 0);
  h.dispose(); h.ready(); await flush(); assert.equal(h.edits(), 0); assert.deepEqual(h.errors, []);
});
test('preserves changes made before native config edit', async () => {
  const h = harness(); apply(h.ctx);
  h.entry.options.config.providers['cctq-plus'].models[0].maxTokens = 128000;
  h.ready(); await flush(); assert.equal(h.edits(), 1);
  assert.equal(h.entry.options.config.providers['cctq-plus'].models[0].maxTokens, 128000);
  assert.equal(h.entry.options.config.providers['cctq-plus'].models[0].reasoningEfforts.high, 'high');
});
test('launcher readiness avoids waiting on loader tasks', async () => {
  const h = harness(); let callback; let cancelled = false;
  h.ctx.root.loader.await = () => { throw new Error('must not await loader when appReady exists'); };
  h.ctx.get = name => name === 'appReady' ? { onReady(fn) { callback = fn; return () => { cancelled = true; }; } } : undefined;
  const isolatedCleanups = []; h.ctx.effect = fn => { isolatedCleanups.push(fn()); };
  apply(h.ctx); assert.equal(h.edits(), 0); callback(); await flush(); assert.equal(h.edits(), 1);
  for (const cleanup of isolatedCleanups) cleanup(); assert.equal(cancelled, true);
});
test('new providers are adapted on volatile and profile reload signals', async () => {
  const h = harness(); const reloads = [];
  h.ctx.on = (event, fn) => { assert.ok(['loader/volatile-update','app-boot/config-reload'].includes(event)); reloads.push(fn); };
  apply(h.ctx); h.ready(); await flush();
  h.entry.options.config.providers.newSupplier = {api:'anthropic-messages',models:[{id:'claude-opus-5-5'}]};
  reloads[0](); reloads[1](); await flush();
  assert.deepEqual(h.entry.options.config.providers.newSupplier.models[0].reasoningEfforts,{low:'low',medium:'medium',high:'high'});
  assert.equal(h.edits(),2);
});
test('native catalog reasoning takes precedence over inferred rules', async () => {
  const h = harness(); h.ctx.get = name => name === 'llm' ? {resolveModelInfo:async()=>({reasoning:{efforts:[{id:'high'}]}})} : undefined;
  apply(h.ctx); h.ready(); await flush(); assert.equal(h.edits(),0);
});
test('protocol changed while discovery awaits is not overwritten', async () => {
  const h = harness();
  h.ctx.get = name => name === 'llm' ? {resolveModelInfo:async()=>{
    h.entry.options.config.providers['cctq-plus'].api='anthropic-messages';
    return {};
  }} : undefined;
  apply(h.ctx); h.ready(); await flush();
  assert.equal(h.entry.options.config.providers['cctq-plus'].models[0].reasoningEfforts,undefined);
});
test('volatile update rescans a model added after startup', async () => {
  const h = harness(); let volatile;
  h.ctx.on = (event, fn) => { if (event === 'loader/volatile-update') volatile = fn; };
  apply(h.ctx); h.ready(); await flush();
  h.entry.options.config.providers['cctq-plus'].models.push({id:'gpt-6-astra'});
  volatile(); await flush();
  assert.deepEqual(h.entry.options.config.providers['cctq-plus'].models.at(-1).reasoningEfforts,{low:'low',medium:'medium',high:'high',xhigh:'xhigh'});
});
test('automatic candidates can be disabled', async () => {
  const h = harness(); apply(h.ctx,{autoDetect:false}); h.ready(); await flush(); assert.equal(h.edits(),0);
});
test('missing adapter entry is reported rather than silently ignored', async () => {
  const h = harness(); h.ctx.configEditor.entries = () => []; apply(h.ctx); h.ready(); await flush();
  assert.equal(h.edits(), 0); assert.equal(h.errors.length, 1); assert.match(h.errors[0].message, /entry not found/);
});
