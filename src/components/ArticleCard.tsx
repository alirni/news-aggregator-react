import { useState } from 'react';
import type { Article } from '../../shared/news';

const dateFormat = new Intl.DateTimeFormat('en', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

export function ArticleCard({ article }: { article: Article }) {
  const [failedImage, setFailedImage] = useState<string>();
  const showImage = article.imageUrl && failedImage !== article.imageUrl;

  return (
    <article className="article-card">
      <div className="article-image">
        {showImage ? (
          <img src={article.imageUrl} alt="" loading="lazy" onError={() => setFailedImage(article.imageUrl)} />
        ) : <span className="image-placeholder">No image available</span>}
      </div>
      <div className="article-body">
        <div className="article-meta">
          <span className="publication">{article.source.name}</span>
          {article.category && <span className="category">{article.category}</span>}
        </div>
        <h3>
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            {article.title}<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </h3>
        {article.description && <p className="article-description">{article.description}</p>}
        <div className="article-footer">
          <p className="byline">{article.authors.length ? article.authors.join(', ') : 'Author not listed'}</p>
          <time dateTime={article.publishedAt}>{dateFormat.format(new Date(article.publishedAt))}</time>
        </div>
      </div>
    </article>
  );
}
