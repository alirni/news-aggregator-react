import { categories } from '../shared/news.ts';
import type { Category, NewsQuery } from '../shared/news.ts';

export function parseNewsQuery(params: URLSearchParams): NewsQuery {
  const query: NewsQuery = {};
  for (const key of ['q', 'from', 'to', 'category', 'source'] as const) {
    if (params.getAll(key).length > 1) throw new Error(`${key} must be specified only once.`);
    const value = params.get(key)?.trim();
    if (!value) continue;
    if (key === 'q' && value.length > 200) throw new Error('Search must be 200 characters or fewer.');
    if (key === 'from' || key === 'to') {
      const date = new Date(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error(`${key} must be a valid date in YYYY-MM-DD format.`);
      }
    }
    if (key === 'category') {
      if (!categories.includes(value as Category)) throw new Error('Unknown category.');
      query.category = value as Category;
    } else {
      if (key === 'source' && !/^(guardian|nyt|newsapi:[a-z0-9-]+)$/.test(value)) {
        throw new Error('Unknown source format. Use an id from /api/sources.');
      }
      query[key] = value;
    }
  }
  if (query.from && query.to && query.from > query.to) throw new Error('Start date must not be after end date.');
  return query;
}
