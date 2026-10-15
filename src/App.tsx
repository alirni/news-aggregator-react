import { NewsFeed } from './components/NewsFeed';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to news</a>
      <header className="site-header">
        <div className="page-width masthead">
          <p className="brand"><span className="brand-mark" aria-hidden="true">N.</span> News Aggregator</p>
          <p className="header-note">A broader view, in one place.</p>
        </div>
      </header>
      <main id="main-content" className="page-width" tabIndex={-1}>
        <div className="introduction">
          <p className="eyebrow">Your daily briefing</p>
          <h1>Make room for a wider perspective.</h1>
          <p>Headlines from NewsAPI, The Guardian, and The New York Times.</p>
        </div>
        <NewsFeed />
      </main>
      <footer className="site-footer page-width">
        <p>Read the full story at its original publication.</p>
      </footer>
    </>
  );
}
