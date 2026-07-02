// content.js v7 - Auto-click "Ver historia" + detecta fin de historias
(function() {
  'use strict';

  let isMonitoring = false;
  let checkInterval = null;
  let lastUrl = location.href;

  // ---- Responder mensajes ----
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

  // ---- Click automatico en "Ver historia" ----
  function autoClickVerHistoria() {
    const btns = document.querySelectorAll('div[role="button"], button');
    for (const btn of btns) {
      const txt = btn.textContent.trim();
      if (txt === 'Ver historia' || txt === 'Watch story' || txt === 'View story') {
        btn.click();
        return true;
      }
    }
    return false;
  }

  // ---- Monitoreo de URL + boton "Ver historia" ----
  function startMonitoring() {
    if (isMonitoring) return;
    isMonitoring = true;
    lastUrl = location.href;

    checkInterval = setInterval(() => {
      // 1) Auto-click "Ver historia" si aparece
      autoClickVerHistoria();

      // 2) Detectar si salimos de las historias
      if (location.href !== lastUrl) {
        const from = lastUrl;
        lastUrl = location.href;
        const wasInStories = /\/stories\//.test(from);
        const nowInStories = /\/stories\//.test(lastUrl);
        if (wasInStories && !nowInStories) {
          chrome.runtime.sendMessage({ type: 'STORIES_ENDED' });
        }
      }
    }, 600);
  }

  function stopMonitoring() {
    isMonitoring = false;
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  }

  // Auto-iniciar si el bucle esta activo
  chrome.storage.local.get(['loopActive'], (data) => {
    if (data.loopActive) {
      startMonitoring();
    }
  });

  // Tambien ejecutar al cargar la pagina por si ya hay un boton visible
  setTimeout(() => {
    chrome.storage.local.get(['loopActive'], (data) => {
      if (data.loopActive) autoClickVerHistoria();
    });
  }, 800);

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
