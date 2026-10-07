/* Collapse each stop down to its time and name.

   A park day is 15 to 21 stops, and most of each stop's height is the note
   and the photos. Closed, a day reads as a numbered timeline you can thumb
   through - "what is next?" - and a tap opens the detail for the one stop
   you actually care about.

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
    setOpen(ev, false);
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
