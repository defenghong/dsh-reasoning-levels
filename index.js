import { addCapabilities, validateRoutes } from './capabilities.js';
import { discoveredRoutes } from './discovery.js';
import { readFile } from 'node:fs/promises';
import { capabilityReport } from './report.js';

export const name = 'dsh-reasoning';
export const inject = ['configEditor'];

export function apply(ctx, config = {}) {
  let disposed = false;
  ctx.effect(() => () => { disposed = true; });
  const migrate = async () => {
    if (disposed) return;
    const overrides = config.routesFile ? validateRoutes(JSON.parse(await readFile(config.routesFile, 'utf8'))) : {};
    if (disposed) return;
    const entry = ctx.configEditor.entries().find(row => row.options.name === '@deepseek-ai/dsh-llm-pi-ai');
    if (!entry) throw new Error('reasoning-levels: llm-pi-ai configuration entry not found');
    if (config.logReport === true) ctx.logger.info('reasoning-levels capability report: %s', JSON.stringify(capabilityReport(entry.options.config)));
    const protocols = Object.fromEntries(Object.entries(entry.options.config.providers ?? {}).map(([id, route]) => [id, route.api]));
    const automatic = discoveredRoutes(entry.options.config, { enableCandidates: config.autoDetect !== false });
    // Native catalog capabilities take precedence over inferred family rules.
    const llm = ctx.get?.('llm');
    if (llm?.resolveModelInfo) {
      for (const [provider, models] of Object.entries(automatic)) {
        for (const model of Object.keys(models)) {
          try {
            const info = await llm.resolveModelInfo(provider, model);
            if (info?.reasoning?.efforts?.length) delete models[model];
          } catch { /* Unknown route: leave candidate to normal Config validation. */ }
        }
      }
    }
    if (disposed) return;
    const routes = { ...automatic };
    for (const [provider, models] of Object.entries(overrides)) routes[provider] = { ...routes[provider], ...models };
    if (addCapabilities(entry.options.config, routes) === entry.options.config) return;
    await ctx.configEditor.edit(entry, current => {
      // Recheck protocol and model presence under the editor lock; discoveries
      // made before awaiting metadata must not overwrite concurrent user edits.
      const guarded = {};
      for (const [provider, models] of Object.entries(routes)) {
        if (current.providers?.[provider]?.api !== protocols[provider]) continue;
        guarded[provider] = models;
      }
      return addCapabilities(current, guarded);
    });
    if (!disposed) ctx.logger.info('reasoning-levels: applied configured model capabilities; provider defaults and explicit declarations preserved');
  };
  let running = false;
  let queued = false;
  const start = () => {
    if (disposed) return;
    queued = true;
    if (running) return;
    running = true;
    (async () => {
      while (queued && !disposed) {
        queued = false;
        try { await migrate(); } catch (error) { if (!disposed) ctx.logger.error(error); }
      }
    })().finally(() => { running = false; });
  };
  if (ctx.on) {
    // A model/provider settings edit may only refresh the volatile llm row;
    // a profile patch reload emits the app-level signal. Handle both official
    // events; queued/idempotent migration prevents duplicate writes.
    ctx.on('loader/volatile-update', start);
    ctx.on('app-boot/config-reload', start);
  }
  // Some remote model editors update the effective config without emitting a
  // profile event. A lightweight unref'd poll closes that gap; migrate() is
  // still idempotent and writes only when a new candidate is present.
  const pollMs = Number.isFinite(config.pollMs) && config.pollMs > 0 ? config.pollMs : 1000;
  ctx.effect(() => {
    const timer = setInterval(start, pollMs);
    timer.unref?.();
    return () => clearInterval(timer);
  });
  // Loader.await() can include long-lived startup tasks. The launcher-owned
  // ready signal commits after Host setup and also fires immediately on HMR.
  const ready = ctx.get?.('appReady');
  if (ready) ctx.effect(() => ready.onReady(start));
  else ctx.root.loader.await().then(start).catch(error => { if (!disposed) ctx.logger.error(error); });
}
