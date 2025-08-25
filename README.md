# JoyFeed News

A tiny site that aggregates uplifting, positive news via RSS.

## Quick start (Netlify)
1. **Create repo** with these files.
2. **Netlify → New site** → Import from Git.
3. No build command needed. Functions auto-detected.
4. Visit your site. The API is at `/.netlify/functions/happy-news`.

## Customize
- **Feeds**: edit `FEEDS` in `netlify/functions/happy-news.js`.
- **Filters**: tune `POSITIVE_HINTS` / `NEGATIVE_FLAGS`.
- **Branding**: search/replace “JoyFeed News”, swap `/assets/logo.svg`.
- **Categories**: update `CATEGORY_RULES`.

## Local dev
```bash
npm i
npm run start
```

## Monetization
- Placeholder ad slots are included (top banner, mid-feed, sticky sidebar).
- To use AdSense, add your script tag to `index.html` where indicated and replace placeholder divs with your `<ins class="adsbygoogle">` blocks.
