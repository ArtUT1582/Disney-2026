/* Calendar-first reminders and optional day focus. Nothing here changes a booking. */
(() => {
  'use strict';
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* Storage can be disabled. */ } }
  };
  const alarmKey = 'garcia-2026-lightning-lane-alarm';
  const alarmAt = Date.parse('2026-10-04T05:59:00-05:00');
  if (Date.now() >= alarmAt + 60000) {
    document.querySelector('.next-action .status').textContent = 'Booking window opened October 4';
  }
  const overlay = document.getElementById('alarmOverlay');
  const alarmStatus = document.getElementById('alarmStatus');
  let armed = storage.get(alarmKey) === String(alarmAt);
  let alarmTimer;
  let previousFocus;
  function speak() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance('Your Lightning Lane booking window opens at 7 AM Eastern. Open My Disney Experience.'));
    }
  }
  function startAlarm() {
    if (overlay.classList.contains('active')) return;
    previousFocus = document.activeElement;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.querySelector('button').focus();
    speak();
  }
  window.stopAlarm = () => {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') window.stopAlarm();
    if (event.key === 'Tab') { event.preventDefault(); overlay.querySelector('button').focus(); }
  });
  function checkAlarm() {
    clearTimeout(alarmTimer);
    if (!armed) return;
    const remaining = alarmAt - Date.now();
    if (remaining <= 0) {
      armed = false;
      storage.remove(alarmKey);
      alarmStatus.textContent = 'The October 4 booking window has opened. Check availability in My Disney Experience.';
      // Returning long after the event should show status, not sound an obsolete alarm.
      if (remaining > -15 * 60 * 1000) startAlarm();
      return;
    }
    alarmStatus.textContent = 'Backup armed: Oct 4, 5:59 AM Central / 6:59 AM Eastern. Keep this page open and active; use your calendar as the main reminder.';
    // Short checks avoid the browser timeout limit for a far-future booking date.
    alarmTimer = setTimeout(checkAlarm, Math.min(remaining, 60000));
  }
  document.getElementById('testAlarmBtn').addEventListener('click', startAlarm);
  document.getElementById('scheduleAlarmBtn').addEventListener('click', () => {
    if (Date.now() >= alarmAt) {
      alarmStatus.textContent = 'The October 4 booking window has already opened. Check current availability in the app.';
      return;
    }
    armed = true;
    const saved = storage.set(alarmKey, String(alarmAt));
    checkAlarm();
    if (!saved) alarmStatus.textContent += ' This browser blocks saved reminders; reloading will clear it.';
  });
  document.getElementById('cancelAlarmBtn').addEventListener('click', () => {
    armed = false; clearTimeout(alarmTimer); storage.remove(alarmKey);
    alarmStatus.textContent = 'Webpage alarm cancelled. Calendar reminders must be changed in your calendar app.';
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkAlarm(); });
  if (armed) checkAlarm();
  const toolbar = document.createElement('div');
  toolbar.className = 'park-toolbar';
  const parkLabel = document.createElement('strong');
  const exit = document.createElement('button');
  exit.className = 'trip-button'; exit.type = 'button'; exit.textContent = 'Full trip';
  toolbar.append(parkLabel, exit);
  document.querySelector('.day-nav').after(toolbar);
  let activeDay;
  function leaveParkMode() {
    document.body.classList.remove('park-view');
    activeDay?.classList.remove('park-selected');
    document.querySelectorAll('.park-next').forEach(button => button.remove());
    activeDay = null;
  }
  exit.addEventListener('click', () => {
    const day = activeDay; leaveParkMode(); day?.scrollIntoView(); day?.querySelector('.park-mode').focus({preventScroll:true});
  });
  document.querySelectorAll('.park-mode').forEach(button => button.addEventListener('click', () => {
    leaveParkMode();
    activeDay = document.getElementById(button.dataset.day);
    activeDay.classList.add('park-selected');
    document.body.classList.add('park-view');
    parkLabel.textContent = activeDay.querySelector('h2').textContent + ' · Park mode';
    const stops = [...activeDay.querySelectorAll('.stop-details')];
    stops.forEach((details, index) => {
      details.open = index === 0;
      if (index === stops.length - 1) return;
      const next = document.createElement('button');
      next.type = 'button'; next.className = 'trip-button park-next'; next.textContent = 'Next stop →';
      next.addEventListener('click', () => {
        details.open = false;
        stops[index + 1].open = true;
        stops[index + 1].scrollIntoView({block:'center'});
        stops[index + 1].querySelector('summary').focus({preventScroll:true});
      });
      details.append(next);
    });
    activeDay.querySelector('.expand-day').setAttribute('aria-expanded', 'false');
    activeDay.querySelector('.expand-day').textContent = 'Expand all stops';
    activeDay.scrollIntoView(); exit.focus({preventScroll:true});
  }));
  document.querySelectorAll('.day-nav a').forEach(anchor => anchor.addEventListener('click', () => {
    leaveParkMode();
    document.querySelectorAll('.day-nav a').forEach(link => link.removeAttribute('aria-current'));
    anchor.setAttribute('aria-current', 'location');
  }));
  document.querySelectorAll('.expand-day').forEach(button => button.addEventListener('click', () => {
    const expand = button.getAttribute('aria-expanded') !== 'true';
    button.closest('.ed-day').querySelectorAll('.stop-details').forEach(details => { details.open = expand; });
    button.setAttribute('aria-expanded', String(expand)); button.textContent = expand ? 'Collapse all stops' : 'Expand all stops';
  }));
  let printState;
  function preparePrint() {
    if (printState) return;
    printState = [...document.querySelectorAll('.stop-details')].map(details => [details, details.open]);
    printState.forEach(([details]) => { details.open = true; });
  }
  function finishPrint() {
    printState?.forEach(([details, open]) => { details.open = open; });
    printState = null;
    delete document.body.dataset.printDay;
    document.querySelectorAll('.print-selected').forEach(day => day.classList.remove('print-selected'));
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', finishPrint);
  document.querySelectorAll('.print-day').forEach(button => button.addEventListener('click', () => {
    document.body.dataset.printDay = button.dataset.day;
    document.getElementById(button.dataset.day).classList.add('print-selected');
    preparePrint();
    window.print();
  }));
})();
