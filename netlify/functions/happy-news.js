// /.netlify/functions/happy-news — SAFE MODE
const Parser = require('rss-parser');
const parser = new Parser({ timeout: 20000, headers: { 'User-Agent': 'JoyFeedNewsBot/1.0 (+https://joyfeednews.com)' } });

// Reputable feeds
const REGION_FEEDS = {
  Canada: [
    'https://www.cbc.ca/cmlink/rss-world',
    'https://www.cbc.ca/cmlink/rss-health',
    'https://globalnews.ca/feed/',
    'https://www.ctvnews.ca/rss/ctvnews-ca-world-public-rss-1.822289',
    'https://www.cbc.ca/cmlink/rss-canada',
    'https://www.thestar.com/content/thestar/feed.RSSManagerServlet.news.canada.rss',
    'https://www.nationalobserver.com/rss.xml'
  ],
  Africa: [
    'https://feeds.bbci.co.uk/news/world/africa/rss.xml',
    'https://www.bbc.co.uk/africa/index.xml',
    'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
    'https://www.reutersagency.com/feed/?best-sectors=africa&post_type=best',
    'https://www.theafricareport.com/feed/',
    'https://www.dailymaverick.co.za/section/news/feed/'
  ],
  Asia: [
    'https://feeds.bbci.co.uk/news/asia/rss.xml',
    'https://www.reutersagency.com/feed/?best-sectors=asia&post_type=best',
    'https://feeds.npr.org/1004/rss.xml',
    'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://www.japantimes.co.jp/feed/',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  'North America': [
    'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
    'https://apnews.com/hub/north-america/rss',
    'https://www.npr.org/rss/rss.php?id=1004',
    'https://feeds.npr.org/1128/rss.xml',
    'https://www.smithsonianmag.com/rss/latest_articles/',
    'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml'
  ],
  Europe: [
    'https://feeds.bbci.co.uk/news/europe/rss.xml',
    'https://www.reutersagency.com/feed/?best-sectors=europe&post_type=best',
    'https://apnews.com/hub/europe/rss',
    'https://www.euronews.com/rss?level=theme&name=news',
    'https://rss.dw.com/rdf/rss-en-all',
    'https://www.theguardian.com/world/rss'
  ],
  Common: [
    'https://www.goodnewsnetwork.org/category/news/feed/',
    'https://www.positive.news/feed/',
    'https://www.optimistdaily.com/feed/',
    'https://www.nationalgeographic.com/animals/feed/rss',
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    'https://www.sciencedaily.com/rss/top/science.xml',
    'https://www.reddit.com/r/UpliftingNews/.rss'
  ]
};

const POSITIVE_HINTS = ['wholesome','heartwarming','uplifting','hope','kindness','donates','rescued','saved','breakthrough','cure','reunited','restored','revived','community','wildlife','conservation','clean energy','scholarship','celebrates','volunteer','inspiring','smile','teacher','students','neighborhood','fundraiser','award','grant','renewable','reforestation','rehabilitation','sanctuary','success'];
const NEGATIVE_FLAGS = ['dies','dead','death','fatal','shoot','war','conflict','assault','crime','lawsuit','suicide','murder','fraud','collapse','recession','covid','ebola','hiv','abuse','crash','explosion','bomb','kill','killed','hate','disaster','flood','wildfire','hostage','terror','stabbing','injured','arrested','charges','charged','indicted','sanction'];
const CATEGORY_RULES = [
  { name: 'Community',  words: ['community','neighbors','volunteer','teacher','students','school','donate','fundraiser','local','town','village'] },
  { name: 'Wildlife',   words: ['wildlife','conservation','habitat','rescue','species','sanctuary','marine','turtle','whale','elephant','rhino','bird','rehabilitation'] },
  { name: 'Science',    words: ['breakthrough','cancer','therapy','trial','vaccine','research','battery','fusion','quantum','prosthetic','gene'] },
  { name: 'Climate',    words: ['solar','wind','geothermal','clean energy','emissions','recycling','reforestation','climate','renewable'] },
  { name: 'Humanity',   words: ['heartwarming','kindness','uplifting','reunited','saved','rescued','hope','smile','hero','donates'] },
  { name: 'Arts',       words: ['artist','art','music','orchestra','film','festival','museum','exhibit'] }
];

const LIMIT = 140;
const PAGE_SIZE = 60;
const FEED_TIMEOUT = 5000; // 5s per feed
const CONCURRENCY = 6;
const CACHE_MS = 10 * 60 * 1000;

let memoryCache = { at: 0, key: '', data: null };

function stripHtml(s='') { return s.replace(/<[^>]+>/g,''); }
function originFromLink(url='') { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; } }
function host(u) { try { return new URL(u).hostname; } catch { return ''; } }
function inferRegion(feedUrl) {
  for (const [region, list] of Object.entries(REGION_FEEDS)) {
    if (region === 'Common') continue;
    if (list.some(u => feedUrl && host(feedUrl) === host(u))) return region;
  }
  return null;
}
function isLikelyPositive(txt='') {
  const t = txt.toLowerCase();
  if (NEGATIVE_FLAGS.some(w => t.includes(w))) return false;
  if (POSITIVE_HINTS.some(w => t.includes(w))) return true;
  return /good news|feel[-\s]?good|heartwarming|inspir|uplift|kind|smile|adorable|celebrat|award/i.test(t);
}
function categorize(txt='') {
  const t = txt.toLowerCase();
  const cats = [];
  for (const c of CATEGORY_RULES) if (c.words.some(w => t.includes(w))) cats.push(c.name);
  if (!cats.length) cats.push('Good News');
  return Array.from(new Set(cats)).slice(0, 3);
}
function dedupe(items) {
  const seen = new Set(); const out = [];
  for (const it of items) {
    const key = (it.link || it.title).toLowerCase().replace(/[?#].*$/,'');
    if (!seen.has(key)) { seen.add(key); out.push(it); }
  } return out;
}
function normalizeItem(item, feedTitle, feedUrl) {
  // Prefer full text if feed provides it
  let text =
    item['content:encoded'] ||
    item.content ||
    item.summary ||
    item.description ||
    item.contentSnippet ||
    '';

  // Strip HTML tags and collapse whitespace
  text = String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit to ~500–650 chars (≈ 2 paragraphs), cut at sentence end if possible
  const HARD_LIMIT = 650;
  if (text.length > HARD_LIMIT) {
    let cut = 500;
    const window = text.slice(500, HARD_LIMIT);
    const dot = window.search(/[.!?](\s|$)/);
    if (dot !== -1) cut = 500 + dot + 1;
    text = text.slice(0, cut).trim() + '…';
  }

  const image =
    (item.enclosure && item.enclosure.url) ||
    (item.media && item.media.content && item.media.content.url) ||
    null;

  return {
    id: (item.guid || item.link || item.title || '').slice(0, 180),
    title: item.title || '',
    link: item.link || item.guid || '',
    site: originFromLink(item.link),
    sourceTitle: feedTitle || originFromLink(item.link),
    isoDate: item.isoDate || item.pubDate || new Date().toISOString(),
    excerpt: text,
    image,
    region: inferRegion(feedUrl)
  };
}

// Timeout wrapper for parser.parseURL
function parseWithTimeout(url, ms = FEED_TIMEOUT) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve({ items: [], title: '' }); } }, ms);
    parser.parseURL(url).then(feed => {
      if (done) return;
      clearTimeout(timer); done = true;
      resolve(feed || { items: [], title: '' });
    }).catch(() => {
      if (done) return;
      clearTimeout(timer); done = true;
      resolve({ items: [], title: '' });
    });
  });
}

