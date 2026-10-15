# News Aggregator

A frontend take-home assignment using React, TypeScript, and Vite, with a small Express API proxy. The project setup and three news integrations are implemented. The frontend is currently a placeholder; the feed UI follows in the next step.

## Local development

Use Node.js 24 LTS (`nvm use` if you use nvm) and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to Express on port 3001. Both processes stop when you press Ctrl+C. Set `API_PORT` in `.env` if port 3001 is unavailable; restart development after changing it.

`GET /api/health` returns `{"status":"ok"}`. API credentials belong only in `.env`. Never use the `VITE_` prefix for secrets, as Vite exposes those values to the browser.

Set these server-side variables before requesting news:

| Variable | Provider setup |
| --- | --- |
| `NEWS_API_KEY` | [NewsAPI](https://newsapi.org/register) |
| `GUARDIAN_API_KEY` | [Guardian Open Platform](https://open-platform.theguardian.com/access/) |
| `NYT_API_KEY` | [NYT developer portal](https://developer.nytimes.com/) — enable Article Search for the key |

Restart the server after editing `.env`. Missing or rejected keys are reported per provider; working providers still return articles.

## API

`GET /api/news` returns `{ articles, failures }`. Optional query parameters:

| Parameter | Format |
| --- | --- |
| `q` | Keyword query, up to 200 characters |
| `from`, `to` | Inclusive UTC dates, `YYYY-MM-DD` |
| `category` | `business`, `entertainment`, `health`, `science`, `sports`, `technology` |
| `source` | Publication ID from `/api/sources`, e.g. `guardian`, `nyt`, `newsapi:bbc-news` |

Example: `/api/news?q=space&category=science&from=2026-10-01&to=2026-10-14`.

The server queries providers concurrently with a ten-second timeout per request, normalizes their articles, removes exact duplicate article URLs, and sorts newest first. Selecting a publication only calls its provider. Invalid filters return HTTP 400; complete provider failure returns 502; successful or partially successful queries return 200, including when no articles match. Failures contain a provider ID, a stable code, and a safe message without credentials or upstream request URLs.

`GET /api/sources` returns `{ sources, failures }`: English-language NewsAPI publications plus The Guardian and The New York Times. The fixed publications remain available if the NewsAPI catalog fails. NewsAPI publication IDs are prefixed with `newsapi:` to distinguish their API route from the direct Guardian/NYT integrations.

Shared response types are in `shared/news.ts`. Provider adapters are in `server/providers`; merging and filtering are in `server/news.ts`.

### Coverage limitations

- Each request retrieves one batch: up to 20 NewsAPI articles, 20 Guardian articles, and 10 NYT articles. No pagination or automatic retries are implemented.
- NewsAPI uses US headlines for the default feed and category queries; keyword or publication queries without a category use its English-language Everything endpoint. [NewsAPI headlines](https://newsapi.org/docs/endpoints/top-headlines) cannot combine category and publication parameters or filter dates, so publication/date constraints are applied to that returned batch. An empty result does not prove that no matching articles exist in the archive.
- Guardian categories map to sections, with a health tag narrowing the Society section. NYT categories map to sections, and results are limited to The New York Times publication. The providers' taxonomies are approximate equivalents.
- NewsAPI does not supply article categories: unfiltered results have a null category. Missing authors produce an empty list. Structured Guardian/NYT authors are preserved individually; unstructured bylines remain one label.
- API access, date history, and quotas depend on the key's plan. The [NewsAPI free plan](https://newsapi.org/pricing) is for development/testing; this assignment targets localhost.

## Checks and builds

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Tests use synthetic provider fixtures and mocked requests, so they need no API keys or network access. They cover parameter mapping, normalization, validation, merging, filtering, and partial failures.

The build outputs frontend files to `dist/client`, the server to `dist/server`, and shared modules to `dist/shared`. At this stage, `npm start` runs the API only. Serving the built frontend and Docker instructions will be added in the final packaging step.
