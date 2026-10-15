import { categories } from '../../shared/news';
import type { Article, Category, NewsQuery } from '../../shared/news';

export interface Preferences {
  sources: string[];
  categories: Category[];
  authors: string[];
}

export const emptyPreferences: Preferences = { sources: [], categories: [], authors: [] };
export const preferencesKey = 'news-aggregator.preferences';

export function parsePreferences(value: string | null): Preferences {
  if (!value) return emptyPreferences;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== 'object') return emptyPreferences;
    const stored = data as Record<string, unknown>;
    const strings = (items: unknown): string[] => Array.isArray(items)
      ? [...new Set(items.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
      : [];
    return {
      sources: strings(stored.sources).filter((source) => /^(guardian|nyt|newsapi:[a-z0-9-]+)$/.test(source)),
      categories: strings(stored.categories).filter((category): category is Category => categories.includes(category as Category)),
      authors: strings(stored.authors),
    };
  } catch {
    return emptyPreferences;
  }
}

export function feedQueries(preferences: Preferences): NewsQuery[] {
  const sources = preferences.sources.length ? [...new Set(preferences.sources)] : [undefined];
  const selectedCategories = preferences.categories.length ? [...new Set(preferences.categories)] : [undefined];
  return sources.flatMap((source) => selectedCategories.map((category) => ({
    ...(source && { source }), ...(category && { category }),
  })));
}

export function matchesPreferences(article: Article, preferences: Preferences): boolean {
  return (!preferences.sources.length || preferences.sources.includes(article.source.id)) &&
    (!preferences.categories.length || (article.category !== null && preferences.categories.includes(article.category))) &&
    (!preferences.authors.length || article.authors.some((author) =>
      preferences.authors.some((selected) => selected.toLowerCase() === author.toLowerCase()),
    ));
}
