import type { Article, NewsQuery, NewsResponse, Provider } from '../../shared/news';
import { getNews } from '../api/news';

export interface NewsResult extends NewsResponse {
  status: 'success' | 'error';
}

async function requestNews(query: NewsQuery, signal: AbortSignal) {
  const data = await getNews(query, signal);
  return { ...data, ok: data.failures.length < (query.source ? 1 : 3) };
}

export async function loadNews(queries: NewsQuery[], signal: AbortSignal): Promise<NewsResult> {
  const results = await Promise.allSettled(queries.map((query) => requestNews(query, signal)));
  const articles: Article[] = [];
  const failures: NewsResponse['failures'] = [];
  let succeeded = false;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      succeeded ||= result.value.ok;
      articles.push(...result.value.articles);
      failures.push(...result.value.failures);
    } else {
      const source = queries[index].source;
      const providers: Provider[] = source ? [source.startsWith('newsapi:') ? 'newsapi' : source as Provider] : ['newsapi', 'guardian', 'nyt'];
      failures.push(...providers.map((provider) => ({ provider, code: 'unavailable' as const, message: 'Unable to retrieve news from this provider.' })));
    }
  });
  articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const uniqueArticles = new Map<string, Article>();
  for (const article of articles) if (!uniqueArticles.has(article.url)) uniqueArticles.set(article.url, article);
  return {
    status: succeeded ? 'success' : 'error',
    articles: [...uniqueArticles.values()],
    failures: [...new Map(failures.map((failure) => [failure.provider, failure])).values()],
  };
}
