import type { Article, Category, NewsQuery, Source } from '../../../shared/news';
import { apiKey, ProviderError, requestJson } from './http';
import { normalizeArticle, sectionCategory } from './normalize';

export const guardianSource: Source = { id: 'guardian', name: 'The Guardian', provider: 'guardian' };
const sections: Record<Category, readonly string[]> = {
  business: ['business'],
  entertainment: ['culture', 'film', 'music', 'stage', 'tv-and-radio'],
  health: ['society'],
  science: ['science'],
  sports: ['sport', 'football'],
  technology: ['technology'],
};

interface GuardianArticle {
  webTitle?: string;
  webUrl?: string;
  webPublicationDate?: string;
  sectionId?: string;
  fields?: { trailText?: string; thumbnail?: string; byline?: string };
  tags?: { type?: string; webTitle?: string }[];
}

export async function fetchGuardian(query: NewsQuery, signal?: AbortSignal): Promise<Article[]> {
  const url = new URL('https://content.guardianapis.com/search');
  url.searchParams.set('api-key', apiKey('VITE_GUARDIAN_API_KEY'));
  url.searchParams.set('page-size', '20');
  url.searchParams.set('order-by', 'newest');
  url.searchParams.set('show-fields', 'trailText,thumbnail,byline');
  url.searchParams.set('show-tags', 'contributor');
  if (query.q) url.searchParams.set('q', query.q);
  if (query.from) url.searchParams.set('from-date', query.from);
  if (query.to) url.searchParams.set('to-date', query.to);
  if (query.category) url.searchParams.set('section', sections[query.category].join('|'));
  // Health is a topic within Society, not a standalone Guardian section.
  if (query.category === 'health') url.searchParams.set('tag', 'society/health');
  const data = await requestJson<{ response?: { status?: string; results?: GuardianArticle[] } }>(url, undefined, signal);
  if (data?.response?.status !== 'ok' || !Array.isArray(data.response.results)) {
    throw new ProviderError('unavailable', 'The Guardian returned an unexpected response.');
  }
  return data.response.results.filter(Boolean).map((item) => {
    const authors = item.tags?.filter((tag) => tag.type === 'contributor' && tag.webTitle)
      .map((tag) => tag.webTitle!) ?? [];
    return normalizeArticle({
      provider: 'guardian', source: guardianSource,
      title: item.webTitle ?? '', url: item.webUrl ?? '', publishedAt: item.webPublicationDate ?? '',
      authors: authors.length ? authors : item.fields?.byline ? [item.fields.byline] : [],
      // Do not label all Society articles as health in an unfiltered feed.
      category: query.category ?? (item.sectionId === 'society' ? null : sectionCategory(item.sectionId, sections)),
      description: item.fields?.trailText?.replace(/<[^>]*>/g, ''),
      imageUrl: item.fields?.thumbnail,
    });
  }).filter((article): article is Article => article !== null);
}
