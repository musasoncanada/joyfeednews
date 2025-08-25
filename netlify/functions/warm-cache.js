// /.netlify/functions/warm-cache
// Pings the news function for all regions to pre-fill cache.
// Runs on a schedule (set in netlify.toml below).

const REGIONS = ["", "Canada", "Africa", "Asia", "North America", "Europe"]; 
// "" warms the all-regions homepage

exports.handler = async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || "https://joyfeednews.com";
  const targets = REGIONS.map(r => {
    const p = new URL("/.netlify/functions/happy-news", base);
    if (r) p.searchParams.set("region", r);
    return p.toString();
  });

  const results = await Promise.allSettled(
    targets.map(async (u) => {
      const res = await fetch(u, { headers: { "User-Agent": "JoyFeedWarm/1.0" }});
      return { url: u, ok: res.ok, status: res.status };
    })
  );

  const payload = results.map(r =>
    r.status === "fulfilled" ? r.value : { error: String(r.reason) }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ warmed: payload, at: new Date().toISOString() })
  };
};
