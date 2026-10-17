// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderApp } from './helpers/renderApp';
import { getNews, getSources } from '../src/api/news';
import type { Article, NewsResponse } from '../shared/news';
import { emptyPreferences, preferencesKey } from '../src/lib/preferences';

vi.mock('../src/api/news', () => ({ getNews: vi.fn(), getSources: vi.fn() }));

const sources = [
  { id: 'guardian', name: 'The Guardian', provider: 'guardian' as const },
  { id: 'nyt', name: 'The New York Times', provider: 'nyt' as const },
];
const articles: Article[] = [
  { id: 'older', url: 'https://example.com/older', provider: 'guardian', source: sources[0], title: 'Older science story', authors: ['Alex'], category: 'science', publishedAt: '2026-10-13T12:00:00Z' },
  { id: 'newer', url: 'https://example.com/newer', provider: 'nyt', source: sources[1], title: 'Newer sports story', authors: ['Sam'], category: 'sports', publishedAt: '2026-10-14T12:00:00Z' },
];
const news = vi.mocked(getNews);
beforeEach(() => {
  localStorage.clear();
  news.mockImplementation(async () => ({ articles, failures: [] }));
  vi.mocked(getSources).mockResolvedValue({ sources, failures: [] });
});
afterEach(() => {
  cleanup();
  vi.mocked(getSources).mockReset();
  news.mockReset();
  localStorage.clear();
});

async function tabTo(user: ReturnType<typeof userEvent.setup>, target: HTMLElement) {
  for (let attempt = 0; attempt < 25 && document.activeElement !== target; attempt++) await user.tab();
  expect(target).toHaveFocus();
}

it('supports keyboard search, labeled controls, and keyboard preference selection', async () => {
  const user = userEvent.setup();
  renderApp();
  await screen.findAllByRole('article');
  await user.tab();
  expect(screen.getByRole('link', { name: 'Skip to news' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('searchbox', { name: 'Keyword' })).toHaveFocus();
  await user.keyboard('space');
  expect(news).toHaveBeenCalledTimes(1);
  await user.keyboard('{Enter}');
  await screen.findByRole('heading', { name: 'Search results' });
  expect(news.mock.lastCall?.[0]).toEqual({ q: 'space' });
  for (const control of [screen.getByRole('combobox', { name: 'Category' }), screen.getByRole('combobox', { name: 'Publication' }), screen.getByLabelText('From'), screen.getByLabelText('To')]) await tabTo(user, control);
  const summary = screen.getByText('Feed preferences');
  await tabTo(user, summary);
  await user.keyboard('{Enter}');
  const publication = screen.getByRole('checkbox', { name: 'The Guardian' });
  await tabTo(user, publication);
  await user.keyboard(' ');
  expect(publication).toBeChecked();
  const author = screen.getByRole('checkbox', { name: 'Alex' });
  await tabTo(user, author);
  await user.keyboard(' ');
  await tabTo(user, screen.getByRole('button', { name: 'Save preferences' }));
  await user.keyboard('{Enter}');
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  expect(screen.getByRole('heading', { name: 'My feed' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(preferencesKey)!)).toEqual({ sources: ['guardian'], categories: [], authors: ['Alex'] });
});

it('recovers a personalized feed from a network failure while keeping sorted, unique stories', async () => {
  localStorage.setItem(preferencesKey, JSON.stringify({ ...emptyPreferences, sources: ['guardian', 'nyt'] }));
  let failed = true;
  news.mockImplementation(async (input) => {
    if (input.source === 'nyt' && failed) throw new Error('Connection interrupted');
    return ({ articles: [...articles, articles[0]], failures: [] });
  });
  const user = userEvent.setup();
  renderApp();
  await screen.findByText('Some sources are unavailable');
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getAllByRole('article')[0]).toHaveTextContent('Newer sports story');
  failed = false;
  await user.click(screen.getByRole('button', { name: 'Retry sources' }));
  await waitFor(() => expect(screen.queryByText('Some sources are unavailable')).not.toBeInTheDocument());
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(news).toHaveBeenCalledTimes(4);
});

it('ignores a late personalized response after the user switches to search', async () => {
  localStorage.setItem(preferencesKey, JSON.stringify({ ...emptyPreferences, authors: ['Alex'] }));
  let resolveOld!: (response: NewsResponse) => void;
  news.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const user = userEvent.setup();
  renderApp();
  await user.type(screen.getByLabelText('Keyword'), 'sports{Enter}');
  await screen.findAllByRole('article');
  expect(news.mock.calls[0][1]?.aborted).toBe(true);
  await act(async () => resolveOld({ articles: [articles[0]], failures: [] }));
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getByRole('heading', { name: 'Search results' })).toBeInTheDocument();
});

it('resets search without applying or deleting saved feed preferences', async () => {
  localStorage.setItem(preferencesKey, JSON.stringify({ ...emptyPreferences, authors: ['Alex'] }));
  const user = userEvent.setup();
  renderApp();
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  await user.type(screen.getByLabelText('Keyword'), 'sports{Enter}');
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  expect(screen.getByLabelText('Keyword')).toHaveValue('');
  expect(news.mock.lastCall?.[0]).toEqual({});
  expect(JSON.parse(localStorage.getItem(preferencesKey)!).authors).toEqual(['Alex']);
  await user.click(screen.getByRole('button', { name: 'My feed' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
});
