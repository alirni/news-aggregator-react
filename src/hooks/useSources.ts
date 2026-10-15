import { useEffect, useState } from 'react';
import type { Source } from '../../shared/news';
import { getSources } from '../api/news';

const fixedSources: Source[] = [
  { id: 'guardian', name: 'The Guardian', provider: 'guardian' },
  { id: 'nyt', name: 'The New York Times', provider: 'nyt' },
];

export function useSources() {
  const [sources, setSources] = useState(fixedSources);
  const [status, setStatus] = useState<'loading' | 'ready' | 'partial'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    async function load() {
      try {
        const data = await getSources(controller.signal);
        if (active) {
          setSources(data.sources);
          setStatus(data.failures.length ? 'partial' : 'ready');
        }
      } catch {
        if (active) setStatus('partial');
      } finally {
        clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [attempt]);

  function retry() {
    setStatus('loading');
    setAttempt((value) => value + 1);
  }

  return { sources, status, retry };
}
