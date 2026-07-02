// content.js v6 - Detecta fin de historias y fuerza bucle
(function() {
  'use strict';

  let isMonitoring = false;
  let checkInterval = null;
  let lastUrl = location.href;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_STORIES') {
      sendResponse({ stories: getStoriesList() });
    }
    if (msg.type === 'START_MONITORING') {
      startMonitoring();
      sendResponse({ ok: true });
    }
    if (msg.type === 'STOP_MONITORING') {
      stopMonitoring();
      sendResponse({ ok: true });
    }
    return true;
  });

  function startMonitoring() {
    if (isMonitoring) return;
    isMonitoring = true;
    lastUrl = location.href;
    checkInterval = setInterval(() => {
      if (location.href !== lastUrl) {
        const from = lastUrl;
        lastUrl = location.href;
        const wasInStories = /\/stories\//.test(from);
        const nowInStories = /\/stories\//.test(lastUrl);
        if (wasInStories && !nowInStories) {
          chrome.runtime.sendMessage({ type: 'STORIES_ENDED' });
        }
      }
    }, 500);
  }

  function stopMonitoring() {
    isMonitoring = false;
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  }

  chrome.storage.local.get(['loopActive'], (data) => {
    if (data.loopActive && /\/stories\//.test(location.href)) {
      startMonitoring();
    }
  });

  function getStoriesList() {
    const results = [];
    try {
      const items = document.querySelectorAll('div[role="button"] canvas, button[aria-label] img[alt]');
      items.forEach(el => {
        const img = el.tagName === 'IMG' ? el : el.closest('button, div[role="button"]')?.querySelector('img');
        if (img) results.push({ name: img.alt || '', thumb: img.src || '' });
      });
      if (!results.length) {
        document.querySelectorAll('header img').forEach(img => {
          if (img.src) results.push({ name: img.alt || '', thumb: img.src });
        });
      }
    } catch(e) {}
    return results;
  }
})();
