Monetization Starter for JoyFeed News
======================================

This adds:
- AdSense slots (top banner, in-feed, sidebar) + lazy init (ads.js)
- Newsletter signup box (replace form action with your provider URL)
- Privacy page & ads.txt placeholder

Setup
-----
1) **AdSense**
   - Apply / sign in at https://www.google.com/adsense
   - In `index.html`, replace all occurrences of:
       ca-pub-YOUR_ADSENSE_PUBLISHER_ID
     with your real Publisher ID.
   - Replace slot IDs: TOP_BANNER_SLOT_ID, INFEED_SLOT_ID, SIDEBAR_SLOT_ID with your ad unit slot IDs.
   - Upload `ads.txt` at the site root (Netlify will serve it).

2) **Newsletter**
   - Replace `YOUR_EMAIL_PROVIDER_FORM_URL` in `index.html` with your Mailchimp/ConvertKit POST URL.

3) **Styles**
   - Append the contents of `styles-additions.css` to your existing `styles.css` (or merge manually).

4) **Hook for reloading ads**
   - `ads.js` exposes `window.refreshAds()`. If you paginate or inject cards dynamically in `app.js`,
     call `window.refreshAds()` after rendering to nudge AdSense to fill in new slots.

5) **Privacy**
   - Add a link to `/privacy.html` in your nav or footer (already in the provided `index.html`).

6) **Deploy**
   - Commit files to your repo; Netlify redeploys automatically.
