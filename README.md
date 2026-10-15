# News Aggregator

A frontend take-home assignment using React, TypeScript, and Vite, with a small Express API proxy. News comes from NewsAPI, The Guardian, and The New York Times. The frontend and API run together in one Docker container.

The feed displays article images, publication, title, description, author, and UTC publication date. Titles open the original article in a new tab. It supports loading, empty results, retry, and partial provider failures, with image fallbacks and one/two/three-column layouts for mobile/tablet/desktop.

Search by keyword and combine category, publication, and inclusive UTC date filters. Changes apply only when you submit **Search articles** (or press Enter); **Reset filters** clears the form and reloads unrestricted search results. Invalid date ranges are rejected before requesting articles. Retry repeats the submitted query, and responses from superseded requests cannot replace the current results. If publication choices fail to load, keyword/date/category search and the fixed publications remain usable.

## Personalized feed

Open **Feed preferences**, choose multiple publications, categories, or authors, and select **Save preferences**. The app saves selections in localStorage and opens **My feed**. Matching uses OR within each group and AND across populated groups; an empty group is unrestricted. **Reset preferences** removes every restriction. If storage is unavailable, preferences still apply for the current session and the panel explains that they may not survive a reload.

The feed requests each selected publication/category combination once, merges the responses, removes duplicate article URLs, and sorts newest first. Requests run only on save, reset, retry, or returning to **My feed**, rather than on each checkbox change. Selecting many publications/categories consumes more API requests and can encounter provider quotas; one failed combination does not hide successful results.

Author choices accumulate from articles retrieved during the current session and include any saved authors. Author matching happens locally within the retrieved batches, not the providers' full archives. Missing authors cannot match an author preference. Saved authors and publication IDs remain selectable even if absent from the latest data or catalog.

Search ignores all feed preferences, including an empty submitted search. Use **My feed** to return to your saved selections; the search form remains available independently.

## Run with Docker

Install and start Docker Desktop (or Docker Engine). From the project directory, create the environment file if you do not already have one:

```sh
cp .env.example .env
```

Fill in the three API keys listed below. Use plain `KEY=value` lines without surrounding quotes. Keys are supplied at runtime; `.env` is excluded from Git and the Docker build context.

```sh
docker build -t news-aggregator:local .
docker run --rm --name news-aggregator --env-file .env -e API_PORT=3001 -p 127.0.0.1:3001:3001 news-aggregator:local
```

