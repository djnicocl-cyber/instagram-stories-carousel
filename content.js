// content.js v11 - Captura el primer ID de historia para bucle perfecto
(function() {
'use strict';

let isMonitoring = false;
let checkInterval = null;
let targetUser = null;
let redirecting = false;
let historyPatched = false;
let firstStoryId = null;

// ---- Interceptar fetch para capturar IDs de historias ----
const origFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await origFetch.apply(this, args);
  try {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    if (url.includes('graphql') || url.includes('reels') || url.includes('stories')) {
      const clone = response.clone();
      clone.json().then(data => {
        const reelsMedia = data?.data?.xdt_api__v1__feed__reels_media?.reels_media;
        if (reelsMedia && reelsMedia.length > 0) {
          const items = reelsMedia[0]?.items;
          if (items && items.length > 0) {
            const newId = String(items[0].pk || items[0].id || '');
            if (newId) firstStoryId = newId;
          }
        }
      }).catch(() => {});
    }
  } catch(e) {}
  return response;
};

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

// ---- Reiniciar al primer ID de historia ----
function doRestart() {
  if (redirecting) return;
  redirecting = true;
  // Guardar firstStoryId antes del reload
  if (firstStoryId) {
    chrome.storage.local.set({ firstStoryId });
  }
  let dest;
  if (firstStoryId && targetUser) {
    dest = 'https://www.instagram.com/stories/' + targetUser + '/' + firstStoryId + '/';
  } else if (targetUser) {
    dest = 'https://www.instagram.com/stories/' + targetUser + '/';
  } else { return; }
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
      const inStories = /\/stories\//i.test(String(url));
      if (!inStories && !redirecting) { doRestart(); return; }
    }
    return _pushState(state, title, url);
  };
  history.replaceState = function(state, title, url) {
    if (isMonitoring && targetUser && url) {
      const inStories = /\/stories\//i.test(String(url));
      if (!inStories && !redirecting) { doRestart(); return; }
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
    // Persistir firstStoryId periodicamente
    if (firstStoryId) {
      chrome.storage.local.set({ firstStoryId });
    }
  }, 500);
}

function stopMonitoring() {
  isMonitoring = false;
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}

// Auto-iniciar
chrome.storage.local.get(['loopActive', 'targetUser', 'firstStoryId'], (data) => {
  if (data.loopActive) {
    targetUser = data.targetUser || null;
    if (data.firstStoryId) firstStoryId = data.firstStoryId;
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
