// content.js v8 - Intercepta history.pushState para bucle instantaneo
(function() {
'use strict';

let isMonitoring = false;
let checkInterval = null;
let targetUser = null;
let redirecting = false;

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
    if (txt === 'Ver historia' || txt === 'Watch story' || txt === 'View story' ||
        txt === 'Ver como' || /^Ver (como|historia)/i.test(txt)) {
      btn.click();
      return true;
    }
  }
  return false;
}

// ---- Interceptar history.pushState para capturar navegacion al instante ----
function patchHistory() {
  const _pushState = history.pushState.bind(history);
  const _replaceState = history.replaceState.bind(history);

  history.pushState = function(state, title, url) {
    if (isMonitoring && targetUser && url) {
      const urlStr = String(url);
      const inStories = /\/stories\//i.test(urlStr);
      if (!inStories && !redirecting) {
        // Instagram intenta salir de historias: interceptar y redirigir
        redirecting = true;
        const dest = 'https://www.instagram.com/stories/' + targetUser + '/';
        setTimeout(() => {
          redirecting = false;
          _pushState(state, title, dest);
          // Forzar carga completa si la URL no cambio realmente
          if (!location.href.includes('/stories/')) {
            location.href = dest;
          }
        }, 100);
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
        setTimeout(() => {
          redirecting = false;
          _replaceState(state, title, dest);
          if (!location.href.includes('/stories/')) {
            location.href = dest;
          }
        }, 100);
        return;
      }
    }
    return _replaceState(state, title, url);
  };
}

// ---- Monitoreo: auto-click + deteccion de salida como fallback ----
function startMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;

  // Parchear history para intercepcion inmediata
  patchHistory();

  checkInterval = setInterval(() => {
    // Auto-click "Ver historia" si aparece
    autoClickVerHistoria();

    // Fallback: si de alguna forma salimos de /stories/, redirigir
    if (targetUser && !location.href.includes('/stories/') && !redirecting) {
      redirecting = true;
      setTimeout(() => {
        redirecting = false;
        location.href = 'https://www.instagram.com/stories/' + targetUser + '/';
      }, 100);
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

// Safety: intentar click a los 800ms del load
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
