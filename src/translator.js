/**
 * translator.js
 *
 * Free translation layer. Priority:
 *   1. Self-hosted LibreTranslate (if LIBRETRANSLATE_URL is set) — unlimited, free
 *   2. MyMemory public API (no key needed, 5 000 chars/day; 10 000 with email)
 *   3. Local dictionary fallback for genres (always used for genres — faster & free)
 */

import fetch from 'node-fetch';

// ── Genre dictionary en→sl ────────────────────────────────
const GENRE_MAP = {
  'action': 'Akcija',
  'adventure': 'Pustolovščina',
  'animation': 'Animacija',
  'animated': 'Animacija',
  'biography': 'Biografija',
  'biographical': 'Biografija',
  'comedy': 'Komedija',
  'crime': 'Kriminalna',
  'documentary': 'Dokumentarec',
  'drama': 'Drama',
  'family': 'Družinska',
  'fantasy': 'Fantazija',
  'history': 'Zgodovinska',
  'historical': 'Zgodovinska',
  'horror': 'Grozljivka',
  'music': 'Glasba',
  'musical': 'Muzikal',
  'mystery': 'Skrivnost',
  'romance': 'Romantika',
  'romantic': 'Romantika',
  'sci-fi': 'Sci-Fi',
  'science fiction': 'Sci-Fi',
  'sport': 'Šport',
  'sports': 'Šport',
  'superhero': 'Superjunak',
  'thriller': 'Triler',
  'war': 'Vojna',
  'western': 'Western',
};

export function translateGenresLocal(genreStr = '') {
  return genreStr
    .split(/[,|\/]/)
    .map(g => g.trim())
    .filter(Boolean)
    .map(g => GENRE_MAP[g.toLowerCase()] ?? (g.charAt(0).toUpperCase() + g.slice(1)))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 6);
}

// ── Translation via LibreTranslate (self-hosted) ──────────
async function translateLibreTranslate(text, apiUrl) {
  const url = apiUrl.replace(/\/$/, '') + '/translate';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'en', target: 'sl', format: 'text' }),
    timeout: 10000,
  });
  if (!res.ok) throw new Error(`LibreTranslate HTTP ${res.status}`);
  const json = await res.json();
  if (!json.translatedText) throw new Error('No translatedText in response');
  return json.translatedText;
}

// ── Translation via MyMemory (free public API) ────────────
// Docs: https://mymemory.translated.net/doc/spec.php
// Free limit: 5 000 chars/day (anon), 10 000/day with email param
async function translateMyMemory(text, email = '') {
  const params = new URLSearchParams({
    q: text,
    langpair: 'en|sl',
  });
  if (email) params.set('de', email);

  const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
    timeout: 10000,
  });
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const json = await res.json();

  if (json.responseStatus !== 200) {
    throw new Error(`MyMemory error: ${json.responseDetails || json.responseStatus}`);
  }

  return json.responseData.translatedText;
}

// ── Public entry point ────────────────────────────────────
/**
 * Translate a synopsis from English to Slovenian.
 * Falls back gracefully: LibreTranslate → MyMemory → original text.
 */
export async function translateSynopsis(text) {
  if (!text || text.trim().length < 5) return text;

  // Truncate to safe length for MyMemory (500 chars is a safe single request)
  const safe = text.slice(0, 500);

  const libreUrl = process.env.LIBRETRANSLATE_URL?.trim();
  if (libreUrl) {
    try {
      return await translateLibreTranslate(safe, libreUrl);
    } catch (e) {
      console.warn('[translate] LibreTranslate failed, trying MyMemory:', e.message);
    }
  }

  try {
    const email = process.env.MYMEMORY_EMAIL?.trim() || '';
    return await translateMyMemory(safe, email);
  } catch (e) {
    console.warn('[translate] MyMemory failed, using original:', e.message);
    return text; // Return untranslated as last resort
  }
}