Open [http://localhost:3001](http://localhost:3001). Express serves the built frontend and `/api` from the same port. The explicit `API_PORT` override keeps the container port fixed even if you use a different port in local development. If port 3001 is occupied, use `-p 127.0.0.1:3002:3001` and open localhost:3002 instead.

The foreground command displays server output. To view logs from another terminal:

```sh
docker logs --follow news-aggregator
```

Stop with Ctrl+C, or from another terminal:

```sh
docker stop news-aggregator
```

`--rm` removes the container when it stops. Preferences remain in browser localStorage for the same origin. After changing keys, stop and recreate the container with the same run command; rebuilding the image is unnecessary. Missing or invalid keys show provider failures while working providers continue to supply news.

The Dockerfile uses a build stage for Vite/TypeScript and a runtime stage containing production dependencies and compiled output. The app runs as the unprivileged `node` user. Its health check calls `/api/health` without consuming news API requests.

## Local development

Use Node.js 24 LTS (`nvm use` if you use nvm) and npm. Docker users do not need a local Node installation.

```sh
npm ci
cp .env.example .env # Only if .env does not already exist
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

Provider failures also appear in the terminal running `npm run dev` or `npm start`, with the provider, operation, HTTP status (when available), and a safe error message. For example: `[news] nyt HTTP 401 unauthorized: API key was rejected or lacks access.` Raw upstream responses, request URLs, and credentials are not logged.

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

## Implementation choices

- React hooks manage feed requests and browser preferences; native forms, fetch, and plain CSS keep the dependency surface small.
- Each provider adapter owns its request parameters and response normalization. A shared request helper handles timeouts and safe errors, and the aggregation layer uses the same article interface for all providers.
- Server imports reference the `.ts` source files. TypeScript rewrites relative import extensions to `.js` during compilation, so the output runs directly in Node and Docker. Vite and the test runner resolve extensionless imports.
- Search controls, preferences, feed states, and article cards have separate responsibilities. Shared types, category values, and filtering helpers avoid duplicating provider-specific logic in components.
- There is no database, authentication, client router, or article reader. Article links open the original publication.

## Assignment checklist

| Requirement | Implementation |
| --- | --- |
| React with TypeScript | Vite client with strict TypeScript |
| At least three approved sources | Separate NewsAPI, Guardian, and NYT integrations |
| Keyword search | Submitted search form |
| Date, category, and source filters | Combined filters with date validation and documented provider limits |
| Preferred sources, categories, and authors | Multiple selections saved in localStorage, plus My feed navigation |
| Mobile-responsive UI | Responsive controls and one/two/three-column article grid |
| Docker and running instructions | Multi-stage Dockerfile and commands above |
| DRY, KISS, SOLID practices | Shared contracts/helpers, focused adapters and components, small proxy |

### Coverage limitations

- Each request retrieves one batch: up to 20 NewsAPI articles, 20 Guardian articles, and 10 NYT articles. No pagination or automatic retries are implemented.
- NewsAPI uses US headlines for the default feed and category queries; keyword or publication queries without a category use its English-language Everything endpoint. [NewsAPI headlines](https://newsapi.org/docs/endpoints/top-headlines) cannot combine category and publication parameters or filter dates, so publication/date constraints are applied to that returned batch. An empty result does not prove that no matching articles exist in the archive.
- Guardian categories map to sections, with a health tag narrowing the Society section. NYT categories map to sections. NYT publication and category constraints are applied to the returned batch locally: its documented `fq` source and section filters returned zero hits during live verification. This can produce empty category results even when older matching articles exist. NYT's successful `docs: null` response is treated as empty only when metadata confirms zero hits. The providers' taxonomies are approximate equivalents.
- NewsAPI does not supply article categories: unfiltered results have a null category. Missing authors produce an empty list. Structured Guardian/NYT authors are preserved individually; unstructured bylines remain one label.
- API access, date history, and quotas depend on the key's plan. The [NewsAPI free plan](https://newsapi.org/pricing) is for development/testing; this assignment targets localhost.

## Checks and builds

Run every required automated check with:

```sh
npm run check
```

Or run them individually:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Tests use synthetic provider fixtures and mocked requests, so they need no API keys or network access. They cover parameter mapping, normalization, validation, merging, filtering, partial failures, feed rendering/retry behavior, combined search filters, reset, invalid dates, catalog failures, stale responses, preference semantics/persistence, unavailable storage, and separation of search from the personalized feed. Frontend tests use React Testing Library with jsdom.

The user-flow tests additionally exercise keyboard navigation with Testing Library user-event, retry after a network failure, sorting and deduplication across preference requests, switching to search while the personalized feed is loading, and resetting search without changing saved preferences. Use `npm run test:watch` during development.

### Browser verification

jsdom does not calculate visual layout. Check these flows in a real browser after `npm run dev`:

- At 320px, 390px, 768px, and 1440px widths, confirm no horizontal scrolling, readable cards, and usable search/preference controls. The article grid uses one, two, or three columns as space allows.
- Use Tab to reach **Skip to news**, then Enter to focus the main content. Continue through search inputs, submit with Enter, expand preferences, and toggle checkboxes with Space. Focus should remain visible.
- Submit combined filters, reject an inverted date range, reset filters, and open an article at its original publication.
- Save preferences, reload to confirm they persist, submit search to see independent results, return with **My feed**, and reset preferences.
- With mocked or unavailable providers, check partial results, complete failure, retry recovery, empty results, and missing/failed image fallbacks. Automated tests cover these states without consuming API quotas.

The build outputs frontend files to `dist/client`, the server to `dist/server`, and shared modules to `dist/shared`. After `npm run build`, `npm start` serves the complete app at [http://localhost:3001](http://localhost:3001), or the port configured with `API_PORT`.
