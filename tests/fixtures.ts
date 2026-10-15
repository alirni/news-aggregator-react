// Small synthetic examples shaped like the providers' documented responses.
export const newsApiArticle = {
  source: { id: 'bbc-news', name: 'BBC News' },
  title: 'A science discovery',
  url: 'https://www.bbc.com/news/discovery',
  publishedAt: '2026-10-14T12:00:00Z',
  author: 'Alex Reporter',
  description: 'Scientists share their findings.',
  urlToImage: 'https://example.com/science.jpg',
};

export const guardianArticle = {
  webTitle: 'A new discovery',
  webUrl: 'https://www.theguardian.com/science/discovery',
  webPublicationDate: '2026-10-14T13:00:00Z',
  sectionId: 'science',
  fields: { trailText: '<p>A short description.</p>', thumbnail: 'https://example.com/guardian.jpg', byline: 'Alex and Sam' },
  tags: [
    { type: 'contributor', webTitle: 'Alex Reporter' },
    { type: 'contributor', webTitle: 'Sam Writer' },
    { type: 'keyword', webTitle: 'Science' },
  ],
};

export const nytArticle = {
  source: 'The New York Times',
  headline: { main: 'Science today' },
  web_url: 'https://www.nytimes.com/2026/10/14/science/discovery.html',
  pub_date: '2026-10-14T14:00:00Z',
  abstract: 'The latest findings.',
  section_name: 'Science',
  byline: { original: 'By Jane Q. Doe', person: [{ firstname: 'Jane', middlename: 'Q.', lastname: 'Doe' }] },
  multimedia: [{ subtype: 'xlarge', url: 'images/2026/10/14/science.jpg' }],
};
