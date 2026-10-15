// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';

const news = vi.fn<typeof fetch>();
const sources = vi.fn<typeof fetch>();
const empty = () => Response.json({ articles: [], failures: [] });
const sourceList = [{ id: 'newsapi:bbc-news', name: 'BBC News', provider: 'newsapi' }, { id: 'nyt', name: 'The New York Times', provider: 'nyt' }];

beforeEach(() => {
  news.mockImplementation(async () => empty());
  sources.mockImplementation(async () => Response.json({ sources: sourceList, failures: [] }));
  vi.stubGlobal('fetch', (url: string, options?: RequestInit) => url === '/api/sources' ? sources(url, options) : news(url, options));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  news.mockReset();
  sources.mockReset();
});

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Search articles' }));
}

it('waits for submission and sends combined filters with encoded, trimmed keywords', async () => {
  render(<App />);
  await screen.findByRole('option', { name: 'BBC News (via NewsAPI)' });
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: '  space & science  ' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Category', exact: true }), { target: { value: 'science' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Publication', exact: true }), { target: { value: 'newsapi:bbc-news' } });
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-14' } });
  expect(news).toHaveBeenCalledTimes(1);
  submit();
  await screen.findByRole('heading', { name: 'Search results' });
  expect(news).toHaveBeenCalledTimes(2);
  const url = new URL(String(news.mock.calls[1][0]), 'http://localhost');
  expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'space & science', category: 'science', source: 'newsapi:bbc-news', from: '2026-10-01', to: '2026-10-14' });
  expect(sources).toHaveBeenCalledTimes(1);
});

it('rejects an inverted date range without making a new request', async () => {
  render(<App />);
  await screen.findByText('No stories to show');
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-14' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });
  submit();
  expect(screen.getByRole('alert')).toHaveTextContent('Start date must not be after end date.');
  expect(news).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'true');
});

it('resets all draft and applied filters and returns to latest stories', async () => {
  render(<App />);
  await screen.findByText('No stories to show');
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'space' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'science' } });
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-14' } });
  fireEvent.change(screen.getByLabelText('Publication'), { target: { value: 'nyt' } });
  submit();
  await screen.findByRole('heading', { name: 'Search results' });
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  await screen.findByRole('heading', { name: 'Latest stories' });
  for (const label of ['Keyword', 'Category', 'Publication', 'From', 'To']) expect(screen.getByLabelText(label)).toHaveValue('');
  expect(news.mock.lastCall?.[0]).toBe('/api/news');
});

it('shows guidance when a search has no matching articles', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'no matches' } });
  submit();
  expect(await screen.findByText(/Try broader filters or reset your search/)).toBeInTheDocument();
});

it('aborts superseded requests and ignores stale responses even if fetch completes', async () => {
  let resolveOld!: (response: Response) => void;
  news.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  render(<App />);
  const oldSignal = news.mock.calls[0][1]?.signal;
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'latest search' } });
  submit();
  await screen.findByText(/Try broader filters/);
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => resolveOld(Response.json({ articles: [], failures: [{ provider: 'nyt', code: 'unauthorized', message: 'Old error' }] }, { status: 502 })));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Search results' })).toBeInTheDocument();
});

it('retries the submitted query, not unsubmitted changes', async () => {
  render(<App />);
  await screen.findByText('No stories to show');
  news.mockRejectedValueOnce(new Error('Network error'));
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'space' } });
  submit();
  await screen.findByRole('alert');
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'unsubmitted' } });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText(/Try broader filters/);
  expect(news.mock.lastCall?.[0]).toBe('/api/news?q=space');
});

it('keeps search usable when publication loading fails and supports catalog retry', async () => {
  sources.mockRejectedValueOnce(new Error('Network error'));
  render(<App />);
  await screen.findByText('Some publication choices are unavailable. You can still search.');
  expect(screen.getByRole('option', { name: 'The Guardian' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'space' } });
  submit();
  await screen.findByText(/Try broader filters/);
  fireEvent.click(screen.getByRole('button', { name: 'Retry publications' }));
  await screen.findByRole('option', { name: 'BBC News (via NewsAPI)' });
  await waitFor(() => expect(screen.queryByText(/Some publication choices are unavailable/)).not.toBeInTheDocument());
  expect(news).toHaveBeenCalledTimes(2);
});
