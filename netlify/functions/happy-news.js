// Aggregates & filters uplifting news from multiple RSS feeds.
// Deploys as Netlify Function: /.netlify/functions/happy-news
const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 20000,
  headers: { 'User-Agent': 'JoyFeedNewsBot/1.0 (+https://joyfeednews.com)' }
});

// ---- Feeds: add/remove freely ----
const FEEDS = [
  'https://www.goodnewsnetwork.org/category/news/feed/',
  'https://www.positive.news/feed/',
  'https://www.sunnyskyz.com/good-news/rss',
  'https://www.sunnyskyz.com/happy-videos/rss',
  'https://www.optimistdaily.com/feed/',
  'https://www.reddit.com/r/UpliftingNews/.rss'
];

const POSITIVE_HINTS = [
  'wholesome','heartwarming','uplifting','hope','kindness','donates','rescued',
  'saved','breakthrough','cure','reunited','restored','revived','community',
  'wildlife','conservation','clean energy','scholarship','celebrates','volunteer',
  'inspiring','smile','teacher','students','neighborhood','fundraiser','rescue'
];

const NEGATIVE_FLAGS = [
  'dies','dead','death','fatal','shoot','war','assault','crime','lawsuit','suicide',
  'murder','fraud','collapse','recession','covid','ebola','hiv','abuse','crash',
  'explosion','bomb','kill','killed','hate','disaster','flood','wildfire','hostage',
  'terror','stabbing','injured','arrested','charges','charged'
];

const CATEGORY_RULES = [
  { name: 'Community',  words: ['community','neighbors','volunteer','teacher','students','school','donate','fundraiser','local','town','village'] },
  { name: 'Wildlife',   words: ['wildlife','conservation','habitat','rescue','species','sanctuary','marine','turtle','whale','elephant','rhino','bird'] },
  { name: 'Science',    words: ['breakthrough','cancer','therapy','trial','vaccine','research','gene','battery','fusion','quantum','prosthetic'] },
  { name: 'Climate',    words: ['solar','wind','geothermal','clean energy','emissions','recycling','reforestation','climate'] },
  { name: 'Humanity',   words: ['heartwarming','kindness','uplifting','reunited','saved','rescued','hope','smile','hero'] },
  { name: 'Arts',       words: ['artist','art','music','orchestra','film','festival','museum','exhibit'] },
];

let cache = { at: 0, data: null };
const CACHE_MS = 10 * 60 * 1000;

function stripHtml(s='') { return s.replace(/<[^>]+>/g,''); }

function originFromLink(url='') {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./,'');
  } catch { return ''; }
}

function normalizeItem(item, feedTitle) {
  const excerpt = stripHtml(item.contentSnippet || item.content || '').trim();
  const image =
    (item.enclosure && item.enclosure.url) ||
    (item.media && item.media.content && item.media.content.url) ||
    null;

  return {
    id: (item.guid || item.link || item.title || '').slice(0,180),
    title: item.title || '',
    link: item.link || item.guid || '',
    site: originFromLink(item.link),
    sourceTitle: feedTitle || originFromLink(item.link),
    isoDate: item.isoDate || item.pubDate || new Date().toISOString(),
    excerpt: excerpt.slice(0, 300),
    image
  };
}

function isLikelyPositive(txt='') {
  const t = txt.toLowerCase();
  if (NEGATIVE_FLAGS.some(w => t.includes(w))) return false;
  if (POSITIVE_HINTS.some(w => t.includes(w))) return true;
  return /good news|feel[-\s]?good|heartwarming|inspir|uplift|kind|smile|adorable|celebrat/i.test(t);
}

function categorize(txt='') {
  const t = txt.toLowerCase();
  const cats = [];
  for (const c of CATEGORY_RULES) {
    if (c.words.some(w => t.includes(w))) cats.push(c.name);
  }
  if (!cats.length) cats.push('Good News');
  return Array.from(new Set(cats)).slice(0, 3);
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = (it.link || it.title).toLowerCase().replace(/[?#].*$/,'');
    if (!seen.has(key)) { seen.add(key); out.push(it); }
  }
  return out;
}

exports.handler = async (event) => {
  try {
    const now = Date.now();
    const params = new URLSearchParams(event.queryStringParameters || {});
    const q = (params.get('q') || '').trim().toLowerCase();
    const categoryFilter = (params.get('category') || '').trim().toLowerCase();

    if (cache.data && (now - cache.at) < CACHE_MS && !q && !categoryFilter) {
      return json(cache.data, 200, true);
    }

    const results = await Promise.allSettled(
      FEEDS.map(async (url) => {
        const feed = await parser.parseURL(url);
        return (feed.items || [])
          .map(i => normalizeItem(i, feed.title))
          .map(i => ({ ...i, categories: categorize(`${i.title} ${i.excerpt}`) }))
          .filter(i => isLikelyPositive(`${i.title} ${i.excerpt}`));
      })
    );

    let items = dedupe(
      results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    ).sort((a,b) => new Date(b.isoDate) - new Date(a.isoDate));

    if (q) {
      const words = q.split(/\s+/);
      items = items.filter(i => {
        const blob = `${i.title} ${i.excerpt} ${i.site} ${i.sourceTitle} ${i.categories.join(' ')}`.toLowerCase();
        return words.every(w => blob.includes(w));
      });
    }

    if (categoryFilter) {
      items = items.filter(i => i.categories.some(c => c.toLowerCase() === categoryFilter));
    }

    items = items.slice(0, 120);

    const payload = {
      updatedAt: new Date().toISOString(),
      count: items.length,
      items
    };

    if (!q && !categoryFilter) cache = { at: now, data: payload };

    return json(payload, 200, true);
  } catch (err) {
    return json({ error: 'Failed to fetch feeds', details: String(err) }, 500, false);
  }
};

function json(body, status=200, cacheable=false) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheable ? 'public, max-age=300, stale-while-revalidate=120' : 'no-store'
    },
    body: JSON.stringify(body)
  };
}
