/* Critical Action Center.
   Lives in its own file so its source never passes through a String.replace()
   replacement argument — "$&" inside one silently corrupted the ICS escaping once. */
(function () {
  var EVENTS = [
    { id: 'bbb', name: 'Bibbidi Bobbidi Boutique', at: '2026-08-11T23:00:00-05:00', utc: '20260812T040000Z',
      how: 'Opens midnight Eastern on your 60-day mark. Magic Kingdom location, not Disney Springs. Be signed in by 10:45 PM CT.' },
    { id: 'crt', name: "Cinderella's Royal Table", at: '2026-08-12T05:00:00-05:00', utc: '20260812T100000Z',
      how: 'Disney dining opens 6:00 AM Eastern. Party of 3, Oct 14 lunch. Card is charged in full. Be signed in by 4:45 AM CT.' },
    { id: 'llmp', name: 'Lightning Lane Multi Pass', at: '2026-10-04T06:00:00-05:00', utc: '20261004T110000Z',
      how: 'Opens 7:00 AM Eastern, 7 days before check-in. Pop Century is a Disney resort, so all 7 days book at once. Alarm 5:59 AM CT.' }
  ];
  var KEY = 'cacDone';

  function done() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function setDone(id, v) {
    var d = done(); d[id] = v;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    render();
    if (window.renderHeroRibbon) window.renderHeroRibbon();
  }
  window.cacToggle = function (id) { setDone(id, !done()[id]); };
  window.cacPending = function () {
    var d = done();
    return EVENTS.filter(function (e) { return !d[e.id] && new Date(e.at).getTime() > Date.now(); })
                 .sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
  };

  /* RFC 5545 escaping. split/join has no special-pattern behaviour, unlike replace(). */
  function icsEsc(s) {
    return String(s).split('\\').join('\\\\')
                    .split(';').join('\\;')
                    .split(',').join('\\,')
                    .split('\n').join('\\n');
  }
  function ics(ev) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Garcia Expedition//Booking//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', 'UID:' + ev.id + '-garcia-2026@artut1582.github.io', 'DTSTAMP:20260810T120000Z',
      'DTSTART:' + ev.utc, 'DURATION:PT30M',
      'SUMMARY:' + icsEsc('BOOK - ' + ev.name),
      'DESCRIPTION:' + icsEsc(ev.how),
      'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY',
      'DESCRIPTION:' + icsEsc('Booking window opens in 15 minutes'), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'];
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
  }
  window.cacIcs = ics;

  function fmt(ms) {
    if (ms <= 0) return 'Window open';
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400),
        h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm';
  }

  function render() {
    var grid = document.getElementById('cacGrid');
    if (!grid) return;
    var dn = done();
    var list = EVENTS.map(function (e) {
      return { e: e, t: new Date(e.at).getTime(), d: !!dn[e.id] };
    }).sort(function (a, b) { return (a.d - b.d) || (a.t - b.t); });

    var firstOpen = -1;
    for (var i = 0; i < list.length; i++) { if (!list[i].d) { firstOpen = i; break; } }

    grid.innerHTML = list.map(function (x, i) {
      var left = x.t - Date.now();
      var cls = x.d ? 'done' : (i === firstOpen ? 'next' : '');
      if (!x.d && left > 0 && left < 24 * 3600000) cls += ' soon';
      var when = new Date(x.t).toLocaleString('en-US', {
        timeZone: 'America/Chicago', weekday: 'short', month: 'short',
        day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
      return '<div class="cac-card ' + cls + '">' +
        '<div class="cac-rank">' + (x.d ? 'Completed' : (i === firstOpen ? 'Up next' : 'Then')) + '</div>' +
        '<h3 class="cac-name">' + x.e.name + '</h3>' +
        '<div class="cac-when">' + when + ' CT</div>' +
        '<div class="cac-cd">' + (x.d ? '✓ Booked' : fmt(left)) + '</div>' +
        '<p class="cac-how">' + x.e.how + '</p>' +
        '<div class="cac-btns">' +
          '<a class="cac-btn" href="' + ics(x.e) + '" download="' + x.e.id + '-booking.ics">' +
            '📅 Add to calendar</a>' +
          '<button class="cac-btn' + (x.d ? ' on' : '') + '" type="button" ' +
            'aria-pressed="' + (x.d ? 'true' : 'false') + '" ' +
            'onclick="cacToggle(\'' + x.e.id + '\')">' + (x.d ? '✓ Booked' : 'Mark booked') + '</button>' +
        '</div></div>';
    }).join('');
  }
  window.cacRender = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  setInterval(function () { render(); if (window.renderHeroRibbon) window.renderHeroRibbon(); }, 30000);
})();
