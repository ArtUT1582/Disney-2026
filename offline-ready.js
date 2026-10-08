/* Verify the files saved on this device; installation alone is not readiness. */
(function () {
  'use strict';
  var status = document.getElementById('offlineStatus');
  if (!status) return;
  var suffix = ' Videos, live waits, weather and booking apps need internet.';
  if (!('serviceWorker' in navigator)) { status.textContent = 'Offline saving is unavailable in this browser.' + suffix; return; }
  function local(value) { var url = new URL(value, document.baseURI); return url.origin === location.origin ? url.href : null; }
  function prepare() {
    var controller = navigator.serviceWorker.controller;
    if (!controller) return;
    var base = new URL('./', document.baseURI);
    var core = ['./', 'index.html', 'install-guide.html', 'manifest.json'].map(function (p) { return new URL(p,base).href; });
    document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach(function (element) {
      var url = local(element.src || element.href); if (url) core.push(url);
    });
    var extras = [];
    document.querySelectorAll('img[src], link[rel="icon"][href], link[rel="apple-touch-icon"][href]').forEach(function (element) {
      var url = local(element.src || element.href); if (url) extras.push(url);
    });
    document.querySelectorAll('style').forEach(function (element) {
      var pattern = /url\(\s*["']?([^"')]+)["']?\s*\)/g, match;
      while ((match = pattern.exec(element.textContent))) { var url = local(match[1]); if (url) extras.push(url); }
    });
    core = Array.from(new Set(core)); extras = Array.from(new Set(extras)).filter(function (url) { return !core.includes(url); });
    var channel = new MessageChannel(); status.textContent = 'Checking the offline copy on this device…' + suffix;
    var timeout = setTimeout(function () {
      status.textContent = 'Offline copy not verified. Reconnect or reload to retry; storage or downloads may be unavailable.' + suffix; channel.port1.close();
    },45000);
    channel.port1.onmessage = function (event) {
      var result = event.data;
      if (!result || result.type !== 'offline-result') return;
      clearTimeout(timeout);
      if (!result.ready) status.textContent = 'Offline copy incomplete. Reconnect and reload to retry (' + result.failedCore.length + ' required files unavailable).' + suffix;
      else status.textContent = 'Offline itinerary ready on this device · checked ' + new Date(result.savedAt).toLocaleString('en-US',{timeZone:'America/New_York'}) + ' Eastern.' + (result.failedExtras ? ' Some photos are unavailable offline.' : ' Local photos saved too.') + suffix;
      channel.port1.close();
    };
    controller.postMessage({type:'prepare-offline',core:core,extras:extras},[channel.port2]);
  }
  window.addEventListener('load',function () {
    navigator.serviceWorker.register('sw.js').then(function () {
      if (navigator.serviceWorker.controller) prepare();
      navigator.serviceWorker.addEventListener('controllerchange',prepare);
    }).catch(function () { status.textContent = 'Offline saving failed. Keep an online connection and retry after reloading.' + suffix; });
  });
})();
