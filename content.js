// content.js v12 - Usa ArrowLeft para volver al inicio, NO hace hard reload
(function() {
'use strict';

let isMonitoring = false;
let checkInterval = null;
let targetUser = null;
let restarting = false;
let historyPatched = false;
let storyCount = 0;
let allStoryIds = [];
let lastUrl = location.href;

// ---- Capturar IDs de historias por polling de URL ----
function startUrlPolling() {
  setInterval(() => {
    const cur = location.href;
    if (cur !== lastUrl) {
      const m = cur.match(/\/stories\/[^\/]+\/(\d+)\//);
      if (m && !allStoryIds.includes(m[1])) {
        allStoryIds.push(m[1]);
      }
      lastUrl = cur;
    }
  }, 100);
}

// ---- Detectar cuantas historias hay por segmentos del progress bar ----
function detectStoryCount() {
  const segs = [...document.querySelectorAll('div')].filter(d => {
    try {
      const r = d.getBoundingClientRect();
      return r.height > 0 && r.height <= 4 && r.width > 20 && r.top < 90 && r.top > 15;
    } catch(e) { return false; }
  });
  if (segs.length > storyCount) storyCount = segs.length;
  return segs.length;
}

// ---- Volver al inicio presionando ArrowLeft muchas veces ----
function doRestartWithArrowLeft() {
  if (restarting) return;
  restarting = true;

  const total = Math.max(storyCount, allStoryIds.length, 10);
  const stepsBack = total + 3;
  let steps = 0;

  const goBack = setInterval(() => {
    if (steps >= stepsBack) {
      clearInterval(goBack);
      setTimeout(() => { restarting = false; }, 1000);
      return;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37,
      bubbles: true, cancelable: true
    }));
    steps++;
  }, 100);
}

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

// ---- Interceptar history para detectar salida de /stories/ ----
function patchHistory() {
  if (historyPatched) return;
  historyPatched = true;

  const _push = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);

  history.pushState = function(s, t, url) {
    if (isMonitoring && targetUser && url) {
      const inStories = /\/stories\//i.test(String(url));
      if (!inStories && !restarting) {
        doRestartWithArrowLeft();
        return; // cancelar navegacion al home
      }
    }
    return _push(s, t, url);
  };

  history.replaceState = function(s, t, url) {
    if (isMonitoring && targetUser && url) {
      const inStories = /\/stories\//i.test(String(url));
      if (!inStories && !restarting) {
        doRestartWithArrowLeft();
        return;
      }
    }
    return _replace(s, t, url);
  };
}

// ---- Monitoreo activo ----
function startMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;
  patchHistory();
  startUrlPolling();

  checkInterval = setInterval(() => {
    autoClickVerHistoria();
    detectStoryCount();
    if (targetUser && !location.href.includes('/stories/') && !restarting) {
      doRestartWithArrowLeft();
    }
  }, 500);
}

function stopMonitoring() {
  isMonitoring = false;
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}

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

// Auto-iniciar
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
