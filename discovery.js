// Provider keys and endpoints are deliberately absent: rules describe model
// families, not this installation. These are protocol candidates, not proof
// that a gateway honours the parameter. Existing model declarations win.
const OPENAI_APIS = new Set(['openai-completions', 'openai-responses']);
export function candidateFor(api, modelId) {
  if (typeof modelId !== 'string') return undefined;
  const id = modelId.toLowerCase().split('/').at(-1);
  if (OPENAI_APIS.has(api) && /^gpt-(?:5|6)(?:[.\-]|$)/.test(id)) {
    return { family: 'openai-gpt', status: 'rule-candidate', efforts: {low:'low',medium:'medium',high:'high',xhigh:'xhigh'} };
  }
  if (api === 'anthropic-messages' && /^claude-(?:opus|sonnet)-(?:4[.-][5-9]|[5-9])(?:[.-]|$)/.test(id)) {
    return { family: 'anthropic-claude', status: 'rule-candidate', efforts: {low:'low',medium:'medium',high:'high'} };
  }
  // Exact versions documented by xAI; do not generalize to every Grok.
  // https://docs.x.ai/developers/model-capabilities/text/reasoning
  if (OPENAI_APIS.has(api) && /^grok-4\.[567](?:-latest)?$/.test(id)) {
    const efforts = {low:'low',medium:'medium',high:'high'};
    if (id.startsWith('grok-4.6') || id.startsWith('grok-4.7')) efforts.xhigh = 'xhigh';
    return {family:'xai-grok',status:'rule-candidate',efforts};
  }
  return undefined;
}
export function discoverCapabilities(raw) {
  const rows = [];
  for (const [provider, route] of Object.entries(raw?.providers ?? {})) {
    for (const model of route.models ?? []) {
      const explicit = model.reasoningEfforts;
      const candidate = explicit === undefined ? candidateFor(route.api, model.id) : undefined;
      rows.push({provider, model:model.id, api:route.api,
        status:explicit !== undefined ? (explicit === false ? 'declared-unavailable' : 'declared') : candidate?.status ?? 'unknown',
        ...(explicit !== undefined ? {efforts:explicit} : candidate ? {family:candidate.family,efforts:candidate.efforts} : {}),
      });
    }
  }
  return rows;
}
export function discoveredRoutes(raw, {enableCandidates = false} = {}) {
  const routes = {};
  if (!enableCandidates) return routes;
  for (const row of discoverCapabilities(raw)) {
    if (row.status !== 'rule-candidate') continue;
    (routes[row.provider] ??= {})[row.model] = row.efforts;
  }
  return routes;
}
