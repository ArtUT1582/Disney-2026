/* Collapse each stop down to its time and name.

   A park day is 15 to 21 stops, and most of each stop's height is the note
   and the photos. Closed, a day reads as a numbered timeline you can thumb
   through - "what is next?" - and a tap opens the detail for the one stop
   you actually care about.

   Nothing here rewrites the markup. `.ed-ev` is a CSS grid with a named
   area for the photos, so moving the note or the media into a <details>
   would break the layout. Instead the closed state is a class, and the
   hiding is a :not() rule - when a stop is open no rule of ours applies at
   all and the original CSS governs it, untouched. */
(function () {
  'use strict';

  var OPEN = 'is-open';

  function stopsIn(day) {
    return [].slice.call(day.querySelectorAll('.ed-ev'));
  }

  function setOpen(ev, open) {
    ev.classList.toggle(OPEN, open);
    ev.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* Only the time/name row toggles. A tap on an opened note, a photo or a
     link should do what it normally does, not slam the stop shut. */
  function isToggleTarget(e) {
    return !e.target.closest('a, button, .ed-n, .ed-media');
  }

  function wire(ev) {
    setOpen(ev, false);
    ev.setAttribute('role', 'button');
    ev.setAttribute('tabindex', '0');

    ev.addEventListener('click', function (e) {
      if (!isToggleTarget(e)) return;
      setOpen(ev, !ev.classList.contains(OPEN));
    });

    ev.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!isToggleTarget(e)) return;
      e.preventDefault();                      // space must not scroll the page
      setOpen(ev, !ev.classList.contains(OPEN));
    });
  }

  /* Reading the whole day at the kitchen table is a different job from
     checking the next stop in a queue, so each day gets one control for it. */
  function addExpandAll(day, evs) {
    var list = day.querySelector('.ed-list');
    if (!list) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ed-expand';

    function label() {
      var anyClosed = evs.some(function (ev) { return !ev.classList.contains(OPEN); });
      btn.textContent = anyClosed ? 'Expand all ' + evs.length + ' stops' : 'Collapse all';
      btn.setAttribute('aria-expanded', anyClosed ? 'false' : 'true');
      return anyClosed;
    }

    btn.addEventListener('click', function () {
      var opening = evs.some(function (ev) { return !ev.classList.contains(OPEN); });
      evs.forEach(function (ev) { setOpen(ev, opening); });
      label();
    });

    // Keep the button honest when stops are toggled one at a time.
    day.addEventListener('click', function () { setTimeout(label, 0); });

    label();
    list.parentNode.insertBefore(btn, list);
  }

  function init() {
    var days = [].slice.call(document.querySelectorAll('#expedition .ed-day'));
    days.forEach(function (day) {
      var evs = stopsIn(day);
      if (!evs.length) return;
      evs.forEach(wire);
      addExpandAll(day, evs);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
