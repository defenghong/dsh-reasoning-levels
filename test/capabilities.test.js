import test from 'node:test';
import assert from 'node:assert/strict';
import { addCapabilities, validateRoutes } from '../capabilities.js';

function config(model = {}) {
  return { providers: {
    'cctq-plus': { api: 'openai-completions', baseURL: 'https://www.cctq.ai/v1', apiKeyEnv: 'CCTQ_PLUS_API_KEY', models: [{ id: 'gpt-6.1-sol', contextWindow: 1000000, maxTokens: 128000, ...model }, { id: 'other' }] },
    untouched: { api: 'anthropic-messages', models: [{ id: 'gpt-6.1-sol' }] },
  } };
}
test('only tested route is augmented, without mutating input', () => {
  const input = config(); const before = structuredClone(input); const output = addCapabilities(input);
  assert.deepEqual(input, before);
  assert.deepEqual(output.providers['cctq-plus'].models[0].reasoningEfforts, {low:'low',medium:'medium',high:'high',xhigh:'xhigh'});
  assert.equal(output.providers.untouched, input.providers.untouched);
  assert.equal(output.providers['cctq-plus'].models[1], input.providers['cctq-plus'].models[1]);
  assert.equal(output.providers['cctq-plus'].apiKeyEnv, 'CCTQ_PLUS_API_KEY');
  assert.equal(output.providers['cctq-plus'].models[0].maxTokens, 128000);
  assert.equal(output.providers['cctq-plus'].reasoning, undefined);
});
test('explicit declarations and disabled reasoning are preserved', () => {
  for (const reasoningEfforts of [false, { high:'custom' }]) {
    const input = config({reasoningEfforts}); assert.equal(addCapabilities(input), input);
  }
});
test('custom provider maps support native OpenAI and Anthropic protocols', () => {
  for (const api of ['openai-completions', 'openai-responses', 'anthropic-messages']) {
    const raw = {providers:{custom:{api,models:[{id:'custom-model'}]}}};
    const out = addCapabilities(raw,{custom:{'custom-model':{low:'low',high:'high'}}});
    assert.deepEqual(out.providers.custom.models[0].reasoningEfforts,{low:'low',high:'high'});
    assert.equal(raw.providers.custom.models[0].reasoningEfforts,undefined);
  }
});
test('explicit nonreasoning model and invalid mappings', () => {
  const raw={providers:{custom:{api:'openai-completions',models:[{id:'m'}]}}};
  assert.equal(addCapabilities(raw,{custom:{m:false}}).providers.custom.models[0].reasoningEfforts,false);
  for (const routes of [{custom:{m:{}}},{custom:{m:{ultra:'ultra'}}},{custom:{m:{high:null}}},{custom:{m:{off:null}}}]) assert.throws(()=>validateRoutes(routes));
});
test('idempotent and ignores absent or unsupported routes', () => {
  const output = addCapabilities(config()); assert.equal(addCapabilities(output), output);
  for (const raw of [undefined, {}, {providers:{}}, {providers:{'cctq-plus':{api:'unsupported-protocol',models:[{id:'gpt-6.1-sol'}]}}}]) assert.equal(addCapabilities(raw), raw);
});
