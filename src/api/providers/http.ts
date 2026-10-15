import type { ProviderFailure } from '../../../shared/news';

export class ProviderError extends Error {
  constructor(public readonly code: ProviderFailure['code'], message: string, public readonly status?: number) {
    super(message);
  }
}

type KeyName = 'VITE_NEWS_API_KEY' | 'VITE_GUARDIAN_API_KEY' | 'VITE_NYT_API_KEY';

export function apiKey(name: KeyName): string {
  const keys = {
    VITE_NEWS_API_KEY: import.meta.env.VITE_NEWS_API_KEY,
    VITE_GUARDIAN_API_KEY: import.meta.env.VITE_GUARDIAN_API_KEY,
    VITE_NYT_API_KEY: import.meta.env.VITE_NYT_API_KEY,
  };
  const key = keys[name]?.trim();
  if (!key) throw new ProviderError('missing_key', 'API key is not configured.');
  return key;
}

export async function requestJson<T>(url: URL, headers?: Record<string, string>, signal?: AbortSignal): Promise<T> {
  try {
    const timeout = AbortSignal.timeout(10_000);
    const response = await fetch(url, { headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('unauthorized', 'API key was rejected or lacks access.', response.status);
    }
    if (response.status === 429) {
      throw new ProviderError('rate_limited', 'Request limit reached. Please try again later.', response.status);
    }
    if (!response.ok) throw new ProviderError('unavailable', 'News provider is unavailable.', response.status);
    return await response.json() as T;
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ProviderError('timeout', 'News provider took too long to respond.');
    }
    // Browser network tools expose the demo keys; keep application logs concise.
    throw new ProviderError('unavailable', 'Unable to retrieve news from this provider.');
  }
}
