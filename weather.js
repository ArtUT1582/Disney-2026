/* Weather — fills the trip-week tiles the moment a real forecast exists.

   Nobody has to remember to come back and do this. The page asks Open-Meteo on
   every load; the API only reaches about 16 days ahead, so on 22 Sep it could
   see to 8 Oct and the tiles stayed "pending". As the trip approaches the days
   fill themselves in, left to right.

   Open-Meteo needs no key and sends Access-Control-Allow-Origin: *, which is
   what makes this possible from a page with no server.

   The last good answer is kept in localStorage, so in a park with no signal
   the tiles still show what they showed that morning rather than going blank,
   and they say how old it is. */
(function () {
  'use strict';

  var LAT = 28.42, LON = -81.58;              // Walt Disney World
  var KEY = 'disney2026.weather';
  var TRIP = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14',
              '2026-10-15', '2026-10-16', '2026-10-17'];

  // WMO weather codes -> what to show. Grouped, because "slight rain showers"
  // and "moderate rain showers" call for the same poncho.
  var WMO = [
    [[0],              '☀️', 'Clear'],
    [[1],              '\u{1F324}️', 'Mostly sunny'],
    [[2],              '⛅', 'Partly cloudy'],
    [[3],              '☁️', 'Overcast'],
    [[45, 48],         '\u{1F32B}️', 'Fog'],
    [[51, 53, 55, 56, 57], '\u{1F327}️', 'Drizzle'],
    [[61, 63, 65, 66, 67], '\u{1F327}️', 'Rain'],
    [[80, 81, 82],     '\u{1F326}️', 'Showers'],
    [[95, 96, 99],     '⛈️', 'Thunderstorms']
  ];

  function describe(code) {
    for (var i = 0; i < WMO.length; i++) {
      if (WMO[i][0].indexOf(code) !== -1) return { icon: WMO[i][1], text: WMO[i][2] };
    }
    return { icon: '⛅', text: 'Mixed' };
  }

  var store = {
    get: function () {
      try { return JSON.parse(localStorage.getItem(KEY)) || null; }
      catch (e) { return null; }
    },
    set: function (v) {
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* no-op */ }
    }
  };

  function paint(byDate, asOf, stale) {
    var tiles = document.querySelectorAll('#weather .wb-tile');
    if (!tiles.length) return 0;
    var filled = 0;

    TRIP.forEach(function (date, i) {
      var tile = tiles[i];
      if (!tile) return;
      var d = byDate[date];
      if (!d) return;                          // still beyond the horizon
      var w = describe(d.code);
      tile.querySelector('.wb-icon').textContent = w.icon;
      tile.querySelector('.wb-cond').textContent =
        w.text + (d.rain >= 30 ? ' · ' + d.rain + '%' : '');
      tile.querySelector('.wb-temp').textContent =
        Math.round(d.hi) + '° / ' + Math.round(d.lo) + '°';
      tile.classList.add('wb-live');
      filled++;
    });

    var note = document.querySelector('#weather .wb-note');
    if (note && filled) {
      var when = new Date(asOf);
      var stamp = when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
                  ' ' + when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      note.innerHTML = filled === TRIP.length
        ? 'Live forecast for all seven days, taken ' + stamp +
          (stale ? ' — <b>no connection since</b>' : '') +
          '. Central Florida in October: warm, humid, and afternoon storms that ' +
          'pass. Ponchos beat umbrellas in a queue.'
        : 'Live forecast for the first ' + filled + ' day' + (filled > 1 ? 's' : '') +
          ', taken ' + stamp + '. The rest fill in automatically as the trip gets ' +
          'closer — forecasts only reach about 16 days ahead.';
    }
    return filled;
  }

  function fromCache() {
    var c = store.get();
    if (!c || !c.byDate) return;
    var ageDays = (Date.now() - c.asOf) / 86400000;
    if (ageDays > 14) return;                  // too old to be worth showing
    paint(c.byDate, c.asOf, true);
  }

  function fetchNow() {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + LAT + '&longitude=' + LON +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=16';

    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (j) {
        var d = j && j.daily;
        if (!d || !d.time) return;
        var byDate = {};
        d.time.forEach(function (date, i) {
          if (TRIP.indexOf(date) === -1) return;   // only the trip week
          byDate[date] = {
            code: d.weather_code[i],
            hi: d.temperature_2m_max[i],
            lo: d.temperature_2m_min[i],
            rain: d.precipitation_probability_max[i]
          };
        });
        if (!Object.keys(byDate).length) return;   // trip still beyond the horizon
        var asOf = Date.now();
        store.set({ asOf: asOf, byDate: byDate });
        paint(byDate, asOf, false);
      })
      .catch(function () { /* offline or rate-limited: the cache already painted */ });
  }

  function init() {
    fromCache();      // instant, even with no signal
    fetchNow();       // then refresh if there is a connection
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
