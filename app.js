// JoyFeed News — Direct open (no iframe reader)
const API = '/.netlify/functions/happy-news';

const grid = document.getElementById('grid');
const chips = document.getElementById('chips');
const searchInput = document.getElementById('search');
const categorySel = document.getElementById('categorySel');
const regionSel = document.getElementById('regionSel');
const refreshBtn = document.getElementById('refreshBtn');
const intervalSel = document.getElementById('intervalSel');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const statusLine = document.getElementById('statusLine');
const themeBtn = document.getElementById('themeBtn');

let allItems = [];
let shown = 0;
const pageSize = 24;
let timer = null;

const QUICK_CHIPS = ['Community','Wildlife','Science','Climate','Humanity','Arts'];

function timeAgo(iso) {
  const now = new Date();
  const then = new Date(iso);
  const s = Math.max(1, Math.floor((now - then) / 1000));
  const units = [['year',31536000],['month',2592000],['week',604800],['day',86400],['hour',3600],['minute',60]];
  for (const [name, secs] of units) {
    const val = Math.floor(s / secs);
    if (val >= 1) return `${val} ${name}${val>1?'s':''} ago`;
  } return 'just now';
}

function buildSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "JoyFeed News stories",
    "itemListElement": (items||[]).slice(0,20).map((it,i)=>({
      "@type":"ListItem","position":i+1,"url":it.link,"name":it.title
    }))
  };
}

function withUTM(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return url;
    if (!u.searchParams.has('utm_source')) {
      u.searchParams.set('utm_source','joyfeednews');
      u.searchParams.set('utm_medium','referral');
    }
    return u.toString();
  } catch { return url; }
}

function card(item) {
  const cats = item.categories || [];
  const regionBadge = item.region ? `<span class="badge Region">${item.region}</span>` : '';
  const catBadges = cats.map(c => `<span class="badge ${c}">${c}</span>`).join('') + regionBadge;
  const img = item.image ? `<img class="thumb" alt="" loading="lazy" src="${item.image}">` : '';
  const firstCat = cats[0] || '';
  const href = withUTM(item.link);
  return `
    <article class="card" data-cat="${firstCat}">
      <a class="open" href="${href}" target="_blank" rel="noopener noreferrer">
        ${img}
        <h3>${item.title}</h3>
        <p class="muted">${item.excerpt || ''}</p>
        <div class="meta">
          <span>${item.site || item.sourceTitle || 'Source'}</span>
          <span>•</span>
          <time datetime="${item.isoDate}">${timeAgo(item.isoDate)}</time>
        </div>
        <div class="badges">${catBadges}</div>
      </a>
      <div class="card-actions">
        <button class="ghost preview-btn" data-id="${item.id}">Preview</button>
        <a class="ghost" href="${href}" target="_blank" rel="noopener noreferrer">Open ↗</a>
      </div>
    </article>
  `;
}

function render(reset=false) {
  if (!grid) return;
  if (reset) { shown = 0; grid.innerHTML = ''; }
  const slice = allItems.slice(shown, shown + pageSize);
  if (!slice.length && shown === 0) {
    grid.innerHTML = '<div class="card" style="padding:20px"><h3>No stories yet</h3><p class="muted">Try Refresh — we keep pulling new happy news ✨</p></div>';
  } else {
    grid.insertAdjacentHTML('beforeend', slice.map(card).join(''));
  }
  shown += slice.length;
  loadMoreBtn.style.display = shown < allItems.length ? 'inline-block' : 'none';

  const schemaEl = document.getElementById('schema-json');
  if (schemaEl) schemaEl.textContent = JSON.stringify(buildSchema(allItems), null, 2);
}

async function load() {
  try {
    refreshBtn.disabled = true; refreshBtn.textContent = 'Loading…';
    statusLine.textContent = 'Fetching uplifting stories…';

    const params = new URLSearchParams(location.search);
    const q = (searchInput?.value || '').trim();
    const cat = categorySel?.value || '';
    const region = regionSel?.value || '';
    if (q) params.set('q', q);
    if (cat) params.set('category', cat);
    if (region) params.set('region', region);
    params.set('fast','1'); // default fast mode

    const res = await fetch(`${API}?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json();
    allItems = data.items || [];
    render(true);

    const updated = data.updatedAt ? timeAgo(data.updatedAt) : 'just now';
    statusLine.textContent = `Updated ${updated} • ${allItems.length} stories`;
  } catch (err) {
    console.error(err);
    statusLine.textContent = 'Could not load stories.';
    grid.innerHTML = '<p class="muted">Something went wrong. Try Refresh.</p>';
  } finally {
    refreshBtn.disabled = false; refreshBtn.textContent = 'Refresh';
  }
}

function writeFiltersToURL() {
  const p = new URLSearchParams(location.search);
  const cat = categorySel?.value || '';
  const reg = regionSel?.value || '';
  if (cat) p.set('category', cat); else p.delete('category');
  if (reg) p.set('region', reg); else p.delete('region');
  history.pushState({ category: cat, region: reg }, '', `?${p.toString()}`);
}
function readFiltersFromURL() {
  const p = new URLSearchParams(location.search);
  const cat = p.get('category') || '';
  const reg = p.get('region') || '';
  if (categorySel) categorySel.value = cat;
  if (regionSel) regionSel.value = reg;
}
function applyFilter() { writeFiltersToURL(); render(true); load(); }

refreshBtn?.addEventListener('click', load);
searchInput?.addEventListener('change', applyFilter);
categorySel?.addEventListener('change', applyFilter);
regionSel?.addEventListener('change', applyFilter);
loadMoreBtn?.addEventListener('click', () => render(false));

if (chips) {
  chips.innerHTML = QUICK_CHIPS.map(t => `<button class="ghost" data-chip="${t}">${t}</button>`).join('');
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chip]'); if (!btn) return;
    categorySel.value = btn.dataset.chip; applyFilter();
  });
}

// Preview modal
document.addEventListener('click', (e) => {
  const b = e.target.closest('.preview-btn');
  if (!b) return;
  const id = b.dataset.id;
  const it = allItems.find(x => x.id === id);
  if (!it) return;
  e.preventDefault();
  openPreview(it);
});

function openPreview(it) {
  const existing = document.getElementById('preview');
  if (existing) existing.remove();
  const m = document.createElement('div');
  m.id = 'preview';
  m.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal">
      <button class="close">&times;</button>
      <div class="modal-body">
        ${it.image ? `<img src="${it.image}" alt="" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px">` : ''}
        <h3 style="margin:12px 0 6px">${it.title}</h3>
        <p class="muted">${it.excerpt || ''}</p>
        <div class="meta" style="margin-top:10px">
          <span>${it.site || it.sourceTitle || 'Source'}</span>
          <span>•</span>
          <time datetime="${it.isoDate}">${timeAgo(it.isoDate)}</time>
        </div>
        <div style="margin-top:14px">
          <a class="ghost" href="${withUTM(it.link)}" target="_blank" rel="noopener noreferrer">Read on source ↗</a>
        </div>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', (e) => {
    if (e.target.classList.contains('close') || e.target.classList.contains('modal-backdrop')) m.remove();
  });
}

window.addEventListener('popstate', () => { readFiltersFromURL(); render(true); load(); });

themeBtn?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? '' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
});
document.documentElement.dataset.theme = localStorage.getItem('theme') || '';

intervalSel?.addEventListener('change', () => {
  if (timer) { clearInterval(timer); timer = null; }
  const mins = parseInt(intervalSel.value, 10);
  if (mins > 0) timer = setInterval(load, mins * 60 * 1000);
});

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(() => {}); }

readFiltersFromURL();
load();
