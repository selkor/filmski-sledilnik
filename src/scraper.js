/**
 * scraper.js
 *
 * Fetches scnsrc.me/category/films/ via RSS feed (more reliable than HTML scraping)
 * and then visits each individual post page to extract structured data:
 *   Genre / Cast / Runtime / Ratings / Synopsis / Poster
 *
 * The RSS feed URL: https://www.scnsrc.me/category/films/feed/
 * Individual posts contain lines like:
 *   Genre: Action, Drama
 *   Cast: Actor One, Actor Two
 *   Runtime: 1h 38m
 *   Ratings: IMDB: 7.1 (2,498+ votes) | RT: 87%
 */

import fetch from 'node-fetch';
import { parse as parseHtml } from 'node-html-parser';

const BASE = 'https://www.scnsrc.me';
const RSS_URL = `${BASE}/category/films/feed/`;

// Release types to completely skip
const BANNED = ['BDSCR', 'CAM', 'DVDSCR', 'R5', 'SCR', 'TELECINE', 'TELESYNC'];
// Quality priority for deduplication (higher = better)
const QUALITY = { SD: 0, '480P': 1, '576P': 2, '720P': 3, '1080I': 4, '1080P': 5, REMUX: 6, BDREMUX: 7, UHD: 8, '2160P': 9, '4K': 9 };

export function qualityRank(text = '') {
  const u = text.toUpperCase();
  return Math.max(...Object.entries(QUALITY).map(([k, v]) => u.includes(k) ? v : -1));
}

export function isBanned(text = '') {
  const u = text.toUpperCase();
  return BANNED.some(b => new RegExp(`\\b${b}\\b`).test(u));
}

function releaseTypeLabel(text = '') {
  const u = text.toUpperCase();
  for (const t of ['4K','UHD','2160P','BLURAY','BLU-RAY','BDREMUX','BDRIP','WEB-DL','WEBRIP','WEB','HDRIP','HDTV','DVDRIP','DCPRIP']) {
    if (u.includes(t)) return t.replace('-','');
  }
  return 'WEB';
}

async function httpGet(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

/**
 * Parse the RSS feed and return a list of raw post entries.
 * Returns: [{ title, url, pubDate, description }]
 */
export async function fetchRssFeed() {
  const xml = await httpGet(RSS_URL);
  const items = [];

  // Simple regex-based XML parse (avoids heavy XML library)
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  for (const [, block] of itemBlocks) {
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
                   block.match(/<title>(.*?)<\/title>/i))?.[1]?.trim() ?? '';
    const link  = block.match(/<link>(.*?)<\/link>/i)?.[1]?.trim() ?? '';
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1]?.trim() ?? '';
    const desc  = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
                   block.match(/<description>([\s\S]*?)<\/description>/i))?.[1]?.trim() ?? '';

    if (!title || !link) continue;
    items.push({ title, url: link, pubDate, description: desc });
  }

  return items;
}

/**
 * Parse an individual post page and extract structured movie details.
 */
export async function fetchPostDetails(url) {
  let html;
  try { html = await httpGet(url); } catch { return null; }

  const root = parseHtml(html);

  // ── Post content area ──────────────────────────────────
  const content = root.querySelector('.entry-content, .post-content, [class*="content"]');
  const rawText = content?.text ?? root.text;

  // ── Poster image ───────────────────────────────────────
  let poster = '';
  if (content) {
    for (const img of content.querySelectorAll('img')) {
      const src = img.getAttribute('src') ?? '';
      const w = parseInt(img.getAttribute('width') ?? '0', 10);
      // Skip tiny icons / tracking pixels, prefer portrait posters
      if (src && !src.includes('logo') && !src.includes('stat') && (w === 0 || w >= 100)) {
        poster = src;
        break;
      }
    }
  }

  // ── Structured fields ──────────────────────────────────
  // Pattern matches lines like "Genre: Action, Drama, Thriller"
  const field = (label) => {
    const re = new RegExp(`${label}[:\\s]+([^\\n\\r]{2,200})`, 'i');
    return rawText.match(re)?.[1]?.trim() ?? '';
  };

  const synopsis = field('synopsis');
  const genreRaw = field('genre');
  const castRaw  = field('cast');
  const runtime  = field('runtime').replace(/\s*\(.*$/, '').trim(); // strip trailing parens
  const ratingsRaw = field('ratings');

  // Extract IMDb from "IMDB: 7.1 (2,498+ votes) | RT: 87%"
  const imdb = ratingsRaw.match(/imdb[:\s]+([\d.]+)/i)?.[1] ?? '';
  const rt   = ratingsRaw.match(/rt[:\s]+([\d]+%)/i)?.[1] ?? '';

  // Parse cast into array
  const cast = castRaw
    ? castRaw.split(/[,|]/).map(s => s.trim()).filter(Boolean).slice(0, 5)
    : [];

  return { poster, synopsis, genreRaw, cast, runtime, imdb, rt };
}

/**
 * Extract the movie title from a post title line.
 * Examples:
 *   'Group MADSKY has released 1080p AMZN WEB-DL of film "Glenrothan". Enjoy'
 *   'The group MUSiCANA released SD WEB of 2026\'s Comedy movie Power Ballad'
 *   'Power Ballad 2026 AMZN WEB H264-MUSiCANA'
 */
export function extractMovieTitle(postTitle = '') {
  // Pattern A: ...of film "Title". Enjoy
  let m = postTitle.match(/\bof\s+film\s+"([^"]+)"/i);
  if (m) return m[1].trim();

  // Pattern B: ...movie Title (at end or before period)
  m = postTitle.match(/\bmovie\s+([A-Z][^.!\n]{2,60}?)(?:\.\s*$|\s*$)/i);
  if (m) return m[1].trim();

  // Pattern C: page title like "Power Ballad 2026 AMZN WEB H264-MUSiCANA"
  // Strip year + release tag from end
  const cleaned = postTitle
    .replace(/\s+\d{4}\s+.*$/, '')      // strip year and everything after
    .replace(/\s+-\s+SceneSource.*$/i, '')
    .trim();
  if (cleaned.length > 1) return cleaned;

  return postTitle.split(' ').slice(0, 4).join(' ');
}

export { releaseTypeLabel };
