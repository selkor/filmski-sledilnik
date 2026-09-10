import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { qualityRank } from './scraper.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const MOVIES_FILE = path.join(DIR, 'movies.json');
const SEEN_FILE   = path.join(DIR, 'seen.json');

let movies   = [];   // deduplicated list
let seenUrls = new Set();

function slug(title = '') {
  return title.toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 60);
}

export async function loadStore() {
  await fs.mkdir(DIR, { recursive: true });
  try { movies = JSON.parse(await fs.readFile(MOVIES_FILE, 'utf8')); } catch { movies = []; }
  try { seenUrls = new Set(JSON.parse(await fs.readFile(SEEN_FILE, 'utf8'))); } catch { seenUrls = new Set(); }
  console.log(`[store] ${movies.length} movies, ${seenUrls.size} seen URLs loaded`);
}

export async function saveStore() {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(MOVIES_FILE, JSON.stringify(movies, null, 2));
  await fs.writeFile(SEEN_FILE, JSON.stringify([...seenUrls]));
}

export const isSeen = (url) => seenUrls.has(url);
export const markSeen = (url) => seenUrls.add(url);

/** Add or upgrade a movie. Returns true if the UI should show it as new/updated. */
export function upsert(movie) {
  const key = slug(movie.title);
  const idx = movies.findIndex(m => slug(m.title) === key);
  if (idx === -1) {
    movies.unshift({ ...movie, addedAt: new Date().toISOString() });
    return true;
  }
  const existing = movies[idx];
  if (qualityRank(movie.releaseType) > qualityRank(existing.releaseType)) {
    movies[idx] = { ...movie, addedAt: existing.addedAt, upgradedAt: new Date().toISOString() };
    return true;
  }
  return false;
}

export const getMovies = () => [...movies].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
export const count = () => movies.length;

export function pruneOlderThan(days = 14) {
  const cutoff = Date.now() - days * 86_400_000;
  const before = movies.length;
  movies = movies.filter(m => +new Date(m.addedAt) > cutoff);
  if (movies.length < before) console.log(`[store] Pruned ${before - movies.length} old movies`);
}
