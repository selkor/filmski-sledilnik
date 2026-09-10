import { generateHtml } from './generate.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
import { fetchRssFeed, fetchPostDetails, extractMovieTitle, isBanned, releaseTypeLabel, qualityRank } from './scraper.js';
import { translateSynopsis, translateGenresLocal } from './translator.js';
import { isSeen, markSeen, upsert, saveStore, pruneOlderThan } from './store.js';

export let status = { state: 'idle', lastRun: null, nextRun: null, lastError: null, newCount: 0 };

export async function runPoll() {
  if (status.state === 'running') return;
  status.state = 'running';
  status.lastError = null;
  status.newCount = 0;
  console.log('[poll] Starting…');

  try {
    // 1. RSS feed → list of posts
    const posts = await fetchRssFeed();
    console.log(`[poll] ${posts.length} items in RSS`);

    const fresh = posts.filter(p => !isSeen(p.url) && !isBanned(p.title));
    console.log(`[poll] ${fresh.length} new, non-banned posts`);

    // 2. Fetch each post page (3 at a time to be polite)
    const BATCH = 3;
    for (let i = 0; i < fresh.length; i += BATCH) {
      const slice = fresh.slice(i, i + BATCH);

      await Promise.all(slice.map(async (post) => {
        markSeen(post.url);

        const movieTitle = extractMovieTitle(post.title);
        if (!movieTitle || movieTitle.length < 2) return;

        const releaseType = releaseTypeLabel(post.title);
        const detail = await fetchPostDetails(post.url);

        // Synopsis: prefer detail page, fall back to RSS description snippet
        let synopsis = detail?.synopsis ?? '';
        if (!synopsis) {
          // RSS description is HTML — strip tags for a plain-text snippet
          synopsis = post.description
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .match(/synopsis[:\s]+([^<\n]{20,})/i)?.[1]?.trim() ?? '';
        }

        // Translate synopsis to Slovenian
        let synopsisSl = '';
        if (synopsis) {
          synopsisSl = await translateSynopsis(synopsis);
          // Small delay to stay within rate limits
          await new Promise(r => setTimeout(r, 300));
        }

        const genreRaw = detail?.genreRaw ?? '';
        const genre    = translateGenresLocal(genreRaw);

        const movie = {
          title:       movieTitle,
          releaseType,
          synopsis,
          synopsisSl:  synopsisSl || synopsis,
          genre,
          cast:        detail?.cast ?? [],
          runtime:     detail?.runtime ?? '',
          imdb:        detail?.imdb ?? '',
          rt:          detail?.rt ?? '',
          poster:      detail?.poster ?? '',
          sourceUrl:   post.url,
          postedAt:    post.pubDate,
        };

        const added = upsert(movie);
        if (added) status.newCount++;
      }));

      // Polite pause between batches
      if (i + BATCH < fresh.length) await new Promise(r => setTimeout(r, 2000));
    }

    pruneOlderThan(14);
    await saveStore();

    status.state = 'idle';
    status.lastRun = new Date().toISOString();
    console.log(`[poll] Done — ${status.newCount} new/updated movies`);
    // Generiraj HTML in push na GitHub
    await generateHtml();
    await gitPush();
  } catch (err) {
    status.state = 'error';
    status.lastRun = new Date().toISOString();
    status.lastError = err.message;
    console.error('[poll] Error:', err.message);
  }
}

export function startPoller(intervalMin = 60) {
  runPoll();
  const ms = intervalMin * 60_000;
  setInterval(() => {
    status.nextRun = new Date(Date.now() + ms).toISOString();
    runPoll();
  }, ms);
  status.nextRun = new Date(Date.now() + ms).toISOString();
  console.log(`[poll] Polling every ${intervalMin} min`);
async function gitPush() {
  const repoPath = process.env.GITHUB_REPO_PATH || 'C:\\filmski-sledilnik';
  try {
    await execFileAsync('git', ['-C', repoPath, 'add', 'docs/index.html'], {});
    await execFileAsync('git', ['-C', repoPath, 'commit', '-m', `Update: ${new Date().toISOString()}`], {});
    await execFileAsync('git', ['-C', repoPath, 'push'], {});
    console.log('[git] Pushed to GitHub');
  } catch (err) {
    console.warn('[git] Push failed:', err.message);
  }
}
}
