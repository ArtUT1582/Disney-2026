/* Persistent backup reminder for the original booking controls. The page must stay open. */
(() => {
  'use strict';
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* Storage can be disabled. */ } }
  };
  const alarmKey = 'garcia-2026-lightning-lane-alarm';
  const alarmAt = Date.parse('2026-10-04T05:59:00-05:00');
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
})();
