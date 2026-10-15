import { useState } from 'react';
import { categories } from '../../shared/news';
import type { Source } from '../../shared/news';
import { emptyPreferences } from '../lib/preferences';
import type { Preferences } from '../lib/preferences';

interface Props {
  preferences: Preferences;
  sources: Source[];
  authors: string[];
  storageError: boolean;
  onSave: (preferences: Preferences) => void;
}

export function FeedPreferences({ preferences, sources, authors, storageError, onSave }: Props) {
  const [draft, setDraft] = useState(preferences);
  const sourceOptions = [
    ...sources.map((source) => ({ id: source.id, label: `${source.name}${source.provider === 'newsapi' ? ' (via NewsAPI)' : ''}` })),
    ...preferences.sources.filter((id) => !sources.some((source) => source.id === id)).map((id) => ({ id, label: `${id} (saved)` })),
  ];
  const authorOptions = [...new Set([...authors, ...preferences.authors])].sort();

  function toggle(group: keyof Preferences, value: string) {
    setDraft((previous) => {
      const values: readonly string[] = previous[group];
      return { ...previous, [group]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  }

  return (
    <details className="feed-preferences">
      <summary>Feed preferences</summary>
      <p className="filter-help">Choose any publications, categories, and authors. Leave a group empty to include all. Choices within a group are combined; selected groups must all match.</p>
      <div className="preference-groups">
        <fieldset>
          <legend>Preferred publications</legend>
          <div className="preference-options">
            {sourceOptions.map(({ id, label }) => (
              <label key={id}><input type="checkbox" checked={draft.sources.includes(id)} onChange={() => toggle('sources', id)} />{label}</label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Preferred categories</legend>
          <div className="preference-options">
            {categories.map((category) => (
              <label key={category}><input type="checkbox" checked={draft.categories.includes(category)} onChange={() => toggle('categories', category)} />{category[0].toUpperCase() + category.slice(1)}</label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Preferred authors</legend>
          <p id="author-help" className="filter-help">Authors come from retrieved stories. Only retrieved articles can match these preferences.</p>
          <div className="preference-options" aria-describedby="author-help">
            {authorOptions.length ? authorOptions.map((author) => (
              <label key={author}><input type="checkbox" checked={draft.authors.includes(author)} onChange={() => toggle('authors', author)} />{author}</label>
            )) : <p className="filter-help">Author choices appear after stories load.</p>}
          </div>
        </fieldset>
      </div>
      <p className="filter-help" aria-live="polite">{storageError
        ? 'Browser storage is unavailable. Your preferences apply for this session but may not survive a reload.'
        : 'Preferences are saved on this browser when you apply them.'}</p>
      <div className="filter-actions">
        <button type="button" onClick={() => onSave(draft)}>Save preferences</button>
        <button type="button" className="button-secondary" onClick={() => { setDraft(emptyPreferences); onSave(emptyPreferences); }}>Reset preferences</button>
      </div>
    </details>
  );
}
