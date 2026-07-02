// content.js v9 - Intercepta history.pushState para bucle instantaneo sin pasar por home
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
    // Recibir targetUser del background
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

// ---- Interceptar history.pushState/replaceState para capturar navegacion al instante ----
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
        // Instagram intenta ir fuera de historias: redirigir de vuelta
        redirecting = true;
        const dest = 'https://www.instagram.com/stories/' + targetUser + '/';
        _pushState(state, title, dest);
        setTimeout(() => { redirecting = false; }, 500);
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
        redirecting = true;
        const dest = 'https://www.instagram.com/stories/' + targetUser + '/';
        _replaceState(state, title, dest);
        setTimeout(() => { redirecting = false; }, 500);
        return;
      }
    }
    return _replaceState(state, title, url);
  };
}

// ---- Monitoreo: auto-click + fallback de deteccion de salida ----
function startMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;

  // Parchear history para intercepcion inmediata
  patchHistory();

  checkInterval = setInterval(() => {
    // Auto-click "Ver historia" si aparece
    autoClickVerHistoria();

    // Fallback: si de alguna forma salimos de /stories/ sin ser capturado por pushState
    if (targetUser && !location.href.includes('/stories/') && !redirecting) {
      redirecting = true;
      const dest = 'https://www.instagram.com/stories/' + targetUser + '/';
      setTimeout(() => {
        redirecting = false;
        location.href = dest;
      }, 100);
    }
  }, 500);
}

function stopMonitoring() {
  isMonitoring = false;
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}

// Auto-iniciar si el bucle esta activo en storage
chrome.storage.local.get(['loopActive', 'targetUser'], (data) => {
  if (data.loopActive) {
    targetUser = data.targetUser || null;
    startMonitoring();
  }
});

// Safety: intentar click al cargar la pagina
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
