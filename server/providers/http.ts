import type { ProviderFailure } from '../../shared/news.ts';

export class ProviderError extends Error {
  constructor(public readonly code: ProviderFailure['code'], message: string, public readonly status?: number) {
    super(message);
  }
}

export function apiKey(name: string): string {
  const key = process.env[name]?.trim();
  if (!key) throw new ProviderError('missing_key', 'API key is not configured.');
  return key;
}

export async function requestJson<T>(url: URL, headers?: Record<string, string>): Promise<T> {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('unauthorized', 'API key was rejected or lacks access.', response.status);
    }
    if (response.status === 429) {
      throw new ProviderError('rate_limited', 'Request limit reached. Please try again later.', response.status);
    }
    if (!response.ok) throw new ProviderError('unavailable', 'News provider is unavailable.', response.status);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ProviderError('timeout', 'News provider took too long to respond.');
    }
    // Never forward upstream URLs or raw errors: they can contain API keys.
    throw new ProviderError('unavailable', 'Unable to retrieve news from this provider.');
  }
}
