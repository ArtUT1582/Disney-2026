/* One day at a time.

   The page was 62,000px on a phone - about 77 screens - because all five park
   days render stacked. Reaching Wednesday meant scrolling past all of Monday
   and Tuesday, roughly 21 screens of it.

   So: show one day, and put a tab bar at the bottom where a thumb already is.
   The top of the page has two sticky bars already, and the bottom is the
   easier reach on a phone anyway.

   The tabs are built from the existing "Five days, five parks" cards rather
   than a second hard-coded list, so the labels can never drift apart. */
(function () {
  'use strict';

  var KEY = 'disney2026.day';
  var TRIP_DAYS = {                 // the date you are standing in -> its chapter
    '2026-10-12': 'day-ak',
    '2026-10-13': 'day-hs',
    '2026-10-14': 'day-mk',
    '2026-10-15': 'day-hhn',
    '2026-10-16': 'day-eu'
  };

  // Long park names do not fit a fifth of a 375px screen. These do.
  var SHORT = {
    'day-ak': 'Animal',
    'day-hs': 'Studios',
    'day-mk': 'Magic',
    'day-hhn': 'HHN',
    'day-eu': 'Epic'
  };

  var days = [].slice.call(document.querySelectorAll('#expedition .ed-day'));
  if (days.length < 2) return;      // nothing to switch between

  function todayLocalISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /* A hash can point at the day itself (#day-mk) or at something buried inside
     it. Either way the right answer is the chapter that contains it. */
  function dayFromHash() {
    var id = (location.hash || '').slice(1);
    if (!id) return null;
    var el = document.getElementById(id);
    if (!el) return null;
    var day = el.closest('.ed-day');
    return day ? day.id : null;
  }

  function remembered() {
    try {
      var v = localStorage.getItem(KEY);
      return document.getElementById(v) ? v : null;
    } catch (e) { return null; }
  }

  function firstChoice() {
    return dayFromHash() ||
           TRIP_DAYS[todayLocalISO()] ||     // during the trip, open on today
           remembered() ||
           days[0].id;
  }

  var bar, tabs = {};

  function show(id, scroll) {
    if (!document.getElementById(id)) id = days[0].id;

    days.forEach(function (d) { d.classList.toggle('is-on', d.id === id); });
    Object.keys(tabs).forEach(function (k) {
      var on = k === id;
      tabs[k].classList.toggle('is-on', on);
      tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
    });

    try { localStorage.setItem(KEY, id); } catch (e) { /* private mode */ }

    if (scroll) {
      var top = document.getElementById(id).getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top - 70), behavior: 'smooth' });
    }
  }

  function buildBar() {
    bar = document.createElement('nav');
    bar.className = 'daybar';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Choose a park day');

    days.forEach(function (day) {
      // Reuse the label already on the matching "five parks" card.
      var card = document.querySelector('.pk-card[href="#' + day.id + '"]');
      var weekday = card ? (card.querySelector('.pk-day') || {}).textContent : '';
      weekday = (weekday || '').trim().split(' ')[0] || day.id;

      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'daybar-tab';
      b.setAttribute('role', 'tab');
      b.innerHTML = '<span class="db-wd"></span><span class="db-pk"></span>';
      b.querySelector('.db-wd').textContent = weekday;
      b.querySelector('.db-pk').textContent = SHORT[day.id] || day.id.replace('day-', '');
      b.addEventListener('click', function () { show(day.id, true); });

      tabs[day.id] = b;
      bar.appendChild(b);
    });

    document.body.appendChild(bar);
    document.body.classList.add('has-daybar');   // pads the page above the bar
  }

  function init() {
    buildBar();
    show(firstChoice(), false);
    // Anchors elsewhere on the page (#day-mk, or a stop inside a day) still work.
    window.addEventListener('hashchange', function () {
      var id = dayFromHash();
      if (id) show(id, true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
