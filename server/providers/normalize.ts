import type { Article, Category } from '../../shared/news.js';

export function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function webUrl(value: unknown): string | undefined {
  const candidate = text(value);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeArticle(article: Omit<Article, 'id'>): Article | null {
  const url = webUrl(article.url);
  const title = text(article.title);
  const timestamp = Date.parse(article.publishedAt);
  if (!url || !title || title === '[Removed]' || !Number.isFinite(timestamp)) return null;
  return {
    ...article,
    id: url,
    url,
    title,
    publishedAt: new Date(timestamp).toISOString(),
    authors: [...new Set(article.authors.map(text).filter((name): name is string => Boolean(name)))],
    description: text(article.description),
    imageUrl: webUrl(article.imageUrl),
  };
}

export function sectionCategory(section: string | undefined, mapping: Record<Category, readonly string[]>): Category | null {
  return (Object.keys(mapping) as Category[]).find((category) =>
    mapping[category].some((name) => name.toLowerCase() === section?.toLowerCase()),
  ) ?? null;
}
