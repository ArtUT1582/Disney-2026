/* Now / Next card at the top of today's plan. Trip days only, Eastern time.
   Test any moment with ?now=2026-10-14T11:20 */
(function () {
  'use strict';
  var DAYS = {'2026-10-12':'day-ak','2026-10-13':'day-hs','2026-10-14':'day-mk','2026-10-15':'day-hhn','2026-10-16':'day-eu'};

  function eastern() {
    var o = /[?&]now=(\d{4}-\d\d-\d\d)T(\d\d):(\d\d)/.exec(location.search);
    if (o) return {date: o[1], min: +o[2] * 60 + +o[3]};
    var p = {};
    new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'})
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return {date: p.year + '-' + p.month + '-' + p.day, min: +p.hour * 60 + +p.minute};
  }

  function clock(m) {
    var h = Math.floor(m / 60) % 24, mm = m % 60;
    return (h % 12 || 12) + ':' + (mm < 10 ? '0' : '') + mm + (h < 12 ? ' AM' : ' PM');
  }

  function row(label, li, extra) {
    var h = li.querySelector('.ed-h');
    return '<p><span class="ed-now-k">' + label + '</span> <a href="#' + li.id + '">' +
      clock(+li.dataset.start) + ' · ' + (h ? h.textContent.trim() : '') + '</a>' + (extra || '') + '</p>';
  }

  function render() {
    var old = document.querySelector('.ed-now');
    if (old) old.remove();
    var t = eastern(), day = document.getElementById(DAYS[t.date] || '');
    if (!day) return;
    var stops = [].slice.call(day.querySelectorAll('li.ed-ev[data-optional="false"][data-start]'))
      .sort(function (a, b) { return a.dataset.start - b.dataset.start; });
    var plan = day.querySelector('.ed-plan');
    if (!stops.length || !plan) return;
    var now = null, next = null;
    stops.forEach(function (li) { if (+li.dataset.start <= t.min) now = li; else if (!next) next = li; });
    var gap = next ? +next.dataset.start - t.min : 0;
    var html = '<b>Right now · ' + clock(t.min) + ' Eastern</b>' +
      (now ? row('Now', now) : '') +
      (next ? row(now ? 'Next' : 'First up', next, ' <span class="ed-now-in">in ' +
        (gap >= 60 ? Math.floor(gap / 60) + 'h ' : '') + gap % 60 + 'm</span>') : '<p>Day done. Rest up.</p>');
    var box = document.createElement('aside');
    box.className = 'ed-now';
    box.setAttribute('aria-label', 'Now and next');
    box.innerHTML = html;
    plan.parentNode.insertBefore(box, plan);
  }

  render();
  setInterval(render, 60000);
})();
