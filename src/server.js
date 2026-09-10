import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadStore, getMovies, count } from './store.js';
import { startPoller, runPoll, status } from './poller.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PORT  = parseInt(process.env.PORT ?? '3000');
const INTERVAL = parseInt(process.env.FETCH_INTERVAL_MINUTES ?? '60');

const app = express();
app.use(express.static(path.join(__dir, '..', 'public')));

app.get('/api/movies', (_req, res) => {
  res.json({ movies: getMovies(), total: count(), status });
});

app.get('/api/status', (_req, res) => {
  res.json({ total: count(), status });
});

app.post('/api/refresh', (_req, res) => {
  if (status.state === 'running') return res.json({ ok: false, message: 'Already running' });
  runPoll().catch(console.error);
  res.json({ ok: true });
});

// SPA fallback
app.get('*', (_req, res) => res.sendFile(path.join(__dir, '..', 'public', 'index.html')));

(async () => {
  await loadStore();
  startPoller(INTERVAL);
  app.listen(PORT, () => console.log(`\n🎬  Running → http://localhost:${PORT}\n`));
})();
