(function () {
  'use strict';
  const host = document.querySelector('[data-reading-mode]');
  if (!host || !window.HasulamScan || !window.HASULAM_SCAN_DATA) return;
  const full = host.dataset.readingMode === 'full';
  const params = new URLSearchParams(location.search);
  const parashaId = full ? (params.get('parasha') || host.dataset.parasha) : host.dataset.parasha;
  const sourceKey = full && params.get('source') === 'zohar' ? 'zohar' : 'torah';
  // Mount never initiates a remote load, including a carried-over Zohar choice.
  const reader = window.HasulamScan.mount(host, {
    mode: full ? 'full' : 'compact', parashaId, sourceKey,
    inputMode: full && !params.has('parasha') ? 'book' : 'parasha',
    fullReaderHref: host.dataset.fullHref
  });
  const pause = () => reader.pause(true);
  document.querySelectorAll('a').forEach(link => link.addEventListener('click', pause));
  window.addEventListener('pagehide', pause);
})();
