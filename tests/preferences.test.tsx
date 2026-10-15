// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import type { Article, NewsResponse } from '../shared/news';
import { emptyPreferences, preferencesKey } from '../src/lib/preferences';

const sources = [
  { id: 'guardian', name: 'The Guardian', provider: 'guardian' as const },
  { id: 'nyt', name: 'The New York Times', provider: 'nyt' as const },
];
const articles: Article[] = [
  { id: '1', url: 'https://example.com/1', provider: 'guardian', source: sources[0], title: 'Alex science story', category: 'science', authors: ['Alex'], publishedAt: '2026-10-14T12:00:00Z' },
  { id: '2', url: 'https://example.com/2', provider: 'nyt', source: sources[1], title: 'Sam sports story', category: 'sports', authors: ['Sam'], publishedAt: '2026-10-14T13:00:00Z' },
  { id: '3', url: 'https://example.com/3', provider: 'nyt', source: sources[1], title: 'Alex sports story', category: 'sports', authors: ['Alex'], publishedAt: '2026-10-14T14:00:00Z' },
];
const news = vi.fn<typeof fetch>();
beforeEach(() => {
  localStorage.clear();
  news.mockImplementation(async () => Response.json({ articles, failures: [] }));
  vi.stubGlobal('fetch', (url: string, options?: RequestInit) => url === '/api/sources'
    ? Promise.resolve(Response.json({ sources, failures: [] })) : news(url, options));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  news.mockReset();
  localStorage.clear();
});

function openPreferences() {
  fireEvent.click(screen.getByText('Feed preferences'));
}
function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
}

it('saves selected groups, requests each combination once, and filters the merged feed', async () => {
  render(<App />);
  await screen.findAllByRole('article');
  openPreferences();
  for (const name of ['The Guardian', 'The New York Times', 'Science', 'Sports', 'Alex']) {
    fireEvent.click(screen.getByRole('checkbox', { name }));
  }
  expect(news).toHaveBeenCalledTimes(1);
  save();
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  expect(screen.queryByRole('link', { name: /Sam sports story/ })).not.toBeInTheDocument();
  expect(news).toHaveBeenCalledTimes(5);
  expect(new Set(news.mock.calls.slice(1).map(([url]) => url)).size).toBe(4);
  expect(JSON.parse(localStorage.getItem(preferencesKey)!)).toEqual({ sources: ['guardian', 'nyt'], categories: ['science', 'sports'], authors: ['Alex'] });
});

it('restores preferences on mount, preserves saved authors, and resets them', async () => {
  localStorage.setItem(preferencesKey, JSON.stringify({ sources: ['guardian'], categories: ['science'], authors: ['Saved author'] }));
  render(<App />);
  await screen.findByText(/No retrieved stories match your preferences/);
  expect(news.mock.calls[0][0]).toBe('/api/news?source=guardian&category=science');
  openPreferences();
  expect(screen.getByRole('checkbox', { name: 'Saved author' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Science' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  expect(news.mock.lastCall?.[0]).toBe('/api/news');
  expect(JSON.parse(localStorage.getItem(preferencesKey)!)).toEqual(emptyPreferences);
});

it('keeps search independent of preferences and restores them with My feed', async () => {
  localStorage.setItem(preferencesKey, JSON.stringify({ ...emptyPreferences, authors: ['Alex'] }));
  render(<App />);
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  // Even an empty submitted search must bypass feed preferences.
  fireEvent.click(screen.getByRole('button', { name: 'Search articles' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  expect(screen.getByRole('heading', { name: 'Search results' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'My feed' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  expect(screen.getByRole('heading', { name: 'My feed' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(preferencesKey)!).authors).toEqual(['Alex']);
});

it('recovers from corrupt preferences and from unavailable storage reads', async () => {
  localStorage.setItem(preferencesKey, '{broken');
  const first = render(<App />);
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  first.unmount();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  render(<App />);
  await screen.findAllByRole('article');
  openPreferences();
  expect(screen.getByText(/Browser storage is unavailable/)).toBeInTheDocument();
});

it('applies preferences for the session when storage writes fail', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
  render(<App />);
  await screen.findAllByRole('article');
  openPreferences();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alex' }));
  save();
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  openPreferences();
  expect(screen.getByText(/Browser storage is unavailable/)).toBeInTheDocument();
});

it('retains successful combinations when another selected publication fails', async () => {
  localStorage.setItem(preferencesKey, JSON.stringify({ ...emptyPreferences, sources: ['guardian', 'nyt'] }));
  news.mockImplementation(async (input) => {
    const isNyt = String(input).includes('source=nyt');
    const body: NewsResponse = { articles: isNyt ? [] : [articles[0]], failures: isNyt ? [{ provider: 'nyt', code: 'unauthorized', message: 'Rejected key' }] : [] };
    return Response.json(body, { status: isNyt ? 502 : 200 });
  });
  render(<App />);
  expect(await screen.findByRole('article')).toBeInTheDocument();
  expect(screen.getByText('Some sources are unavailable')).toBeInTheDocument();
});

it('retains saved publication selections when the catalog no longer contains them', async () => {
  localStorage.setItem(preferencesKey, JSON.stringify({ ...emptyPreferences, sources: ['newsapi:saved-source'] }));
  render(<App />);
  await screen.findByText(/No retrieved stories match your preferences/);
  openPreferences();
  expect(screen.getByRole('checkbox', { name: 'newsapi:saved-source (saved)' })).toBeChecked();
});
