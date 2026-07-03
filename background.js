// background.js v6 - Redireccion rapida usando status 'loading'
// Intercepta apenas empieza a navegar al home, sin esperar que cargue

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
// Asi redirige antes de que el home aparezca en pantalla
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Reaccionar en 'loading' para mayor velocidad
  if (changeInfo.status !== 'loading') return;

  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;

    const url = tab.url || changeInfo.url || '';
    if (!url) return;

    const username = data.targetUser;
    const storyUrl = 'https://www.instagram.com/stories/' + username + '/';

    // Si navego fuera de /stories/username, redirigir de inmediato
    if (url.includes('instagram.com') && !url.includes('/stories/' + username)) {
      console.log('[BG v6] Loading detectado fuera de stories:', url);
      chrome.tabs.update(tabId, { url: storyUrl });
    }
  });
});

// Tambien vigilar cambios de URL sin recarga (SPA) - complementa el anterior
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;

    const url = changeInfo.url;
    const username = data.targetUser;
    const storyUrl = 'https://www.instagram.com/stories/' + username + '/';

    if (url.includes('instagram.com') && !url.includes('/stories/' + username)) {
      console.log('[BG v6] URL change fuera de stories:', url);
      chrome.tabs.update(tabId, { url: storyUrl });
    }
  });
});

// Cuando llegamos a las stories, auto-click en "Ver historia" si aparece
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;

    const url = tab.url || '';
    if (!url.includes('/stories/' + data.targetUser)) return;

    // Inyectar auto-click para boton "Ver historia"
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
              console.log('[BG v6] Auto-click:', txt);
              btn.click();
              clearInterval(iv);
              return;
            }
          }
          if (attempts > 30) clearInterval(iv);
        }, 200);
      }
    }).catch(() => {});
  });
});
