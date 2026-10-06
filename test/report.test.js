import test from 'node:test';
import assert from 'node:assert/strict';
import {capabilityReport} from '../report.js';
test('report excludes endpoints credentials and headers',()=>{
 const raw={providers:{example:{api:'openai-completions',baseURL:'SECRET_ENDPOINT',headers:{Authorization:'SECRET_TOKEN'},apiKeyEnv:'SECRET_REF',models:[{id:'gpt-6-sol'},{id:'grok-4.7'},{id:'m',reasoningEfforts:false}]}}};
 const report=capabilityReport(raw);
 assert.deepEqual(report.models.map(r=>r.status),['rule-candidate','rule-candidate','declared-unavailable']);
 assert.ok(!JSON.stringify(report).includes('SECRET'));
 assert.match(report.warning,/not upstream-verified/);
});
