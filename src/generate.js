import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMovies } from './store.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '..', 'docs', 'index.html');

function e(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'ravnokar';
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)}h`;
  if (s < 172800) return 'včeraj';
  return new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' });
}

function movieCard(m) {
  const isNew = m.addedAt && Date.now() - new Date(m.addedAt) < 7_200_000;
  const syn = m.synopsisSl || m.synopsis || '';
  const ratings = [
    m.imdb ? `<span class="imdb-tag">IMDb</span>${e(m.imdb)}/10` : '',
    m.rt ? `<span class="rt-tag">RT</span>${e(m.rt)}` : '',
  ].filter(Boolean).join(' ');

  const img = m.poster
    ? `<img src="${e(m.poster)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const ph = m.poster ? 'style="display:none"' : '';

  return `<div class="card" data-genre="${e((m.genre || []).join(','))}">
  <div class="poster">
    ${img}<div class="poster-ph" ${ph}>🎬</div>
    ${isNew ? '<span class="badge-new">novo</span>' : ''}
    ${m.releaseType ? `<span class="badge-type">${e(m.releaseType)}</span>` : ''}
  </div>
  <div class="body">
    <div class="title">${e(m.title)}</div>
    ${(m.genre || []).length ? `<div class="genres">${m.genre.map(g => `<span class="genre">${e(g)}</span>`).join('')}</div>` : ''}
    ${syn ? `<p class="synopsis">${e(syn)}</p>` : ''}
    <div class="details">
      ${m.cast?.length ? `<div class="dr"><span class="dl">Zasedba</span><span>${e(m.cast.slice(0, 3).join(', '))}</span></div>` : ''}
      ${m.runtime ? `<div class="dr"><span class="dl">Trajanje</span><span>${e(m.runtime)}</span></div>` : ''}
      ${ratings ? `<div class="dr"><span class="dl">Ocena</span><span>${ratings}</span></div>` : ''}
    </div>
    <div class="foot">${ago(m.addedAt)}</div>
  </div>
</div>`;
}

