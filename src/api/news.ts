import type { Article, NewsQuery, NewsResponse, Provider, ProviderFailure, SourcesResponse } from '../../shared/news';
import { fetchGuardian, guardianSource } from './providers/guardian';
import { ProviderError } from './providers/http';
import { fetchNewsApi, fetchNewsApiSources } from './providers/newsapi';
import { fetchNyt, nytSource } from './providers/nyt';

const providers = [
  { id: 'newsapi', fetch: fetchNewsApi },
  { id: 'guardian', fetch: fetchGuardian },
  { id: 'nyt', fetch: fetchNyt },
] as const;

function failure(provider: Provider, error: unknown, operation: 'news' | 'sources'): ProviderFailure {
  const result: ProviderFailure = error instanceof ProviderError
    ? { provider, code: error.code, message: error.message }
    : { provider, code: 'unavailable', message: 'News provider returned an unexpected response.' };
  const status = error instanceof ProviderError && error.status ? ` HTTP ${error.status}` : '';
  console.error(`[${operation}] ${provider}${status} ${result.code}: ${result.message}`);
  return result;
}

export async function getNews(query: NewsQuery, signal?: AbortSignal): Promise<NewsResponse> {
  const selected = providers.filter(({ id }) => !query.source ||
    (id === 'newsapi' ? query.source.startsWith('newsapi:') : query.source === id));
  const results = await Promise.allSettled(selected.map((provider) => provider.fetch(query, signal)));
  signal?.throwIfAborted();
  const articles: Article[] = [];
  const failures: ProviderFailure[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') articles.push(...result.value);
    else failures.push(failure(selected[index].id, result.reason, 'news'));
  });
  const filtered = articles.filter((article) => {
    const day = article.publishedAt.slice(0, 10);
    return (!query.from || day >= query.from) && (!query.to || day <= query.to) &&
      (!query.source || article.source.id === query.source);
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const unique = new Map<string, Article>();
  for (const article of filtered) {
    if (!unique.has(article.url)) unique.set(article.url, article);
  }
  return { articles: [...unique.values()], failures };
}

export async function getSources(signal?: AbortSignal): Promise<SourcesResponse> {
  const sources = [guardianSource, nytSource];
  const failures: ProviderFailure[] = [];
  try {
    sources.push(...await fetchNewsApiSources(signal));
  } catch (error) {
    signal?.throwIfAborted();
    failures.push(failure('newsapi', error, 'sources'));
  }
  return { sources: sources.sort((a, b) => a.name.localeCompare(b.name)), failures };
}
