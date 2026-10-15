# News Aggregator

A frontend take-home assignment using React, TypeScript, and Vite, with a small Express API proxy. This initial commit contains the project setup; news integrations and UI features follow in separate commits.

## Local development

Use Node.js 24 LTS (`nvm use` if you use nvm) and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to Express on port 3001. Both processes stop when you press Ctrl+C. Set `API_PORT` in `.env` if port 3001 is unavailable; restart development after changing it.

`GET /api/health` returns `{"status":"ok"}`. API credentials belong only in `.env`; they are not needed for this initial setup. Never use the `VITE_` prefix for secrets, as Vite exposes those values to the browser.

## Checks and builds

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

The build outputs frontend files to `dist/client` and the server to `dist/server`. At this stage, `npm start` runs the API only. Serving the built frontend and Docker instructions will be added in the final packaging step.