export async function generateHtml() {
  const movies = getMovies();

  // Group by date
  const groups = {};
  for (const m of movies) {
    const day = m.addedAt
      ? new Date(m.addedAt).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' })
      : 'Neznano';
    if (!groups[day]) groups[day] = [];
    groups[day].push(m);
  }

  // Build genre list
  const allGenres = [...new Set(movies.flatMap(m => m.genre || []))].sort();

  // Build grid HTML
  let gridHtml = '';
  for (const [day, dayMovies] of Object.entries(groups)) {
    gridHtml += `<div class="day-separator"><span>${day}</span></div>`;
    gridHtml += dayMovies.map(movieCard).join('');
  }

  const html = `<!DOCTYPE html>
<html lang="sl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Novi filmi</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0c0c0e; --s1: #141416; --s2: #1c1c1f; --s3: #242428;
  --b: rgba(255,255,255,.07); --bh: rgba(255,255,255,.14);
  --t1: #edebe6; --t2: #8e8c87; --t3: #4e4d4a;
  --red: #e0403f; --gold: #f5c518; --r: 9px;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
       background: var(--bg); color: var(--t1); min-height: 100vh;
       -webkit-font-smoothing: antialiased; }
header {
  position: sticky; top: 0; z-index: 50;
  background: rgba(12,12,14,.9); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--b);
  height: 52px; padding: 0 1.25rem;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
}
.logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
.logo-icon { width: 26px; height: 26px; border-radius: 7px; background: var(--red);
  display: flex; align-items: center; justify-content: center; font-size: 14px; }
.logo-name { font-size: 14px; font-weight: 600; color: var(--t1); letter-spacing: -.02em; }
.updated { font-size: 11px; color: var(--t3); }
main { max-width: 1300px; margin: 0 auto; padding: 1.25rem; }
.toolbar { display: flex; align-items: center; justify-content: space-between;
  gap: .75rem; flex-wrap: wrap; margin-bottom: 1rem; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chip { height: 26px; padding: 0 10px; border-radius: 20px;
  border: 1px solid var(--b); background: transparent; color: var(--t2);
  font-size: 11px; cursor: pointer; transition: all .12s; white-space: nowrap; }
.chip:hover { border-color: var(--bh); color: var(--t1); }
.chip.on { background: rgba(224,64,63,.13); border-color: var(--red); color: var(--red); }
.meta { font-size: 12px; color: var(--t3); white-space: nowrap; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: .9rem; }
.card { background: var(--s1); border: 1px solid var(--b); border-radius: 11px;
  overflow: hidden; display: flex; flex-direction: column;
  transition: border-color .15s, transform .15s; }
.card:hover { border-color: var(--bh); transform: translateY(-2px); }
.card.hidden { display: none; }
.poster { position: relative; aspect-ratio: 2/3; background: var(--s2); overflow: hidden; }
.poster img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s; }
.card:hover .poster img { transform: scale(1.04); }
.poster-ph { width: 100%; height: 100%; display: flex; align-items: center;
  justify-content: center; font-size: 40px; color: var(--t3); }
.badge-new { position: absolute; top: 7px; left: 7px; background: var(--red); color: #fff;
  font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  letter-spacing: .06em; text-transform: uppercase; }
.badge-type { position: absolute; top: 7px; right: 7px; background: rgba(0,0,0,.75);
  color: rgba(255,255,255,.85); font-size: 9px; font-weight: 600; padding: 2px 6px;
  border-radius: 4px; letter-spacing: .05em; backdrop-filter: blur(4px); }
.body { padding: 11px; flex: 1; display: flex; flex-direction: column; gap: 7px; }
.title { font-size: 13.5px; font-weight: 600; line-height: 1.35; color: var(--t1); letter-spacing: -.01em; }
.genres { display: flex; flex-wrap: wrap; gap: 4px; }
.genre { font-size: 10px; padding: 2px 7px; border-radius: 20px;
  background: var(--s2); color: var(--t2); border: 1px solid var(--b); }
.synopsis { font-size: 11.5px; line-height: 1.6; color: var(--t2); }
.details { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--t2); }
.dr { display: flex; gap: 5px; align-items: flex-start; }
.dl { color: var(--t3); min-width: 52px; flex-shrink: 0; }
.imdb-tag { display: inline-block; background: var(--gold); color: #000;
  font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 3px;
  margin-right: 4px; vertical-align: middle; }
.rt-tag { display: inline-block; background: #fa320a; color: #fff;
  font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
  margin-left: 4px; vertical-align: middle; }
.foot { margin-top: auto; padding-top: 7px; border-top: 1px solid var(--b);
  font-size: 10px; color: var(--t3); }
.day-separator { grid-column: 1 / -1; padding: 14px 0 10px 0; margin-top: 8px;
  display: flex; align-items: center; gap: 12px; }
.day-separator:first-child { margin-top: 0; }
.day-separator span { font-size: 13px; font-weight: 700; color: var(--t1);
  text-transform: uppercase; letter-spacing: .08em; white-space: nowrap; }
.day-separator::after { content: ''; flex: 1; height: 1px;
  background: linear-gradient(to right, var(--bh), transparent); }
@media(max-width:550px) {
  main { padding: .9rem; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: .7rem; }
}
</style>
</head>
<body>
<header>
  <a class="logo" href="/">
    <div class="logo-icon">🎬</div>
    <span class="logo-name">Novi filmi</span>
  </a>
  <span class="updated">Posodobljeno: ${new Date().toLocaleString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
</header>
<main>
  <div class="toolbar">
    <div class="chips" id="chips">
      <button class="chip on" onclick="setGenre('vsi',this)">Vsi</button>
      ${allGenres.map(g => `<button class="chip" onclick="setGenre(${JSON.stringify(g)},this)">${e(g)}</button>`).join('')}
    </div>
    <span class="meta" id="meta">${movies.length} filmov</span>
  </div>
  <div class="grid" id="grid">
    ${gridHtml || '<p style="color:var(--t3);padding:2rem">Ni filmov.</p>'}
  </div>
</main>
<script>
let activeGenre = 'vsi';
function setGenre(g, el) {
  activeGenre = g;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  const cards = document.querySelectorAll('.card');
  let count = 0;
  cards.forEach(card => {
    const genres = card.dataset.genre ? card.dataset.genre.split(',') : [];
    const show = g === 'vsi' || genres.includes(g);
    card.classList.toggle('hidden', !show);
    if (show) count++;
  });
  // Hide empty day separators
  document.querySelectorAll('.day-separator').forEach(sep => {
    let next = sep.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('day-separator')) {
      if (!next.classList.contains('hidden')) hasVisible = true;
      next = next.nextElementSibling;
    }
    sep.style.display = hasVisible ? '' : 'none';
  });
  document.getElementById('meta').textContent = count + ' filmov';
}
</script>
</body>
</html>`;

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, html, 'utf8');
  console.log(`[generate] HTML generated → ${OUT} (${movies.length} movies)`);
}