import type { Article, Category, NewsQuery, Source } from '../../../shared/news';
import { apiKey, ProviderError, requestJson } from './http';
import { normalizeArticle, sectionCategory, text } from './normalize';

export const nytSource: Source = { id: 'nyt', name: 'The New York Times', provider: 'nyt' };
const sections: Record<Category, readonly string[]> = {
  business: ['Business', 'Business Day', 'Your Money'],
  entertainment: ['Arts', 'Movies', 'Theater', 'Books'],
  health: ['Health'], science: ['Science'], sports: ['Sports'], technology: ['Technology'],
};

interface NytArticle {
  source?: string;
  headline?: { main?: string };
  web_url?: string;
  pub_date?: string;
  abstract?: string;
  section_name?: string;
  byline?: { original?: string; person?: { firstname?: string; middlename?: string; lastname?: string }[] };
  multimedia?: { url?: string; subtype?: string }[] | { default?: { url?: string }; thumbnail?: { url?: string } };
}

export async function fetchNyt(query: NewsQuery, signal?: AbortSignal): Promise<Article[]> {
  const url = new URL('https://api.nytimes.com/svc/search/v2/articlesearch.json');
  url.searchParams.set('api-key', apiKey('VITE_NYT_API_KEY'));
  url.searchParams.set('sort', 'newest');
  url.searchParams.set('page', '0');
  if (query.q) url.searchParams.set('q', query.q);
  if (query.from) url.searchParams.set('begin_date', query.from.replaceAll('-', ''));
  if (query.to) url.searchParams.set('end_date', query.to.replaceAll('-', ''));
  const data = await requestJson<{
    status?: string;
    response?: { docs?: NytArticle[] | null; metadata?: { hits?: number } };
  }>(url, undefined, signal);
  if (data?.status === 'OK' && data.response?.docs === null && data.response.metadata?.hits === 0) return [];
  if (data?.status !== 'OK' || !Array.isArray(data.response?.docs)) {
    throw new ProviderError('unavailable', 'The New York Times returned an unexpected response.');
  }
  // Documented fq source/section filters currently return zero hits in live requests.
  // Apply those constraints to the returned batch instead.
  return data.response.docs.filter((item) => item?.source === 'The New York Times' &&
    (!query.category || sectionCategory(item.section_name, sections) === query.category),
  ).map((item) => {
    const people = item.byline?.person?.map((person) =>
      [person.firstname, person.middlename, person.lastname].filter(text).join(' '),
    ).filter(Boolean) ?? [];
    const byline = text(item.byline?.original?.replace(/^By\s+/i, ''));
    const media = item.multimedia;
    const image = Array.isArray(media)
      ? (media.find((entry) => entry.subtype === 'xlarge') ?? media[0])?.url
      : media?.default?.url ?? media?.thumbnail?.url;
    return normalizeArticle({
      provider: 'nyt', source: nytSource,
      title: item.headline?.main ?? '', url: item.web_url ?? '', publishedAt: item.pub_date ?? '',
      authors: people.length ? people : byline ? [byline] : [],
      category: sectionCategory(item.section_name, sections),
      description: item.abstract,
      imageUrl: image ? new URL(image, 'https://www.nytimes.com/').href : undefined,
    });
  }).filter((article): article is Article => article !== null);
}
