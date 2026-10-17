import type { ProviderFailure, Provider } from '../../shared/news';
import { useNews } from '../hooks/useNews';
import { ArticleCard } from './ArticleCard';
import { SearchFilters } from './SearchFilters';
import { FeedPreferences } from './FeedPreferences';
import { usePreferences } from '../stores/preferences';
import { useSources } from '../hooks/useSources';
import type { Preferences } from '../lib/preferences';

const providerNames: Record<Provider, string> = {
  newsapi: 'NewsAPI', guardian: 'The Guardian', nyt: 'The New York Times',
};

function FailureList({ failures }: { failures: ProviderFailure[] }) {
  return (
    <ul className="failure-list">
      {failures.map((failure) => (
        <li key={failure.provider}>
          <strong>{providerNames[failure.provider]}:</strong> {failure.code === 'rate_limited'
            ? 'Request limit reached. Please try again later.'
            : 'Currently unavailable.'}
        </li>
      ))}
    </ul>
  );
}

export function NewsFeed() {
  const { preferences, storageError, save } = usePreferences();
  const catalog = useSources();
  const { status, articles, failures, retry, search, showFeed, knownAuthors, isSearch } = useNews(preferences);
  const personalized = preferences.sources.length + preferences.categories.length + preferences.authors.length > 0;

  function savePreferences(next: Preferences) {
    save(next);
    showFeed(next);
  }

  return (
    <>
      <SearchFilters onSearch={search} catalog={catalog} />
      <FeedPreferences
        key={JSON.stringify(preferences)}
        preferences={preferences}
        sources={catalog.sources}
        authors={knownAuthors}
        storageError={storageError}
        onSave={savePreferences}
      />
      <section aria-labelledby="feed-heading" aria-busy={status === 'loading'}>
        <div className="feed-heading">
          <h2 id="feed-heading">{isSearch ? 'Search results' : 'My feed'}</h2>
          {isSearch && <button type="button" className="button-secondary" onClick={() => showFeed(preferences)}>My feed</button>}
          {status === 'success' && <p>{articles.length} {articles.length === 1 ? 'story' : 'stories'} · Newest first</p>}
        </div>
        {status === 'loading' && (
          <div className="feed-state" role="status">
            <h3>Loading the latest stories…</h3>
            <p>Gathering news from our sources.</p>
          </div>
        )}
        {status === 'error' && (
          <div className="feed-state error-state" role="alert">
            <h3>We couldn’t load the news</h3>
            <p>Please try again in a moment. If the problem continues, check your connection.</p>
            {failures.length > 0 && <FailureList failures={failures} />}
            <button type="button" onClick={retry}>Try again</button>
          </div>
        )}
        {status === 'success' && (
          <>
            {failures.length > 0 && (
              <div className="notice" role="status">
                <div>
                  <h3>Some sources are unavailable</h3>
                  <p>Showing the stories we could retrieve.</p>
                  <FailureList failures={failures} />
                </div>
                <button type="button" className="button-secondary" onClick={retry}>Retry sources</button>
              </div>
            )}
            {articles.length === 0 ? (
              <div className="feed-state" role="status">
                <h3>No stories to show</h3>
                <p>{isSearch ? 'No articles matched these filters in the available results. Try broader filters or reset your search.'
                  : personalized ? 'No retrieved stories match your preferences. Try fewer preferences or reset them.'
                    : 'No articles were returned by the available sources. Try again shortly.'}</p>
                <button type="button" onClick={retry}>Try again</button>
              </div>
            ) : (
              <div className="article-grid">
                {articles.map((article) => <ArticleCard key={article.id} article={article} />)}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
