/* Trip state — the hero bar flips from countdown to day-of and then to done.

   Before 11 Oct the countdown runs as it always has. From the moment the trip
   starts it is replaced by what is actually useful in a park: which day it is,
   where you are today, and what is next on the list. After the 17th it settles
   into a summary instead of a dead clock reading zero.

   Stops are read out of the day sections already in the page rather than
   duplicated into a data file, so the panel cannot drift from the itinerary.
   ponytail: no new source of truth. */
(function () {
  'use strict';

  var PARK_TZ = 'America/New_York';          // Orlando, whatever the phone says

  // Trip days in park-local dates. null dayId = a travel day with no park.
  var DAYS = [
    { date: '2026-10-11', dayId: null,      label: 'Travel day',
      note: 'UA 2245 · IAH 7:25 AM → MCO 10:54 AM' },
    { date: '2026-10-12', dayId: 'day-ak',  label: 'Animal Kingdom',
      note: 'Park 8 AM – 6 PM · Early Entry 7:30' },
    { date: '2026-10-13', dayId: 'day-hs',  label: 'Hollywood Studios',
      note: 'Park 9 AM – 9 PM · Early Entry 8:30' },
    { date: '2026-10-14', dayId: 'day-mk',  label: 'Magic Kingdom',
      note: 'Park 9 AM – 10 PM · Early Entry 8:30' },
    { date: '2026-10-15', dayId: 'day-hhn', label: 'HHN 35',
      note: 'USF 8 AM – 5 PM · event 6:30 PM – ~1 AM' },
    { date: '2026-10-16', dayId: 'day-eu',  label: 'Epic Universe',
      note: 'Park 10 AM – 8 PM · no Early Park Admission' },
    { date: '2026-10-17', dayId: null,      label: 'Home',
      note: 'UA 468 · MCO 7:00 AM → IAH 8:38 AM' }
  ];

  /* ---- park-local clock ------------------------------------------------- */

  // en-CA gives YYYY-MM-DD, which sorts and compares as a plain string.
  var fmtDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARK_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  });
  var fmtTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: PARK_TZ, hour: '2-digit', minute: '2-digit', hour12: false
  });

  function parkToday(now) { return fmtDate.format(now); }
  function parkMinutes(now) {
    var p = fmtTime.format(now).split(':');
    return (+p[0]) * 60 + (+p[1]);
  }

  /* ---- reading the itinerary out of the page ---------------------------- */

  // "6:30AM", "12:45PM", "6:15PM+" -> minutes past midnight. Anything without
  // a clock ("Afternoon", "Priority list") is not schedulable and returns null.
  function clockToMinutes(text) {
    var m = /^(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(String(text).trim());
    if (!m) return null;
    var h = (+m[1]) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + (+m[2]);
  }

  function stopsFor(dayId) {
    var art = dayId && document.getElementById(dayId);
    if (!art) return [];
    var out = [];
    art.querySelectorAll('li.ed-ev').forEach(function (li) {
      var t = li.querySelector('.ed-t'), h = li.querySelector('.ed-h'),
          n = li.querySelector('.ed-num');
      if (!t || !h) return;
      var head = h.cloneNode(true);
      var land = head.querySelector('.ed-land');
      if (land) land.remove();                 // drop the land badge from the title
      out.push({
        n: n ? n.textContent.trim() : '',
        raw: t.textContent.trim(),
        min: clockToMinutes(t.textContent),
        title: head.textContent.replace(/\s+/g, ' ').trim()
      });
    });
    return out;
  }

  /* ---- rendering --------------------------------------------------------- */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function tile(k, v, s, href) {
    var inner = '<span class="ts-k">' + k + '</span>' +
                '<span class="ts-v">' + esc(v) + '</span>' +
                (s ? '<span class="ts-s">' + esc(s) + '</span>' : '');
    return href ? '<a class="ts-tile" href="' + href + '">' + inner + '</a>'
                : '<div class="ts-tile">' + inner + '</div>';
  }

  function untilText(mins) {
    if (mins <= 0) return 'now';
    if (mins < 60) return 'in ' + mins + ' min';
    var h = Math.floor(mins / 60), m = mins % 60;
    return 'in ' + h + 'h' + (m ? ' ' + m + 'm' : '');
  }

  function render(panel, countdown) {
    var now = new Date();
    var today = parkToday(now);
    var mins = parkMinutes(now);

    var idx = -1;
    for (var i = 0; i < DAYS.length; i++) {
      if (DAYS[i].date === today) { idx = i; break; }
    }

    // Before the trip: leave the countdown alone.
    if (today < DAYS[0].date) {
      panel.hidden = true;
      if (countdown) countdown.hidden = false;
      return;
    }

    if (countdown) countdown.hidden = true;
    panel.hidden = false;

    // After the trip.
    if (today > DAYS[DAYS.length - 1].date) {
      panel.className = 'ts ts-done';
      panel.innerHTML =
        '<span class="ts-badge ts-badge-done">The trip is done</span>' +
        '<div class="ts-grid">' +
          tile('Where we went', '5 parks in 5 days',
               'Animal Kingdom · Hollywood Studios · Magic Kingdom · HHN · Epic') +
          tile('On foot', '32,700 steps', 'across the five park days') +
          tile('Home', 'Sat 17 Oct', 'UA 468 · MCO 7:00 AM → IAH 8:38 AM') +
        '</div>';
      return;
    }

    var day = DAYS[idx];
    var stops = stopsFor(day.dayId);
    var timed = stops.filter(function (s) { return s.min !== null; });

    var next = null, after = null, doneCount = 0;
    for (var j = 0; j < timed.length; j++) {
      if (timed[j].min <= mins) { doneCount++; continue; }
      if (!next) next = timed[j];
      else if (!after) { after = timed[j]; break; }
    }

    panel.className = 'ts';
    var head = '<span class="ts-badge"><i></i>Day ' + (idx + 1) + ' of ' +
               DAYS.length + ' · live</span>';

    var tiles = tile('Today', day.label, day.note,
                     day.dayId ? '#' + day.dayId : null);

    if (next) {
      tiles += tile('Next up', next.title,
                    next.raw + ' · ' + untilText(next.min - mins),
                    day.dayId ? '#' + day.dayId : null);
      tiles += after
        ? tile('After that', after.title, after.raw)
        : tile('After that', 'Last timed stop of the day', '—');
    } else if (timed.length) {
      tiles += tile('Next up', 'Nothing left on the clock',
                    'The timed stops for today are done');
    } else {
      tiles += tile('Next up', day.dayId ? 'Check the day below' : 'Travel',
                    day.note);
    }

    if (stops.length) {
      tiles += tile('Progress', doneCount + ' of ' + stops.length + ' stops',
                    'by the clock, not by what you actually did');
    }

    panel.innerHTML = head + '<div class="ts-grid">' + tiles + '</div>';
  }

  /* ---- wire it up -------------------------------------------------------- */

  function init() {
    var bar = document.querySelector('.tc-bar');
    if (!bar) return;
    var countdown = document.getElementById('countdown');
    var panel = document.createElement('div');
    panel.id = 'tripState';
    panel.hidden = true;
    bar.appendChild(panel);

    render(panel, countdown);
    // A minute is fine; nothing here changes faster than that.
    setInterval(function () { render(panel, countdown); }, 60000);

    // Let the page be previewed in any state without waiting for October.
    // ?trip=2026-10-14T15:20 pins the clock for this page load only.
    var q = /[?&]trip=([^&]+)/.exec(location.search);
    if (q) {
      var pinned = decodeURIComponent(q[1]);
      var dm = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(pinned);
      if (dm) {
        parkToday = function () { return dm[1]; };
        parkMinutes = function () {
          return dm[2] ? (+dm[2]) * 60 + (+dm[3]) : 9 * 60;
        };
        render(panel, countdown);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
