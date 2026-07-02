// background.js — Service Worker
// Monitorea la URL del tab activo y si salimos de las historias del usuario objetivo, fuerza el regreso.

let targetUser = null;
let loopActive = false;
let monitoredTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_LOOP') {
    targetUser = msg.username;
    loopActive = true;
    monitoredTabId = sender.tab.id;
    sendResponse({ ok: true });
  }
  if (msg.type === 'STOP_LOOP') {
    loopActive = false;
    targetUser = null;
    monitoredTabId = null;
    sendResponse({ ok: true });
  }
  if (msg.type === 'GET_STATE') {
    sendResponse({ loopActive, targetUser });
  }
  return true;
});

// Detectar cuando la URL cambia en el tab monitoreado
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!loopActive || !targetUser || tabId !== monitoredTabId) return;
  if (changeInfo.status !== 'loading' && changeInfo.url === undefined) return;

  const url = changeInfo.url || tab.url || '';
  if (!url) return;

  const storiesPattern = new RegExp('/stories/' + targetUser + '(/|$)', 'i');
  const isInStories = storiesPattern.test(url);

  // Si estamos en Instagram pero NO en las historias del usuario -> redirigir
  if (url.includes('instagram.com') && !isInStories) {
    // Pequeno delay para que la navegacion de Instagram se estabilice
    setTimeout(() => {
      if (!loopActive) return;
      chrome.tabs.update(tabId, {
        url: 'https://www.instagram.com/stories/' + targetUser + '/'
      });
    }, 800);
  }
});
