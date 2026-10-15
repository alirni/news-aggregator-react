import { app } from './app';

const port = Number(process.env.API_PORT || 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

app.listen(port, () => {
  console.log(`App and API listening on http://localhost:${port}`);
});
