import { useEffect, useState } from 'react';
import type { NewsQuery, NewsResponse } from '../../shared/news';
import { loadNews } from '../lib/news';
import { feedQueries, matchesPreferences } from '../lib/preferences';
import type { Preferences } from '../lib/preferences';

interface FeedState extends NewsResponse {
  status: 'loading' | 'success' | 'error';
}

const loadingState: FeedState = { status: 'loading', articles: [], failures: [] };

interface FeedRequest {
  queries: NewsQuery[];
  preferences: Preferences | null;
}

export function useNews(initialPreferences: Preferences) {
  const [state, setState] = useState<FeedState>(loadingState);
  const [request, setRequest] = useState<FeedRequest>(() => ({ queries: feedQueries(initialPreferences), preferences: initialPreferences }));
  const [knownAuthors, setKnownAuthors] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;

    async function load() {
      try {
        const data = await loadNews(request.queries, controller.signal);
        if (active) {
          const preferences = request.preferences;
          setKnownAuthors((previous) => [...new Set([...previous, ...data.articles.flatMap((article) => article.authors)])].sort());
          setState({ ...data, articles: preferences
            ? data.articles.filter((article) => matchesPreferences(article, preferences))
            : data.articles });
        }
      } catch {
        if (active) setState({ status: 'error', articles: [], failures: [] });
      } finally {
        clearTimeout(timeout);
      }
    }

    void load();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [request]);

  function search(query: NewsQuery) {
    setState(loadingState);
    setRequest({ queries: [query], preferences: null });
  }

  function showFeed(preferences: Preferences) {
    setState(loadingState);
    setRequest({ queries: feedQueries(preferences), preferences });
  }

  function retry() {
    setState(loadingState);
    setRequest({ ...request });
  }

  return { ...state, retry, search, showFeed, knownAuthors, isSearch: request.preferences === null };
}
