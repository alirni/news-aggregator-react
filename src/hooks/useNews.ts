import { useEffect, useState } from 'react';
import type { NewsQuery, NewsResponse } from '../../shared/news';

interface FeedState extends NewsResponse {
  status: 'loading' | 'success' | 'error';
}

const loadingState: FeedState = { status: 'loading', articles: [], failures: [] };

export function useNews() {
  const [state, setState] = useState<FeedState>(loadingState);
  const [request, setRequest] = useState<{ query: NewsQuery }>({ query: {} });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;

    async function load() {
      try {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(request.query)) {
          if (value) params.set(key, value);
        }
        const response = await fetch(`/api/news${params.size ? `?${params}` : ''}`, { signal: controller.signal });
        if (!response.ok && response.status !== 502) throw new Error('Request failed');
        const data = await response.json() as NewsResponse;
        if (!Array.isArray(data.articles) || !Array.isArray(data.failures)) throw new Error('Invalid response');
        if (active) setState({ ...data, status: response.ok ? 'success' : 'error' });
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
    setRequest({ query });
  }

  function retry() {
    search(request.query);
  }

  return { ...state, retry, search, isSearch: Object.keys(request.query).length > 0 };
}
