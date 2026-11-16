import { getViteConfig } from 'astro/config';
import unitConfig from './vitest.config.ts';

// Render native Astro components without loading the store's EmDash integration,
// database, Registry plugins or operational environment.
export default getViteConfig({
  resolve: unitConfig.resolve,
  test: {
    include: ['tests/presentation/**/*.test.ts'],
    maxWorkers: 1,
  },
}, { configFile: false, integrations: [], output: 'static', devToolbar: { enabled: false } });
