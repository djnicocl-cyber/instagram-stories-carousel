// background.js v7 - Auto-click rapido en dialogo "Ver como djnicocl"
// Inyecta el auto-click APENAS empieza a cargar la pagina de stories

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

// Detectar navegacion apenas EMPIEZA a cargar (status: 'loading')
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;

  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;

    const url = tab.url || changeInfo.url || '';
    if (!url) return;

    const username = data.targetUser;
    const storyUrl = 'https://www.instagram.com/stories/' + username + '/';

    if (url.includes('instagram.com') && !url.includes('/stories/' + username)) {
      console.log('[BG v7] Loading fuera de stories:', url);
      chrome.tabs.update(tabId, { url: storyUrl });
    }
  });
});

// Vigilar cambios de URL sin recarga completa (SPA)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;

    const url = changeInfo.url;
    const username = data.targetUser;
    const storyUrl = 'https://www.instagram.com/stories/' + username + '/';

    if (url.includes('instagram.com') && !url.includes('/stories/' + username)) {
      console.log('[BG v7] URL change fuera de stories:', url);
      chrome.tabs.update(tabId, { url: storyUrl });
    }
  });
});

// Cuando la pagina de stories carga completamente, inyectar auto-click AGRESIVO
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;

    const url = tab.url || '';
    if (!url.includes('/stories/' + data.targetUser)) return;

    // Inyectar auto-click inmediato y agresivo en el dialogo
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        console.log('[BG v7] Iniciando auto-click agresivo...');

        function clickVerHistoria() {
          const btns = document.querySelectorAll('div[role="button"], button, a[role="button"]');
          for (const btn of btns) {
            const txt = btn.textContent.trim();
            if (/ver historia|ver como|watch story|view story|continue as|continue watching/i.test(txt)) {
              console.log('[BG v7] Click en:', txt);
              btn.click();
              return true;
            }
          }
          return false;
        }

        // Intentar inmediatamente
        clickVerHistoria();

        // Luego cada 50ms durante 3 segundos para ser muy rapido
        let count = 0;
        const iv = setInterval(() => {
          count++;
          if (clickVerHistoria() || count > 60) {
            clearInterval(iv);
          }
        }, 50);
      }
    }).catch(() => {});
  });
});
