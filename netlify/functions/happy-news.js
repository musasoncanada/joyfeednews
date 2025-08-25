// /.netlify/functions/happy-news
// Fast mode + timeouts + concurrency + persistent cache (Netlify Blobs)
// Requires: "rss-parser": "^3.13.0"
// Enable Netlify Blobs (Site settings → Labs/Features) or leave as in-memory only.

const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 20000,
  headers: { 'User-Agent': 'JoyFeedNewsBot/1.0 (+https://joyfeednews.com)' }
});

// ---------- Reputable feeds ----------
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
  // Always-on positive verticals
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

// Ultra-reliable subset used for fast mode (first paint)
const FAST_START = [
  'https://www.goodnewsnetwork.org/category/news/feed/',
  'https://www.positive.news/feed/',
  'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  'https://www.nationalgeographic.com/animals/feed/rss'
];

// ---------- Positivity / category ----------
const POSITIVE_HINTS = [
  'wholesome','heartwarming','uplifting','hope','kindness','donates','rescued',
  'saved','breakthrough','cure','reunited','restored','revived','community',
  'wildlife','conservation','clean energy','scholarship','celebrates','volunteer',
  'inspiring','smile','teacher','students','neighborhood','fundraiser','award',
  'grant','renewable','reforestation','rehabilitation','sanctuary','success'
];
const NEGATIVE_FLAGS = [
  'dies','dead','death','fatal','shoot','war','conflict','assault','crime','lawsuit','suicide',
  'murder','fraud','collapse','recession','covid','ebola','hiv','abuse','crash','explosion',
  'bomb','kill','killed','hate','disaster','flood','wildfire','hostage','terror','stabbing',
  'injured','arrested','charges','charged','indicted','sanction'
];
const CATEGORY_RULES = [
  { name: 'Community',  words: ['community','neighbors','volunteer','teacher','students','school','donate','fundraiser','local','town','village'] },
  { name: 'Wildlife',   words: ['wildlife','conservation','habitat','rescue','species','sanctuary','marine','turtle','whale','elephant','rhino','bird','rehabilitation'] },
  { name: 'Science',    words: ['breakthrough','cancer','therapy','trial','vaccine','research','battery','fusion','quantum','prosthetic','gene'] },
  { name: 'Climate',    words: ['solar','wind','geothermal','clean energy','emissions','recycling','reforestation','climate','renewable'] },
  { name: 'Humanity',   words: ['heartwarming','kindness','uplifting','reunited','saved','rescued','hope','smile','hero','donates'] },
  { name: 'Arts',       words: ['artist','art','music','orchestra','film','festival','museum','exhibit'] }
];

// ---------- Helpers ----------
const LIMIT = 140;            // overall cap
const PAGE_SIZE = 60;         // default items returned (keep small for speed)
const FEED_TIMEOUT = 4000;    // 4s per feed
const CONCURRENCY = 6;        // fetch N feeds at a time
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
  const excerpt = stripHtml(item.contentSnippet || item.content || '').trim();
  const image =
    (item.enclosure && item.enclosure.url) ||
    (item.media && item.media.content && item.media.content.url) || null;
  return {
    id: (item.guid || item.link || item.title || '').slice(0,180),
    title: item.title || '',
    link: item.link || item.guid || '',
    site: originFromLink(item.link),
    sourceTitle: feedTitle || originFromLink(item.link),
    isoDate: item.isoDate || item.pubDate || new Date().toISOString(),
    excerpt: excerpt.slice(0, 300),
    image,
    region: inferRegion(feedUrl)
  };
}

// Fetch with timeout and parse (rss-parser works with strings as well)
async function fetchFeedWithTimeout(url, ms = FEED_TIMEOUT) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'JoyFeedNewsBot/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const feed = await parser.parseString(text);
    return (feed.items || []).map(i => normalizeItem(i, feed.title, url));
  } finally {
    clearTimeout(id);
  }
}

// Simple concurrency limiter
async function mapConcurrent(items, fn, limit = CONCURRENCY) {
  const ret = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      try { ret[idx] = await fn(items[idx]); }
      catch { ret[idx] = []; }
    }
  });
  await Promise.all(workers);
  return ret;
}

// ---------- Persistent cache via Netlify Blobs ----------
async function blobGet(key) {
  try {
    // eslint-disable-next-line no-undef
    const store = await import('@netlify/blobs');
    const b = store.getStore('joyfeed-cache');
    const v = await b.get(key, { type: 'json' });
    return v || null;
  } catch { return null; }
}
async function blobSet(key, val) {
  try {
    // eslint-disable-next-line no-undef
    const store = await import('@netlify/blobs');
    const b = store.getStore('joyfeed-cache');
    await b.set(key, JSON.stringify(val), { contentType: 'application/json' });
  } catch {}
}

// Build a cache key based on filters + mode
function cacheKey({ q, cat, region, fast }) {
  re
