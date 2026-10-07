/* Share buttons on the QR card. The native share sheet is the one that puts
   WhatsApp one tap away on a phone; the wa.me link covers desktop and anyone
   whose browser has no share sheet. Both fall back to copying the link. */
(function () {
  'use strict';
  var URL_ = 'https://artut1582.github.io/Disney-2026/';
  var TEXT = 'Our Disney 2026 itinerary — all five park days, park maps, '+
             'times, and what Annelise can ride. Open it and '+
             'tap Install (iPhone: Share → Add to Home Screen) so it works '+
             'in the parks with no signal.';

  function flash(btn, msg) {
    var was = btn.textContent;
    btn.textContent = msg;
    btn.classList.add('is-done');
    setTimeout(function () {
      btn.textContent = was;
      btn.classList.remove('is-done');
    }, 1800);
  }

  function copy(btn) {
    var done = function () { flash(btn, 'Link copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(URL_).then(done, function () { manual(btn); });
    } else { manual(btn); }
  }

  function manual(btn) {
    // execCommand is deprecated but it is the only fallback that works
    // without clipboard permission, which Safari withholds outside a gesture.
    var ta = document.createElement('textarea');
    ta.value = URL_;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flash(btn, 'Link copied'); }
    catch (e) { flash(btn, 'Copy failed'); }
    document.body.removeChild(ta);
  }

  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-share]');
    if (s) {
      if (navigator.share) {
        navigator.share({ title: 'Garcia Family · Disney 2026',
                          text: TEXT, url: URL_ })
          .catch(function () { /* dismissed */ });
      } else {
        copy(s);
      }
      return;
    }
    var c = e.target.closest('[data-copy]');
    if (c) copy(c);
  });
})();
