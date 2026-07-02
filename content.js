// content.js v10 - Hard reload al reiniciar para empezar desde la primera historia
(function() {
'use strict';

let isMonitoring = false;
let checkInterval = null;
let targetUser = null;
let redirecting = false;
let historyPatched = false;

// ---- Responder mensajes ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STORIES') {
    sendResponse({ stories: getStoriesList() });
  }
  if (msg.type === 'START_MONITORING') {
    if (msg.targetUser) targetUser = msg.targetUser;
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
    if (txt === 'Ver historia' || txt === 'Watch story' || txt === 'View story' ||
        /^Ver (como|historia)/i.test(txt)) {
      btn.click();
      return true;
    }
  }
  return false;
}

// ---- Reiniciar con hard reload para cargar historias frescas desde el inicio ----
function doRestart() {
  if (redirecting) return;
  redirecting = true;
  const dest = 'https://www.instagram.com/stories/' + targetUser + '/';
  window.location.href = dest;
}

// ---- Interceptar history.pushState/replaceState ----
function patchHistory() {
  if (historyPatched) return;
  historyPatched = true;

  const _pushState = history.pushState.bind(history);
  const _replaceState = history.replaceState.bind(history);

  history.pushState = function(state, title, url) {
    if (isMonitoring && targetUser && url) {
      const urlStr = String(url);
      const inStories = /\/stories\//i.test(urlStr);
      if (!inStories && !redirecting) {
        doRestart();
        return;
      }
    }
    return _pushState(state, title, url);
  };

  history.replaceState = function(state, title, url) {
    if (isMonitoring && targetUser && url) {
      const urlStr = String(url);
      const inStories = /\/stories\//i.test(urlStr);
      if (!inStories && !redirecting) {
        doRestart();
        return;
      }
    }
    return _replaceState(state, title, url);
  };
}

// ---- Monitoreo activo ----
function startMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;
  patchHistory();

  checkInterval = setInterval(() => {
    autoClickVerHistoria();
    if (targetUser && !location.href.includes('/stories/') && !redirecting) {
      doRestart();
    }
  }, 500);
}

function stopMonitoring() {
  isMonitoring = false;
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}

// Auto-iniciar si el bucle esta activo
chrome.storage.local.get(['loopActive', 'targetUser'], (data) => {
  if (data.loopActive) {
    targetUser = data.targetUser || null;
    startMonitoring();
  }
});

setTimeout(() => {
  chrome.storage.local.get(['loopActive'], (data) => {
    if (data.loopActive) autoClickVerHistoria();
  });
}, 800);

function getStoriesList() {
  const results = [];
  try {
    document.querySelectorAll('button[aria-label] img, div[role="button"] img').forEach(img => {
      if (img.src) results.push({ name: img.alt || '', thumb: img.src });
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
