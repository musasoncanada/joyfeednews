const API = '/.netlify/functions/happy-news';

const grid = document.getElementById('grid');
const chips = document.getElementById('chips');
const searchInput = document.getElementById('search');
const categorySel = document.getElementById('categorySel');
const refreshBtn = document.getElementById('refreshBtn');
const intervalSel = document.getElementById('intervalSel');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const statusLine = document.getElementById('statusLine');
const themeBtn = document.getElementById('themeBtn');

let allItems = [];
let shown = 0;
let pageSize = 24;
let timer = null;

const QUICK_CHIPS = ['Community','Wildlife','Science','Climate','Humanity','Arts','Scholarship','Rescue','Solar','Teacher'];

function timeAgo(iso) {
  const now = new Date();
  const then = new Date(iso);
  const s = Math.max(1, Math.floor((now - then) / 1000));
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60]
  ];
  for (const [name, secs] of units) {
    const val = Math.floor(s / secs);
    if (val >= 1) return `${val} ${name}${val>1?'s':''} ago`;
  }
  return 'just now';
}

function buildSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "JoyFeed News stories",
    "itemListElement": items.slice(0, 20).map((it, i) => ({
      "@type": "ListItem",
      "position": i+1,
      "url": it.link,
      "name": it.title
    }))
  };
}

function card(item) {
  const cats = item.categories || [];
  const catBadges = cats.map(c => `<span class="badge ${c}">${c}</span>`).join('');
  const img = item.image ? `<img class="thumb" alt="" loading="lazy" src="${item.image}">` : '';
  const firstCat = cats[0] || '';
  return `
    <article class="card" data-cat="${firstCat}">
      ${img}
      <a href="${item.link}" target="_blank" rel="noopener">
        <h3>${item.title}</h3>
        <p class="muted">${item.excerpt || ''}</p>
        <div class="meta">
          <span>${item.site || item.sourceTitle || 'Source'}</span>
          <span>•</span>
          <time datetime="${item.isoDate}">${timeAgo(item.isoDate)}</time>
        </div>
        <div class="badges">${catBadges}</div>
      </a>
      <div style="display:flex; gap:8px; padding: 0 16px 16px;">
        <button class="ghost" data-share="${encodeURIComponent(item.link)}" aria-label="Share">Share</button>
        <button class="ghost" data-copy="${encodeURIComponent(item.link)}" aria-label="Copy link">Copy link</button>
      </div>
    </article>
  `;
}

function render(reset=false) {
  if (reset) { shown = 0; grid.innerHTML = ''; }
  const slice = allItems.slice(shown, shown + pageSize);
  if (slice.length === 0 && shown === 0) {
    grid.innerHTML = `<div class="card" style="padding:20px"><h3>No stories yet in this category</h3><p class="muted">Try Refresh or pick another category — we’ll keep pulling new happy news throughout the day ✨</p></div>`;
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
    const params = new URLSearchParams();
    const selected = categorySel.value;
    const q = searchInput.value.trim();
    if (selected) params.set('category', selected);
    if (q) params.set('q', q);

    const res = await fetch(`${API}?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json();
    allItems = data.items || [];
    statusLine.textContent = `Updated ${timeAgo(data.updatedAt)} • ${allItems.length} stories`;
    render(true);
  } catch (e) {
    statusLine.textContent = 'Could not load news.';
    grid.innerHTML = `<p class="muted">Something went wrong. Try Refresh.</p>`;
  } finally {
    refreshBtn.disabled = false; refreshBtn.textContent = 'Refresh';
  }
}

function applyFilter() { load(); }

function setupChips() {
  chips.innerHTML = QUICK_CHIPS.map(t => `<button class="chip" data-chip="${t}" aria-pressed="false">${t}</button>`).join('');
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chip]');
    if (!btn) return;
    const label = btn.dataset.chip;
    searchInput.value = label;
    chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed','false'));
    btn.setAttribute('aria-pressed','true');
    applyFilter();
  });
}

function setupShareCopy() {
  grid.addEventListener('click', async (e) => {
    const shareBtn = e.target.closest('[data-share]');
    const copyBtn = e.target.closest('[data-copy]');
    if (shareBtn) {
      const url = decodeURIComponent(shareBtn.dataset.share);
      if (navigator.share) {
        try { await navigator.share({ title: 'JoyFeed News', url }); } catch {}
      } else {
        await navigator.clipboard.writeText(url);
        shareBtn.textContent = 'Copied!';
        setTimeout(() => shareBtn.textContent = 'Share', 1200);
      }
    }
    if (copyBtn) {
      const url = decodeURIComponent(copyBtn.dataset.copy);
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy link', 1200);
    }
  });
}

function setupTheme() {
  const stored = localStorage.getItem('theme') || '';
  if (stored) document.documentElement.dataset.theme = stored;
  document.getElementById('themeBtn')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

function setupAutoRefresh() {
  if (timer) clearInterval(timer);
  const mins = parseInt(intervalSel.value, 10);
  if (mins > 0) timer = setInterval(load, mins * 60 * 1000);
}

document.getElementById('refreshBtn')?.addEventListener('click', load);
document.getElementById('intervalSel')?.addEventListener('change', setupAutoRefresh);
document.getElementById('search')?.addEventListener('input', applyFilter);
document.getElementById('categorySel')?.addEventListener('change', applyFilter);
document.getElementById('loadMoreBtn')?.addEventListener('click', () => render(false));

setupChips();
setupShareCopy();
setupTheme();
setupAutoRefresh();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

load();
