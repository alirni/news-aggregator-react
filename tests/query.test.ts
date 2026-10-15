import { expect, it } from 'vitest';
import { parseNewsQuery } from '../server/query';

it('parses and trims supported query parameters', () => {
  expect(parseNewsQuery(new URLSearchParams('q=+space+&category=science&source=guardian&from=2026-10-01&to=2026-10-14'))).toEqual({ q: 'space', category: 'science', source: 'guardian', from: '2026-10-01', to: '2026-10-14' });
  expect(parseNewsQuery(new URLSearchParams('q=&source='))).toEqual({});
});

it.each([
  'from=2026-02-30', 'to=yesterday', 'from=2026-10-15&to=2026-10-01',
  'category=invalid', 'source=https://example.com', 'q=one&q=two', `q=${'a'.repeat(201)}`,
])('rejects invalid query: %s', (query) => {
  expect(() => parseNewsQuery(new URLSearchParams(query))).toThrow();
});
