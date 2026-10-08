/* Every stop opens in full - note, photo, ride videos - with no tap needed
   (Artemio, Oct 8: the family reads the day on a phone and should not have
   to open each stop). Tapping the time/name row folds a stop down to one
   line, and "Collapse all" turns the day into a numbered timeline to thumb
   through.

   A native button owns the time/name row; videos and links remain separate
   controls. A class hides the note without changing the photo grid. */
(function () {
  'use strict';

  var OPEN = 'is-open';

  function stopsIn(day) {
    return [].slice.call(day.querySelectorAll('.ed-ev'));
  }

  function setOpen(ev, open) {
    ev.classList.toggle(OPEN, open);
    var button = ev.querySelector('.ed-stop-toggle');
    if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function wire(ev) {
    var body = ev.querySelector('.ed-body');
    var time = ev.querySelector('.ed-t'), title = ev.querySelector('.ed-h');
    if (!body || !time || !title) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ed-stop-toggle';
    body.insertBefore(button, time);
    button.appendChild(time);
    button.appendChild(title);
    var note = ev.querySelector('.ed-n');
    if (note) {
      note.id = ev.dataset.stopId + '-note';
      button.setAttribute('aria-controls', note.id);
    }
    setOpen(ev, true);
    button.addEventListener('click', function () {
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
