import { useState } from 'react';
import type { FormEvent } from 'react';
import { categories } from '../../shared/news';
import type { Category, NewsQuery } from '../../shared/news';
import type { useSources } from '../hooks/useSources';

const emptyFilters = { q: '', from: '', to: '', category: '', source: '' };

export function SearchFilters({ onSearch, catalog }: { onSearch: (query: NewsQuery) => void; catalog: ReturnType<typeof useSources> }) {
  const [draft, setDraft] = useState(emptyFilters);
  const [error, setError] = useState('');
  const { sources, status, retry } = catalog;

  function update(field: keyof typeof emptyFilters, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setError('Start date must not be after end date.');
      return;
    }
    const query: NewsQuery = {};
    if (draft.q.trim()) query.q = draft.q.trim();
    if (draft.from) query.from = draft.from;
    if (draft.to) query.to = draft.to;
    if (draft.category) query.category = draft.category as Category;
    if (draft.source) query.source = draft.source;
    onSearch(query);
  }

  function reset() {
    setDraft(emptyFilters);
    setError('');
    onSearch({});
  }

  return (
    <form className="search-filters" aria-labelledby="search-heading" onSubmit={submit}>
      <h2 id="search-heading">Find your next read</h2>
      <div className="filter-fields">
        <div className="filter-field keyword-field">
          <label htmlFor="keyword">Keyword</label>
          <input id="keyword" type="search" maxLength={200} placeholder="Search articles…" value={draft.q} onChange={(event) => update('q', event.target.value)} />
        </div>
        <div className="filter-field">
          <label htmlFor="category">Category</label>
          <select id="category" value={draft.category} onChange={(event) => update('category', event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="source">Publication</label>
          <select id="source" value={draft.source} onChange={(event) => update('source', event.target.value)} aria-describedby="source-status">
            <option value="">All publications</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.name}{source.provider === 'newsapi' ? ' (via NewsAPI)' : ''}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="from-date">From</label>
          <input id="from-date" type="date" value={draft.from} onChange={(event) => update('from', event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'date-error date-help' : 'date-help'} />
        </div>
        <div className="filter-field">
          <label htmlFor="to-date">To</label>
          <input id="to-date" type="date" value={draft.to} onChange={(event) => update('to', event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'date-error date-help' : 'date-help'} />
        </div>
      </div>
      <p id="date-help" className="filter-help">Dates include the full day in UTC. Results cover a limited batch of articles from each source.</p>
      {error && <p id="date-error" className="form-error" role="alert">{error}</p>}
      <div id="source-status" className="filter-help" aria-live="polite">
        {status === 'loading' && 'Loading publication choices…'}
        {status === 'partial' && <><span>Some publication choices are unavailable. You can still search.</span> <button type="button" className="text-button" onClick={retry}>Retry publications</button></>}
      </div>
      <div className="filter-actions">
        <button type="submit">Search articles</button>
        <button type="button" className="button-secondary" onClick={reset}>Reset filters</button>
      </div>
    </form>
  );
}
