import { expect, it } from 'vitest';
import { emptyPreferences, feedQueries, matchesPreferences, parsePreferences } from '../src/lib/preferences';
import type { Article } from '../shared/news';

it('ignores corrupt stored JSON and sanitizes invalid preference values', () => {
  for (const value of [null, '{broken', 'null', '42']) expect(parsePreferences(value)).toEqual(emptyPreferences);
  expect(parsePreferences(JSON.stringify({ sources: ['guardian', 'guardian', 42, 'invalid'], categories: ['science', 'unknown', 'science'], authors: [' Alex ', '', 'Alex', null] }))).toEqual({ sources: ['guardian'], categories: ['science'], authors: ['Alex'] });
});

it('creates unique publication/category combinations and unrestricted defaults', () => {
  expect(feedQueries(emptyPreferences)).toEqual([{}]);
  expect(feedQueries({ sources: ['guardian', 'nyt', 'guardian'], categories: ['science', 'sports', 'science'], authors: ['Alex'] })).toEqual([
    { source: 'guardian', category: 'science' }, { source: 'guardian', category: 'sports' },
    { source: 'nyt', category: 'science' }, { source: 'nyt', category: 'sports' },
  ]);
  expect(feedQueries({ ...emptyPreferences, categories: ['science'] })).toEqual([{ category: 'science' }]);
});

it('uses OR within groups, AND across groups, and unrestricted empty groups', () => {
  const article: Article = { id: '1', url: 'https://example.com/1', provider: 'guardian', source: { id: 'guardian', name: 'The Guardian', provider: 'guardian' }, title: 'Story', publishedAt: '2026-10-14T12:00:00Z', authors: ['Alex'], category: 'science' };
  expect(matchesPreferences(article, emptyPreferences)).toBe(true);
  const preferences = { sources: ['guardian', 'nyt'], categories: ['science', 'sports'] as const, authors: ['Sam', 'alex'] };
  expect(matchesPreferences(article, { ...preferences, categories: [...preferences.categories] })).toBe(true);
  expect(matchesPreferences(article, { ...emptyPreferences, authors: ['Sam'] })).toBe(false);
  expect(matchesPreferences(article, { ...emptyPreferences, sources: ['nyt'] })).toBe(false);
  expect(matchesPreferences({ ...article, category: null }, { ...emptyPreferences, categories: ['science'] })).toBe(false);
});
