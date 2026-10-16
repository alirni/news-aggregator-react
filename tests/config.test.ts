import { afterEach, expect, it, vi } from 'vitest';
import { apiKey } from '../src/api/providers/http';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('uses container startup configuration before Vite build values', () => {
  vi.stubEnv('VITE_NEWS_API_KEY', 'build-key');
  vi.stubGlobal('window', { __NEWS_CONFIG__: { VITE_NEWS_API_KEY: ' reviewer-key ' } });
  expect(apiKey('VITE_NEWS_API_KEY')).toBe('reviewer-key');
});

it('uses Vite values during local development when runtime configuration is empty', () => {
  vi.stubEnv('VITE_GUARDIAN_API_KEY', 'local-key');
  vi.stubGlobal('window', { __NEWS_CONFIG__: {} });
  expect(apiKey('VITE_GUARDIAN_API_KEY')).toBe('local-key');
});

it('reports a missing runtime key instead of using an unrelated build key', () => {
  vi.stubEnv('VITE_NYT_API_KEY', 'build-key');
  vi.stubGlobal('window', { __NEWS_CONFIG__: { VITE_NYT_API_KEY: '' } });
  expect(() => apiKey('VITE_NYT_API_KEY')).toThrow('API key is not configured.');
});
