import type { Article, NewsQuery, Source } from '../../shared/news.ts';
import { apiKey, ProviderError, requestJson } from './http.ts';
import { normalizeArticle, text } from './normalize.ts';

interface NewsApiArticle {
  source?: { id?: string | null; name?: string | null };
  title?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  author?: string | null;
  description?: string | null;
  urlToImage?: string | null;
}

interface NewsApiResponse {
  status: string;
  articles?: NewsApiArticle[];
}

export async function fetchNewsApi(query: NewsQuery): Promise<Article[]> {
  const key = apiKey('NEWS_API_KEY');
  const sourceId = query.source?.replace(/^newsapi:/, '');
  const search = !query.category && Boolean(query.q || sourceId);
  const url = new URL(`https://newsapi.org/v2/${search ? 'everything' : 'top-headlines'}`);
  url.searchParams.set('pageSize', '20');
  if (query.q) url.searchParams.set('q', query.q);
  if (search) {
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'publishedAt');
    if (sourceId) url.searchParams.set('sources', sourceId);
    if (query.from) url.searchParams.set('from', `${query.from}T00:00:00Z`);
    if (query.to) url.searchParams.set('to', `${query.to}T23:59:59.999Z`);
  } else {
    url.searchParams.set('country', 'us');
    if (query.category) url.searchParams.set('category', query.category);
    // Headlines cannot combine category/country with sources or filter by date.
    // The aggregation layer applies those constraints to the returned batch.
  }
  const data = await requestJson<NewsApiResponse>(url, { 'X-Api-Key': key });
  if (data?.status !== 'ok' || !Array.isArray(data.articles)) {
    throw new ProviderError('unavailable', 'NewsAPI returned an unexpected response.');
  }
  return data.articles.filter(Boolean).map((item) => normalizeArticle({
    provider: 'newsapi',
    source: {
      id: `newsapi:${text(item.source?.id) || 'unknown'}`,
      name: text(item.source?.name) || 'Unknown publication',
      provider: 'newsapi',
    },
    title: item.title ?? '',
    url: item.url ?? '',
    publishedAt: item.publishedAt ?? '',
    authors: item.author ? [item.author] : [],
    category: query.category ?? null,
    description: item.description ?? undefined,
    imageUrl: item.urlToImage ?? undefined,
  })).filter((article): article is Article => article !== null);
}

export async function fetchNewsApiSources(): Promise<Source[]> {
  const key = apiKey('NEWS_API_KEY');
  const url = new URL('https://newsapi.org/v2/top-headlines/sources?language=en');
  const data = await requestJson<{
    status: string;
    sources?: { id?: string; name?: string }[];
  }>(url, { 'X-Api-Key': key });
  if (data?.status !== 'ok' || !Array.isArray(data.sources)) {
    throw new ProviderError('unavailable', 'NewsAPI returned an unexpected sources response.');
  }
  return data.sources.filter((source) => source && text(source.id) && text(source.name))
    .map((source) => ({ id: `newsapi:${source.id}`, name: source.name!, provider: 'newsapi' }));
}
