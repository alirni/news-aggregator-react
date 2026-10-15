// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { ArticleCard } from '../src/components/ArticleCard';
import type { Article } from '../shared/news';

const article: Article = {
  id: 'https://example.com/story', url: 'https://example.com/story',
  title: 'A new discovery', provider: 'guardian',
  source: { id: 'guardian', name: 'The Guardian', provider: 'guardian' },
  authors: ['Alex Reporter'], publishedAt: '2026-10-14T12:00:00Z',
  category: 'science', description: 'Scientists share their findings.',
  imageUrl: 'https://example.com/image.jpg',
};
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => vi.stubGlobal('fetch', (url: string, options?: RequestInit) => url === '/api/sources'
  ? Promise.resolve(Response.json({ sources: [], failures: [] }))
  : fetchMock(url, options)));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
});

it('shows loading until the request completes, then renders article details', async () => {
  let resolve!: (response: Response) => void;
  fetchMock.mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading the latest stories');
  await act(async () => resolve(Response.json({ articles: [article], failures: [] })));
  const link = screen.getByRole('link', { name: /A new discovery/ });
  expect(link).toHaveAttribute('href', article.url);
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(within(screen.getByRole('article')).getByText('Alex Reporter')).toBeInTheDocument();
  expect(screen.getByText('Oct 14, 2026')).toHaveAttribute('datetime', article.publishedAt);
  expect(screen.getByText(article.description!)).toBeInTheDocument();
  expect(screen.getByText('1 story · Newest first')).toBeInTheDocument();
  expect(screen.queryByText(/Loading the latest stories/)).not.toBeInTheDocument();
});

it('keeps articles visible during partial provider failure', async () => {
  fetchMock.mockResolvedValue(Response.json({ articles: [article], failures: [{ provider: 'nyt', code: 'unauthorized', message: 'API key rejected' }] }));
  render(<App />);
  expect(await screen.findByText('Some sources are unavailable')).toBeInTheDocument();
  expect(screen.getByRole('article')).toBeInTheDocument();
  expect(screen.getByText('The New York Times:')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry sources' })).toBeInTheDocument();
  expect(screen.queryByText('API key rejected')).not.toBeInTheDocument();
});

it('shows a useful empty state', async () => {
  fetchMock.mockResolvedValue(Response.json({ articles: [], failures: [] }));
  render(<App />);
  expect(await screen.findByText('No stories to show')).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('retries a failed request and replaces the error with articles', async () => {
  fetchMock.mockRejectedValueOnce(new Error('Network failure'))
    .mockResolvedValueOnce(Response.json({ articles: [article], failures: [] }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load the news');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('article')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows total provider failure as an error rather than empty results', async () => {
  fetchMock.mockResolvedValue(Response.json({ articles: [], failures: [{ provider: 'newsapi', code: 'rate_limited', message: 'Quota exceeded' }] }, { status: 502 }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Request limit reached');
  expect(screen.queryByText('No stories to show')).not.toBeInTheDocument();
});

it('handles an unexpected API response', async () => {
  fetchMock.mockResolvedValue(Response.json({ unexpected: true }));
  render(<App />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

it('aborts a pending request when the feed unmounts', () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  const { unmount } = render(<App />);
  const signal = fetchMock.mock.calls[0][1]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
});

it('ends loading with a retryable error when the request times out', async () => {
  vi.useFakeTimers();
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  render(<App />);
  await act(() => vi.advanceTimersByTimeAsync(15_000));
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

it('replaces a failed image and handles absent optional information', () => {
  const { container, rerender } = render(<ArticleCard article={article} />);
  fireEvent.error(container.querySelector('img')!);
  expect(screen.getByText('No image available')).toBeInTheDocument();
  expect(container.querySelector('img')).toBeNull();
  rerender(<ArticleCard article={{ ...article, imageUrl: undefined, description: undefined, authors: [] }} />);
  expect(screen.getByText('Author not listed')).toBeInTheDocument();
  expect(screen.queryByText(article.description!)).not.toBeInTheDocument();
});