// Simple concurrency limiter
async function mapConcurrent(items, fn, limit = CONCURRENCY) {
  const ret = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      try { ret[idx] = await fn(items[idx]); } catch { ret[idx] = { items: [], title: '' }; }
    }
  });
  await Promise.all(workers);
  return ret;
}

function cacheKey({ q, cat, region }) {
  return `safe:${(region||'all').toLowerCase()}:${(cat||'').toLowerCase()}:${(q||'').toLowerCase()}`;
}

exports.handler = async (event) => {
  const now = Date.now();
  const params = new URLSearchParams(event.queryStringParameters || {});
  const q = (params.get('q') || '').trim();
  const categoryFilter = (params.get('category') || '').trim();
  const regionFilter = (params.get('region') || '').trim();

  const requestedRegionKey = Object.keys(REGION_FEEDS).find(r => r.toLowerCase() === regionFilter.toLowerCase());
  const feeds = requestedRegionKey
    ? [...(REGION_FEEDS[requestedRegionKey] || []), ...REGION_FEEDS.Common]
    : Object.values(REGION_FEEDS).flat();

  const key = cacheKey({ q, cat: categoryFilter, region: regionFilter });
  const canUseMem = !q && !categoryFilter;
  if (canUseMem && memoryCache.data && memoryCache.key === key && (now - memoryCache.at) < CACHE_MS) {
    return json(memoryCache.data, 200, true);
  }

  try {
    const parsed = await mapConcurrent(feeds, (u) => parseWithTimeout(u, FEED_TIMEOUT), CONCURRENCY);
    let items = dedupe(parsed.flatMap(feed =>
      (feed.items || []).map(i => normalizeItem(i, feed.title, feed.link || ''))
    ))
      .map(i => ({ ...i, categories: categorize(`${i.title} ${i.excerpt}`) }))
      .filter(i => isLikelyPositive(`${i.title} ${i.excerpt}`))
      .sort((a,b) => new Date(b.isoDate) - new Date(a.isoDate))
      .slice(0, LIMIT);

    if (q) {
      const words = q.toLowerCase().split(/\s+/);
      items = items.filter(i => {
        const blob = `${i.title} ${i.excerpt} ${i.site} ${i.sourceTitle} ${i.categories.join(' ')} ${i.region || ''}`.toLowerCase();
        return words.every(w => blob.includes(w));
      });
    }
    if (categoryFilter) items = items.filter(i => i.categories.some(c => c.toLowerCase() === categoryFilter.toLowerCase()));
    if (regionFilter) items = items.filter(i => (i.region || '').toLowerCase() === regionFilter.toLowerCase());

    const payload = { updatedAt: new Date().toISOString(), count: items.length, items: items.slice(0, PAGE_SIZE), mode: 'safe' };
    if (canUseMem) memoryCache = { at: now, key, data: payload };
    return json(payload, 200, true);
  } catch (err) {
    return json({ error: 'Failed to load feeds', details: String(err) }, 500, false);
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
