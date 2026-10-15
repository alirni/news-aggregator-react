import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGuardian } from '../server/providers/guardian';
import { fetchNewsApi, fetchNewsApiSources } from '../server/providers/newsapi';
import { fetchNyt } from '../server/providers/nyt';
import { requestJson } from '../server/providers/http';
import { guardianArticle, newsApiArticle, nytArticle } from './fixtures';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEWS_API_KEY', 'test-news-key');
  vi.stubEnv('GUARDIAN_API_KEY', 'test-guardian-key');
  vi.stubEnv('NYT_API_KEY', 'test-nyt-key');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

function requestUrl(): URL {
  return fetchMock.mock.calls[0][0] as URL;
}

describe('NewsAPI', () => {
  it('sends keyword, source, language, and inclusive dates to Everything', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'ok', articles: [newsApiArticle] }));
    const articles = await fetchNewsApi({ q: 'science', source: 'newsapi:bbc-news', from: '2026-10-01', to: '2026-10-14' });
    const url = requestUrl();
    expect(url.pathname).toBe('/v2/everything');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ q: 'science', sources: 'bbc-news', language: 'en', from: '2026-10-01T00:00:00Z', to: '2026-10-14T23:59:59.999Z' });
    expect(url.searchParams.has('apiKey')).toBe(false);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ 'X-Api-Key': 'test-news-key' });
    expect(articles[0]).toMatchObject({ id: newsApiArticle.url, source: { id: 'newsapi:bbc-news', name: 'BBC News' }, authors: ['Alex Reporter'], category: null });
  });

  it('uses category headlines without incompatible sources or date parameters', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'ok', articles: [newsApiArticle] }));
    const articles = await fetchNewsApi({ q: 'discovery', category: 'science', source: 'newsapi:bbc-news', from: '2026-10-01' });
    expect(requestUrl().pathname).toBe('/v2/top-headlines');
    expect(Object.fromEntries(requestUrl().searchParams)).toEqual({ pageSize: '20', q: 'discovery', country: 'us', category: 'science' });
    expect(articles[0].category).toBe('science');
  });

  it('loads US headlines when no filters are supplied', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'ok', articles: [] }));
    await fetchNewsApi({});
    expect(requestUrl().pathname).toBe('/v2/top-headlines');
    expect(requestUrl().searchParams.get('country')).toBe('us');
  });

  it('keeps articles with missing optional fields, but drops unusable articles', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'ok', articles: [
      { ...newsApiArticle, author: null, description: null, urlToImage: null },
      { ...newsApiArticle, url: 'javascript:alert(1)' },
      { ...newsApiArticle, publishedAt: 'not a date' },
      { ...newsApiArticle, title: '[Removed]' },
      { ...newsApiArticle, title: null },
    ] }));
    const articles = await fetchNewsApi({});
    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({ authors: [], description: undefined, imageUrl: undefined });
  });

  it('loads English source metadata and skips incomplete entries', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'ok', sources: [{ id: 'bbc-news', name: 'BBC News' }, { name: 'No identifier' }] }));
    expect(await fetchNewsApiSources()).toEqual([{ id: 'newsapi:bbc-news', name: 'BBC News', provider: 'newsapi' }]);
    expect(requestUrl().searchParams.get('language')).toBe('en');
  });
});

describe('The Guardian', () => {
  it('maps query parameters and preserves individual contributors', async () => {
    fetchMock.mockResolvedValue(Response.json({ response: { status: 'ok', results: [guardianArticle] } }));
    const articles = await fetchGuardian({ q: 'discovery', category: 'sports', from: '2026-10-01', to: '2026-10-14' });
    expect(Object.fromEntries(requestUrl().searchParams)).toMatchObject({ q: 'discovery', section: 'sport|football', 'from-date': '2026-10-01', 'to-date': '2026-10-14', 'show-tags': 'contributor' });
    expect(articles[0]).toMatchObject({ authors: ['Alex Reporter', 'Sam Writer'], description: 'A short description.', source: { id: 'guardian' } });
  });

  it('falls back to the byline and limits health searches to the health tag', async () => {
    fetchMock.mockResolvedValue(Response.json({ response: { status: 'ok', results: [{ ...guardianArticle, tags: [] }] } }));
    const articles = await fetchGuardian({ category: 'health' });
    expect(requestUrl().searchParams.get('tag')).toBe('society/health');
    expect(articles[0].authors).toEqual(['Alex and Sam']);
  });

  it('handles absent fields without inventing an author or category', async () => {
    fetchMock.mockResolvedValue(Response.json({ response: { status: 'ok', results: [{ ...guardianArticle, sectionId: 'society', fields: undefined, tags: undefined }] } }));
    expect((await fetchGuardian({}))[0]).toMatchObject({ authors: [], category: null, imageUrl: undefined });
  });
});

