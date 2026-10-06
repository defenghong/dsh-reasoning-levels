import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateFor,discoverCapabilities,discoveredRoutes} from '../discovery.js';
test('rules ignore supplier names and support model prefixes',()=>{
 assert.ok(candidateFor('openai-completions','vendor/gpt-6.1-sol'));
 assert.ok(candidateFor('openai-responses','gpt-6-astra'));
 assert.ok(candidateFor('anthropic-messages','claude-opus-5-5'));
 assert.equal(candidateFor('anthropic-messages','gpt-6-sol'),undefined);
 assert.deepEqual(Object.keys(candidateFor('openai-completions','grok-4.7').efforts),['low','medium','high','xhigh']);
 assert.deepEqual(Object.keys(candidateFor('openai-responses','grok-4.5').efforts),['low','medium','high']);
 assert.equal(candidateFor('openai-completions','grok-4'),undefined);
 assert.equal(candidateFor('openai-completions','grok-4.20-multi-agent'),undefined);
 assert.equal(candidateFor('openai-completions','unknown'),undefined);
});
test('explicit capability and false override family rules',()=>{
 const raw={providers:{'any-supplier':{api:'openai-completions',models:[{id:'gpt-6-sol',reasoningEfforts:false},{id:'gpt-6-astra'},{id:'mystery'}]}}};
 const rows=discoverCapabilities(raw);
 assert.deepEqual(rows.map(r=>r.status),['declared-unavailable','rule-candidate','unknown']);
 assert.deepEqual(discoveredRoutes(raw),{});
 const routes=discoveredRoutes(raw,{enableCandidates:true});
 assert.deepEqual(Object.keys(routes['any-supplier']),['gpt-6-astra']);
});
