// background.js v5 - Redireccion directa via tabs.onUpdated
// Estrategia: cuando Instagram saca al usuario del /stories/, background lo devuelve directo

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'START_LOOP') {
    const tabId = msg.tabId || sender.tab?.id;
    const username = msg.username;
    chrome.storage.local.set({ loopActive: true, targetUser: username, monitoredTabId: tabId });
    if (tabId && username) {
      chrome.tabs.update(tabId, { url: 'https://www.instagram.com/stories/' + username + '/' });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'STOP_LOOP') {
    chrome.storage.local.set({ loopActive: false, targetUser: null, monitoredTabId: null });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GET_STATE') {
    chrome.storage.local.get(['loopActive', 'targetUser'], (data) => {
      sendResponse({ loopActive: !!data.loopActive, targetUser: data.targetUser || '' });
    });
    return true;
  }

  return true;
});

// Vigilar cuando la pagina termina de cargar completamente
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;

    const url = tab.url || '';
    const username = data.targetUser;
    const storyUrl = 'https://www.instagram.com/stories/' + username + '/';

    if (!url.includes('/stories/' + username)) {
      console.log('[BG v5] Fuera de stories. Redirigiendo a:', storyUrl);
      setTimeout(() => {
        chrome.tabs.update(tabId, { url: storyUrl });
      }, 200);
    } else {
      console.log('[BG v5] En stories. Inyectando auto-click...');
      autoClickVerHistoria(tabId);
    }
  });
});

// Vigilar cambios de URL sin recarga completa (SPA navigation de Instagram)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;

    const url = changeInfo.url;
    const username = data.targetUser;
    const storyUrl = 'https://www.instagram.com/stories/' + username + '/';

    if (!url.includes('/stories/' + username)) {
      console.log('[BG v5] URL cambio fuera de stories:', url, '-> redirigiendo');
      setTimeout(() => {
        chrome.tabs.update(tabId, { url: storyUrl });
      }, 200);
    }
  });
});

function autoClickVerHistoria(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      let attempts = 0;
      const iv = setInterval(() => {
        attempts++;
        const btns = document.querySelectorAll('div[role="button"], button');
        for (const btn of btns) {
          const txt = btn.textContent.trim();
          if (/ver historia|watch story|view story|ver como/i.test(txt)) {
            console.log('[BG v5] Auto-click en:', txt);
            btn.click();
            clearInterval(iv);
            return;
          }
        }
        if (attempts > 30) clearInterval(iv);
      }, 200);
    }
  }).catch(e => console.log('[BG v5] autoClick error:', e));
}
