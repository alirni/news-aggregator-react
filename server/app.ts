import express from 'express';
import { getNews, getSources } from './news.js';
import { parseNewsQuery } from './query.js';

export const app = express();
app.disable('x-powered-by');

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/news', async (request, response) => {
  let query;
  try {
    query = parseNewsQuery(new URL(request.originalUrl, 'http://localhost').searchParams);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Invalid filters.' });
    return;
  }
  const result = await getNews(query);
  const providerCount = query.source ? 1 : 3;
  response.status(result.failures.length === providerCount ? 502 : 200).json(result);
});

app.get('/api/sources', async (_request, response) => {
  response.json(await getSources());
});

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API endpoint not found.' });
});
