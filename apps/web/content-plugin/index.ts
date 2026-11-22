import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { compileContent } from './compile';

/** Vite plugin: compiles content/ into `virtual:fretsense-content` (precached JSON, FR-045). */
export function fretsenseContent(contentDir = resolve(import.meta.dirname, '../../../content')): Plugin {
  const id = 'virtual:fretsense-content';
  const resolved = '\0' + id;
  return {
    name: 'fretsense-content',
    resolveId: (source) => (source === id ? resolved : undefined),
    load(loadId) {
      if (loadId !== resolved) return undefined;
      this.addWatchFile(contentDir);
      return `export default ${JSON.stringify(compileContent(contentDir))};`;
    },
    handleHotUpdate(ctx) {
      if (ctx.file.replace(/\\/g, '/').includes('/content/')) {
        const mod = ctx.server.moduleGraph.getModuleById(resolved);
        if (mod) {
          ctx.server.moduleGraph.invalidateModule(mod);
          ctx.server.ws.send({ type: 'full-reload' });
        }
      }
    },
  };
}
