import { COLLECTIONS, LOOKS } from './catalogue.js';
import { createFluid } from './vendor/fluid-core/src/index.js';

const $ = id => document.getElementById(id);
const lookById = new Map(LOOKS.map(look => [look.id, look]));
const collectionById = new Map(COLLECTIONS.map(collection => [collection.id, collection]));
const curatedIds = [...new Set(COLLECTIONS.flatMap(collection => collection.featured.slice(0, 3)))];
const media = matchMedia('(prefers-reduced-motion: reduce)');
let motion = !media.matches;
let selection = 'curated';
let query = '';
let hero;
let hover;
let hoverTarget;
const hoverHost = document.createElement('div');
hoverHost.className = 'hover-canvas';
hoverHost.setAttribute('aria-hidden', 'true');

function studioUrl(look) {
  return `studio.html?${new URLSearchParams({ look: look.id, seed: String(look.seed ?? 42) })}`;
}
function title(look) { return look.humanTitle || look.name; }
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function image(look) {
  const img = node('img');
  img.src = look.thumbnail; img.alt = ''; img.width = 800; img.height = 500;
  img.loading = 'lazy'; img.decoding = 'async';
  return img;
}
function drawCollections() {
  const fragment = document.createDocumentFragment();
  COLLECTIONS.forEach((collection, index) => {
    const cover = lookById.get(collection.cover);
    if (!cover) return;
    const card = node('a', 'collection-card');
    card.href = `?collection=${collection.id}#looks`;
    card.dataset.collection = collection.id;
    const art = node('div', 'collection-image');
    art.append(image(cover), node('span', 'collection-number', String(index + 1).padStart(2, '0')));
    const heading = node('div', 'collection-title');
    heading.append(node('h3', '', collection.name), node('span', '', `${LOOKS.filter(look => look.collection === collection.id).length} looks ↗`));
    card.append(art, heading, node('p', '', collection.description));
    card.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); selection = collection.id; query = ''; $('searchLooks').value = '';
      syncLocation(); renderLooks();
      $('looks').scrollIntoView({ behavior: media.matches ? 'instant' : 'smooth' });
      $('libraryHeading').tabIndex = -1; $('libraryHeading').focus({ preventScroll: true });
    });
    fragment.append(card);
  });
  $('collectionGrid').replaceChildren(fragment);
}
function stopHover() {
  hover?.pause(); hoverHost.remove(); hoverTarget = null;
  if (motion) hero?.play();
}
function previewCard(target, look) {
  if (!motion || matchMedia('(hover: none)').matches) return;
  try {
    hoverTarget = target; target.querySelector('.art-preview').append(hoverHost); hero?.pause();
    const params = { look: look.name, seed: look.seed ?? 42, paused: false };
    if (hover) hover.set(params); else hover = createFluid(hoverHost, params);
    hover.play();
  } catch {
    stopHover(); $('libraryStatus').textContent = 'Still previews are available. Open a look to try it in the studio.';
  }
}
function renderLooks() {
  stopHover();
  const collection = collectionById.get(selection);
  const normalized = query.trim().toLocaleLowerCase();
  let results = selection === 'curated' && !normalized
    ? curatedIds.map(id => lookById.get(id)).filter(Boolean)
    : LOOKS.filter(look => !collection || look.collection === selection);
  if (normalized) results = results.filter(look => [look.name, look.humanTitle, look.description, look.params?.material, look.params?.substrate, look.params?.field, collectionById.get(look.collection)?.name, ...(look.tags || [])].join(' ').toLocaleLowerCase().includes(normalized));
  $('libraryHeading').textContent = normalized ? `Results for “${query.trim()}”` : collection?.name || (selection === 'curated' ? 'A few favourites.' : 'Every starting point.');
  $('libraryDescription').textContent = collection?.description || (selection === 'curated' && !normalized ? 'A selection from across the Fluid library.' : 'Choose a look to make it your own in the studio.');
  $('libraryEyebrow').textContent = collection ? 'THE COLLECTION' : 'PICK A STARTING POINT';
  $('resultCount').textContent = `${results.length} ${results.length === 1 ? 'look' : 'looks'}`;
  $('curatedFilter').setAttribute('aria-pressed', String(selection === 'curated' && !normalized));
  $('allFilter').setAttribute('aria-pressed', String(selection === 'all' || (selection === 'curated' && !!normalized)));
  $('activeCollection').hidden = !collection; $('activeCollectionName').textContent = collection?.name || '';
  $('activeCollection').setAttribute('aria-label', collection ? `Clear ${collection.name} collection filter` : 'Clear collection filter');
  document.querySelectorAll('.collection-card').forEach(card => {
    if (card.dataset.collection === selection) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current');
  });
  const fragment = document.createDocumentFragment();
  results.forEach(look => {
    const card = node('article', 'art-card'); const link = node('a'); link.href = studioUrl(look);
    link.setAttribute('aria-label', `Open ${title(look)} in the studio`); link.dataset.look = look.id;
    const preview = node('div', 'art-preview'); preview.append(image(look), node('span', 'art-open', '↗'));
    const heading = node('div', 'art-card-title'); heading.append(node('h3', '', title(look)), node('span', '', 'STUDIO ↗'));
    link.append(preview, heading, node('p', '', collectionById.get(look.collection)?.name || 'Fluid study'));
    link.addEventListener('pointerenter', () => previewCard(link, look)); link.addEventListener('pointerleave', stopHover);
    link.addEventListener('focus', () => previewCard(link, look)); link.addEventListener('blur', stopHover);
    card.append(link); fragment.append(card);
  });
  $('lookGrid').replaceChildren(fragment); $('emptyState').hidden = results.length > 0;
}
function setHero(id) {
  const look = lookById.get(id); if (!look) return;
  $('heroStill').src = look.thumbnail; $('heroStill').alt = `${title(look)} — ${look.description}`;
  $('heroTitle').textContent = title(look); $('heroLink').href = $('heroTitle').href = studioUrl(look);
  $('heroLink').setAttribute('aria-label', `Open ${title(look)} in the studio`);
  $('heroCollection').textContent = collectionById.get(look.collection)?.name.toUpperCase(); $('heroMedium').textContent = look.description;
  document.querySelectorAll('[data-hero]').forEach((button, index) => {
    button.setAttribute('aria-pressed', String(button.dataset.hero === id));
    if (button.dataset.hero === id) $('heroNumber').textContent = String(index + 1).padStart(2, '0');
  });
  try {
    const params = { look: look.name, seed: look.seed ?? 42, paused: !motion };
    if (hero) hero.set(params); else hero = createFluid($('heroCanvas'), params);
    if (motion && !hoverTarget) hero.play(); else hero.pause();
  } catch {
    $('heroCanvas').hidden = true; $('motionToggle').hidden = true;
    $('libraryStatus').textContent = 'Showing still previews. The studio needs a browser with WebGL support.';
  }
}
function setMotion(enabled) {
  motion = enabled; $('motionToggle').setAttribute('aria-pressed', String(!motion));
  $('motionToggle').setAttribute('aria-label', motion ? 'Pause artwork previews' : 'Play artwork previews');
  $('motionSymbol').textContent = motion ? 'Ⅱ' : '▷'; $('motionLabel').textContent = motion ? 'Pause' : 'Play';
  if (motion) hero?.play(); else { hero?.pause(); stopHover(); }
}
function syncLocation() {
  const url = new URL(location.href);
  url.searchParams.delete('collection'); url.searchParams.delete('view'); url.searchParams.delete('q');
  if (collectionById.has(selection)) url.searchParams.set('collection', selection); else if (selection === 'all') url.searchParams.set('view', 'all');
  if (query.trim()) url.searchParams.set('q', query.trim());
  history.replaceState(null, '', url);
}
function readLocation() {
  const params = new URLSearchParams(location.search);
  selection = collectionById.has(params.get('collection')) ? params.get('collection') : params.get('view') === 'all' ? 'all' : 'curated';
  query = params.get('q') || ''; $('searchLooks').value = query;
}
function resetLibrary(next = 'all') { selection = next; query = ''; $('searchLooks').value = ''; syncLocation(); renderLooks(); }
$('searchLooks').addEventListener('input', event => { query = event.target.value; syncLocation(); renderLooks(); });
$('curatedFilter').addEventListener('click', () => resetLibrary('curated'));
$('allFilter').addEventListener('click', () => resetLibrary('all'));
$('activeCollection').addEventListener('click', () => resetLibrary('all'));
$('clearSearch').addEventListener('click', () => { resetLibrary('all'); $('searchLooks').focus(); });
$('motionToggle').addEventListener('click', () => setMotion(!motion));
document.querySelectorAll('[data-hero]').forEach(button => button.addEventListener('click', () => setHero(button.dataset.hero)));
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) && !event.target.isContentEditable) { event.preventDefault(); $('searchLooks').focus(); }
});
media.addEventListener('change', event => setMotion(!event.matches));
window.addEventListener('popstate', () => { readLocation(); renderLooks(); });
window.addEventListener('pagehide', event => { if (!event.persisted) { hero?.destroy(); hover?.destroy(); } });
readLocation(); drawCollections(); renderLooks(); setHero('monsoon'); setMotion(motion);
