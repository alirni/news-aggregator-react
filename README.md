# News Aggregator

A frontend-only React + TypeScript take-home assignment. The browser fetches articles directly from **NewsAPI**, **The Guardian**, and **The New York Times**. Vite handles development/builds, and Docker serves the static app with Nginx. There is no backend or API proxy.

Source: [GitHub](https://github.com/alirni/news-aggregator-react). Published image: [Docker Hub](https://hub.docker.com/r/alirni/news-aggregator).

## Local development

Use Node.js 24 LTS (`nvm use` if you use nvm) and npm.

```sh
npm ci
cp .env.example .env # Skip this if .env already exists
```

Set the following values in `.env`:

| Variable | Provider setup |
| --- | --- |
| `VITE_NEWS_API_KEY` | [NewsAPI](https://newsapi.org/register) |
| `VITE_GUARDIAN_API_KEY` | [Guardian Open Platform](https://open-platform.theguardian.com/access/) |
| `VITE_NYT_API_KEY` | [NYT developer portal](https://developer.nytimes.com/) — enable Article Search |

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Restart Vite after editing `.env`. Stop with Ctrl+C.

**These are public browser demo keys.** Vite embeds `VITE_` values in the JavaScript bundle, and requests expose them in browser developer tools. Keeping `.env` out of Git does not make bundled keys secret. Use dedicated development keys and never put private credentials in these variables.

This assignment targets **localhost development/testing**. [NewsAPI's free plan](https://newsapi.org/pricing) enables CORS for localhost and does not permit staging or production use. Direct requests also depend on each provider's CORS policy. All three providers were verified from a localhost browser; do not disable browser security or use a public CORS proxy if a provider rejects an origin.

## Run with Docker

Start Docker Desktop (or Docker Engine). Create a `.env` file using the three variable names above and your own provider keys (or copy `.env.example` from this repository). Keep each value on one unquoted `KEY=value` line.

Pull the published image and start it without building the project:

```sh
docker pull alirni/news-aggregator:0.1.0
docker run --rm --name news-aggregator \
  --env-file .env -p 127.0.0.1:3001:80 alirni/news-aggregator:0.1.0
```

Open [http://localhost:3001](http://localhost:3001). If port 3001 is occupied, change the host mapping to `-p 127.0.0.1:3002:80` and open localhost:3002. The image supports Linux AMD64 and ARM64, including Docker Desktop on Intel and Apple Silicon. The `latest` tag is also available; `0.1.0` identifies this submission.

To build the same image locally instead:

```sh
docker build -t news-aggregator:local .
docker run --rm --name news-aggregator \
  --env-file .env -p 127.0.0.1:3001:80 news-aggregator:local
```

The image has two stages: Node builds the frontend, then Nginx serves the compiled files. No Node server or proxy runs in the final container. `.env` is excluded from the build context, and the published image contains no provider keys. At startup, a small entrypoint script writes the supplied keys into `config.js`, which the frontend loads before starting. These keys are still visible in the running app's browser, as required for direct provider requests. Recreate the container with updated environment values to change keys; rebuilding is unnecessary. Missing keys produce provider-failure messages in the app.

Stop with Ctrl+C, or from another terminal:

```sh
docker stop news-aggregator
```

`--rm` removes the stopped container. Browser preferences remain in localStorage for the same origin. `docker logs --follow news-aggregator` shows Nginx startup/access logs. **Provider errors appear in the browser console and Network panel**, alongside the app's provider-failure messages. The container health check requests the static home page without consuming API quotas.

## Search and personalized feed

- Search by keyword and combine category, publication, and inclusive UTC date filters. Fields apply only when submitting **Search articles** or pressing Enter. Invalid date ranges are rejected before fetching. **Reset filters** clears the form and loads unrestricted search results.
- Open **Feed preferences**, choose multiple publications, categories, and authors, then **Save preferences**. Selections persist in localStorage. Matching uses OR within a group and AND across populated groups; an empty group is unrestricted. **Reset preferences** removes every restriction.
- Search ignores saved feed preferences, including an empty submitted search. **My feed** restores saved selections. Preferences still apply for the session if browser storage is unavailable, with an explanatory message.
- Each selected publication/category combination is requested once. Articles are merged, deduplicated by exact URL, and sorted newest first. Selecting many combinations consumes more provider requests. A failed provider does not hide working providers' stories.
- Author choices accumulate from retrieved articles and include saved selections. Authors are matched locally within returned batches, not the full archives. Missing authors cannot match an author preference. Saved author/publication choices remain selectable when absent from current data.
- Cards show the available image, title, description, publication, author, and UTC date. Links open the original article. Loading, empty, error, retry, partial-failure, and image-fallback states are included. Superseded requests are aborted and their results ignored.

## Structure and implementation choices

- `src/api/providers` contains a focused adapter per provider plus shared request/normalization helpers. `src/api/news.ts` fetches the selected providers concurrently, combines their results, and records safe provider failures.
- `src/stores/preferences.ts` is one small Zustand store for saved preferences and the save action. It reuses the existing localStorage format and error handling; draft form values and network state remain in React hooks.
- `src/lib` handles preference matching and combining preference requests. Hooks manage requests and the publication catalog; separate components handle forms, feed states, and article cards.
- `shared/news.ts` defines the common article/source/query types and categories. Imports are extensionless, resolved by Vite and the test runner. React state, a single Zustand store, native fetch/forms, plain CSS, and a small set of shared helpers keep the app simple.
- There is no database, authentication, router, article reader, or backend. HTTP statuses belong to upstream provider requests; the app has no `/api/news`, `/api/sources`, or `/api/health` endpoints.

## Provider limitations

- Each query retrieves one batch: up to 20 NewsAPI articles, 20 Guardian articles, and 10 NYT articles. There is no pagination or automatic retry. Each direct request has a ten-second timeout, combined with cancellation when switching queries.
- NewsAPI uses US headlines for default/category queries and English-language Everything for keyword/publication queries without a category. Its [headlines endpoint](https://newsapi.org/docs/endpoints/top-headlines) cannot combine category and publication parameters or filter dates; those constraints are applied locally to the returned batch.
- Guardian categories map to sections, with a health tag narrowing Society. NYT publication/category checks run locally because the documented `fq` filters returned zero hits during live verification. Empty category results do not prove that matching articles are absent from the archive. NYT `docs: null` counts as empty only when metadata confirms zero hits.
- NewsAPI does not supply article categories; results without a category query have a null category. Structured contributors are preserved individually, while unstructured bylines remain one label. Publication IDs prefixed with `newsapi:` distinguish that integration from direct Guardian/NYT access.
- Keys, quotas, archive access, CORS, and service availability depend on the provider. Application logs show safe provider/error codes; browser Network tools naturally show the direct requests and demo keys.

## Checks and builds

```sh
npm run check
```

This runs lint, all tests, TypeScript checks, and the frontend build. Individual commands are `npm run lint`, `npm test`, `npm run typecheck`, and `npm run build`. Use `npm run test:watch` during development.

Provider tests mock fetch with synthetic upstream fixtures. UI tests mock the frontend provider layer with React Testing Library/user-event and jsdom. Tests need no real keys or network access. Coverage includes runtime API-key configuration, parameter mapping, normalization, partial failures, cancellation, dates, merging/deduplication, search/reset, preference semantics/persistence, storage errors, keyboard interactions, and stale responses.

The build outputs static files to `dist`. `npm start` previews the build at [http://localhost:3001](http://localhost:3001).

### Browser verification

jsdom does not calculate visual layout. In a real browser:

- Check 320px, 390px, 768px, and 1440px widths for horizontal overflow, readable cards, and usable forms. The grid uses one, two, or three columns as space allows.
- Tab to **Skip to news**, press Enter, then navigate search controls. Submit with Enter, expand preferences, and toggle checkboxes with Space. Focus should be visible.
- Submit combined filters, reject an inverted date range, reset, and open an original article.
- Save preferences, reload, search independently, return to **My feed**, and reset preferences.
- Use mocked provider responses to check partial/complete failure, retry recovery, empty results, and image fallbacks without spending API quotas.

## Assignment checklist

| Requirement | Implementation |
| --- | --- |
| React with TypeScript | Vite frontend with strict TypeScript |
| Three approved data sources | Direct NewsAPI, Guardian, and NYT adapters |
| Keyword, date, category, source filtering | Submitted form with combined filters and date validation |
| Preferred sources, categories, authors | Multiple selections saved in localStorage |
| Mobile-responsive UI | Responsive forms and article grid |
| Docker and running instructions | Multi-stage build and static Nginx container |
| DRY, KISS, SOLID practices | Shared contracts/helpers and focused adapters/components |
