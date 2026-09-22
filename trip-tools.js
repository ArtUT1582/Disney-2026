/* Trip tools — three filters over the itinerary that is already on the page.

     who        twelve people are frequently not together; show one group's day
     height     Annelise is 43", so flag what she cannot do
     autographs tick off the book as she collects them

   All three annotate the existing stops rather than duplicating them, so
   nothing here can drift from the itinerary. Choices persist per device in
   localStorage, wrapped because private mode and blocked site data both throw.
   ponytail: one file, one data table, no framework. */
(function () {
  'use strict';

  /* ---- who is on which stop -------------------------------------------
     Everything is "everyone" unless it is listed here. dayDefault covers a
     whole day; stops overrides individual numbers. */
  var GROUPS = [
    { id: 'all',      label: 'Everyone',      sub: 'all twelve' },
    { id: 'castle3',  label: 'Castle three',  sub: 'Art · Sandra · Annelise' },
    { id: 'nine',     label: 'The other nine', sub: 'everyone else' },
    { id: 'hhn3',     label: 'HHN three',     sub: 'Art · Sandra · Valeria' },
    { id: 'epic8',    label: 'Epic eight',    sub: 'all but John, Martha, Victoria, Valentina' }
  ];

  var WHO = {
    'day-mk': { stops: { 8: ['castle3'], 9: ['nine'], 14: ['castle3'], 15: ['castle3'] } },
    'day-hhn': { dayDefault: ['hhn3'], stops: { 1: ['all'], 2: ['all'], 3: ['all'] } },
    'day-eu': { dayDefault: ['epic8'] }
  };

  /* ---- what Annelise cannot do at 43" ----------------------------------
     Verified against Disney's and Universal's published minimums. "part"
     means the stop bundles something she can do with something she cannot. */
  var HEIGHT = {
    'day-ak': { 10: ['no',   'Flight of Passage is 44" — she is an inch short'],
                12: ['part', 'The trek and Kali River Rapids are fine; Expedition Everest is 44"'] },
    'day-hs': { 12: ['part', 'Tower of Terror at 40" is fine; Rock ’n’ Roller Coaster is 48"'] },
    'day-eu': {  9: ['no',   'Monsters Unchained is 48"'],
                11: ['no',   'Dragon Racer’s Rally is 48"'],
                18: ['no',   'Stardust Racers is 48"'] }
  };

  /* ---- autograph opportunities ----------------------------------------- */
  var SIGNERS = {
    'day-ak':  { 7: ['Mickey', 'Minnie'], 14: ['Dug', 'Russell', 'Kevin'] },
    'day-hs':  { 5: ['Woody', 'Buzz', 'Jessie'] },
    'day-mk':  { 6: ['Tiana', 'Cinderella'], 10: ['Belle'] },
    'day-hhn': { 1: ['Chef Mickey', 'Donald', 'Goofy', 'Pluto'] },
    'day-eu':  { 6: ['Mario', 'Luigi', 'Peach', 'Toad'], 12: ['Toothless'],
                 20: ['Donkey Kong'] }
  };

  /* ---- storage that never throws ---------------------------------------- */
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no-op */ }
    }
  };

  function stopsIn(dayId) {
    var art = document.getElementById(dayId);
    return art ? Array.prototype.slice.call(art.querySelectorAll('li.ed-ev')) : [];
  }
  function numOf(li) {
    var n = li.querySelector('.ed-num');
    return n ? n.textContent.trim() : '';
  }

  /* ---- 1. annotate every stop once -------------------------------------- */
  function annotate() {
    Object.keys(WHO).concat(Object.keys(HEIGHT), Object.keys(SIGNERS))
      .filter(function (v, i, a) { return a.indexOf(v) === i; })
      .forEach(function () {});                       // days are walked below

    ['day-ak', 'day-hs', 'day-mk', 'day-hhn', 'day-eu'].forEach(function (dayId) {
      var who = WHO[dayId] || {};
      var hgt = HEIGHT[dayId] || {};
      var sig = SIGNERS[dayId] || {};
      stopsIn(dayId).forEach(function (li) {
        var n = numOf(li);

        var g = (who.stops && who.stops[n]) || who.dayDefault || ['all'];
        li.dataset.who = g.join(' ');

        var h = hgt[n];
        if (h) {
          li.dataset.height = h[0];
          var flag = document.createElement('span');
          flag.className = 'tt-flag tt-flag-' + h[0];
          flag.innerHTML = '<b>' + (h[0] === 'no' ? 'Annelise cannot ride'
                                                  : 'Annelise: part of this') +
                           '</b><span>' + h[1] + '</span>';
          (li.querySelector('.ed-body') || li).appendChild(flag);
        }

        var s = sig[n];
        if (s) {
          li.dataset.signers = s.join(',');
          var box = document.createElement('span');
          box.className = 'tt-sign';
          box.innerHTML = '<span class="tt-sign-k">Autograph book</span>' +
            s.map(function (name) {
              var key = dayId + ':' + n + ':' + name;
              return '<label class="tt-chip"><input type="checkbox" data-sign="' +
                     key + '"><span>' + name + '</span></label>';
            }).join('');
          (li.querySelector('.ed-body') || li).appendChild(box);
        }
      });
    });
  }

  /* ---- 2. the toolbar ---------------------------------------------------- */
  function toolbar() {
    var bar = document.createElement('div');
    bar.className = 'tt-bar';
    bar.innerHTML =
      '<div class="tt-row tt-who">' +
        '<span class="tt-lab">Show</span>' +
        GROUPS.map(function (g, i) {
          return '<button class="tt-chip-btn" data-group="' + g.id + '"' +
                 (i === 0 ? ' aria-pressed="true"' : ' aria-pressed="false"') +
                 '><b>' + g.label + '</b><i>' + g.sub + '</i></button>';
        }).join('') +
      '</div>' +
      '<div class="tt-row tt-toggles">' +
        '<button class="tt-tog" data-tog="height" aria-pressed="false">' +
          '<span class="tt-dot"></span>What can Annelise ride?</button>' +
        '<button class="tt-tog" data-tog="signs" aria-pressed="false">' +
          '<span class="tt-dot"></span>Autograph book' +
          '<em class="tt-count"></em></button>' +
      '</div>';
    return bar;
  }

  function applyGroup(id) {
    document.querySelectorAll('li.ed-ev[data-who]').forEach(function (li) {
      var mine = id === 'all' || (li.dataset.who || '').split(' ').indexOf(id) !== -1
                 || (li.dataset.who || '') === 'all';
      li.classList.toggle('tt-dim', !mine);
    });
    document.querySelectorAll('.tt-chip-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.group === id));
    });
    store.set('tt.group', id);
  }

  function refreshCount() {
    var boxes = document.querySelectorAll('input[data-sign]');
    var done = document.querySelectorAll('input[data-sign]:checked').length;
    var el = document.querySelector('.tt-count');
    if (el) el.textContent = done + '/' + boxes.length;
  }

  function init() {
    if (!document.getElementById('day-ak')) return;
    annotate();

    var host = document.querySelector('.parks') || document.querySelector('.tcard');
    if (!host || !host.parentNode) return;
    var bar = toolbar();
    host.parentNode.insertBefore(bar, host.nextSibling);

    bar.addEventListener('click', function (e) {
      var g = e.target.closest('.tt-chip-btn');
      if (g) { applyGroup(g.dataset.group); return; }
      var t = e.target.closest('.tt-tog');
      if (t) {
        var on = t.getAttribute('aria-pressed') !== 'true';
        t.setAttribute('aria-pressed', String(on));
        document.body.classList.toggle('tt-show-' + t.dataset.tog, on);
        store.set('tt.' + t.dataset.tog, on);
      }
    });

    // restore previous choices
    applyGroup(store.get('tt.group', 'all'));
    ['height', 'signs'].forEach(function (k) {
      if (store.get('tt.' + k, false)) {
        var btn = bar.querySelector('[data-tog="' + k + '"]');
        if (btn) { btn.setAttribute('aria-pressed', 'true'); }
        document.body.classList.add('tt-show-' + k);
      }
    });

    // autograph ticks
    var ticked = store.get('tt.signed', []);
    document.querySelectorAll('input[data-sign]').forEach(function (box) {
      if (ticked.indexOf(box.dataset.sign) !== -1) box.checked = true;
      box.addEventListener('change', function () {
        var list = store.get('tt.signed', []);
        var i = list.indexOf(box.dataset.sign);
        if (box.checked && i === -1) list.push(box.dataset.sign);
        if (!box.checked && i !== -1) list.splice(i, 1);
        store.set('tt.signed', list);
        box.closest('.tt-chip').classList.toggle('is-got', box.checked);
        refreshCount();
      });
      box.closest('.tt-chip').classList.toggle('is-got', box.checked);
    });
    refreshCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
