// Simplified app.js (full code omitted for brevity in this cell)
// This version routes links through reader.html
function safeReaderUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return '#';
    return '/reader.html?url=' + encodeURIComponent(u.toString());
  } catch { return '#'; }
}
// ... rest of app.js logic ...
