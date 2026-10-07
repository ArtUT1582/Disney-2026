/* Install prompt — turns "add to home screen" from a thing you have to know
   about into a button.

   Android/Chrome fires beforeinstallprompt, so we can offer a real one-tap
   install. iOS Safari does not support it at all and never has: there the
   only route is Share → Add to Home Screen, so we show that instruction with
   the actual glyph rather than a button that cannot work.

   Hides itself once the app is installed, and stays hidden if dismissed. */
(function () {
  'use strict';

  var KEY = 'disney2026.installDismissed';

  function installed() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;   // iOS
  }
  function dismissed() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function remember() {
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* no-op */ }
  }

  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();          // keep Chrome's own mini-bar from appearing
    deferred = e;
    render();
  });
  window.addEventListener('appinstalled', function () {
    remember();
    var el = document.getElementById('installCard');
    if (el) el.remove();
  });

  function body() {
    if (deferred) {
      return {
        head: 'Install it on your phone',
        copy: 'One tap. It gets its own icon, opens without a browser bar, ' +
              'and can open the saved itinerary after the offline readiness check.',
        action: '<button class="inst-btn" type="button" data-install>Install</button>'
      };
    }
    if (isIOS) {
      return {
        head: 'Add it to your home screen',
        copy: 'iPhone does this manually. Tap the <b>Share</b> button ' +
              '<span class="inst-glyph" aria-hidden="true">↑</span> at the ' +
              'bottom of Safari, scroll down, then tap <b>Add to Home Screen</b>. ' +
              'It gets an icon; check the offline status before relying on the saved guide.' +
              (isSafari ? '' : ' <b>This only works in Safari</b> — open ' +
                               'this page there first.'),
        action: ''
      };
    }
    return {
      head: 'Add it to your home screen',
      copy: 'In your browser menu, look for <b>Install app</b> or ' +
            '<b>Add to Home screen</b>. Check the offline status before relying on the saved guide.',
      action: ''
    };
  }

  function render() {
    if (installed() || dismissed()) return;
    var host = document.getElementById('logistics');
    if (!host) return;

    var card = document.getElementById('installCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'installCard';
      card.className = 'inst';
      host.parentNode.insertBefore(card, host);
    }
    var b = body();
    card.innerHTML =
      '<div class="inst-in">' +
        '<div class="inst-txt">' +
          '<span class="inst-k">Save the itinerary on your phone</span>' +
          '<b class="inst-h">' + b.head + '</b>' +
          '<p class="inst-p">' + b.copy + '</p>' +
        '</div>' +
        '<div class="inst-act">' + b.action +
          '<a class="inst-x" href="install-guide.html">Show me how</a>' +
          '<button class="inst-x" type="button" data-dismiss>Not now</button>' +
        '</div>' +
      '</div>';

    card.addEventListener('click', function (e) {
      if (e.target.closest('[data-dismiss]')) { remember(); card.remove(); return; }
      if (e.target.closest('[data-install]') && deferred) {
        deferred.prompt();
        deferred.userChoice.then(function (r) {
          if (r.outcome === 'accepted') { remember(); card.remove(); }
          deferred = null;
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else { render(); }
})();
