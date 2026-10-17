// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderApp } from './helpers/renderApp';
import { getNews, getSources } from '../src/api/news';
import type { NewsResponse, Source } from '../shared/news';

vi.mock('../src/api/news', () => ({ getNews: vi.fn(), getSources: vi.fn() }));


const news = vi.mocked(getNews);
const sources = vi.mocked(getSources);
const empty = () => ({ articles: [], failures: [] });
const sourceList: Source[] = [{ id: 'newsapi:bbc-news', name: 'BBC News', provider: 'newsapi' }, { id: 'nyt', name: 'The New York Times', provider: 'nyt' }];

beforeEach(() => {
  news.mockImplementation(async () => empty());
  sources.mockImplementation(async () => ({ sources: sourceList, failures: [] }));
});
afterEach(() => {
  cleanup();
  news.mockReset();
  sources.mockReset();
});

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Search articles' }));
}

it('waits for submission and passes combined filters with trimmed keywords', async () => {
  renderApp();
  await screen.findByRole('option', { name: 'BBC News (via NewsAPI)' });
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: '  space & science  ' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'science' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Publication' }), { target: { value: 'newsapi:bbc-news' } });
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-14' } });
  expect(news).toHaveBeenCalledTimes(1);
  submit();
  await screen.findByRole('heading', { name: 'Search results' });
  expect(news).toHaveBeenCalledTimes(2);
  expect(news.mock.calls[1][0]).toEqual({ q: 'space & science', category: 'science', source: 'newsapi:bbc-news', from: '2026-10-01', to: '2026-10-14' });
  expect(sources).toHaveBeenCalledTimes(1);
});

it('rejects an inverted date range without making a new request', async () => {
  renderApp();
  await screen.findByText('No stories to show');
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-14' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });
  submit();
  expect(screen.getByRole('alert')).toHaveTextContent('Start date must not be after end date.');
  expect(news).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'true');
});

it('resets all draft and applied filters and returns unrestricted search results', async () => {
  renderApp();
  await screen.findByText('No stories to show');
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'space' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'science' } });
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-14' } });
  fireEvent.change(screen.getByLabelText('Publication'), { target: { value: 'nyt' } });
  submit();
  await screen.findByRole('heading', { name: 'Search results' });
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  await screen.findByRole('heading', { name: 'Search results' });
  for (const label of ['Keyword', 'Category', 'Publication', 'From', 'To']) expect(screen.getByLabelText(label)).toHaveValue('');
  expect(news.mock.lastCall?.[0]).toEqual({});
});

it('shows guidance when a search has no matching articles', async () => {
  renderApp();
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'no matches' } });
  submit();
  expect(await screen.findByText(/Try broader filters or reset your search/)).toBeInTheDocument();
});

it('aborts superseded requests and ignores stale responses even if fetch completes', async () => {
  let resolveOld!: (response: NewsResponse) => void;
  news.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  renderApp();
  const oldSignal = news.mock.calls[0][1];
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'latest search' } });
  submit();
  await screen.findByText(/Try broader filters/);
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => resolveOld({ articles: [], failures: [{ provider: 'nyt', code: 'unauthorized', message: 'Old error' }] }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Search results' })).toBeInTheDocument();
});

it('retries the submitted query, not unsubmitted changes', async () => {
  renderApp();
  await screen.findByText('No stories to show');
  news.mockRejectedValueOnce(new Error('Network error'));
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'space' } });
  submit();
  await screen.findByRole('alert');
  fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'unsubmitted' } });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText(/Try broader filters/);
  expect(news.mock.lastCall?.[0]).toEqual({ q: 'space' });
});

it('keeps search usable when publication loading fails and supports catalog retry', async () => {
  sources.mockRejectedValueOnce(new Error('Network error'));
  renderApp();
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
