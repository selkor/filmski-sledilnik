import 'dotenv/config';
import { loadStore } from './store.js';
import { startPoller } from './poller.js';

console.log('\n🎬  Filmski sledilnik (lokalni način)\n');

(async () => {
  await loadStore();
  startPoller(parseInt(process.env.FETCH_INTERVAL_MINUTES ?? '60'));
})();