import { discoverCapabilities } from './discovery.js';

// Pure diagnostic output: no credentials, headers, endpoints, or network I/O.
export function capabilityReport(raw) {
  return {
    version: 1,
    warning: 'Declared means configured, not upstream-verified. Rule candidates may be ignored or rejected by gateways.',
    models: discoverCapabilities(raw).map(({provider,model,api,status,family,efforts}) => ({
      provider, model, api, status, ...(family ? {family} : {}),
      levels: efforts === false ? [] : Object.keys(efforts ?? {}),
    })),
  };
}
