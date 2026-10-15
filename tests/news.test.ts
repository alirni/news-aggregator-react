import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getNews, getSources } from '../server/news.js';
import { guardianArticle, newsApiArticle, nytArticle } from './fixtures.js';

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEWS_API_KEY', 'test');
  vi.stubEnv('GUARDIAN_API_KEY', 'test');
  vi.stubEnv('NYT_API_KEY', 'test');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

it('merges all three providers, deduplicates URLs, and sorts newest first', async () => {
  fetchMock.mockImplementation(async (input) => {
    const host = (input as URL).hostname;
    if (host === 'newsapi.org') return Response.json({ status: 'ok', articles: [newsApiArticle, { ...newsApiArticle, url: guardianArticle.webUrl }] });
    if (host === 'content.guardianapis.com') return Response.json({ response: { status: 'ok', results: [guardianArticle] } });
    return Response.json({ status: 'OK', response: { docs: [nytArticle] } });
  });
  const result = await getNews({});
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(result.failures).toEqual([]);
  expect(result.articles.map((article) => article.url)).toEqual([nytArticle.web_url, guardianArticle.webUrl, newsApiArticle.url]);
});

it('keeps successful articles when another provider rejects its key', async () => {
  fetchMock.mockImplementation(async (input) => {
    const host = (input as URL).hostname;
    if (host === 'newsapi.org') return Response.json({ status: 'ok', articles: [newsApiArticle] });
    return new Response('invalid key', { status: 401 });
  });
  const result = await getNews({});
  expect(result.articles).toHaveLength(1);
  expect(result.failures.map(({ provider, code }) => [provider, code])).toEqual([['guardian', 'unauthorized'], ['nyt', 'unauthorized']]);
});

it('reports every failed provider without exposing raw errors', async () => {
  fetchMock.mockRejectedValue(new Error('secret request URL'));
  const result = await getNews({});
  expect(result.articles).toEqual([]);
  expect(result.failures).toHaveLength(3);
  expect(JSON.stringify(result)).not.toContain('secret');
  expect(console.error).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('secret');
});

it('queries only the provider for the selected publication', async () => {
  fetchMock.mockResolvedValue(Response.json({ response: { status: 'ok', results: [guardianArticle] } }));
  const result = await getNews({ source: 'guardian' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((fetchMock.mock.calls[0][0] as URL).hostname).toBe('content.guardianapis.com');
  expect(result.articles).toHaveLength(1);
});

it('applies publication and inclusive UTC date filters to category headlines', async () => {
  fetchMock.mockResolvedValue(Response.json({ status: 'ok', articles: [
    { ...newsApiArticle, url: 'https://example.com/start', publishedAt: '2026-10-14T00:00:00Z' },
    { ...newsApiArticle, url: 'https://example.com/end', publishedAt: '2026-10-14T23:59:59.999Z' },
    { ...newsApiArticle, url: 'https://example.com/old', publishedAt: '2026-10-13T23:59:59Z' },
    { ...newsApiArticle, url: 'https://example.com/new', publishedAt: '2026-10-15T00:00:00Z' },
    { ...newsApiArticle, source: { id: 'other', name: 'Other' } },
  ] }));
  const result = await getNews({ source: 'newsapi:bbc-news', category: 'science', from: '2026-10-14', to: '2026-10-14' });
  expect(result.articles.map((article) => article.url)).toEqual(['https://example.com/end', 'https://example.com/start']);
});

it('returns fixed publications when the NewsAPI source catalog fails', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 429 }));
  const result = await getSources();
  expect(result.sources.map((source) => source.id)).toEqual(['guardian', 'nyt']);
  expect(result.failures).toEqual([{ provider: 'newsapi', code: 'rate_limited', message: 'Request limit reached. Please try again later.' }]);
  expect(console.error).toHaveBeenCalledWith('[sources] newsapi HTTP 429 rate_limited: Request limit reached. Please try again later.');
});

it('logs the provider, HTTP status, and safe failure reason in the terminal', async () => {
  fetchMock.mockResolvedValue(new Response('upstream URL with secret key', { status: 401 }));
  await getNews({ source: 'nyt' });
  expect(console.error).toHaveBeenCalledExactlyOnceWith('[news] nyt HTTP 401 unauthorized: API key was rejected or lacks access.');
});
