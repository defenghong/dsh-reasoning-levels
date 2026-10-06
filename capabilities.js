export const TESTED_ROUTES = Object.freeze({
  'cctq-plus': Object.freeze({
    'gpt-6.1-sol': Object.freeze({ low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' }),
  }),
});

// Preserve all provider settings, credentials references and capacities. Explicit
// user declarations (including false) always win. No default effort is added.
export function validateRoutes(routes) {
  const levels = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
  if (!routes || typeof routes !== 'object' || Array.isArray(routes)) throw new TypeError('routes must be a provider/model mapping');
  for (const models of Object.values(routes)) {
    if (!models || typeof models !== 'object' || Array.isArray(models)) throw new TypeError('provider routes must map model ids');
    for (const efforts of Object.values(models)) {
      if (efforts === false) continue;
      if (!efforts || typeof efforts !== 'object' || Array.isArray(efforts) || !Object.keys(efforts).length) throw new TypeError('model efforts must be false or a nonempty mapping');
      for (const [level, wire] of Object.entries(efforts)) {
        if (!levels.has(level) || !(typeof wire === 'string' && wire.length > 0 || level === 'off' && wire === null)) throw new TypeError(`invalid effort mapping: ${level}`);
      }
      if (!Object.keys(efforts).some(level => level !== 'off')) throw new TypeError('model must declare a thinking level');
    }
  }
  return routes;
}

export function addCapabilities(raw, routes = TESTED_ROUTES) {
  validateRoutes(routes);
  if (!raw || typeof raw !== 'object' || !raw.providers) return raw;
  let providers;
  for (const [providerId, models] of Object.entries(routes)) {
    const provider = raw.providers[providerId];
    if (!provider || !['openai-completions', 'openai-responses', 'anthropic-messages'].includes(provider.api) || !Array.isArray(provider.models)) continue;
    let changed = false;
    const entries = provider.models.map(model => {
      const efforts = models[model.id];
      if (efforts === undefined || model.reasoningEfforts !== undefined) return model;
      changed = true;
      return { ...model, reasoningEfforts: efforts === false ? false : { ...efforts } };
    });
    if (!changed) continue;
    providers ??= { ...raw.providers };
    providers[providerId] = { ...provider, models: entries };
  }
  return providers ? { ...raw, providers } : raw;
}
