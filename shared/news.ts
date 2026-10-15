export const categories = ['business', 'entertainment', 'health', 'science', 'sports', 'technology'] as const;
export type Category = (typeof categories)[number];
export type Provider = 'newsapi' | 'guardian' | 'nyt';

export interface Source {
  id: string;
  name: string;
  provider: Provider;
}

export interface Article {
  id: string;
  provider: Provider;
  source: Source;
  title: string;
  url: string;
  publishedAt: string;
  authors: string[];
  category: Category | null;
  description?: string;
  imageUrl?: string;
}

export interface NewsQuery {
  q?: string;
  from?: string;
  to?: string;
  category?: Category;
  source?: string;
}

export interface ProviderFailure {
  provider: Provider;
  code: 'missing_key' | 'unauthorized' | 'rate_limited' | 'timeout' | 'unavailable';
  message: string;
}

export interface NewsResponse {
  articles: Article[];
  failures: ProviderFailure[];
}

export interface SourcesResponse {
  sources: Source[];
  failures: ProviderFailure[];
}
