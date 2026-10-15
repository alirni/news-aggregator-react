import { useEffect, useState } from 'react';
import type { NewsResponse } from '../../shared/news';

interface FeedState extends NewsResponse {
  status: 'loading' | 'success' | 'error';
}

const loadingState: FeedState = { status: 'loading', articles: [], failures: [] };

export function useNews() {
  const [state, setState] = useState<FeedState>(loadingState);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;

    async function load() {
      try {
        const response = await fetch('/api/news', { signal: controller.signal });
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
  }, [attempt]);

  function retry() {
    setState(loadingState);
    setAttempt((previous) => previous + 1);
  }

  return { ...state, retry };
}
