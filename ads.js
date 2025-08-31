// Lazy init AdSense units + re-push after content updates
(function(){
  function pushAds(){
    try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e){}
  }
  // Initial push
  window.addEventListener('load', pushAds);

  // Expose a hook: app.js can call window.refreshAds() after it updates the grid
  window.refreshAds = function(){ pushAds(); };

  // Also observe grid changes
  const grid = document.getElementById('grid');
  if (grid && 'MutationObserver' in window){
    const obs = new MutationObserver(() => pushAds());
    obs.observe(grid, { childList: true, subtree: false });
  }
})();