describe('The New York Times', () => {
  it('omits the broken upstream source filter and filters publications locally', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'OK', response: { docs: [nytArticle, { ...nytArticle, source: 'AP' }] } }));
    expect(await fetchNyt({})).toHaveLength(1);
    expect(requestUrl().searchParams.has('fq')).toBe(false);
  });

  it('accepts the observed null-documents response when metadata confirms zero hits', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'OK', response: { docs: null, metadata: { hits: 0, offset: 0, time: 160 } } }));
    expect(await fetchNyt({ q: 'no matching stories' })).toEqual([]);
  });

  it('still rejects null documents when results are expected', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'OK', response: { docs: null, metadata: { hits: 10 } } }));
    await expect(fetchNyt({})).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('uses NYT date parameters, filters sections locally, and extracts structured authors', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'OK', response: { docs: [nytArticle] } }));
    const articles = await fetchNyt({ q: 'discovery', category: 'science', from: '2026-10-01', to: '2026-10-14' });
    expect(Object.fromEntries(requestUrl().searchParams)).toMatchObject({ q: 'discovery', begin_date: '20261001', end_date: '20261014', page: '0' });
    expect(requestUrl().searchParams.has('fq')).toBe(false);
    expect(articles[0]).toMatchObject({ authors: ['Jane Q. Doe'], category: 'science', imageUrl: 'https://www.nytimes.com/images/2026/10/14/science.jpg' });
  });

  it('supports object-shaped multimedia and unstructured bylines', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'OK', response: { docs: [{ ...nytArticle, byline: { original: 'By Jane Doe' }, multimedia: { default: { url: 'https://static01.nyt.com/photo.jpg' } } }] } }));
    expect((await fetchNyt({}))[0]).toMatchObject({ authors: ['Jane Doe'], imageUrl: 'https://static01.nyt.com/photo.jpg' });
  });

  it('excludes other sections instead of assigning them the requested category', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'OK', response: { docs: [nytArticle, { ...nytArticle, section_name: 'Sports' }] } }));
    expect(await fetchNyt({ category: 'science' })).toHaveLength(1);
  });

  it('allows missing multimedia and bylines', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'OK', response: { docs: [{ ...nytArticle, byline: undefined, multimedia: undefined }] } }));
    expect((await fetchNyt({}))[0]).toMatchObject({ authors: [], imageUrl: undefined });
  });
});

describe('provider failures', () => {
  it.each([[401, 'unauthorized'], [403, 'unauthorized'], [429, 'rate_limited'], [500, 'unavailable']])('sanitizes HTTP %s errors', async (status, code) => {
    fetchMock.mockResolvedValue(new Response('secret upstream details', { status: Number(status) }));
    await expect(fetchGuardian({})).rejects.toMatchObject({ code });
  });

  it('does not make a request without a key', async () => {
    vi.stubEnv('NYT_API_KEY', '');
    await expect(fetchNyt({})).rejects.toMatchObject({ code: 'missing_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sets a ten-second timeout and reports aborted requests', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockRejectedValue(new DOMException('upstream URL with secret', 'TimeoutError'));
    await expect(fetchNewsApi({})).rejects.toMatchObject({ code: 'timeout' });
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('hides sensitive network errors', async () => {
    fetchMock.mockRejectedValue(new Error('https://provider.test?api-key=secret'));
    await expect(requestJson(new URL('https://provider.test'))).rejects.toMatchObject({ message: 'Unable to retrieve news from this provider.' });
  });

  it.each([fetchNewsApi, fetchGuardian, fetchNyt])('rejects malformed provider envelopes', async (adapter) => {
    fetchMock.mockResolvedValue(Response.json({ unexpected: true }));
    await expect(adapter({})).rejects.toMatchObject({ code: 'unavailable' });
  });
});
